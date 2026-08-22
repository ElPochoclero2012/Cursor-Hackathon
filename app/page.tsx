"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "movimientos" | "control" | "exportacion";

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

type ProformaDoc = {
  body: string;
  today: string;
  buyer: string;
  country: string;
  from: string;
  variety: string;
  lot: string;
  bags: number;
  kg: number | null;
  trace: {
    campo?: string;
    categoria?: string;
    calibre?: string;
    bolsa?: string;
    hilo?: string;
  };
};

type ProformaRow = {
  id: number;
  lot_code: string;
  bags: number;
  buyer: string;
  dest_country: string;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  ingreso: "Ingreso",
  egreso: "Egreso",
};

const DEMO_PHRASES = [
  "Pasá 80 bolsas del lote 241 Agata de Dos Pancani al galpón.",
  "Retirá 600 bolsas del lote 241 de Pancani.",
];

export default function Page() {
  const [tab, setTab] = useState<Tab>("movimientos");
  const [stock, setStock] = useState<StockPayload | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
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
  const [doc, setDoc] = useState<ProformaDoc | null>(null);
  const [proformas, setProformas] = useState<ProformaRow[]>([]);

  const load = useCallback(async () => {
    const [s, m, c, k] = await Promise.all([
      fetch("/api/stock").then((r) => r.json()),
      fetch("/api/movements").then((r) => r.json()),
      fetch("/api/catalog").then((r) => r.json()),
      fetch("/api/counts").then((r) => r.json()),
    ]);
    setStock(s);
    setMovements(m);
    setCounts(k);
    const map: Record<string, string> = {};
    for (const loc of c.locations as { id: string; name: string }[]) map[loc.id] = loc.name;
    setNames(map);
  }, []);

  const loadProformas = useCallback(async () => {
    const list = await fetch("/api/proforma").then((r) => r.json());
    setProformas(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "exportacion") loadProformas();
  }, [tab, loadProformas]);

  const bodegas = useMemo(
    () => (stock?.locations ?? []).map((l) => ({ id: l.id, name: l.name })),
    [stock],
  );
  const lotCodes = useMemo(() => stock?.rows.map((r) => r.code) ?? ["241", "810"], [stock]);

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

  function dictate(into: (s: string) => void) {
    const SR =
      typeof window !== "undefined" &&
      ((window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition ||
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition);
    if (!SR) {
      setMsg({
        kind: "error",
        text: "Este navegador no dicta. Usá Chrome o pegá el texto.",
      });
      return;
    }
    const rec = new SR();
    rec.lang = "es-AR";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      setMsg({ kind: "error", text: "No se oyó el micrófono." });
    };
    rec.onresult = (ev: SpeechRecognitionEvent) => into(ev.results[0][0].transcript);
    rec.start();
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
      setDoc(data);
      setMsg({ kind: "ok", text: "Proforma armada con trazabilidad del lote." });
      await loadProformas();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Stock de semilla</h1>
          <p>Campaña 2026 · una fuente de verdad por lote y ubicación</p>
        </div>
        <nav className="tabs" aria-label="Módulos">
          {(
            [
              ["movimientos", "Movimientos"],
              ["control", "Control"],
              ["exportacion", "Exportación"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "on" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="wrap">
        {tab === "movimientos" && (
          <>
            <div className="grid-2">
              <section className="card">
                <h2>Registrar movimiento</h2>
                <p className="hint">Dictá o escribí en el lenguaje del galpón. Nada se graba hasta confirmar.</p>
                <label htmlFor="frase">Voz o texto</label>
                <textarea
                  id="frase"
                  className={listening ? "listening" : ""}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Dictá o escribí el movimiento…"
                />
                <div className="chips" aria-label="Frases de ejemplo">
                  {DEMO_PHRASES.map((p) => (
                    <button key={p} type="button" className="chip" onClick={() => setText(p)}>
                      {p}
                    </button>
                  ))}
                </div>
                <div className="row-actions">
                  <button type="button" className="btn-secondary" onClick={() => dictate(setText)}>
                    {listening ? "Escuchando…" : "Micrófono"}
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
                      <dd>{TYPE_LABEL[draft.type] || draft.type}</dd>
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
                {msg && tab === "movimientos" && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
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

        {tab === "control" && (
          <>
            <div className="grid-2 even">
              <section className="card">
                <h2>Conteo físico vs declarado</h2>
                <p className="hint">Si no coincide, el sistema propone la causa más probable.</p>
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
                {msg && tab === "control" && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
              </section>

              <section className="card">
                <h2>Orden de carga</h2>
                <p className="hint">
                  Mismo lote y ubicación del conteo. Usa el mínimo entre el sistema y el último conteo. No sale si no
                  hay bolsas verificables.
                </p>
                <label htmlFor="lbags">Bolsas a cargar</label>
                <input id="lbags" value={loadBags} onChange={(e) => setLoadBags(e.target.value)} />
                <div className="row-actions">
                  <button type="button" className="btn-ok" onClick={doCarga} disabled={busy}>
                    Emitir orden de carga
                  </button>
                </div>
              </section>
            </div>

            <section className="card">
              <h2>Stock</h2>
              <StockTable stock={stock} rows={rows} />
            </section>

            <section className="card">
              <h2>Conteos</h2>
              {counts.length === 0 ? (
                <p className="empty">Todavía no hay conteos. Registrá el primero para comparar piso vs sistema.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Ubicación</th>
                        <th>Sistema</th>
                        <th>Contado</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {counts.map((c) => {
                        const ok = c.declared_bags === c.counted_bags;
                        return (
                          <tr key={c.id}>
                            <td>
                              {c.lot_code} {c.variety}
                            </td>
                            <td>{c.location_name}</td>
                            <td className="num">{c.declared_bags}</td>
                            <td className="num">{c.counted_bags}</td>
                            <td>
                              <span className={`pill ${ok ? "ingreso" : "egreso"}`}>{ok ? "OK" : "Desvío"}</span>
                            </td>
                            <td className="num when">{new Date(c.created_at).toLocaleString("es-AR")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {tab === "exportacion" && (
          <>
            <section className="card">
              <h2>Proforma de exportación</h2>
              <p className="hint">
                Cruza el lote (variedad, calibre, bolsa/hilo, procedencia) con el stock verificable. Si no hay bolsas, no
                se emite.
              </p>
              <div className="fields fields-export">
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
                    className={listening ? "listening" : ""}
                  />
                </div>
                <div>
                  <label htmlFor="country">País / destino</label>
                  <input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
              </div>
              <div className="row-actions">
                <button type="button" className="btn-secondary" onClick={() => dictate(setBuyer)}>
                  {listening ? "Escuchando…" : "Dictar comprador"}
                </button>
                <button type="button" className="btn-primary" onClick={doProforma} disabled={busy}>
                  Armar proforma
                </button>
              </div>
              {msg && tab === "exportacion" && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
            </section>

            {doc && <ProformaCard doc={doc} />}

            <section className="card">
              <h2>Proformas emitidas</h2>
              {proformas.length === 0 ? (
                <p className="empty">Todavía no hay proformas. Armá una con stock verificable.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Lote</th>
                        <th>Comprador</th>
                        <th>Destino</th>
                        <th>Bolsas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proformas.map((p) => (
                        <tr key={p.id}>
                          <td className="num when">{new Date(p.created_at).toLocaleString("es-AR")}</td>
                          <td>{p.lot_code}</td>
                          <td>{p.buyer}</td>
                          <td>{p.dest_country}</td>
                          <td className="num">{p.bags}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function ProformaCard({ doc }: { doc: ProformaDoc }) {
  const tr = doc.trace ?? {};
  return (
    <section className="card proforma">
      <header className="proforma-head">
        <h2>Proforma / documentación de exportación</h2>
        <p>Semilla para siembra · {doc.today}</p>
      </header>
      <div className="proforma-grid">
        <div>
          <h3>Comprador</h3>
          <dl>
            <dt>Nombre</dt>
            <dd>{doc.buyer}</dd>
            <dt>País / destino</dt>
            <dd>{doc.country}</dd>
          </dl>
        </div>
        <div>
          <h3>Carga</h3>
          <dl>
            <dt>Lugar</dt>
            <dd>{doc.from}</dd>
            <dt>Bolsas</dt>
            <dd>{doc.bags}</dd>
            <dt>Kilogramos</dt>
            <dd>{doc.kg ? `${doc.kg.toLocaleString("es-AR")} (est.)` : "Según pesada"}</dd>
          </dl>
        </div>
        <div>
          <h3>Lote</h3>
          <dl>
            <dt>Variedad</dt>
            <dd>
              {doc.variety} · {doc.lot}
            </dd>
            <dt>Categoría / calibre</dt>
            <dd>
              {tr.categoria || "semilla"} · {tr.calibre || "según planta"}
            </dd>
            <dt>Identificación</dt>
            <dd>
              bolsa {tr.bolsa || "s/d"} / hilo {tr.hilo || "s/d"}
            </dd>
            <dt>Procedencia</dt>
            <dd>{tr.campo || "Santa Ana"}</dd>
          </dl>
        </div>
      </div>
      <p className="proforma-foot">Campos cruzados con trazabilidad del lote. Completar DTV / SENASA en destino.</p>
    </section>
  );
}

function StockTable({
  stock,
  rows,
}: {
  stock: StockPayload | null;
  rows: StockPayload["rows"];
}) {
  if (!stock) return <p className="empty">Cargando saldos…</p>;
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

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onstart: () => void;
  onend: () => void;
  onerror: (ev: { error: string }) => void;
  onresult: (ev: SpeechRecognitionEvent) => void;
  start: () => void;
};

type SpeechRecognitionEvent = {
  results: { 0: { 0: { transcript: string } } };
};
