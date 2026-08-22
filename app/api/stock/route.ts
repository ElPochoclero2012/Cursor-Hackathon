import { NextResponse } from "next/server";
import { listStock } from "@/lib/stock";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await listStock());
}
