import { NextRequest, NextResponse } from "next/server";
import { NodeRequestBody } from "@/schemas/node.schema";


export async function POST(req: NextRequest) {
  const body: NodeRequestBody = await req.json();
  const parsedBody = NodeRequestBody.safeParse(body);
  //   console.log(parsedBody);
  if (!parsedBody.success) {
    return NextResponse.json(parsedBody, { status: 400 });
  }
  return NextResponse.json(parsedBody, { status: 200 });
}
