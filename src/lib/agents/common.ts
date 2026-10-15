import "server-only";
import { db, schema } from "@/db";
import { getBrandKit } from "../brand-kit";
import type { CompleteResult } from "../ai/providers";
import type { RunDetail } from "@/db/schema";

export type AgentName = "scout" | "analis" | "copywriter" | "designer" | "publisher" | "system";

/** Akumulasi pemakaian AI dalam satu putaran agen. */
export class Usage {
  tokensIn = 0;
  tokensOut = 0;
  costUsd = 0;
  provider: string | null = null;
  model: string | null = null;
  fallbacks = new Set<string>();
  calls = 0;
  add(r: CompleteResult) {
    this.calls++;
    for (const e of r.fallbackErrors) this.fallbacks.add(e.split(":")[0]);
    this.tokensIn += r.tokensIn;
    this.tokensOut += r.tokensOut;
    this.costUsd += r.costUsd;
    this.provider = r.provider;
    this.model = r.model;
  }
}

const clip = (s: string | undefined, n: number) => (s && s.length > n ? s.slice(0, n) + `… (+${s.length - n} karakter)` : s);

export async function logRun(agent: AgentName, message: string, opts: { ok?: boolean; usage?: Usage; detail?: RunDetail } = {}) {
  const u = opts.usage;
  await db().insert(schema.agentRuns).values({
    agent,
    message: (u?.fallbacks.size ? `${message} · via ${u.provider} (${[...u.fallbacks].join(", ")} gagal)` : message).slice(0, 1000),
    ok: opts.ok ?? true,
    provider: u?.provider ?? null,
    model: u?.model ?? null,
    tokensIn: u?.tokensIn ?? 0,
    tokensOut: u?.tokensOut ?? 0,
    costUsd: u?.costUsd ?? 0,
    detail: opts.detail
      ? {
          ...opts.detail,
          raw: clip(opts.detail.raw, 6000),
          stack: clip(opts.detail.stack, 2000),
          items: opts.detail.items?.map((i) => ({ ...i, raw: clip(i.raw, 3000) })),
        }
      : null,
  });
}

/** Catatan Brain yang berlaku untuk agen tertentu, digabung jadi teks untuk system prompt. */
export async function brainFor(agent: AgentName) {
  const notes = await db().select().from(schema.brainNotes);
  const relevant = notes.filter((n) => !n.appliesTo.length || n.appliesTo.includes(agent));
  if (!relevant.length) return "";
  return "\n\nPEDOMAN REDAKSI (wajib diikuti):\n" + relevant.map((n) => `## ${n.title}\n${n.content}`).join("\n\n");
}

export async function audience() {
  const k = await getBrandKit();
  return `Akun ${k.handle} (${k.name}) — ${k.about}`;
}

/** HTML → teks polos. */
export function stripHtml(html: string) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export const UA = "Mozilla/5.0 (compatible; BeritaStudioBot/1.0; +https://github.com/faridadamn/berita)";
