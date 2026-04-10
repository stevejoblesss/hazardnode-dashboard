import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { nodeId, ssid, password, newNodeId } = await req.json();

    if (!nodeId) {
      return NextResponse.json({ error: "Missing nodeId" }, { status: 400 });
    }

    // Handle Node ID Rename
    if (newNodeId && newNodeId !== nodeId) {
      const nameRef = db.ref(`configs/${nodeId}/name`);
      await nameRef.set(newNodeId);
      
      // Log the rename
      await db.ref("system_logs").push().set({
        node_id: nodeId,
        message: `Node renamed to: ${newNodeId}`,
        timestamp: new Date().toISOString(),
        type: "success"
      });

      console.log(`✅ Node ${nodeId} renamed to ${newNodeId}`);
      return NextResponse.json({ success: true, renamed: true });
    }

    // Handle WiFi Update
    if (!ssid || !password) {
      return NextResponse.json({ error: "Missing ssid or password" }, { status: 400 });
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

    // Log the WiFi update
    await db.ref("system_logs").push().set({
      node_id: nodeId,
      message: `WiFi Config Updated -> SSID: ${ssid}`,
      timestamp: new Date().toISOString(),
      type: "success"
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
