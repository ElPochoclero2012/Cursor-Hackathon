import type { MovementType } from "./stock";

export type Catalog = {
  lots: { code: string; variety: string }[];
  aliases: Record<string, string>;
  locations: { id: string; name: string; kind: string }[];
};

export type ParsedMovement = {
  type: MovementType;
  lote: string;
  variedad?: string;
  bolsas: number;
  origen?: string | null;
  destino?: string | null;
  remito?: string | null;
  confidence: "high" | "low";
  source: "rules";
};

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function resolveLocation(text: string, aliases: Record<string, string>): string | null {
  const f = fold(text);
  const entries = Object.entries(aliases).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, id] of entries) {
    if (f.includes(fold(alias))) return id;
  }
  return null;
}

function findLot(text: string, lots: Catalog["lots"]) {
  const f = fold(text);
  const sorted = [...lots].sort((a, b) => b.code.length - a.code.length);
  for (const lot of sorted) {
    const re = new RegExp(`(?:lote\\s*)?\\b${lot.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(f) || re.test(text)) return lot;
  }
  const m = f.match(/lote\s*([0-9]+[a-z]?)/i);
  if (m) {
    const lot = lots.find((l) => l.code.toLowerCase() === m[1].toLowerCase());
    if (lot) return lot;
  }
  return null;
}

function findBags(text: string): number | null {
  const f = fold(text);
  const m =
    f.match(/(\d+)\s*(bolsas?|bolsones?)/i) ||
    f.match(/(?:pasa|pasi|pase|mover|mové|move|retira|retir[aeá]|entreg[aeá]|ingres[aeá]|sac[aeá])\s+(\d+)/i) ||
    f.match(/\b(\d+)\s+(?:del|de)\b/i);
  if (m) return Number(m[1]);
  return null;
}

function inferType(text: string): MovementType {
  const f = fold(text);
  if (/(retir|entreg|egres|sac[aoe]|salida|cliente)/.test(f)) return "egreso";
  if (/(ingres|recib|entrada|del campo|desde el campo)/.test(f)) return "ingreso";
  return "transferencia";
}

/** ponytail: reglas cubren frases de operario (pasar/retirar N bolsas lote X de A a B); no parsean remitos complejos. Mejorar: más patrones en este archivo, sin API paga. */
export function parseWithRules(text: string, catalog: Catalog): ParsedMovement | { error: string } {
  const lot = findLot(text, catalog.lots);
  const bolsas = findBags(text);
  if (!lot || !bolsas) {
    return {
      error:
        "No pude leer lote y cantidad. Probá: «Pasá 80 bolsas del lote 241 Agata de Dos Pancani al galpón».",
    };
  }

  const type = inferType(text);
  const f = fold(text);

  let origen: string | null = null;
  let destino: string | null = null;

  const deMatch = f.match(/\bde(?:l)?\s+(.+?)(?:\s+al?\s+|\s+hacia\s+|$)/);
  const aMatch = f.match(/\b(?:al?|hacia|para)\s+(.+)$/);

  if (deMatch) origen = resolveLocation(deMatch[1], catalog.aliases);
  if (aMatch) destino = resolveLocation(aMatch[1], catalog.aliases);

  if (!origen) origen = resolveLocation(text, catalog.aliases);

  if (type === "transferencia" && origen && !destino) {
    const ids = new Set(Object.values(catalog.aliases));
    for (const id of ids) {
      if (id === origen) continue;
      const names = Object.entries(catalog.aliases)
        .filter(([, v]) => v === id)
        .map(([k]) => k);
      if (names.some((n) => fold(text).includes(fold(n)))) {
        destino = id;
        break;
      }
    }
  }

  if (type === "ingreso" && !destino) destino = origen;
  if (type === "ingreso" && destino === origen) origen = "campo";

  return {
    type,
    lote: lot.code,
    variedad: lot.variety,
    bolsas,
    origen: type === "ingreso" ? origen ?? "campo" : origen,
    destino: type === "egreso" ? destino ?? "externo" : destino,
    remito: null,
    confidence: origen || destino ? "high" : "low",
    source: "rules",
  };
}

export function parseMovement(text: string, catalog: Catalog) {
  return parseWithRules(text, catalog);
}
