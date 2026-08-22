# Deploy gratis (Vercel + Turso)

Render cobró o pidió plan pago: no lo usamos. Para **testear y mostrar la demo** alcanza el plan Hobby de Vercel (gratis) y una base **Turso** (SQLite en la nube, también gratis). El parseo sigue sin OpenAI.

No uses Netlify para esto: cada función serverless perdería el archivo SQLite. Turso es el mismo SQL, compartido entre requests.

## 1. Base Turso (2 minutos)

1. Entrá a https://turso.tech y creá cuenta (GitHub).
2. En el dashboard: **Create Database** (región cercana, plan free).
3. Copiá:
   - `TURSO_DATABASE_URL` (empieza con `libsql://`)
   - `TURSO_AUTH_TOKEN` (Create token)

La primera request a la app crea tablas y carga el seed.

## 2. Subir el repo y Vercel

En PowerShell el comando es `npx vercel`, no `vercel`. Si dice que no hay credenciales:

```bash
npx vercel login
npx vercel
```

Login gratis, proyecto Hobby, **no** hace falta tarjeta para el plan hobby típico.

O desde https://vercel.com → Add New → importá el GitHub.

En **Settings → Environment Variables** (Production y Preview):

```
TURSO_DATABASE_URL=libsql://....
TURSO_AUTH_TOKEN=...
```

Redeploy. La URL queda `https://….vercel.app`.

## Parseo

Reglas locales en `lib/parse.ts`. Sin API paga.
