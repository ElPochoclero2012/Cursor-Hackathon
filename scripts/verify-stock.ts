import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "stock-n01-"));
process.env.STOCK_DB_PATH = join(dir, "test.db");

const { applyMovement, listStock, StockError } = await import("../lib/stock.ts");
const { getDb, closeDb } = await import("../lib/db.ts");
const { parseWithRules } = await import("../lib/parse.ts");
const { getCatalog } = await import("../lib/catalog.ts");

getDb();

applyMovement({
  type: "ingreso",
  lotCode: "241",
  bags: 10,
  fromId: "campo",
  toId: "galpon",
});

applyMovement({
  type: "transferencia",
  lotCode: "241",
  bags: 80,
  fromId: "dospanca",
  toId: "galpon",
});

let blocked = false;
try {
  applyMovement({
    type: "egreso",
    lotCode: "241",
    bags: 600,
    fromId: "dospanca",
    toId: "externo",
  });
} catch (e) {
  blocked = e instanceof StockError;
}
assert.equal(blocked, true, "egreso de 600 debía rechazarse");

const parsed = parseWithRules(
  "Pasá 80 bolsas del lote 241 Agata de Dos Pancani al galpón",
  getCatalog(),
);
assert.ok(!("error" in parsed));
assert.equal(parsed.lote, "241");
assert.equal(parsed.bolsas, 80);
assert.equal(parsed.origen, "dospanca");
assert.equal(parsed.destino, "galpon");
assert.equal(parsed.type, "transferencia");

const stock = listStock();
const row = stock.rows.find((r) => r.code === "241");
assert.ok(row);
assert.equal(row.byLocation.dospanca, 320);
assert.equal(row.byLocation.galpon, 170);

closeDb();
rmSync(dir, { recursive: true, force: true });
console.log("verify-stock: ok");
