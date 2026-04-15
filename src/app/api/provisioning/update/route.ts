import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { mac_address, config } = await req.json();

    if (!mac_address || !config) {
      return NextResponse.json({ error: "mac_address and config are required" }, { status: 400 });
    }

    const deviceRef = db.ref(`device_registry/${mac_address}/config`);
    await deviceRef.update(config);

    // Also update system logs
    await db.ref("system_logs").push().set({
      node_id: mac_address,
      message: `Device configuration updated: ${JSON.stringify(config)}`,
      timestamp: new Date().toISOString(),
      type: "success"
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Update failed:", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
