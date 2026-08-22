import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "./db";
import { availableForLoad } from "./count";
import { StockError } from "./stock";

export type Trace = {
  campo?: string;
  categoria?: string;
  calibre?: string;
  bolsa?: string;
  hilo?: string;
};

export type ProformaFields = {
  today: string;
  buyer: string;
  country: string;
  from: string;
  variety: string;
  lot: string;
  bags: number;
  kg: number | null;
  trace: Trace;
};

const seed = JSON.parse(readFileSync(join(process.cwd(), "data", "seed.json"), "utf8")) as {
  lots: { code: string; variety: string; kg_per_bag: number }[];
  trace?: Record<string, Trace>;
};

export function formatProformaBody(p: ProformaFields) {
  const tr = p.trace;
  const kgLine = p.kg ? `Kilogramos (est.): ${p.kg.toLocaleString("es-AR")}` : "Kilogramos: según pesada";
  return [
    "PROFORMA / DOCUMENTACIÓN DE EXPORTACIÓN",
    "Semilla para siembra",
    "",
    `Fecha: ${p.today}`,
    "",
    "COMPRADOR",
    `  Nombre: ${p.buyer}`,
    `  País / destino: ${p.country}`,
    "",
    "CARGA",
    `  Lugar: ${p.from}`,
    `  Bolsas: ${p.bags}`,
    `  ${kgLine}`,
    "",
    "LOTE",
    `  Variedad: ${p.variety}`,
    `  Código: ${p.lot}`,
    `  Categoría: ${tr.categoria || "semilla"}`,
    `  Calibre: ${tr.calibre || "según planta"}`,
    `  Identificación: bolsa ${tr.bolsa || "s/d"} / hilo ${tr.hilo || "s/d"}`,
    `  Procedencia: ${tr.campo || "Santa Ana"}`,
    "",
    "Campos cruzados con trazabilidad del lote. Completar DTV / SENASA en destino.",
  ].join("\n");
}

export async function buildProforma(input: {
  lot: string;
  locationId: string;
  bags: number;
  buyer?: string;
  destCountry?: string;
}) {
  const bags = Math.trunc(Number(input.bags));
  if (!Number.isFinite(bags) || bags <= 0) {
    throw new StockError("Indicá bolsas a documentar.");
  }

  const avail = await availableForLoad(input.lot, input.locationId);
  if (avail < bags) {
    throw new StockError(
      `No se emite documentación: en origen hay ${avail} bolsas verificables del lote ${input.lot} (pedido ${bags}).`,
    );
  }

  const db = await getSql();
  const lot = await db.get<{ code: string; variety: string; kg_per_bag: number | null }>(
    "SELECT code, variety, kg_per_bag FROM lots WHERE code = ?",
    input.lot,
  );
  if (!lot) throw new StockError(`No existe el lote ${input.lot}.`);
  const loc = await db.get<{ name: string }>("SELECT name FROM locations WHERE id = ?", input.locationId);
  if (!loc) throw new StockError("Ubicación de carga desconocida.");

  const trace = seed.trace?.[input.lot] ?? {};
  const kg = lot.kg_per_bag ? Math.round(lot.kg_per_bag * bags) : null;
  const buyer = (input.buyer || "A confirmar").trim();
  const country = (input.destCountry || "A confirmar").trim();
  const today = new Date().toLocaleDateString("es-AR");
  const fields: ProformaFields = {
    today,
    buyer,
    country,
    from: loc.name,
    variety: lot.variety,
    lot: lot.code,
    bags,
    kg,
    trace,
  };
  const body = formatProformaBody(fields);

  await db.run(
    `INSERT INTO proformas (lot_code, location_id, bags, buyer, dest_country, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.lot,
    input.locationId,
    bags,
    buyer,
    country,
    body,
    new Date().toISOString(),
  );

  return { body, ...fields };
}

export async function listProformas(limit = 10) {
  const db = await getSql();
  return db.all(
    `SELECT id, lot_code, bags, buyer, dest_country, body, created_at
     FROM proformas ORDER BY id DESC LIMIT ?`,
    limit,
  );
}
