import assert from "node:assert/strict";
import { explainGap } from "../lib/hypothesis.ts";
import { parseCount, parseWithRules, looksLikeCount } from "../lib/parse.ts";

const catalog = {
  locations: [
    { id: "dospanca", name: "Frigorífico Dos Pancani", kind: "bodega" },
    { id: "galpon", name: "Galpón", kind: "bodega" },
    { id: "campo", name: "Campo", kind: "origen" },
  ],
  lots: [
    { code: "241", variety: "Agata" },
    { code: "810", variety: "Asterix" },
  ],
  aliases: {
    "dos pancani": "dospanca",
    pancani: "dospanca",
    dospanca: "dospanca",
    galpon: "galpon",
    "el galpon": "galpon",
  },
};

const move = parseWithRules(
  "mandá ochenta bolsas del lote doscientos cuarenta y uno de pancani al gal pon",
  catalog,
);
assert.ok(!("error" in move));
assert.equal(move.lote, "241");
assert.equal(move.bolsas, 80);
assert.equal(move.origen, "dospanca");
assert.equal(move.destino, "galpon");
assert.equal(move.type, "transferencia");

const carga = parseWithRules("despachá 50 bolsas del lote 241 de pancani", catalog);
assert.ok(!("error" in carga));
assert.equal(carga.type, "egreso");

assert.equal(looksLikeCount("Conté 320 bolsas del lote 241 en pancani"), true);
const count = parseCount("Conté 320 bolsas del lote 241 en pancani", catalog);
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
