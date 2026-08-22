import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClient, type Client } from "@libsql/client";

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

export type SqlArg = string | number | bigint | null;

export type Sql = {
  exec(text: string): Promise<void>;
  get<T>(text: string, ...args: SqlArg[]): Promise<T | undefined>;
  all<T>(text: string, ...args: SqlArg[]): Promise<T[]>;
  run(text: string, ...args: SqlArg[]): Promise<void>;
  withTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
};

const SCHEMA = `
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
    CREATE TABLE IF NOT EXISTS counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_code TEXT NOT NULL,
      location_id TEXT NOT NULL,
      declared_bags INTEGER NOT NULL,
      counted_bags INTEGER NOT NULL,
      hypothesis TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proformas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_code TEXT NOT NULL,
      location_id TEXT NOT NULL,
      bags INTEGER NOT NULL,
      buyer TEXT,
      dest_country TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
`;

const DB_PATH =
  process.env.STOCK_DB_PATH || join(process.cwd(), "data", "app.db");

let sqlPromise: Promise<Sql> | null = null;
let sqlite: DatabaseSync | null = null;

function sqliteAdapter(database: DatabaseSync): Sql {
  const wrap = (db: DatabaseSync): Sql => ({
    async exec(text) {
      db.exec(text);
    },
    async get(text, ...args) {
      return db.prepare(text).get(...args) as never;
    },
    async all(text, ...args) {
      return db.prepare(text).all(...args) as never;
    },
    async run(text, ...args) {
      db.prepare(text).run(...args);
    },
    async withTransaction(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(wrap(db));
        db.exec("COMMIT");
        return result;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  });
  return wrap(database);
}

function tursoAdapter(client: Client): Sql {
  const runOn = (c: Pick<Client, "execute">): Sql => ({
    async exec(text) {
      for (const part of text.split(";").map((s) => s.trim()).filter(Boolean)) {
        await c.execute(part);
      }
    },
    async get(text, ...args) {
      const rs = await c.execute({ sql: text, args });
      return rs.rows[0] as never;
    },
    async all(text, ...args) {
      const rs = await c.execute({ sql: text, args });
      return rs.rows as never;
    },
    async run(text, ...args) {
      await c.execute({ sql: text, args });
    },
    async withTransaction(fn) {
      const tx = await client.transaction("write");
      try {
        const result = await fn(runOn(tx));
        await tx.commit();
        return result;
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    },
  });
  return runOn(client);
}

async function seedIfEmpty(sql: Sql) {
  const n = await sql.get<{ c: number }>("SELECT COUNT(*) AS c FROM locations");
  if (Number(n?.c ?? 0) > 0) return;

  for (const loc of seed.locations) {
    await sql.run(
      "INSERT INTO locations (id, name, kind, sort) VALUES (?, ?, ?, ?)",
      loc.id,
      loc.name,
      loc.kind,
      loc.sort,
    );
  }
  for (const [id, list] of Object.entries(seed.aliases)) {
    for (const a of list) {
      await sql.run("INSERT INTO aliases (alias, location_id) VALUES (?, ?)", a.toLowerCase(), id);
    }
  }
  for (const lot of seed.lots) {
    await sql.run(
      "INSERT INTO lots (code, variety, kg_per_bag) VALUES (?, ?, ?)",
      lot.code,
      lot.variety,
      lot.kg_per_bag,
    );
  }
  for (const row of seed.stock) {
    await sql.run(
      "INSERT INTO stock (lot_code, location_id, bags) VALUES (?, ?, ?)",
      row.lot,
      row.location,
      row.bags,
    );
  }
}

async function openSql(): Promise<Sql> {
  const url = process.env.TURSO_DATABASE_URL;
  let sql: Sql;
  if (url) {
    sql = tursoAdapter(
      createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }),
    );
  } else if (process.env.VERCEL) {
    throw new Error(
      "En Vercel hace falta TURSO_DATABASE_URL (SQLite gratis). Ver docs/DEPLOY.md",
    );
  } else {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    sqlite = new DatabaseSync(DB_PATH);
    sql = sqliteAdapter(sqlite);
  }
  await sql.exec(SCHEMA);
  await seedIfEmpty(sql);
  return sql;
}

export function getSql(): Promise<Sql> {
  if (!sqlPromise) sqlPromise = openSql();
  return sqlPromise;
}

export function closeDb() {
  sqlite?.close();
  sqlite = null;
  sqlPromise = null;
}

export async function bodegas(sql?: Sql): Promise<Location[]> {
  const db = sql ?? (await getSql());
  return db.all("SELECT id, name, kind, sort FROM locations WHERE kind = 'bodega' ORDER BY sort");
}

export async function allLocations(sql?: Sql): Promise<Location[]> {
  const db = sql ?? (await getSql());
  return db.all("SELECT id, name, kind, sort FROM locations ORDER BY sort");
}

export async function allLots(sql?: Sql): Promise<Lot[]> {
  const db = sql ?? (await getSql());
  return db.all("SELECT code, variety, kg_per_bag FROM lots ORDER BY variety, code");
}

export async function aliasMap(sql?: Sql): Promise<Record<string, string>> {
  const db = sql ?? (await getSql());
  const rows = await db.all<{ alias: string; location_id: string }>(
    "SELECT alias, location_id FROM aliases",
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.alias] = r.location_id;
  return map;
}
