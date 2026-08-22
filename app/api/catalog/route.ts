import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(getCatalog());
}
