import { NextResponse } from "next/server";
import { listStock } from "@/lib/stock";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(listStock());
}
