import { NextRequest, NextResponse } from "next/server";
import { NodeRequestBody } from "@/schemas/node.schema";
import * as z from "zod";
import supabase from "@/lib/supabaseAdmin";

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
  } as Record<string, unknown>;

  try {
    // Insert into a table named `node_reports`. Create this table in Supabase with matching columns.
    const { data, error } = await supabase.from("node_reports").insert([payload]);
    if (error) {
      console.error(error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
