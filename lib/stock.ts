import { getSql, type Sql } from "./db";

export type MovementType = "ingreso" | "transferencia" | "egreso";

export type MovementInput = {
  type: MovementType;
  lotCode: string;
  bags: number;
  fromId?: string | null;
  toId?: string | null;
  remito?: string | null;
  notes?: string | null;
  rawText?: string | null;
};

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

async function locName(sql: Sql, id: string) {
  const row = await sql.get<{ name: string }>("SELECT name FROM locations WHERE id = ?", id);
  return row?.name ?? id;
}

async function lotExists(sql: Sql, code: string) {
  const row = await sql.get<{ code: string }>("SELECT code FROM lots WHERE code = ?", code);
  return Boolean(row);
}

async function bagsAt(sql: Sql, lotCode: string, locationId: string): Promise<number> {
  const row = await sql.get<{ bags: number }>(
    "SELECT bags FROM stock WHERE lot_code = ? AND location_id = ?",
    lotCode,
    locationId,
  );
  return row?.bags ?? 0;
}

async function addBags(sql: Sql, lotCode: string, locationId: string, bags: number) {
  await sql.run(
    `INSERT INTO stock (lot_code, location_id, bags) VALUES (?, ?, ?)
     ON CONFLICT(lot_code, location_id) DO UPDATE SET bags = bags + excluded.bags`,
    lotCode,
    locationId,
    bags,
  );
}

async function removeBags(sql: Sql, lotCode: string, locationId: string, bags: number) {
  const have = await bagsAt(sql, lotCode, locationId);
  if (have < bags) {
    throw new StockError(
      `En ${await locName(sql, locationId)} el lote ${lotCode} tiene ${have} bolsas; pediste ${bags}.`,
    );
  }
  await sql.run(
    "UPDATE stock SET bags = bags - ? WHERE lot_code = ? AND location_id = ?",
    bags,
    lotCode,
    locationId,
  );
}

export async function applyMovement(input: MovementInput) {
  const bags = Math.trunc(Number(input.bags));
  if (!Number.isFinite(bags) || bags <= 0) {
    throw new StockError("La cantidad de bolsas tiene que ser un número mayor a 0.");
  }
  const lotCode = String(input.lotCode).trim();
  const root = await getSql();
  if (!(await lotExists(root, lotCode))) {
    throw new StockError(`No existe el lote ${lotCode} en el catálogo.`);
  }

  const fromId = input.fromId || null;
  const toId = input.toId || null;

  if (input.type === "ingreso" && !toId) {
    throw new StockError("Un ingreso necesita destino.");
  }
  if (input.type === "transferencia" && (!fromId || !toId)) {
    throw new StockError("Una transferencia necesita origen y destino.");
  }
  if (input.type === "transferencia" && fromId === toId) {
    throw new StockError("Origen y destino no pueden ser el mismo.");
  }
  if (input.type === "egreso" && !fromId) {
    throw new StockError("Un egreso necesita origen.");
  }

  await root.withTransaction(async (sql) => {
    if (input.type === "ingreso") {
      await addBags(sql, lotCode, toId!, bags);
    } else if (input.type === "transferencia") {
      await removeBags(sql, lotCode, fromId!, bags);
      await addBags(sql, lotCode, toId!, bags);
    } else {
      await removeBags(sql, lotCode, fromId!, bags);
    }

    const kgRow = await sql.get<{ kg_per_bag: number | null }>(
      "SELECT kg_per_bag FROM lots WHERE code = ?",
      lotCode,
    );
    const kg = kgRow?.kg_per_bag ? kgRow.kg_per_bag * bags : null;

    await sql.run(
      `INSERT INTO movements (type, lot_code, bags, kg, from_id, to_id, remito, notes, raw_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.type,
      lotCode,
      bags,
      kg,
      fromId,
      toId,
      input.remito ?? null,
      input.notes ?? null,
      input.rawText ?? null,
      new Date().toISOString(),
    );
  });
}

export type StockRow = {
  code: string;
  variety: string;
  byLocation: Record<string, number>;
  total: number;
};

export async function listStock(): Promise<{
  locations: { id: string; name: string }[];
  rows: StockRow[];
}> {
  const db = await getSql();
  const locations = await db.all<{ id: string; name: string }>(
    "SELECT id, name FROM locations WHERE kind = 'bodega' ORDER BY sort",
  );
  const lots = await db.all<{ code: string; variety: string }>(
    "SELECT code, variety FROM lots ORDER BY variety, code",
  );
  const balances = await db.all<{ lot_code: string; location_id: string; bags: number }>(
    `SELECT s.lot_code, s.location_id, s.bags
     FROM stock s
     JOIN locations l ON l.id = s.location_id
     WHERE l.kind = 'bodega' AND s.bags > 0`,
  );

  const map = new Map<string, Record<string, number>>();
  for (const b of balances) {
    if (!map.has(b.lot_code)) map.set(b.lot_code, {});
    map.get(b.lot_code)![b.location_id] = Number(b.bags);
  }

  const rows: StockRow[] = lots
    .map((lot) => {
      const byLocation: Record<string, number> = {};
      let total = 0;
      for (const loc of locations) {
        const n = map.get(lot.code)?.[loc.id] ?? 0;
        byLocation[loc.id] = n;
        total += n;
      }
      return { code: lot.code, variety: lot.variety, byLocation, total };
    })
    .filter((r) => r.total > 0);

  return { locations, rows };
}

export async function listMovements(limit = 30) {
  const db = await getSql();
  return db.all(
    `SELECT m.id, m.type, m.lot_code, l.variety, m.bags, m.kg, m.from_id, m.to_id,
            fo.name AS from_name, td.name AS to_name, m.remito, m.notes, m.raw_text, m.created_at
     FROM movements m
     JOIN lots l ON l.code = m.lot_code
     LEFT JOIN locations fo ON fo.id = m.from_id
     LEFT JOIN locations td ON td.id = m.to_id
     ORDER BY m.id DESC
     LIMIT ?`,
    limit,
  );
}
