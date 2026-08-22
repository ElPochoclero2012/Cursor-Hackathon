export type MoveHint = {
  type: string;
  lot_code: string;
  bags: number;
  from_id: string | null;
  to_id: string | null;
  from_name: string | null;
  to_name: string | null;
  created_at: string;
};

/** ponytail: hipótesis por reglas sobre el último movimiento; no es un modelo. Ampliar patrones acá. */
export function explainGap(input: {
  lot: string;
  locationId: string;
  locationName: string;
  declared: number;
  counted: number;
  moves: MoveHint[];
}): { ok: boolean; delta: number; hypothesis: string } {
  const delta = input.counted - input.declared;
  if (delta === 0) {
    return {
      ok: true,
      delta: 0,
      hypothesis: `El conteo coincide con el sistema (${input.declared} bolsas en ${input.locationName}). Se puede emitir orden de carga.`,
    };
  }

  const related = input.moves.filter((m) => m.lot_code === input.lot);
  const out = related.find(
    (m) => m.from_id === input.locationId && (m.type === "transferencia" || m.type === "egreso"),
  );
  const inn = related.find(
    (m) => m.to_id === input.locationId && (m.type === "transferencia" || m.type === "ingreso"),
  );

  const when = (iso: string) =>
    new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (delta < 0) {
    const falta = -delta;
    const matchBags = related.find(
      (m) => m.from_id === input.locationId && Number(m.bags) === falta,
    );
    const hint = matchBags ?? out;
    if (hint?.type === "transferencia") {
      const exacto = Number(hint.bags) === falta ? " (misma cantidad que el faltante)" : "";
      return {
        ok: false,
        delta,
        hypothesis: `Faltan ${falta} bolsas del lote ${input.lot} en ${input.locationName} (sistema ${input.declared}, conteo ${input.counted}). Lo más probable: el envío a frío/galpón del ${when(hint.created_at)} hacia ${hint.to_name || "destino"}${exacto} se cargó en origen y no se registró la llegada.`,
      };
    }
    if (hint?.type === "egreso") {
      return {
        ok: false,
        delta,
        hypothesis: `Faltan ${falta} bolsas del lote ${input.lot} en ${input.locationName}. Lo más probable: un retiro o entrega (${hint.bags} bolsas el ${when(hint.created_at)}) no quedó en esta ubicación — el típico error de la planilla al momento de cargar.`,
      };
    }
    return {
      ok: false,
      delta,
      hypothesis: `Faltan ${falta} bolsas del lote ${input.lot} en ${input.locationName} (declarado ${input.declared}, contado ${input.counted}). Hipótesis: salida o transferencia no registrada, o mercadería en otro frío (Cecive/Belmonte/Sasula) mal anotada.`,
    };
  }

  if (inn) {
    return {
      ok: false,
      delta,
      hypothesis: `Hay ${delta} bolsas de más del lote ${input.lot} en ${input.locationName}. Lo más probable: un ingreso o retorno (${inn.bags} bolsas el ${when(inn.created_at)}) se recibió físicamente y no se cargó al sistema.`,
    };
  }
  return {
    ok: false,
    delta,
    hypothesis: `Hay ${delta} bolsas de más del lote ${input.lot} en ${input.locationName}. Hipótesis: ingreso o retorno de frío no cargado.`,
  };
}
