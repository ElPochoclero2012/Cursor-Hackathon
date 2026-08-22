import { getDb } from "./db";

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

function locName(id: string) {
  const row = getDb()
    .prepare("SELECT name FROM locations WHERE id = ?")
    .get(id) as { name: string } | undefined;
  return row?.name ?? id;
}

function lotExists(code: string) {
  return Boolean(
    getDb().prepare("SELECT code FROM lots WHERE code = ?").get(code),
  );
}

function bagsAt(lotCode: string, locationId: string): number {
  const row = getDb()
    .prepare("SELECT bags FROM stock WHERE lot_code = ? AND location_id = ?")
    .get(lotCode, locationId) as { bags: number } | undefined;
  return row?.bags ?? 0;
}

function addBags(lotCode: string, locationId: string, bags: number) {
  getDb()
    .prepare(
      `INSERT INTO stock (lot_code, location_id, bags) VALUES (?, ?, ?)
       ON CONFLICT(lot_code, location_id) DO UPDATE SET bags = bags + excluded.bags`,
    )
    .run(lotCode, locationId, bags);
}

function removeBags(lotCode: string, locationId: string, bags: number) {
  const have = bagsAt(lotCode, locationId);
  if (have < bags) {
    throw new StockError(
      `En ${locName(locationId)} el lote ${lotCode} tiene ${have} bolsas; pediste ${bags}.`,
    );
  }
  getDb()
    .prepare(
      "UPDATE stock SET bags = bags - ? WHERE lot_code = ? AND location_id = ?",
    )
    .run(bags, lotCode, locationId);
}

export function applyMovement(input: MovementInput) {
  const bags = Math.trunc(Number(input.bags));
  if (!Number.isFinite(bags) || bags <= 0) {
    throw new StockError("La cantidad de bolsas tiene que ser un número mayor a 0.");
  }
  const lotCode = String(input.lotCode).trim();
  if (!lotExists(lotCode)) {
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

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (input.type === "ingreso") {
      addBags(lotCode, toId!, bags);
    } else if (input.type === "transferencia") {
      removeBags(lotCode, fromId!, bags);
      addBags(lotCode, toId!, bags);
    } else {
      removeBags(lotCode, fromId!, bags);
    }

    const kgRow = db
      .prepare("SELECT kg_per_bag FROM lots WHERE code = ?")
      .get(lotCode) as { kg_per_bag: number | null };
    const kg = kgRow?.kg_per_bag ? kgRow.kg_per_bag * bags : null;

    db.prepare(
      `INSERT INTO movements (type, lot_code, bags, kg, from_id, to_id, remito, notes, raw_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
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
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export type StockRow = {
  code: string;
  variety: string;
  byLocation: Record<string, number>;
  total: number;
};

export function listStock(): { locations: { id: string; name: string }[]; rows: StockRow[] } {
  const db = getDb();
  const locations = db
    .prepare(
      "SELECT id, name FROM locations WHERE kind = 'bodega' ORDER BY sort",
    )
    .all() as { id: string; name: string }[];

  const lots = db
    .prepare("SELECT code, variety FROM lots ORDER BY variety, code")
    .all() as { code: string; variety: string }[];

  const balances = db
    .prepare(
      `SELECT s.lot_code, s.location_id, s.bags
       FROM stock s
       JOIN locations l ON l.id = s.location_id
       WHERE l.kind = 'bodega' AND s.bags > 0`,
    )
    .all() as { lot_code: string; location_id: string; bags: number }[];

  const map = new Map<string, Record<string, number>>();
  for (const b of balances) {
    if (!map.has(b.lot_code)) map.set(b.lot_code, {});
    map.get(b.lot_code)![b.location_id] = b.bags;
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

export function listMovements(limit = 30) {
  return getDb()
    .prepare(
      `SELECT m.id, m.type, m.lot_code, l.variety, m.bags, m.kg, m.from_id, m.to_id,
              fo.name AS from_name, td.name AS to_name, m.remito, m.notes, m.raw_text, m.created_at
       FROM movements m
       JOIN lots l ON l.code = m.lot_code
       LEFT JOIN locations fo ON fo.id = m.from_id
       LEFT JOIN locations td ON td.id = m.to_id
       ORDER BY m.id DESC
       LIMIT ?`,
    )
    .all(limit);
}
