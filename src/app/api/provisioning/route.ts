import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

/**
 * Provisioning API
 * 
 * This API allows devices (ESP32/ESP8266) to:
 * 1. Register themselves using their unique MAC address.
 * 2. Pull their latest configuration (Node Name, WiFi SSID/Password).
 */

export async function POST(req: NextRequest) {
  try {
    const { mac_address, type, current_config } = await req.json();

    if (!mac_address) {
      return NextResponse.json({ error: "mac_address is required" }, { status: 400 });
    }

    // 1. Check if device exists in registry
    const deviceRef = db.ref(`device_registry/${mac_address}`);
    const snapshot = await deviceRef.get();

    if (!snapshot.exists()) {
      // 2. Register new device if it doesn't exist
      await deviceRef.set({
        mac_address,
        type: type || "sensor",
        registered_at: new Date().toISOString(),
        last_provision_request: new Date().toISOString(),
        status: "pending_setup",
        config: {
          name: `New Device (${mac_address.slice(-5)})`,
          wifi: null // Will be populated via setup or dashboard
        }
      });
      
      return NextResponse.json({ 
        status: "registered", 
        message: "Device registered. Waiting for dashboard configuration." 
      });
    }

    // 3. Update last request time
    await deviceRef.child("last_provision_request").set(new Date().toISOString());
    if (current_config) {
        await deviceRef.child("last_known_config").set(current_config);
    }

    const deviceData = snapshot.val();
    
    // 4. Return the latest configuration for the device to sync
    return NextResponse.json({
      status: "synced",
      config: deviceData.config || {}
    });

  } catch (err: any) {
    console.error("❌ Provisioning failed:", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mac = searchParams.get("mac");

  if (!mac) {
    return NextResponse.json({ error: "mac is required" }, { status: 400 });
  }

  try {
    const deviceRef = db.ref(`device_registry/${mac}`);
    const snapshot = await deviceRef.get();

    if (!snapshot.exists()) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json(snapshot.val());
  } catch (err: any) {
    console.error("❌ Failed to fetch device info:", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
