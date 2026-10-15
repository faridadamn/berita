import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt } from "../crypto";
import { completeWithChain, type CompleteInput, type ProviderConfig } from "./providers";

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

export { parseJson, AiError } from "./providers";
