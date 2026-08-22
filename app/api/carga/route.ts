import { NextResponse } from "next/server";
import { availableForLoad } from "@/lib/count";
import { applyMovement, listMovements, StockError } from "@/lib/stock";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    lote?: string;
    origen?: string;
    bolsas?: number;
    raw_text?: string;
  };
  const lot = String(body.lote ?? "");
  const origen = String(body.origen ?? "");
  const bags = Number(body.bolsas);
  try {
    const avail = await availableForLoad(lot, origen);
    if (avail < bags) {
      throw new StockError(
        `No se emite orden de carga: hay ${avail} bolsas verificables del lote ${lot} en origen (pedido ${bags}).`,
      );
    }
    await applyMovement({
      type: "egreso",
      lotCode: lot,
      bags,
      fromId: origen,
      toId: "externo",
      notes: "orden de carga",
      rawText: body.raw_text ?? null,
    });
    return NextResponse.json({ ok: true, movements: await listMovements() });
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
