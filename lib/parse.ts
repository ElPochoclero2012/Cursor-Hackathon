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
  source: "rules" | "groq";
};

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function resolveLocation(text: string, aliases: Record<string, string>): string | null {
  const f = fold(text);
  const entries = Object.entries(aliases).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, id] of entries) {
    if (f.includes(fold(alias))) return id;
  }
  const tokens = f.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
  let best: { id: string; d: number } | null = null;
  for (const [alias, id] of entries) {
    const al = fold(alias);
    for (const tok of tokens) {
      const d = levenshtein(tok, al);
      if (d <= 2 && d < al.length) {
        if (!best || d < best.d) best = { id, d };
      }
    }
  }
  return best?.id ?? null;
}

const WORDS: Record<string, number> = {
  diez: 10,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
};

/** ponytail: solo lotes de demo frecuentes; Groq cubre el resto. */
const SPOKEN_LOTS: [string, string][] = [
  ["doscientos cuarenta y uno", "241"],
  ["doscientos cuarenta uno", "241"],
  ["doscientos cuarenta", "240"],
  ["doscientos veintiuno", "221"],
  ["doscientos veinticuatro", "224"],
  ["ochocientos diez", "810"],
  ["ochocientos once", "811"],
  ["ochocientos veinte", "820"],
  ["trescientos diez", "310"],
  ["trescientos", "300"],
];

function normalizeSpeech(text: string) {
  let f = fold(text);
  f = f.replace(/\bgal\s*pon\b/g, "galpon");
  f = f.replace(/\bpan\s*cani\b/g, "pancani");
  f = f.replace(/\bce\s*sive\b/g, "cecive");
  f = f.replace(/\bsesi\s*ve\b/g, "cecive");
  f = f.replace(/\bbel\s*monte\b/g, "belmonte");
  for (const [spoken, code] of SPOKEN_LOTS) {
    f = f.replaceAll(spoken, code);
  }
  return f;
}

function findLot(text: string, lots: Catalog["lots"]) {
  const f = normalizeSpeech(text);
  const sorted = [...lots].sort((a, b) => b.code.length - a.code.length);
  for (const lot of sorted) {
    const re = new RegExp(
      `(?:lote\\s*)?\\b${lot.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
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
  const f = normalizeSpeech(text);
  const m =
    f.match(/(\d+)\s*(bolsas?|bolsones?)/i) ||
    f.match(
      /(?:pasa|pasi|pase|manda|lleva|trae|envio|envi[ae]|mover|move|retira|retir[aea]|entreg[aea]|ingres[aea]|sac[aea]|despacha|carga)\s+(\d+)/i,
    ) ||
    f.match(/\bconte(?:o|mos)?\s+(\d+)/i) ||
    f.match(/\bhay\s+(\d+)\b/i);
  if (m) {
    const num = m.slice(1).find((x) => x && /^\d+$/.test(x));
    if (num) return Number(num);
  }
  for (const [w, n] of Object.entries(WORDS)) {
    if (f.includes(w)) return n;
  }
  return null;
}

export function looksLikeCount(text: string) {
  const f = normalizeSpeech(text);
  return /(conteo|conte fisico|contamos|\bconte\b|hay en piso|en el piso hay)/.test(f);
}

export function parseCount(
  text: string,
  catalog: Catalog,
): { lote: string; origen: string; bolsas: number } | { error: string } {
  const lot = findLot(text, catalog.lots);
  const bolsas = findBags(text);
  const origen = resolveLocation(text, catalog.aliases);
  if (!lot || bolsas === null || !origen) {
    return {
      error: "No pude armar el conteo. Probá: «Conté 320 bolsas del lote 241 en Pancani».",
    };
  }
  return { lote: lot.code, origen, bolsas };
}

function inferType(text: string): MovementType {
  const f = normalizeSpeech(text);
  if (/(retir|entreg|egres|sac[aoe]|salida|cliente|despach|orden de carga|cargar el camion|carga a cliente)/.test(f)) {
    return "egreso";
  }
  if (/(ingres|recib|entrada|del campo|desde el campo|de chacra|de santa ana|tolva)/.test(f)) {
    return "ingreso";
  }
  return "transferencia";
}

/** ponytail: reglas + fuzzy de alias (1-2 letras) y números en palabras; Groq cubre el dictado sucio. */
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
  let origen: string | null = null;
  let destino: string | null = null;

  const f = normalizeSpeech(text);
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

export async function parseWithGroq(
  text: string,
  catalog: Catalog,
): Promise<ParsedMovement | { error: string } | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const locList = catalog.locations.map((l) => `${l.id} (${l.name})`).join(", ");
  const lotList = catalog.lots.map((l) => `${l.code} ${l.variety}`).join(", ");
  const aliasList = Object.entries(catalog.aliases)
    .map(([a, id]) => `${a}→${id}`)
    .join(", ");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Interpretá stock de semilla. Puede ser movimiento O conteo físico. Dictado con errores.
Si es conteo (conté, conteo, hay en piso): JSON {"kind":"count","lote":"...","bolsas":n,"origen":"id bodega"}
Si es movimiento: JSON {"kind":"move","type":"ingreso|transferencia|egreso","lote":"...","bolsas":n,"origen":"id o null","destino":"id o null"}
Mandá, llevá, enviá a frío = transferencia. Del campo / tolva = ingreso. Retiro, entrega, orden de carga = egreso.
Ubicaciones: ${locList}
Alias: ${aliasList}
Lotes: ${lotList}
Solo ids y códigos del catálogo.`,
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) return { error: `Groq ${res.status}` };
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return { error: "Groq vacío" };

  let parsed: {
    type?: string;
    lote?: string;
    bolsas?: number;
    origen?: string | null;
    destino?: string | null;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Groq no mandó JSON" };
  }

  const type = parsed.type as MovementType;
  if (!["ingreso", "transferencia", "egreso"].includes(type)) {
    return { error: "Groq: tipo inválido" };
  }
  const lot = catalog.lots.find((l) => l.code === String(parsed.lote).trim());
  const bolsas = Number(parsed.bolsas);
  if (!lot || !bolsas) return { error: "Groq: lote o cantidad" };

  const ids = new Set(catalog.locations.map((l) => l.id));
  const origen = parsed.origen && ids.has(parsed.origen) ? parsed.origen : null;
  const destino = parsed.destino && ids.has(parsed.destino) ? parsed.destino : null;

  return {
    type,
    lote: lot.code,
    variedad: lot.variety,
    bolsas,
    origen,
    destino,
    remito: null,
    confidence: "high",
    source: "groq",
  };
}

export async function parseMovement(text: string, catalog: Catalog) {
  const groq = await parseWithGroq(text, catalog);
  if (groq && !("error" in groq)) return groq;
  return parseWithRules(text, catalog);
}

export function groqEnabled() {
  return Boolean(process.env.GROQ_API_KEY);
}
