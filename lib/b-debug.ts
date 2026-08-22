export const FRASES_B = [
  {
    id: "movimiento",
    para: "N01 Interpretar",
    texto: "Pasá 80 bolsas del lote 241 Agata de Dos Pancani al galpón.",
  },
  {
    id: "conteo",
    para: "N02 o POST /api/counts { text }",
    texto: "Conté 320 bolsas del lote 241 en Pancani.",
  },
] as const;

export type BEvent = {
  at: string;
  via: string;
  recibido: unknown;
  resultado: unknown;
};

const MAX = 12;
const events: BEvent[] = [];

export function logB(via: string, recibido: unknown, resultado: unknown) {
  const row: BEvent = {
    at: new Date().toISOString(),
    via,
    recibido,
    resultado,
  };
  events.unshift(row);
  events.splice(MAX);
  console.log("\n[B]", via);
  console.log("[B] recibió:", recibido);
  console.log("[B] resultado:", resultado);
  console.log("");
}

export function lastB() {
  return events;
}
