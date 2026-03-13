import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("nodeId");

  let query = supabase
    .from("node_reports")
    .select("*")
    .order("inserted_at", { ascending: false })
    .limit(1);

  if (nodeId) {
    query = query.eq("node_id", nodeId);
  }

  const { data, error } = await query;

  if (error || !data?.[0]) {
    return NextResponse.json({ error: "No data found for inference" }, { status: 404 });
  }

  const sensor = data[0];

  // AI Inference Logic
  let prediction = "NORMAL";
  let confidence = 0.8;

  // Rule-based simulation of AI inference
  if (sensor.smoke_analog > 2000 || sensor.smoke_digital) {
    prediction = "SMOKE_ALERT";
    confidence = 0.95;
  }

  if (Math.abs(sensor.pitch) > 30 || Math.abs(sensor.roll) > 30) {
    prediction = "FALL_DETECTED";
    confidence = 0.9;
  }

  // Potential FIRE_RISK logic (High temp + Smoke)
  if (sensor.temp > 45 && sensor.smoke_analog > 1500) {
    prediction = "FIRE_RISK";
    confidence = 0.98;
  }

  // Save prediction to the prediction table
  try {
    await supabase.from("ai_predictions").insert([{
      timestamp: sensor.timestamp,
      node_id: sensor.node_id,
      prediction,
      confidence
    }]);
  } catch (err) {
    console.error("Failed to log prediction to database:", err);
  }

  return NextResponse.json({
    prediction,
    confidence,
    node_id: sensor.node_id,
    timestamp: sensor.timestamp
  });
}
