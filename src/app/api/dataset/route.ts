import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("node_reports")
      .select("temp,hum,pitch,roll,smoke_analog,smoke_digital,danger,node_id,timestamp")
      .order("inserted_at", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format for easier export to CSV or Edge Impulse
    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
