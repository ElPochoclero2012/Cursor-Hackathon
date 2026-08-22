import { FRASES_B, lastB } from "@/lib/b-debug";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function html() {
  const rows = lastB()
    .map(
      (e) =>
        `<article><p><b>${e.via}</b> · ${e.at}</p><pre>recibió:\n${JSON.stringify(e.recibido, null, 2)}\n\nresultado:\n${JSON.stringify(e.resultado, null, 2)}</pre></article>`,
    )
    .join("") || "<p>Todavía no hubo parse/conteo/transcribir. Recargá esta pestaña después de Interpretar.</p>";

  const frases = FRASES_B.map(
    (f) =>
      `<li><b>${f.para}</b><br><code>${f.texto}</code></li>`,
  ).join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>B debug</title>
<meta http-equiv="refresh" content="2">
<style>
body{font:15px/1.4 system-ui;max-width:720px;margin:24px auto;padding:0 16px;background:#eef2f5;color:#1a2b37}
code,pre{background:#fff;border:1px solid #d5dde3;border-radius:8px;padding:8px 10px;display:block;white-space:pre-wrap}
article{margin:14px 0;padding:10px;background:#fff;border-radius:10px}
</style></head><body>
<h1>Parte B — log</h1>
<p>Se recarga sola. También mirá la terminal de <code>npm run dev</code> (líneas <code>[B]</code>).</p>
<h2>Frases de prueba</h2>
<ol>${frases}</ol>
<h2>Últimos envíos</h2>
${rows}
</body></html>`;
}

export function GET(req: Request) {
  const wantHtml = new URL(req.url).searchParams.get("raw") !== "1";
  if (wantHtml) {
    return new NextResponse(html(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.json({ frases: FRASES_B, eventos: lastB() });
}
