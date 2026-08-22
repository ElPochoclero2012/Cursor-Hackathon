"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  remito?: string | null;
  source?: string;
};

const TYPE_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  ingreso: "Ingreso",
  egreso: "Egreso",
};

export default function Page() {
  const [stock, setStock] = useState<StockPayload | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [s, m, c] = await Promise.all([
      fetch("/api/stock").then((r) => r.json()),
      fetch("/api/movements").then((r) => r.json()),
      fetch("/api/catalog").then((r) => r.json()),
    ]);
    setStock(s);
    setMovements(m);
    const map: Record<string, string> = {};
    for (const loc of c.locations as { id: string; name: string }[]) {
      map[loc.id] = loc.name;
    }
    setNames(map);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!stock) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return stock.rows;
    return stock.rows.filter(
      (r) =>
        r.code.toLowerCase().includes(needle) ||
        r.variety.toLowerCase().includes(needle),
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

  function dictate() {
    const SR =
      typeof window !== "undefined" &&
      ((window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition ||
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition);
    if (!SR) {
      setMsg({
        kind: "error",
        text: "Este navegador no dicta. Usá Chrome o pegá el texto (está en docs/SPEECH.md).",
      });
      return;
    }
    const rec = new SR();
    rec.lang = "es-AR";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setMsg({ kind: "error", text: "No se oyó el micrófono. Pegá la frase de backup." });
    };
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const said = ev.results[0][0].transcript;
      setText(said);
    };
    rec.start();
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Stock de semilla</h1>
          <p>Campaña 2026 · una sola fuente de verdad · bolsas por lote y ubicación</p>
        </div>
        <span className="badge">4 bodegas · sin planilla</span>
      </header>

      <main className="wrap">
        <div className="grid-2">
          <section className="card">
            <h2>Registrar movimiento</h2>
            <p className="hint">
              Lenguaje libre, como en el galpón. Ejemplo: «Pasá 80 bolsas del lote 241 Agata de
              Dos Pancani al galpón». Se interpreta en el servidor, sin OpenAI.
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
              <button type="button" className="btn-secondary" onClick={dictate}>
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

            {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
          </section>

          <section className="card">
            <h2>Stock actual</h2>
            <p className="hint">Saldos en bolsas. Lo que ves acá es lo que hay, no una versión de Excel.</p>
            <div className="filter">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar por variedad o lote"
                aria-label="Filtrar stock"
              />
            </div>
            <div className="table-wrap">
              {stock && (
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
              )}
              {stock && rows.length === 0 && <p className="empty">Ningún lote coincide con el filtro.</p>}
            </div>
          </section>
        </div>

        <section className="card">
          <h2>Últimos movimientos</h2>
          <p className="hint">Historial append-only: no se edita la celda, se registra el remito lógico.</p>
          {movements.length === 0 ? (
            <p className="empty">Todavía no hay movimientos en esta sesión. El stock inicial viene del seed.</p>
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
                  <span className="num when">
                    {new Date(m.created_at).toLocaleString("es-AR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onstart: () => void;
  onend: () => void;
  onerror: () => void;
  onresult: (ev: SpeechRecognitionEvent) => void;
  start: () => void;
};

type SpeechRecognitionEvent = {
  results: { 0: { 0: { transcript: string } } };
};
