export function groqKey() {
  return (process.env.GROQ_API_KEY ?? "")
    .trim()
    .replace(/^["']+|["';]+$/g, "")
    .trim();
}
