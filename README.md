# Stock de semilla (N01–N03)

Sistema de **una sola fuente de verdad** para bolsas por lote y ubicación. Reemplaza la planilla compartida de movimientos 2026: el operario carga en voz o texto, el parser (reglas locales, sin OpenAI) arma el movimiento, y el stock **no baja** si el origen no alcanza.

## Demo en la nube (gratis)

Vercel Hobby + Turso (SQLite). Pasos: [docs/DEPLOY.md](docs/DEPLOY.md).

## Levantar en el repo (solo desarrollo)

Requisito: Node 22+ (usa `node:sqlite`).

```bash
npm install
npm run dev
```

Comprobación del motor de stock:

```bash
npm run verify
```

## Frases de demo

- `Pasá 80 bolsas del lote 241 Agata de Dos Pancani al galpón.`
- `Retirá 600 bolsas del lote 241 de Pancani.` (debe rechazar: en Pancani hay 400)

## Qué hay en el repo

| Ruta | Rol |
|---|---|
| `lib/stock.ts` | `applyMovement` — única escritura de saldos |
| `lib/parse.ts` | `parseMovement` — reglas sobre catálogo, sin API paga |
| `lib/db.ts` | SQLite local o Turso |
| `data/seed.json` | Ubicaciones, alias, lotes, saldos de demo |
| `docs/DEPLOY.md` | Vercel + Turso (gratis) |
| `docs/COMO_FUNCIONA.md` | Modelo y flujo |
| `docs/ESCALA.md` | Dónde enchufar lo que viene |
| `docs/SPEECH.md` | Texto para presentar |
