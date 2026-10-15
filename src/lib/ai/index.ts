import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt } from "../crypto";
import { AiError, completeWithChain, parseJson, type CompleteInput, type CompleteResult, type ProviderConfig } from "./providers";

/**
 * Rantai provider aktif dari DB (urut `position`).
 * Kalau tabel kosong, pakai key dari env (GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY)
 * supaya bisa langsung jalan tanpa setup UI.
 */
export async function loadChain(): Promise<ProviderConfig[]> {
  const rows = await db()
    .select()
    .from(schema.aiProviders)
    .where(eq(schema.aiProviders.enabled, true))
    .orderBy(asc(schema.aiProviders.position), asc(schema.aiProviders.id));
  const chain: ProviderConfig[] = [];
  for (const r of rows) {
    try {
      chain.push({ ...r, apiKey: r.apiKeyEnc ? decrypt(r.apiKeyEnc) : "" });
    } catch {
      /* key rusak (AUTH_SECRET berubah) → lewati */
    }
  }
  if (chain.length || rows.length) return chain;

  const env = process.env;
  if (env.KENARI_API_KEY)
    chain.push({ id: "env-kenari", name: "Kenari.id (env)", kind: "openai", baseUrl: env.KENARI_BASE_URL || "https://kenari.id/v1", model: env.KENARI_MODEL || "gemini-3-8-flash", apiKey: env.KENARI_API_KEY, priceIn: 0, priceOut: 0 });
  if (env.GEMINI_API_KEY)
    chain.push({ id: "env-gemini", name: "Gemini (env)", kind: "gemini", baseUrl: "", model: env.GEMINI_MODEL || "gemini-2.5-flash", apiKey: env.GEMINI_API_KEY, priceIn: 0, priceOut: 0 });
  if (env.OPENAI_API_KEY)
    chain.push({ id: "env-openai", name: "OpenAI-compat (env)", kind: "openai", baseUrl: env.OPENAI_BASE_URL || "", model: env.OPENAI_MODEL || "gpt-4.1-mini", apiKey: env.OPENAI_API_KEY, priceIn: 0, priceOut: 0 });
  if (env.ANTHROPIC_API_KEY)
    chain.push({ id: "env-anthropic", name: "Claude (env)", kind: "anthropic", baseUrl: "", model: env.ANTHROPIC_MODEL || "claude-haiku-5-5", apiKey: env.ANTHROPIC_API_KEY, priceIn: 0, priceOut: 0 });
  return chain;
}

export async function complete(input: CompleteInput) {
  return completeWithChain(await loadChain(), input);
}

/**
 * Minta jawaban JSON. Kalau JSON rusak / terpotong walau sudah diperbaiki otomatis,
 * minta ulang sekali dengan instruksi lebih ketat (dan jatah token lebih besar kalau terpotong).
 * Semua percobaan (termasuk yang gagal) dikembalikan supaya biayanya tetap tercatat.
 */
export async function completeJson<T>(
  input: CompleteInput,
  opts: { validate?: (v: T) => string | null; onAttempt?: (r: CompleteResult) => void } = {},
) {
  const { validate, onAttempt } = opts;
  const chain = await loadChain();
  const attempts: CompleteResult[] = [];
  let lastErr = "";
  let lastRaw = "";
  for (let i = 0; i < 2; i++) {
    const r = await completeWithChain(chain, i === 0 ? { ...input, json: true } : {
      ...input,
      json: true,
      temperature: Math.min(input.temperature ?? 0.7, 0.3),
      maxTokens: lastErr.includes("terpotong") ? Math.round((input.maxTokens ?? 2048) * 1.6) : input.maxTokens,
      prompt: `${input.prompt}\n\nPENTING: jawaban sebelumnya ditolak (${lastErr}). Balas HANYA satu objek JSON valid, tanpa teks lain, tanpa markdown. Tanda kutip di dalam teks wajib di-escape (\\") atau ganti dengan ' .`,
    });
    attempts.push(r);
    onAttempt?.(r);
    lastRaw = r.text;
    try {
      const v = parseJson<T>(r.text);
      const problem = validate?.(v) ?? null;
      if (!problem) return { value: v, result: r, attempts };
      lastErr = problem;
    } catch {
      lastErr = r.truncated ? "jawaban terpotong karena batas token" : "JSON tidak valid";
    }
  }
  throw new AiError(`Jawaban AI tidak bisa dipakai setelah 2 percobaan: ${lastErr}`, lastRaw);
}

export { parseJson, AiError };
