/**
 * Lapisan AI multi-provider (pola sama dengan satsh): beberapa profil provider disimpan,
 * yang aktif membentuk rantai fallback sesuai urutan. Kalau satu error / kena limit,
 * provider berikutnya yang menjawab.
 *
 * Jenis yang didukung:
 *  - openai    : semua API "OpenAI-compatible" (OpenAI, DeepSeek, OpenRouter, Groq, Together,
 *                Ollama/LM Studio lokal, 9router, dll) → POST {base}/chat/completions
 *  - gemini    : Google Gemini API key → models/{model}:generateContent
 *  - anthropic : Claude API → POST {base}/v1/messages
 */

export type ProviderKind = "openai" | "gemini" | "anthropic";

export type ProviderConfig = {
  id: number | string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  priceIn: number; // USD / 1jt token
  priceOut: number;
};

export type CompleteInput = {
  system: string;
  prompt: string;
  /** minta jawaban JSON; hasil tetap di-parse longgar oleh parseJson() */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type CompleteResult = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  provider: string;
  model: string;
  /** error dari provider sebelumnya di rantai fallback (kalau ada) */
  fallbackErrors: string[];
};

export class AiError extends Error {}

export const presets: { label: string; kind: ProviderKind; baseUrl: string; model: string }[] = [
  { label: "Gemini (API key)", kind: "gemini", baseUrl: "", model: "gemini-2.5-flash" },
  { label: "OpenAI", kind: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  { label: "Claude (Anthropic)", kind: "anthropic", baseUrl: "", model: "claude-haiku-5-5" },
  { label: "DeepSeek", kind: "openai", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "OpenRouter", kind: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4.1-mini" },
  { label: "Groq", kind: "openai", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { label: "Ollama lokal", kind: "openai", baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
  { label: "Custom (OpenAI-compatible)", kind: "openai", baseUrl: "", model: "" },
];

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 90_000);
const trimSlash = (s: string) => s.replace(/\/+$/, "");

async function post(url: string, headers: Record<string, string>, body: unknown) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const err = e as Error;
    throw new AiError(err.name === "TimeoutError" ? `Timeout ${TIMEOUT_MS / 1000}s` : `Koneksi gagal: ${err.message}`);
  }
  const raw = await res.text();
  let j: any;
  try {
    j = raw.trimStart().startsWith("data:") ? fromSse(raw) : JSON.parse(raw);
  } catch {
    throw new AiError(`HTTP ${res.status}: respon bukan JSON: ${raw.slice(0, 200)}`);
  }
  if (!res.ok || (j?.error && !j.choices && !j.candidates && !j.content)) {
    const e = j?.error ?? j;
    const msg = typeof e === "string" ? e : e?.message ?? JSON.stringify(e).slice(0, 300);
    throw new AiError(`HTTP ${res.status}: ${msg}`);
  }
  return j;
}

/** Beberapa router OpenAI-compatible tetap streaming walau stream=false. Gabungkan jadi satu respon. */
function fromSse(text: string) {
  let content = "";
  let usage: any;
  let error: any;
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l.startsWith("data:")) continue;
    const data = l.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const j = JSON.parse(data);
      if (j.error) error = j.error;
      if (j.usage) usage = j.usage;
      for (const ch of j.choices ?? []) {
        const d = ch.delta ?? ch.message ?? {};
        if (typeof d.content === "string") content += d.content;
      }
    } catch {
      /* abaikan baris rusak */
    }
  }
  if (error && !content) return { error };
  return { choices: [{ message: { content } }], usage };
}

