# Cómo funciona

## El problema que reemplaza

La planilla `fuentes/Planilla de movimientos 2026.xls` es un **libro de remitos** (varias hojas, varias personas). No hay un saldo único por lote y ubicación. Las hojas `Stocks`, `DJ Panc` y `SP` están vacías o hablan de producción de chacra, no de inventario de bodega. El faltante se ve cuando hay que entregar.

Este sistema guarda **movimientos** y mantiene **saldos**. Nadie edita la misma celda.

## Modelo

- **locations** — bodegas visibles (Dos Pancani, Cecive, Belmonte, Galpón) más orígenes/destinos técnicos (`campo`, `externo`).
- **lots** — código + variedad (y kg/bolsa informativo).
- **stock** — bolsas actuales por `(lote, ubicación)`.
- **movements** — historial append-only. El saldo no se “corrige a mano”: se aplica un movimiento.

Unidad que manda: **bolsas**. Los kg se calculan si el lote tiene `kg_per_bag`.

## Tipos (las hojas del Excel no son módulos)

| Tipo | Hojas de la planilla | Efecto |
|---|---|---|
| ingreso | De campo a Frío, Env a Frío, Tolvas, Trevelin | Suma en destino |
| transferencia | Entre las 4 bodegas | Resta origen, suma destino; falla si no alcanza |
| egreso | Retiro de frío, entregas a clientes | Resta origen; falla si no alcanza |

## Flujo de carga

1. El operario dicta o escribe.
2. `POST /api/parse` → `parseMovement` (reglas locales sobre lotes y alias; **sin OpenAI**).
3. La pantalla muestra origen, destino, lote y bolsas. **Nada se graba todavía.**
4. Confirmar → `POST /api/movements` → `applyMovement` en una transacción SQLite (`BEGIN IMMEDIATE`).
5. Si el origen no tiene bolsas suficientes: HTTP 409 y un mensaje en español. El stock no cambia.

**Control:** `POST /api/counts` compara conteo vs saldo y arma una hipótesis (`lib/hypothesis.ts`). `POST /api/carga` no emite si no hay bolsas verificables (mínimo entre sistema y último conteo).

**Exportación:** `POST /api/proforma` rellena documentación con trazabilidad del lote (`data/seed.json` → `trace`) y el mismo tope de stock.

La UI **no calcula** saldos; solo muestra lo que devuelve el API.

## API

- `GET /api/stock` — filas por lote, columnas por bodega.
- `GET /api/catalog` — lotes, ubicaciones, alias (para el parser).
- `POST /api/parse` — `{ text }` → borrador o error.
- `GET/POST /api/movements` — listar / aplicar.

## Alias

Los nombres sucios de la planilla (`dospanca`, `galpon-galpon`) viven en `data/seed.json` → tabla `aliases`. El parser resuelve a un `id` canónico.
