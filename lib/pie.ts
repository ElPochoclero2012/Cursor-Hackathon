export type PieMode = "bodega" | "variedad" | "lote";

export type PieStockRow = {
  code: string;
  variety: string;
  byLocation: Record<string, number>;
  total: number;
};

export type PieSlice = { label: string; bags: number };

export const PIE_COLORS = [
  "#ff6b1a",
  "#7cff3a",
  "#12d4e8",
  "#ff2d95",
  "#8b5cff",
  "#ffd400",
  "#ff5c5c",
  "#00c9a7",
];

function add(map: Map<string, number>, key: string, n: number) {
  if (n <= 0) return;
  map.set(key, (map.get(key) ?? 0) + n);
}

function toSlices(map: Map<string, number>): PieSlice[] {
  const slices = [...map.entries()]
    .map(([label, bags]) => ({ label, bags }))
    .sort((a, b) => b.bags - a.bags || a.label.localeCompare(b.label, "es"));
  // ponytail: torta ilegible con 20 lotes; top 7 + Otros. Si hace falta el detalle, la tabla ya está.
  if (slices.length <= 8) return slices;
  const head = slices.slice(0, 7);
  const rest = slices.slice(7).reduce((s, x) => s + x.bags, 0);
  return [...head, { label: "Otros", bags: rest }];
}

export function slicesFromStock(
  rows: PieStockRow[],
  locations: { id: string; name: string }[],
  mode: PieMode,
): PieSlice[] {
  const map = new Map<string, number>();
  if (mode === "bodega") {
    for (const loc of locations) {
      let bags = 0;
      for (const r of rows) bags += r.byLocation[loc.id] ?? 0;
      add(map, loc.name.replace("Frigorífico ", ""), bags);
    }
  } else if (mode === "variedad") {
    for (const r of rows) add(map, r.variety, r.total);
  } else {
    for (const r of rows) add(map, r.code, r.total);
  }
  return toSlices(map);
}

export function pieFill(slices: PieSlice[]): string {
  const total = slices.reduce((s, x) => s + x.bags, 0);
  if (total <= 0) return "var(--line)";
  let at = 0;
  const parts: string[] = [];
  for (let i = 0; i < slices.length; i++) {
    const next = at + (slices[i].bags / total) * 100;
    parts.push(`${PIE_COLORS[i % PIE_COLORS.length]} ${at}% ${next}%`);
    at = next;
  }
  return `conic-gradient(${parts.join(", ")})`;
}