async function callOne(p: ProviderConfig, input: CompleteInput) {
  const maxTokens = input.maxTokens ?? 2048;
  const temperature = input.temperature ?? 0.7;

  if (p.kind === "gemini") {
    const base = trimSlash(p.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
    const j = await post(`${base}/models/${encodeURIComponent(p.model)}:generateContent`, { "x-goog-api-key": p.apiKey }, {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        maxOutputTokens: Math.max(maxTokens, 4000),
        temperature,
        ...(input.json ? { responseMimeType: "application/json" } : {}),
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const cand = j.candidates?.[0];
    if (!cand) throw new AiError(`Gemini tidak menjawab (${j.promptFeedback?.blockReason ?? "tanpa kandidat"})`);
    const text = (cand.content?.parts ?? []).map((x: any) => (x.thought ? "" : x.text ?? "")).join("");
    if (!text) throw new AiError(`Gemini jawaban kosong (${cand.finishReason ?? "?"})`);
    return { text, tokensIn: j.usageMetadata?.promptTokenCount ?? 0, tokensOut: j.usageMetadata?.candidatesTokenCount ?? 0 };
  }

  if (p.kind === "anthropic") {
    const base = trimSlash(p.baseUrl || "https://api.anthropic.com");
    const j = await post(`${base}/v1/messages`, { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" }, {
      model: p.model,
      max_tokens: maxTokens,
      temperature,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });
    const text = (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    if (!text) throw new AiError(`Claude jawaban kosong (${j.stop_reason ?? "?"})`);
    return { text, tokensIn: j.usage?.input_tokens ?? 0, tokensOut: j.usage?.output_tokens ?? 0 };
  }

  // OpenAI-compatible
  const base = trimSlash(p.baseUrl || "https://api.openai.com/v1");
  const j = await post(`${base}/chat/completions`, p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {}, {
    model: p.model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.prompt },
    ],
    max_tokens: maxTokens,
    temperature,
    stream: false,
  });
  const msg = j.choices?.[0]?.message;
  const text = typeof msg?.content === "string" ? msg.content : Array.isArray(msg?.content) ? msg.content.map((c: any) => c.text ?? "").join("") : "";
  if (!text) throw new AiError(`Jawaban kosong (${j.choices?.[0]?.finish_reason ?? "?"})`);
  return { text, tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
}

/** Coba tiap provider sesuai urutan; yang pertama berhasil dipakai. */
export async function completeWithChain(chain: ProviderConfig[], input: CompleteInput): Promise<CompleteResult> {
  if (!chain.length) throw new AiError("Belum ada provider AI aktif. Buka Admin → Pengaturan → Provider AI.");
  const errs: string[] = [];
  for (const p of chain) {
    try {
      const r = await callOne(p, input);
      const costUsd = (r.tokensIn * p.priceIn + r.tokensOut * p.priceOut) / 1_000_000;
      return { ...r, costUsd, provider: p.name, model: p.model, fallbackErrors: errs };
    } catch (e) {
      errs.push(`${p.name}: ${(e as Error).message}`);
    }
  }
  throw new AiError(`Semua provider gagal — ${errs.join(" | ")}`);
}

/** Daftar model yang tersedia di provider (untuk tombol "Ambil daftar model"). */
export async function listModels(p: Pick<ProviderConfig, "kind" | "baseUrl" | "apiKey">): Promise<string[]> {
  const get = async (url: string, headers: Record<string, string>) => {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new AiError(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  if (p.kind === "gemini") {
    const base = trimSlash(p.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
    const j = await get(`${base}/models?pageSize=200`, { "x-goog-api-key": p.apiKey });
    return (j.models ?? [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => String(m.name).replace(/^models\//, ""));
  }
  if (p.kind === "anthropic") {
    const base = trimSlash(p.baseUrl || "https://api.anthropic.com");
    const j = await get(`${base}/v1/models?limit=100`, { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" });
    return (j.data ?? []).map((m: any) => m.id);
  }
  const base = trimSlash(p.baseUrl || "https://api.openai.com/v1");
  const j = await get(`${base}/models`, p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {});
  return (j.data ?? []).map((m: any) => m.id).sort();
}

/** Ambil objek JSON dari teks model (tahan terhadap ```json fence, teks pembuka, dll). */
export function parseJson<T = unknown>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t) as T;
  } catch {
    const start = t.search(/[[{]/);
    const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1)) as T;
    throw new AiError(`Jawaban AI bukan JSON: ${t.slice(0, 160)}`);
  }
}
