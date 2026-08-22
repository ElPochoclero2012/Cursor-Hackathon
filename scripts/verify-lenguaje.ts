import assert from "node:assert/strict";
import { FRASES_B } from "../lib/b-debug.ts";
import { explainGap } from "../lib/hypothesis.ts";
import { parseCount, parseWithRules, looksLikeCount } from "../lib/parse.ts";

const catalog = {
  locations: [
    { id: "dospanca", name: "Frigorífico Dos Pancani", kind: "bodega" },
    { id: "galpon", name: "Galpón", kind: "bodega" },
    { id: "belmonte", name: "Frigorífico Belmonte", kind: "bodega" },
    { id: "campo", name: "Campo", kind: "origen" },
  ],
  lots: [
    { code: "241", variety: "Agata" },
    { code: "700", variety: "7 Four 7" },
    { code: "810", variety: "Asterix" },
  ],
  aliases: {
    "dos pancani": "dospanca",
    pancani: "dospanca",
    dospanca: "dospanca",
    galpon: "galpon",
    "el galpon": "galpon",
    belmonte: "belmonte",
  },
};

const move = parseWithRules(FRASES_B[0].texto, catalog);
assert.ok(!("error" in move));
assert.equal(move.lote, "241");
assert.equal(move.bolsas, 80);
assert.equal(move.origen, "dospanca");
assert.equal(move.destino, "galpon");
assert.equal(move.type, "transferencia");

const carga = parseWithRules("despachá 50 bolsas del lote 241 de pancani", catalog);
assert.ok(!("error" in carga));
assert.equal(carga.type, "egreso");

const sacaron = parseWithRules(
  "sacaron 150 bolsas del galpon del lote 700 7 four 7 y las mandaron a Belmonte",
  catalog,
);
assert.ok(!("error" in sacaron));
assert.equal(sacaron.type, "transferencia");
assert.equal(sacaron.lote, "700");
assert.equal(sacaron.bolsas, 150);
assert.equal(sacaron.origen, "galpon");
assert.equal(sacaron.destino, "belmonte");

const ingreso = parseWithRules(
  "llegaron 500 bolsas nuevas al lote 700 7 four 7 a belmonte",
  catalog,
);
assert.ok(!("error" in ingreso));
assert.equal(ingreso.type, "ingreso");
assert.equal(ingreso.lote, "700");
assert.equal(ingreso.bolsas, 500);
assert.equal(ingreso.origen, "campo");
assert.equal(ingreso.destino, "belmonte");

assert.equal(looksLikeCount(FRASES_B[1].texto), true);
const count = parseCount(FRASES_B[1].texto, catalog);
assert.ok(!("error" in count));
assert.equal(count.lote, "241");
assert.equal(count.bolsas, 320);
assert.equal(count.origen, "dospanca");

const gap = explainGap({
  lot: "241",
  locationId: "dospanca",
  locationName: "Frigorífico Dos Pancani",
  declared: 400,
  counted: 320,
  moves: [
    {
      type: "transferencia",
      lot_code: "241",
      bags: 80,
      from_id: "dospanca",
      to_id: "galpon",
      from_name: "Frigorífico Dos Pancani",
      to_name: "Galpón",
      created_at: new Date().toISOString(),
    },
  ],
});
assert.equal(gap.ok, false);
assert.match(gap.hypothesis, /misma cantidad que el faltante|no se registró la llegada/);

console.log("verify-lenguaje: ok");
