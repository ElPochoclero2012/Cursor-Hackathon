import { NextResponse } from "next/server";
import { logB } from "@/lib/b-debug";
import { getCatalog } from "@/lib/catalog";
import { listCounts, recordCount, recordCountFromText } from "@/lib/count";
import { StockError } from "@/lib/stock";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await listCounts());
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    text?: string;
    lote?: string;
    origen?: string;
    bolsas?: number;
  };
  try {
    const result = body.text?.trim()
      ? await recordCountFromText(body.text.trim(), await getCatalog())
      : await recordCount({
          lot: String(body.lote ?? ""),
          locationId: String(body.origen ?? ""),
          counted: Number(body.bolsas),
        });
    logB("POST /api/counts", body, {
      ok: result.ok,
      lote: body.lote,
      counted: result.counted,
      declared: result.declared,
      hypothesis: result.hypothesis,
    });
    return NextResponse.json({ ...result, counts: await listCounts() });
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
