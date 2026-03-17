import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("nodeId");

  if (!nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  try {
    // 1. Get the latest report for this node
    const nodeLatestRef = db.ref(`nodes/${nodeId}/latest`);
    const snapshot = await nodeLatestRef.get();
    
    if (!snapshot.exists()) {
      console.warn(`⚠️ No data found for Node ${nodeId} to perform inference.`);
      return NextResponse.json({ error: "No data found for inference" }, { status: 404 });
    }

    const sensor = snapshot.val();
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

    // Save prediction to Firebase
    try {
      const predictionsRef = db.ref(`ai_predictions/${nodeId}`);
      await predictionsRef.set({
        timestamp: sensor.timestamp,
        node_id: sensor.node_id,
        prediction,
        confidence,
        inserted_at: new Date().toISOString()
      });
      console.log(`✅ Prediction logged to Firebase for Node ${sensor.node_id}`);
    } catch (err) {
      console.error("❌ Failed to log prediction to database:", err);
    }

    return NextResponse.json({
      prediction,
      confidence,
      node_id: sensor.node_id,
      timestamp: sensor.timestamp
    });

  } catch (err: any) {
    console.error("❌ Unexpected server error in /api/ai:", err.message);
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
