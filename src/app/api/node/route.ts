import { NextRequest, NextResponse } from "next/server";
import { NodeRequestBody } from "@/schemas/node.schema";
import * as z from "zod";
import { db } from "@/lib/firebaseAdmin";

// Telegram Alert Function
async function sendTelegramAlert(payload: any) {
  const botToken = "8648106308:AAF3iDhuALtQgfbvS2piU6e8rkZxdrGhfcw";
  const chatId = "6907050517";

  if (!botToken || !chatId) {
    console.warn("⚠️ Telegram credentials missing. Skipping alert.");
    return;
  }

  const isTilt = Math.abs(payload.pitch) > 30 || Math.abs(payload.roll) > 30;
  const isSmoke = payload.smoke_analog > 2000 || payload.smoke_digital;
  const isDanger = payload.danger;

  if (!isTilt && !isSmoke && !isDanger) return;

  let message = `🚨 *HAZARD ALERT: Node ${payload.node_id}* 🚨\n\n`;
  
  if (isDanger) message += `🔴 *CRITICAL DANGER DETECTED!*\n`;
  if (isSmoke) message += `💨 *SMOKE/GAS DETECTED:* ${payload.smoke_analog}\n`;
  if (isTilt) message += `📐 *TILT DETECTED:* P:${payload.pitch.toFixed(1)}° R:${payload.roll.toFixed(1)}°\n`;
  
  message += `\n🌡 Temp: ${payload.temp}°C | 💧 Hum: ${payload.hum}%\n`;
  message += `📡 Signal: ${payload.rssi || 'N/A'} dBm\n`;
  message += `\n🔗 [Open Dashboard](https://hazardnode-dashboard.vercel.app)`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
    console.log(`✅ Telegram alert sent for Node ${payload.node_id}`);
  } catch (err) {
    console.error("❌ Failed to send Telegram alert:", err);
  }
}

// Edge Impulse Automatic Ingestion (Throttled to 1 sample per minute)
async function forwardToEdgeImpulse(payload: Record<string, any>) {
  const apiKey = process.env.EDGE_IMPULSE_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ EDGE_IMPULSE_API_KEY is missing in environment variables. Data push skipped.");
    return;
  }

  try {
    // 1. Check throttling in Firebase
    const nodeRef = db.ref(`nodes/${payload.node_id}`);
    const snapshot = await nodeRef.child("last_ei_push").get();
    const lastPush = snapshot.val();
    
    const oneMinuteAgo = Date.now() - 60000;

    if (lastPush && lastPush > oneMinuteAgo) {
      console.log(`⏳ Throttling Edge Impulse push for Node ${payload.node_id} (Last push < 1m ago)`);
      return;
    }

    console.log(`🚀 Attempting to send fresh data to Edge Impulse for Node ${payload.node_id}...`);
    
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
      const errorText = await response.text();
      console.error(`❌ Edge Impulse ingestion failed (Status: ${response.status}):`, errorText);
    } else {
      console.log(`✅ Successfully forwarded Node ${payload.node_id} data to Edge Impulse.`);
      // Update last push time
      await nodeRef.update({ last_ei_push: Date.now() });
    }
  } catch (err) {
    console.error("❌ Critical Edge Impulse Ingestion Error:", err);
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
    type: parsedBody.data.type || "sensor",
    temp: parsedBody.data.temp,
    hum: parsedBody.data.hum,
    pitch: parsedBody.data.pitch,
    roll: parsedBody.data.roll,
    smoke_analog: parsedBody.data.smokeAnalog,
    smoke_digital: parsedBody.data.smokeDigital,
    danger: parsedBody.data.danger,
    rssi: parsedBody.data.rssi || null,
    inserted_at: new Date().toISOString()
  };

  try {
    // 1. Save to historical reports list
    const reportsRef = db.ref("node_reports");
    const newReportRef = reportsRef.push();
    await newReportRef.set(payload);

    // 2. Update latest node state for quick dashboard access
    const nodeStateRef = db.ref(`nodes/${payload.node_id}/latest`);
    await nodeStateRef.set(payload);

    // 3. Send Telegram alert if necessary
    try {
      await sendTelegramAlert(payload);
    } catch (err) {
      console.error("⚠️ Telegram background task error:", err);
    }

    // Automatically push to Edge Impulse if configured
    try {
      await forwardToEdgeImpulse(payload);
    } catch (err) {
      console.error("⚠️ Edge Impulse background task error (non-critical):", err);
    }

    return NextResponse.json({ success: true, id: newReportRef.key }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Unexpected server error in /api/node:", errorMessage);
    return NextResponse.json({ error: "Internal server error", message: errorMessage }, { status: 500 });
  }
}
