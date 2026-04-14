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
  const isDanger = payload.danger || payload.edge_ai_class === 2;
  const isWarning = payload.edge_ai_class === 1;

  if (!isTilt && !isSmoke && !isDanger && !isWarning) return;

  let message = `🚨 *HAZARD ALERT: Node ${payload.node_id}* 🚨\n\n`;
  
  if (isDanger) message += `🔴 *CRITICAL DANGER DETECTED!*\n`;
  else if (isWarning) message += `🟠 *WARNING: ABNORMAL ACTIVITY*\n`;

  if (payload.edge_ai_class !== undefined) {
    const labels = ["NORMAL", "WARNING", "HAZARD"];
    message += `🧠 *Edge AI:* ${labels[payload.edge_ai_class]}\n`;
  }
  
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

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("📥 Incoming Telemetry:", JSON.stringify(body));
  
  const parsedBody = NodeRequestBody.safeParse(body);
  const now = Date.now();

  if (!parsedBody.success) {
    const errorDetail = parsedBody.error.format();
    console.error("❌ Validation Failed:", JSON.stringify(errorDetail));
    return NextResponse.json({ 
      error: "Validation failed", 
      details: errorDetail,
      received: body 
    }, { status: 400 });
  }

  const payload = {
    timestamp: parsedBody.data.timestamp ?? now,
    node_id: parsedBody.data.node_id ?? parsedBody.data.nodeID ?? "unknown",
    type: parsedBody.data.type || "sensor",
    temp: parsedBody.data.temp,
    hum: parsedBody.data.hum,
    pitch: parsedBody.data.pitch,
    roll: parsedBody.data.roll,
    smoke_analog: parsedBody.data.smoke_analog ?? parsedBody.data.smokeAnalog ?? 0,
    smoke_digital: parsedBody.data.smoke_digital ?? parsedBody.data.smokeDigital ?? false,
    danger: parsedBody.data.danger,
    rssi: parsedBody.data.rssi || null,
    edge_ai_class: parsedBody.data.edge_ai_class ?? parsedBody.data.edgeAIClass ?? 0,
    inserted_at: new Date().toISOString()
  };

  try {
    // 1. Save to historical reports list
    const reportsRef = db.ref("node_reports");
    const newReportRef = reportsRef.push();
    await newReportRef.set(payload);

    // 2. Add to System Logs (Serial Monitor)
    const logsRef = db.ref("system_logs");
    const newLogRef = logsRef.push();
    await newLogRef.set({
      node_id: payload.node_id,
      message: `Telemetry received: T:${payload.temp}°C H:${payload.hum}% R:${payload.rssi || '?' }`,
      timestamp: payload.inserted_at,
      type: payload.danger ? "error" : payload.edge_ai_class > 0 ? "warn" : "info"
    });

    // 3. Update the node's individual state for the dashboard summary
    const nodeRef = db.ref(`nodes/${payload.node_id}`);
    await nodeRef.update({
      latest: payload,
      last_seen: payload.timestamp,
    });

    // 4. Send Telegram alert if necessary
    try {
      await sendTelegramAlert(payload);
    } catch (err) {
      console.error("⚠️ Telegram background task error:", err);
    }

    return NextResponse.json({ success: true, id: newReportRef.key }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Unexpected server error in /api/node:", errorMessage);
    return NextResponse.json({ error: "Internal server error", message: errorMessage }, { status: 500 });
  }
}
