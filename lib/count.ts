import { getSql } from "./db";
import { explainGap, type MoveHint } from "./hypothesis";
import { parseCount } from "./parse";
import { listMovements, StockError } from "./stock";

async function declaredBags(lot: string, locationId: string) {
  const db = await getSql();
  const row = await db.get<{ bags: number }>(
    "SELECT bags FROM stock WHERE lot_code = ? AND location_id = ?",
    lot,
    locationId,
  );
  return row?.bags ?? 0;
}

export async function lastVerified(lot: string, locationId: string) {
  const db = await getSql();
  const row = await db.get<{ counted_bags: number }>(
    "SELECT counted_bags FROM counts WHERE lot_code = ? AND location_id = ? ORDER BY id DESC LIMIT 1",
    lot,
    locationId,
  );
  return row ? Number(row.counted_bags) : null;
}

export async function availableForLoad(lot: string, locationId: string) {
  const declared = await declaredBags(lot, locationId);
  const counted = await lastVerified(lot, locationId);
  if (counted === null) return declared;
  return Math.min(declared, counted);
}

export async function recordCountFromText(text: string, catalog: Parameters<typeof parseCount>[1]) {
  const parsed = parseCount(text, catalog);
  if ("error" in parsed) throw new StockError(parsed.error);
  return recordCount({ lot: parsed.lote, locationId: parsed.origen, counted: parsed.bolsas });
}

export async function recordCount(input: { lot: string; locationId: string; counted: number }) {
  const counted = Math.trunc(Number(input.counted));
  if (!Number.isFinite(counted) || counted < 0) {
    throw new StockError("El conteo tiene que ser un número de bolsas (0 o más).");
  }
  const db = await getSql();
  const loc = await db.get<{ name: string }>("SELECT name FROM locations WHERE id = ?", input.locationId);
  if (!loc) throw new StockError("Ubicación desconocida.");
  const lot = await db.get<{ code: string }>("SELECT code FROM lots WHERE code = ?", input.lot);
  if (!lot) throw new StockError(`No existe el lote ${input.lot}.`);

  const declared = await declaredBags(input.lot, input.locationId);
  const moves = (await listMovements(50)) as MoveHint[];
  const explained = explainGap({
    lot: input.lot,
    locationId: input.locationId,
    locationName: loc.name,
    declared,
    counted,
    moves,
  });

  await db.run(
    `INSERT INTO counts (lot_code, location_id, declared_bags, counted_bags, hypothesis, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.lot,
    input.locationId,
    declared,
    counted,
    explained.hypothesis,
    new Date().toISOString(),
  );

  return { ...explained, declared, counted, locationName: loc.name };
}

export async function listCounts(limit = 20) {
  const db = await getSql();
  return db.all(
    `SELECT c.id, c.lot_code, l.variety, c.location_id, loc.name AS location_name,
            c.declared_bags, c.counted_bags, c.hypothesis, c.created_at
     FROM counts c
     JOIN lots l ON l.code = c.lot_code
     JOIN locations loc ON loc.id = c.location_id
     ORDER BY c.id DESC
     LIMIT ?`,
    limit,
  );
}
