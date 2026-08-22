import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { groqEnabled, looksLikeCount, parseCount, parseMovement } from "@/lib/parse";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ groq: groqEnabled() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Escribí o dictá un movimiento." }, { status: 400 });
  }
  const catalog = await getCatalog();
  if (looksLikeCount(text)) {
    const count = parseCount(text, catalog);
    if ("error" in count) return NextResponse.json(count, { status: 422 });
    return NextResponse.json({ kind: "count", ...count });
  }
  const result = await parseMovement(text, catalog);
  if ("error" in result) {
    return NextResponse.json(result, { status: 422 });
  }
  return NextResponse.json({ kind: "move", ...result });
}
