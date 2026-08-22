# Groq paso a paso

No se instala ningún paquete npm. La app ya llama a Groq si existe `GROQ_API_KEY`. La clave empieza con `gsk_`.

## 1. Cuenta y API key (2 min)

1. Abrí https://console.groq.com
2. **Sign up** (Google o GitHub). Plan free.
3. Menú **API Keys** → **Create API Key**.
4. Copiá la clave **ya**. Groq no la vuelve a mostrar entera.

No la subas a GitHub ni la pegues en un chat grupal.

## 2. Que ande en tu PC (`npm run dev`)

En la raíz del proyecto, archivo `.env.local` (junto a `package.json`). Si ya lo tenés por Turso, **agregá** esta línea, no borres las otras.

Sin comillas y **sin punto y coma** (si copiás de un `.env` de JavaScript, Groq responde 401):

```
GROQ_API_KEY=gsk_pegá_acá_la_clave
```

Guardá. **Cortá** el `npm run dev` (Ctrl+C) y volvé a levantarlo:

```bash
npm run dev
```

Next solo lee `.env.local` al arrancar.

## 3. Que ande en Vercel (la URL pública)

1. https://vercel.com → tu proyecto → **Settings** → **Environment Variables**.
2. Key: `GROQ_API_KEY` (exacto, mayúsculas).
3. Value: la misma `gsk_…`.
4. Environments: **Production** y **Preview** (igual que Turso).
5. Save.
6. **Deployments** → los tres puntitos del último deploy → **Redeploy**  
   o en la PC: `npx vercel --prod`

Sin redeploy, el servidor sigue sin la clave.

## 4. Comprobar que quedó

1. Chrome o Edge, pestaña **N01**.
2. Arriba del recuadro tiene que decir que Interpretar **usa Groq**.
3. Pegá algo sucio, no perfecto:
   `pasa ochenta del lote doscientos cuarenta y uno agata de pancani al galpon`
4. **Interpretar**.
5. En la confirmación: **IA Groq**, lote `241`, 80 bolsas, Dos Pancani → Galpón.
6. **Confirmar**.

Si sigue diciendo “reglas”, la clave no llegó al proceso: revisá el nombre `GROQ_API_KEY`, el redeploy, y que no haya un espacio al pegar.

## Si Groq no responde

Interpretar cae a las reglas locales. La demo con las frases copiadas de `docs/SPEECH.md` sigue andando.
