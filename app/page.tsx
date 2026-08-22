"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StockPayload = {
  locations: { id: string; name: string }[];
  rows: {
    code: string;
    variety: string;
    byLocation: Record<string, number>;
    total: number;
  }[];
};

type Movement = {
  id: number;
  type: string;
  lot_code: string;
  variety: string;
  bags: number;
  from_name: string | null;
  to_name: string | null;
  created_at: string;
};

type Draft = {
  type: string;
  lote: string;
  variedad?: string;
  bolsas: number;
  origen?: string | null;
  destino?: string | null;
  source?: string;
};

type CountRow = {
  id: number;
  lot_code: string;
  variety: string;
  location_name: string;
  declared_bags: number;
  counted_bags: number;
  hypothesis: string;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  ingreso: "Ingreso",
  egreso: "Egreso",
};

export default function Page() {
  const [tab, setTab] = useState<"n01" | "n02" | "n03">("n01");
  const [stock, setStock] = useState<StockPayload | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [groq, setGroq] = useState(false);
  const wantMic = useRef(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [countLot, setCountLot] = useState("241");
  const [countLoc, setCountLoc] = useState("dospanca");
  const [countBags, setCountBags] = useState("320");
  const [hypo, setHypo] = useState<string | null>(null);
  const [loadBags, setLoadBags] = useState("400");
  const [docLot, setDocLot] = useState("810");
  const [docLoc, setDocLoc] = useState("galpon");
  const [docBags, setDocBags] = useState("200");
  const [buyer, setBuyer] = useState("Parmentier");
  const [country, setCountry] = useState("Brasil");
  const [doc, setDoc] = useState<string | null>(null);

  const load = useCallback(async () => {
    const json = (url: string) => fetch(url).then((r) => r.json()).catch(() => null);
    const [s, m, c, k, p] = await Promise.all([
      json("/api/stock"),
      json("/api/movements"),
      json("/api/catalog"),
      json("/api/counts"),
      json("/api/parse"),
    ]);
    if (s && Array.isArray(s.rows) && Array.isArray(s.locations)) setStock(s);
    if (Array.isArray(m)) setMovements(m);
    if (Array.isArray(k)) setCounts(k);
    setGroq(Boolean(p?.groq));
    const map: Record<string, string> = {};
    for (const loc of (c?.locations ?? []) as { id: string; name: string }[]) map[loc.id] = loc.name;
    setNames(map);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bodegas = useMemo(
    () => (stock?.locations ?? []).map((l) => ({ id: l.id, name: l.name })),
    [stock],
  );
  const lotCodes = useMemo(() => stock?.rows?.map((r) => r.code) ?? ["241", "810"], [stock]);

  const rows = useMemo(() => {
    if (!stock) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return stock.rows;
    return stock.rows.filter(
      (r) => r.code.toLowerCase().includes(needle) || r.variety.toLowerCase().includes(needle),
    );
  }, [stock, q]);

  async function parse() {
    setMsg(null);
    setDraft(null);
    setBusy(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "error", text: data.error || "No se pudo interpretar." });
        return;
      }
      setDraft(data);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, raw_text: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "error", text: data.error || "No se aplicó el movimiento." });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Registrado: ${TYPE_LABEL[draft.type] || draft.type} lote ${draft.lote}, ${draft.bolsas} bolsas.`,
      });
      setDraft(null);
      setText("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function stopDictate() {
    wantMic.current = false;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recRef.current = null;
    stopStream();
    setListening(false);
  }

  async function dictate(into: (s: string) => void) {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (!window.isSecureContext) {
      setMsg({
        kind: "error",
        text: "El micrófono pide https o localhost (Chrome).",
      });
      return;
    }
    if (!groq) {
      setMsg({
        kind: "error",
        text: "El dictado usa Groq Whisper. Poné GROQ_API_KEY en .env.local, reiniciá npm run dev, y en Vercel Redeploy.",
      });
      return;
    }
    setMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      wantMic.current = true;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stopStream();
        setListening(false);
        recRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 64) {
          setMsg({ kind: "error", text: "Grabación vacía. Clic en Micrófono, hablá 2–3 s, clic otra vez para cortar." });
          return;
        }
        setBusy(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "dictado.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) {
            setMsg({ kind: "error", text: data.error || "No se pudo transcribir." });
            return;
          }
          into(String(data.text || "").trim());
        } finally {
          setBusy(false);
          wantMic.current = false;
        }
      };
      rec.start();
      setListening(true);
    } catch {
      stopDictate();
      setMsg({
        kind: "error",
        text: "Chrome bloqueó el micrófono. Candado de la URL → Permitir.",
      });
    }
  }

  async function doCount() {
    setBusy(true);
    setMsg(null);
    setHypo(null);
    try {
      const res = await fetch("/api/counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lote: countLot, origen: countLoc, bolsas: Number(countBags) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "error", text: data.error || "No se registró el conteo." });
        return;
      }
      setHypo(data.hypothesis);
      setMsg({ kind: data.ok ? "ok" : "error", text: data.ok ? "Conteo coincidente." : "Hay desvío: ver hipótesis." });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doCarga() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/carga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lote: countLot, origen: countLoc, bolsas: Number(loadBags) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "error", text: data.error || "No se emitió la orden." });
        return;
      }
      setMsg({ kind: "ok", text: "Orden de carga emitida. El stock de origen bajó." });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doProforma() {
    setBusy(true);
    setMsg(null);
    setDoc(null);
    try {
      const res = await fetch("/api/proforma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lote: docLot,
          origen: docLoc,
          bolsas: Number(docBags),
          buyer,
          dest_country: country,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "error", text: data.error || "No se armó la proforma." });
        return;
      }
      setDoc(data.body);
      setMsg({ kind: "ok", text: "Proforma armada con trazabilidad del lote." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Stock de semilla</h1>
          <p>Campaña 2026 · N01 movimientos · N02 control · N03 documentación</p>
        </div>
        <nav className="tabs" aria-label="Niveles">
          <button type="button" className={tab === "n01" ? "on" : ""} onClick={() => setTab("n01")}>
            N01 Movimientos
          </button>
          <button type="button" className={tab === "n02" ? "on" : ""} onClick={() => setTab("n02")}>
            N02 Control
          </button>
          <button type="button" className={tab === "n03" ? "on" : ""} onClick={() => setTab("n03")}>
            N03 Exportación
          </button>
        </nav>
      </header>

      <main className="wrap">
        {tab === "n01" && (
          <>
            <div className="grid-2">
              <section className="card">
                <h2>Registrar movimiento</h2>
                <p className="hint">
                  {groq
                    ? "Interpretar usa Groq. Micrófono: clic para grabar, hablá, clic otra vez para transcribir (Whisper, no el dictado de Chrome)."
                    : "Sin GROQ_API_KEY no hay IA ni micrófono. Clave en .env.local y reiniciá npm run dev."}{" "}
                </p>
                <label htmlFor="frase">Voz o texto</label>
                <textarea
                  id="frase"
                  className={listening ? "listening" : ""}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Dictá o escribí el movimiento…"
                />
                <div className="row-actions">
                  <button type="button" className="btn-secondary" onClick={() => dictate(setText)}>
                    {listening ? "Cortar y transcribir" : "Micrófono"}
                  </button>
                  <button type="button" className="btn-primary" onClick={parse} disabled={busy || !text.trim()}>
                    Interpretar
                  </button>
                </div>
                {draft && (
                  <div className="preview">
                    <strong>¿Confirmás este movimiento?</strong>
                    <dl>
                      <dt>Tipo</dt>
                      <dd>
                        {TYPE_LABEL[draft.type] || draft.type}
                        {draft.source === "groq" ? " · IA Groq" : " · reglas"}
                      </dd>
                      <dt>Lote</dt>
                      <dd>
                        {draft.lote}
                        {draft.variedad ? ` · ${draft.variedad}` : ""}
                      </dd>
                      <dt>Bolsas</dt>
                      <dd>{draft.bolsas}</dd>
                      <dt>Origen</dt>
                      <dd>{draft.origen ? names[draft.origen] || draft.origen : "—"}</dd>
                      <dt>Destino</dt>
                      <dd>{draft.destino ? names[draft.destino] || draft.destino : "—"}</dd>
                    </dl>
                    <div className="row-actions">
                      <button type="button" className="btn-ok" onClick={confirm} disabled={busy}>
                        Confirmar
                      </button>
                      <button type="button" className="btn-danger" onClick={() => setDraft(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                {msg && tab === "n01" && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
              </section>

              <section className="card">
                <h2>Stock actual</h2>
                <p className="hint">Una vista, cuatro ubicaciones.</p>
                <div className="filter">
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por variedad o lote" />
                </div>
                <StockTable stock={stock} rows={rows} />
              </section>
            </div>
            <History movements={movements} />
          </>
        )}

        {tab === "n02" && (
          <>
            <section className="card">
              <h2>Conteo físico vs declarado</h2>
              <p className="hint">
                Si no coincide, el sistema propone la causa más probable. La orden de carga no sale si no hay
                bolsas verificables.
              </p>
              <div className="fields">
                <div>
                  <label htmlFor="clot">Lote</label>
                  <select id="clot" value={countLot} onChange={(e) => setCountLot(e.target.value)}>
                    {lotCodes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cloc">Ubicación</label>
                  <select id="cloc" value={countLoc} onChange={(e) => setCountLoc(e.target.value)}>
                    {bodegas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cbags">Bolsas contadas</label>
                  <input id="cbags" value={countBags} onChange={(e) => setCountBags(e.target.value)} />
                </div>
              </div>
              <div className="row-actions">
                <button type="button" className="btn-primary" onClick={doCount} disabled={busy}>
                  Registrar conteo
                </button>
              </div>
              {hypo && <p className="hypo">{hypo}</p>}
              {msg && tab === "n02" && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
            </section>

            <section className="card">
              <h2>Orden de carga</h2>
              <p className="hint">Usa el mínimo entre stock del sistema y el último conteo de ese lote y lugar.</p>
              <label htmlFor="lbags">Bolsas a cargar (mismo lote y origen de arriba)</label>
              <input id="lbags" value={loadBags} onChange={(e) => setLoadBags(e.target.value)} />
              <div className="row-actions">
                <button type="button" className="btn-ok" onClick={doCarga} disabled={busy}>
                  Emitir orden de carga
                </button>
              </div>
            </section>

            <section className="card">
              <h2>Stock</h2>
              <StockTable stock={stock} rows={rows} />
            </section>

            <section className="card">
              <h2>Conteos</h2>
              {counts.length === 0 ? (
                <p className="empty">Todavía no hay conteos.</p>
              ) : (
                <ul className="history">
                  {counts.map((c) => (
                    <li key={c.id}>
                      <span className={`pill ${c.declared_bags === c.counted_bags ? "ingreso" : "egreso"}`}>
                        {c.declared_bags === c.counted_bags ? "OK" : "Desvío"}
                      </span>
                      <span>
                        Lote {c.lot_code} · {c.location_name}: sistema {c.declared_bags} / contado {c.counted_bags}
                      </span>
                      <span className="num when">{new Date(c.created_at).toLocaleString("es-AR")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === "n03" && (
          <section className="card">
            <h2>Proforma de exportación</h2>
            <p className="hint">
              Cruza el lote (variedad, calibre, bolsa/hilo, procedencia) con el stock verificable. Si no hay
              bolsas, no se emite.
            </p>
            <div className="fields">
              <div>
                <label htmlFor="dlot">Lote</label>
                <select id="dlot" value={docLot} onChange={(e) => setDocLot(e.target.value)}>
                  {lotCodes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dloc">Carga desde</label>
                <select id="dloc" value={docLoc} onChange={(e) => setDocLoc(e.target.value)}>
                  {bodegas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dbags">Bolsas</label>
                <input id="dbags" value={docBags} onChange={(e) => setDocBags(e.target.value)} />
              </div>
              <div>
                <label htmlFor="buyer">Comprador</label>
                <input
                  id="buyer"
                  value={buyer}
                  onChange={(e) => setBuyer(e.target.value)}
                  onDoubleClick={() => dictate(setBuyer)}
                />
              </div>
              <div>
                <label htmlFor="country">País / destino</label>
                <input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
            </div>
            <div className="row-actions">
              <button type="button" className="btn-secondary" onClick={() => dictate(setBuyer)}>
                Dictar comprador
              </button>
              <button type="button" className="btn-primary" onClick={doProforma} disabled={busy}>
                Armar proforma
              </button>
            </div>
            {msg && tab === "n03" && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
            {doc && <pre className="doc">{doc}</pre>}
          </section>
        )}
      </main>
    </>
  );
}

function StockTable({
  stock,
  rows,
}: {
  stock: StockPayload | null;
  rows: StockPayload["rows"];
}) {
  if (!stock) return null;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Variedad</th>
            <th>Lote</th>
            {stock.locations.map((l) => (
              <th key={l.id}>{l.name.replace("Frigorífico ", "")}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td>{r.variety}</td>
              <td>{r.code}</td>
              {stock.locations.map((l) => {
                const n = r.byLocation[l.id] ?? 0;
                return (
                  <td key={l.id} className={`num ${n === 0 ? "zero" : ""}`}>
                    {n || "—"}
                  </td>
                );
              })}
              <td className="num total">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">Ningún lote coincide con el filtro.</p>}
    </div>
  );
}

function History({ movements }: { movements: Movement[] }) {
  return (
    <section className="card">
      <h2>Últimos movimientos</h2>
      {movements.length === 0 ? (
        <p className="empty">El stock inicial viene del seed. Los movimientos nuevos aparecen acá.</p>
      ) : (
        <ul className="history">
          {movements.map((m) => (
            <li key={m.id}>
              <span className={`pill ${m.type}`}>{TYPE_LABEL[m.type] || m.type}</span>
              <span>
                Lote {m.lot_code} {m.variety} · {m.bags} bolsas
                <br />
                <span className="route">
                  {m.from_name || "—"} → {m.to_name || "—"}
                </span>
              </span>
              <span className="num when">{new Date(m.created_at).toLocaleString("es-AR")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

