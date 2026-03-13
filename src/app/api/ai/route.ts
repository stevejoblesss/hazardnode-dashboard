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

  if (error) {
    console.error("❌ Error querying node_reports for AI inference:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    console.warn(`⚠️ No data found for Node ${nodeId} to perform inference.`);
    return NextResponse.json({ error: "No data found for inference" }, { status: 404 });
  }

  const sensor = data[0];
  console.log(`🧠 Performing AI Inference for Node ${sensor.node_id} (Smoke: ${sensor.smoke_analog}, Temp: ${sensor.temp})`);

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

  console.log(`🎯 Prediction: ${prediction} (${Math.round(confidence * 100)}%)`);

  // Save prediction to the prediction table
  try {
    const { error: insertError } = await supabase.from("ai_predictions").insert([{
      timestamp: sensor.timestamp,
      node_id: sensor.node_id,
      prediction,
      confidence
    }]);
    
    if (insertError) {
      console.error("❌ Error inserting prediction into ai_predictions table:", insertError);
      console.warn("💡 Make sure you created the 'ai_predictions' table in Supabase!");
    } else {
      console.log(`✅ Prediction logged to ai_predictions table for Node ${sensor.node_id}`);
    }
  } catch (err) {
    console.error("❌ Failed to log prediction to database:", err);
  }

  return NextResponse.json({
    prediction,
    confidence,
    node_id: sensor.node_id,
    timestamp: sensor.timestamp
  });
}
