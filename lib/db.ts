import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Seed = {
  locations: { id: string; name: string; kind: LocationKind; sort: number }[];
  aliases: Record<string, string[]>;
  lots: { code: string; variety: string; kg_per_bag: number }[];
  stock: { lot: string; location: string; bags: number }[];
};

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "data", "seed.json"), "utf8"),
) as Seed;

export type LocationKind = "bodega" | "origen" | "externo";

export type Location = {
  id: string;
  name: string;
  kind: LocationKind;
  sort: number;
};

export type Lot = {
  code: string;
  variety: string;
  kg_per_bag: number | null;
};

const DB_PATH =
  process.env.STOCK_DB_PATH || join(process.cwd(), "data", "app.db");

let db: DatabaseSync | null = null;

function schema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      sort INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lots (
      code TEXT PRIMARY KEY,
      variety TEXT NOT NULL,
      kg_per_bag REAL
    );
    CREATE TABLE IF NOT EXISTS aliases (
      alias TEXT PRIMARY KEY,
      location_id TEXT NOT NULL REFERENCES locations(id)
    );
    CREATE TABLE IF NOT EXISTS stock (
      lot_code TEXT NOT NULL REFERENCES lots(code),
      location_id TEXT NOT NULL REFERENCES locations(id),
      bags INTEGER NOT NULL CHECK (bags >= 0),
      PRIMARY KEY (lot_code, location_id)
    );
    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      lot_code TEXT NOT NULL,
      bags INTEGER NOT NULL,
      kg REAL,
      from_id TEXT,
      to_id TEXT,
      remito TEXT,
      notes TEXT,
      raw_text TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function seedIfEmpty(database: DatabaseSync) {
  const n = database.prepare("SELECT COUNT(*) AS c FROM locations").get() as {
    c: number;
  };
  if (n.c > 0) return;

  const insLoc = database.prepare(
    "INSERT INTO locations (id, name, kind, sort) VALUES (?, ?, ?, ?)",
  );
  for (const loc of seed.locations) {
    insLoc.run(loc.id, loc.name, loc.kind, loc.sort);
  }

  const insAlias = database.prepare(
    "INSERT INTO aliases (alias, location_id) VALUES (?, ?)",
  );
  for (const [id, list] of Object.entries(seed.aliases)) {
    for (const a of list) insAlias.run(a.toLowerCase(), id);
  }

  const insLot = database.prepare(
    "INSERT INTO lots (code, variety, kg_per_bag) VALUES (?, ?, ?)",
  );
  for (const lot of seed.lots) {
    insLot.run(lot.code, lot.variety, lot.kg_per_bag);
  }

  const insStock = database.prepare(
    "INSERT INTO stock (lot_code, location_id, bags) VALUES (?, ?, ?)",
  );
  for (const row of seed.stock) {
    insStock.run(row.lot, row.location, row.bags);
  }
}

export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  schema(db);
  seedIfEmpty(db);
  return db;
}

export function closeDb() {
  db?.close();
  db = null;
}

export function bodegas(database = getDb()): Location[] {
  return database
    .prepare(
      "SELECT id, name, kind, sort FROM locations WHERE kind = 'bodega' ORDER BY sort",
    )
    .all() as Location[];
}

export function allLocations(database = getDb()): Location[] {
  return database
    .prepare("SELECT id, name, kind, sort FROM locations ORDER BY sort")
    .all() as Location[];
}

export function allLots(database = getDb()): Lot[] {
  return database
    .prepare("SELECT code, variety, kg_per_bag FROM lots ORDER BY variety, code")
    .all() as Lot[];
}

export function aliasMap(database = getDb()): Record<string, string> {
  const rows = database
    .prepare("SELECT alias, location_id FROM aliases")
    .all() as { alias: string; location_id: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.alias] = r.location_id;
  return map;
}
