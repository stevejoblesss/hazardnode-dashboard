import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { nodeId, ssid, password } = await req.json();

    if (!nodeId || !ssid || !password) {
      return NextResponse.json({ error: "Missing nodeId, ssid, or password" }, { status: 400 });
    }

    const configRef = db.ref(`configs/${nodeId}/wifi`);
    const currentSnap = await configRef.get();
    
    // Save current config as previous before overwriting
    if (currentSnap.exists()) {
      const currentData = currentSnap.val();
      if (currentData.ssid !== ssid) {
        await db.ref(`configs/${nodeId}/prev_wifi`).set({
          ...currentData,
          archived_at: new Date().toISOString()
        });
      }
    }

    await configRef.set({
      ssid,
      password,
      updated_at: new Date().toISOString()
    });

    console.log(`✅ WiFi config updated for Node ${nodeId}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Failed to update WiFi config:", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("nodeId");

  if (!nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  try {
    const configRef = db.ref(`configs/${nodeId}/wifi`);
    const snapshot = await configRef.get();

    if (!snapshot.exists()) {
      return NextResponse.json({ error: "No config found" }, { status: 404 });
    }

    return NextResponse.json(snapshot.val());
  } catch (err: any) {
    console.error("❌ Failed to fetch WiFi config:", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
