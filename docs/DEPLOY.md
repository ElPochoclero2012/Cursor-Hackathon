# Deploy (Render, créditos del hackathon)

El sistema usa **SQLite en un proceso Node**. Por eso va a **Render** (Web Service + disco), no a Netlify: Netlify es serverless y el archivo de stock se perdería en cada cold start. Exa y Firecrawl son búsqueda/crawling, no hosting.

## 1. Créditos

Reclamá los USD 100 de Render: https://credits-portal-mmdm.onrender.com/claim/cafe-cursor

## 2. Repo en GitHub

El servicio se construye desde git. Si el remoto aún no existe:

```bash
git add .
git commit -m "Stock semilla listo para Render"
git remote add origin <tu-repo>
git push -u origin main
```

## 3. Servicio en Render

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** (usa `render.yaml`) **o** Web Service conectado al repo.
2. Runtime **Node**, versión **22**.
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Disco persistente: mount `/var/data`, env `STOCK_DB_PATH=/var/data/app.db` (ya está en `render.yaml`).
6. Plan **Starter** (el free se duerme y a veces no trae disco; los créditos cubren Starter).

La URL pública queda tipo `https://stock-semilla.onrender.com`. Esa es la que mostrás en la demo.

## Parseo (sin OpenAI)

No hay API de OpenAI. `lib/parse.ts` interpreta el español de galpón con reglas sobre el catálogo (lotes y alias de la planilla). Cero costo, funciona offline en el servidor. El micrófono del navegador (Web Speech) es gratis; Wispr Flow del evento es opcional en la PC, no hace falta en el deploy.
