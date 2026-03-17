import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET() {
  try {
    const reportsRef = db.ref("node_reports");
    // Firebase RTDB limitToLast is the closest to SQL's limit
    const snapshot = await reportsRef.limitToLast(1000).get();

    if (!snapshot.exists()) {
      return NextResponse.json([]);
    }

    const data = snapshot.val();
    const reportsList = Object.keys(data)
      .map(key => ({
        ...data[key],
        id: key
      }))
      .reverse(); // Newest first

    return NextResponse.json(reportsList);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
