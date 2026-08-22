import { NextResponse } from "next/server";
import { applyMovement, listMovements, StockError, type MovementType } from "@/lib/stock";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(listMovements());
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    type?: MovementType;
    lote?: string;
    bolsas?: number;
    origen?: string | null;
    destino?: string | null;
    remito?: string | null;
    notes?: string | null;
    raw_text?: string | null;
  };

  try {
    applyMovement({
      type: body.type as MovementType,
      lotCode: String(body.lote ?? ""),
      bags: Number(body.bolsas),
      fromId: body.origen,
      toId: body.destino,
      remito: body.remito,
      notes: body.notes,
      rawText: body.raw_text,
    });
    return NextResponse.json({ ok: true, movements: listMovements() });
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
