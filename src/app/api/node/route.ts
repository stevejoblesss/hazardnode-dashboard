import { NextRequest, NextResponse } from "next/server";
import { NodeRequestBody } from "@/schemas/node.schema";
import * as z from "zod";
import supabase from "@/lib/supabaseAdmin";

// Edge Impulse Automatic Ingestion (Throttled to 1 sample per minute)
async function forwardToEdgeImpulse(payload: Record<string, unknown>) {
  const apiKey = process.env.EDGE_IMPULSE_API_KEY;
  if (!apiKey) return;

  try {
    // 1. Check if we've sent data for this node in the last 60 seconds
    // to prevent overwhelming (DDOSing) Edge Impulse
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    
    const { data: recentReports } = await supabase
      .from("node_reports")
      .select("inserted_at")
      .eq("node_id", payload.node_id)
      .gt("inserted_at", oneMinuteAgo)
      .order("inserted_at", { ascending: false })
      .limit(2); // We check for 2 because the current report was just inserted

    // If there is more than 1 report in the last minute (including the current one),
    // skip the push to Edge Impulse.
    if (recentReports && recentReports.length > 1) {
      console.log(`⏳ Throttling Edge Impulse push for Node ${payload.node_id} (Last push < 1m ago)`);
      return;
    }

    console.log(`🚀 Sending fresh data to Edge Impulse for Node ${payload.node_id}`);
    
    await fetch("https://ingestion.edgeimpulse.com/api/training/data", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "x-file-name": `node_${payload.node_id}_${Date.now()}.json`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        protected: { ver: "v1", alg: "HS256" },
        signature: "empty",
        payload: {
          device_name: `node_${payload.node_id}`,
          device_type: "esp32",
          interval_ms: 0,
          sensors: [
            { name: "temp", units: "C" },
            { name: "hum", units: "%" },
            { name: "pitch", units: "deg" },
            { name: "roll", units: "deg" },
            { name: "smoke", units: "analog" },
          ],
          values: [[payload.temp, payload.hum, payload.pitch, payload.roll, payload.smoke_analog]],
        },
      }),
    });
  } catch (err) {
    console.error("Edge Impulse Ingestion Error:", err);
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
    console.log("📥 Received report:", JSON.stringify(body, null, 2));
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = NodeRequestBody.safeParse(body);
  const now = Date.now();

  if (!parsedBody.success) {
    const { error, ...rest } = parsedBody;
    return NextResponse.json({ error: z.flattenError(error), ...rest }, { status: 400 });
  }

  const payload = {
    timestamp: parsedBody.data.timestamp ?? now,
    node_id: parsedBody.data.nodeID,
    temp: parsedBody.data.temp,
    hum: parsedBody.data.hum,
    pitch: parsedBody.data.pitch,
    roll: parsedBody.data.roll,
    smoke_analog: parsedBody.data.smokeAnalog,
    smoke_digital: parsedBody.data.smokeDigital,
    danger: parsedBody.data.danger,
  };

  try {
    const { data, error } = await supabase.from("node_reports").insert([payload]);
    if (error) {
      console.error("Error inserting into node_reports table:", error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Automatically push to Edge Impulse if configured
    try {
      await forwardToEdgeImpulse(payload);
    } catch (err) {
      console.error("Error forwarding to Edge Impulse:", err);
   }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
