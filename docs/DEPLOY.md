# Deploy gratis (Vercel + Turso)

Plan Hobby de Vercel + una base Turso (SQLite en la nube). Parseo local, sin OpenAI. Node **22+**.

No uses Netlify: cada función perdería el archivo SQLite. Turso comparte el mismo SQL entre requests.

## Checklist

1. **Turso** (2 min) — https://turso.tech (cuenta con GitHub) → Create Database (plan free).
2. Copiá:
   - `TURSO_DATABASE_URL` (empieza con `libsql://`)
   - `TURSO_AUTH_TOKEN` (Create token)
3. **Vercel** — en PowerShell: `npx vercel` (no `vercel` a secas).

```bash
npx vercel login
npx vercel
```

O https://vercel.com → Add New → importar el repo de GitHub. Hobby, sin tarjeta para el plan típico.

4. **Settings → Environment Variables** (Production y Preview):

```
TURSO_DATABASE_URL=libsql://....
TURSO_AUTH_TOKEN=...
GROQ_API_KEY=gsk_...
```

5. Redeploy. URL: `https://….vercel.app`.
6. Primera request: crea tablas y carga el seed. Abrí **Movimientos** y deberías ver saldos.

## Interpretar texto (Groq)

Guía completa: [GROQ.md](GROQ.md). Resumen: cuenta en console.groq.com → `GROQ_API_KEY` en `.env.local` y en Vercel → reiniciar `npm run dev` / Redeploy.

## Local (solo desarrollo)

```bash
npm install
npm run dev
```

Comprobación del motor: `npm run verify`.  
Formato de proforma: `npx tsx scripts/verify-proforma.ts`.

Reglas locales en `lib/parse.ts` si no hay Groq. Con `GROQ_API_KEY`, Llama interpreta dictado con errores.
