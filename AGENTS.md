# Agentes y dueños de archivos

Un solo repo. Cada uno en su rama. `npm run dev` en local. PR a `main` cuando esté. Cursor no reserva archivos: si el prompt no lista paths, el agente se pisa con el compañero.

Al pedir un cambio, pegá: **solo tocá los archivos de tu letra**.

## A — Motor (stock que no miente)

`lib/db.ts`, `lib/stock.ts`, `data/seed.json`, `scripts/verify-stock.ts`, `app/api/stock`, `app/api/movements`, `app/api/carga`

Avance: lotes, validaciones, `npm run verify` en verde.

## B — Lenguaje / N02

`lib/parse.ts`, `lib/hypothesis.ts`, `lib/count.ts`, `app/api/parse`, `app/api/counts`, `app/api/transcribe`, `scripts/verify-lenguaje.ts`

Avance: frases de galpón, dictado→texto, hipótesis de desvío, conteo.

Chequeo: `node --import tsx scripts/verify-lenguaje.ts`

## C — Cara / N03 / demo

`app/page.tsx`, `app/globals.css`, `app/layout.tsx`, `lib/proforma.ts`, `app/api/proforma`, `docs/`

Avance: pestañas, proforma, speech, Vercel.

## Nadie toca

`.env.local`, tokens, `data/app.db`. No `git push --force` a `main`.

## Contrato

La UI no calcula saldos. A y B no reescriben `page.tsx` salvo un bug de micrófono pedido en el ticket. C no cambia `applyMovement`. Conflicto en un archivo: gana quien es dueño.
