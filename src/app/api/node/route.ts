import { NextRequest, NextResponse } from "next/server";
import { NodeRequestBody } from "@/schemas/node.schema";
import * as z from "zod";
import supabase from "@/lib/supabaseAdmin";

// Edge Impulse Ingestion helper
async function forwardToEdgeImpulse(payload: Record<string, unknown>) {
  const apiKey = process.env.EDGE_IMPULSE_API_KEY;
  if (!apiKey) return;

  try {
    const response = await fetch("https://ingestion.edgeimpulse.com/api/training/data", {
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
    if (!response.ok) {
      console.warn("⚠️ Edge Impulse ingestion failed:", await response.text());
    } else {
      console.log("🚀 Data forwarded to Edge Impulse");
    }
  } catch (err) {
    console.error("❌ Error forwarding to Edge Impulse:", err);
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
    // Edge Impulse AI Features
    ai_label: parsedBody.data.aiLabel,
    ai_confidence: parsedBody.data.aiConfidence,
    ai_anomaly: parsedBody.data.aiAnomaly,
  } as Record<string, unknown>;

  try {
    // Insert into a table named `node_reports`. Create this table in Supabase with matching columns.
    const { data, error } = await supabase.from("node_reports").insert([payload]);
    if (error) {
      console.error(error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optional: Forward data to Edge Impulse for training
    // This will only run if EDGE_IMPULSE_API_KEY is defined in environment variables
    forwardToEdgeImpulse(payload);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
