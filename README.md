# Stock de semilla (N01)

Sistema de **una sola fuente de verdad** para bolsas por lote y ubicación. Reemplaza la planilla compartida de movimientos 2026: el operario carga en voz o texto, el parser (reglas locales, sin OpenAI) arma el movimiento, y el stock **no baja** si el origen no alcanza.

## Demo en la nube (Render)

No hace falta correrlo en tu notebook frente al jurado. Pasos: [docs/DEPLOY.md](docs/DEPLOY.md). Créditos del evento: https://credits-portal-mmdm.onrender.com/claim/cafe-cursor

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
| `lib/db.ts` | SQLite + seed |
| `data/seed.json` | Ubicaciones, alias, lotes, saldos de demo |
| `render.yaml` | Web Service + disco en Render |
| `docs/DEPLOY.md` | Cómo publicar con los créditos |
| `docs/COMO_FUNCIONA.md` | Modelo y flujo |
| `docs/ESCALA.md` | Dónde enchufar lo que viene |
| `docs/SPEECH.md` | Texto para presentar |
