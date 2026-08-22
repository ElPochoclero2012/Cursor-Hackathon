import { NextResponse } from "next/server";
import { buildProforma, listProformas } from "@/lib/proforma";
import { StockError } from "@/lib/stock";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await listProformas());
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    lote?: string;
    origen?: string;
    bolsas?: number;
    buyer?: string;
    dest_country?: string;
  };
  try {
    const doc = await buildProforma({
      lot: String(body.lote ?? ""),
      locationId: String(body.origen ?? ""),
      bags: Number(body.bolsas),
      buyer: body.buyer,
      destCountry: body.dest_country,
    });
    return NextResponse.json({ ok: true, ...doc, list: await listProformas() });
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
