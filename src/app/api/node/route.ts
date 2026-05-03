import { NextRequest, NextResponse } from "next/server";
import { NodeRequestBody } from "@/schemas/node.schema";
import * as z from "zod";
import { db } from "@/lib/firebaseAdmin";

// Telegram Alert Function
async function sendTelegramAlert(payload: any) {
  const botToken = "8648106308:AAF3iDhuALtQgfbvS2piU6e8rkZxdrGhfcw";
  const chatId = "6907050517";

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

// Feishu (Lark) Alert Function - China Accessible
async function sendFeishuAlert(payload: any) {
  // Use the working URL provided by the user
  const larkWebhook = "https://open.larksuite.com/open-apis/bot/v2/hook/d72aacd1-0878-42a7-9eb1-c4f6f41bc22b";
  
  const isTilt = Math.abs(payload.pitch || 0) > 30 || Math.abs(payload.roll || 0) > 30;
  const isSmoke = (payload.smoke_analog || 0) > 2000 || !!payload.smoke_digital;
  const isDanger = !!payload.danger || payload.edge_ai_class === 2;
  const isWarning = payload.edge_ai_class === 1;
  const isTest = payload.is_test === true;

  if (!isTilt && !isSmoke && !isDanger && !isWarning && !isTest) return;

  let text = `🚨 危险警报: 节点 ${payload.node_id} 🚨\n`;
  if (isTest) text = `🧪 测试警报: HazardNode 机器人运行正常! 🚀\n`;
  else if (isDanger) text += `🔴 检测到严重危险!\n`;
  else if (isWarning) text += `🟠 警告: 异常活动\n`;

  text += `\n🌡 温度: ${payload.temp ?? 'N/A'}°C | 💧 湿度: ${payload.hum ?? 'N/A'}%\n`;
  text += `💨 烟雾浓度: ${payload.smoke_analog ?? 'N/A'}\n`;
  text += `📐 倾斜角度: P:${(payload.pitch || 0).toFixed(1)}° R:${(payload.roll || 0).toFixed(1)}°\n`;
  text += `\n🔗 查看信息显示板: https://hazardnode-dashboard.vercel.app`;

  try {
    const response = await fetch(larkWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: {
          text: text
        }
      }),
    });
    const result = await response.json();
    if (result.code !== 0) {
      console.error(`❌ Feishu API Error (${result.code}):`, result.msg);
    } else {
      console.log(`✅ Feishu alert sent successfully for Node ${payload.node_id}`);
    }
  } catch (err) {
    console.error("❌ Failed to send Feishu alert:", err);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("📥 Incoming Telemetry (Raw):", JSON.stringify(body));
  
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

  const mac_address = parsedBody.data.mac_address || null;
  const type = parsedBody.data.type || "sensor";
  
  // Construct payload based on node type
  const payload: any = {
    timestamp: parsedBody.data.timestamp ?? now,
    node_id: parsedBody.data.node_id ?? parsedBody.data.nodeID ?? "unknown",
    mac_address: mac_address,
    type: type,
    is_test: parsedBody.data.is_test || false,
    inserted_at: new Date().toISOString()
  };

  // 1. Try to fetch additional info from device registry if MAC exists
  if (mac_address) {
    try {
      const registryRef = db.ref(`device_registry/${mac_address}`);
      const snap = await registryRef.get();
      if (snap.exists()) {
        const regData = snap.val();
        // Override type if registry has one
        if (regData.type) payload.type = regData.type;
        // Include the custom name in the payload so it's always available
        if (regData.config?.name) payload.custom_name = regData.config.name;
      } else {
        // Automatically register the device if it's new
        await registryRef.set({
          mac_address,
          type: payload.type || "sensor",
          registered_at: new Date().toISOString(),
          last_provision_request: new Date().toISOString(),
          status: "auto_registered",
          config: {
            name: `New Device (${mac_address.slice(-5)})`,
            wifi: null
          }
        });
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch/auto-register registry info for ${mac_address}:`, err);
    }
  }

  if (payload.type === "receiver") {
    // Receivers ONLY send RSSI - no sensor data to avoid "0" values in telemetry
    payload.rssi = parsedBody.data.rssi || null;
    // We explicitly omit or set sensor fields to null
    payload.temp = null;
    payload.hum = null;
    payload.pitch = 0;
    payload.roll = 0;
    payload.smoke_analog = 0;
    payload.smoke_digital = false;
    payload.danger = false;
    payload.edge_ai_class = 0;
  } else if (type === "sender") {
    // Senders send sensor data but NO RSSI (per user request)
    payload.temp = parsedBody.data.temp;
    payload.hum = parsedBody.data.hum;
    payload.pitch = parsedBody.data.pitch;
    payload.roll = parsedBody.data.roll;
    payload.smoke_analog = parsedBody.data.smoke_analog ?? parsedBody.data.smokeAnalog ?? 0;
    payload.smoke_digital = parsedBody.data.smoke_digital ?? parsedBody.data.smokeDigital ?? false;
    payload.danger = parsedBody.data.danger;
    payload.edge_ai_class = parsedBody.data.edge_ai_class ?? parsedBody.data.edgeAIClass ?? 0;
    payload.rssi = null; 
  } else {
    // Standard sensor nodes have everything
    payload.temp = parsedBody.data.temp;
    payload.hum = parsedBody.data.hum;
    payload.pitch = parsedBody.data.pitch;
    payload.roll = parsedBody.data.roll;
    payload.smoke_analog = parsedBody.data.smoke_analog ?? parsedBody.data.smokeAnalog ?? 0;
    payload.smoke_digital = parsedBody.data.smoke_digital ?? parsedBody.data.smokeDigital ?? false;
    payload.danger = parsedBody.data.danger;
    payload.rssi = parsedBody.data.rssi || null;
    payload.edge_ai_class = parsedBody.data.edge_ai_class ?? parsedBody.data.edgeAIClass ?? 0;
  }

  try {
    // 1. Save to historical reports list
    const reportsRef = db.ref("node_reports");
    const newReportRef = reportsRef.push();
    await newReportRef.set(payload);

    // 2. Add to System Logs (Serial Monitor)
    const logsRef = db.ref("system_logs");
    const newLogRef = logsRef.push();
    const logMessage = type === "receiver" 
      ? `Gateway signal check: RSSI ${payload.rssi || '?' } dBm`
      : `Telemetry received: ${payload.temp !== null ? `T:${payload.temp}°C H:${payload.hum}%` : "No telemetry data"}${payload.rssi !== null ? ` R:${payload.rssi}` : ""}`;
    
    await newLogRef.set({
      node_id: payload.node_id,
      message: logMessage,
      timestamp: payload.inserted_at,
      type: payload.danger ? "error" : payload.edge_ai_class > 0 ? "warn" : "info"
    });

    // 3. Update the node's individual state for the dashboard summary
    // Use MAC address as the key if available for better stability
    const nodeRef = db.ref(`nodes/${payload.mac_address || payload.node_id}`);
    await nodeRef.update({
      latest: payload,
      last_seen: payload.timestamp,
    });

    // 4. Send Alerts
    try {
      await sendTelegramAlert(payload);
      await sendFeishuAlert(payload);
    } catch (err) {
      console.error("⚠️ Alert background task error:", err);
    }

    return NextResponse.json({ success: true, id: newReportRef.key }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Unexpected server error in /api/node:", errorMessage);
    return NextResponse.json({ error: "Internal server error", message: errorMessage }, { status: 500 });
  }
}
