import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { parseMovement } from "@/lib/parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Escribí o dictá un movimiento." }, { status: 400 });
  }
  const result = parseMovement(text, getCatalog());
  if ("error" in result) {
    return NextResponse.json(result, { status: 422 });
  }
  return NextResponse.json(result);
}
