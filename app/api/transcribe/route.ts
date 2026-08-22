import { logB } from "@/lib/b-debug";
import { groqKey } from "@/lib/groq-key";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const key = groqKey();
  if (!key) {
    return NextResponse.json(
      { error: "Falta GROQ_API_KEY. Sin ella el micrófono no puede transcribir." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size < 64) {
    return NextResponse.json({ error: "No llegó audio. Grabá un segundo y cortá." }, { status: 400 });
  }

  const body = new FormData();
  body.append("file", audio, audio.name || "dictado.webm");
  body.append("model", "whisper-large-v3");
  body.append("language", "es");
  body.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: `Groq Whisper ${res.status}. ${detail.slice(0, 180)}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) {
    logB("POST /api/transcribe", { bytes: audio.size }, { error: "vacío" });
    return NextResponse.json({ error: "No se entendió el audio. Hablá más cerca y más largo." }, { status: 422 });
  }
  logB("POST /api/transcribe", { bytes: audio.size }, { text });
  return NextResponse.json({ text });
}
