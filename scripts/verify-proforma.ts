import assert from "node:assert/strict";
import { formatProformaBody } from "../lib/proforma.ts";

const body = formatProformaBody({
  today: "22/08/2026",
  buyer: "Parmentier",
  country: "Brasil",
  from: "Galpón",
  variety: "Asterix",
  lot: "810",
  bags: 200,
  kg: 10000,
  trace: { campo: "Santa Ana", categoria: "exportacion", calibre: "sin chicas", bolsa: "verde", hilo: "verde" },
});

assert.match(body, /Parmentier/);
assert.match(body, /Brasil/);
assert.match(body, /Galpón/);
assert.match(body, /Asterix/);
assert.match(body, /\b810\b/);
assert.match(body, /Bolsas: 200/);
assert.match(body, /10\.000/);
assert.match(body, /COMPRADOR/);
assert.match(body, /CARGA/);
assert.match(body, /LOTE/);
assert.doesNotMatch(body, /undefined/);
assert.doesNotMatch(body, /\[object Object\]/);

const sparse = formatProformaBody({
  today: "22/08/2026",
  buyer: "A confirmar",
  country: "A confirmar",
  from: "Frigorífico Dos Pancani",
  variety: "Agata",
  lot: "241",
  bags: 80,
  kg: null,
  trace: {},
});
assert.match(sparse, /según pesada/);
assert.match(sparse, /Santa Ana/);
assert.match(sparse, /s\/d/);

console.log("verify-proforma: ok");
