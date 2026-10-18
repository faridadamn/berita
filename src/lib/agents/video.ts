import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AiError, completeJson } from "../ai";
import { getBrand } from "../brand-kit";
import { SHOT_KINDS, formatPrice, isSalesType, type Shot, type ShotKind, type Slide } from "../content";
import { getProductsByIds } from "../products";
import { getSettings } from "../settings";
import { Usage, audience, brainFor, logRun } from "./common";

type Post = typeof schema.posts.$inferSelect;
const KINDS = new Set(SHOT_KINDS.map((k) => k.key));

/** Rapikan teks shot: tanpa emoji, tanpa titik di akhir, maks `max` kata. */
export function tidy(text: unknown, max = 5) {
  const t = String(text ?? "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s/)[0] // kalimat pertama saja
    .replace(/[.。]+$/, "");
  const w = t.split(" ").filter(Boolean);
  return w.slice(0, max).join(" ").replace(/[,;:–-]+$/, "");
}

/** Validasi + normalisasi daftar shot (dari AI atau dari editor). */
export function normalizeShots(input: unknown, productIds: number[]): Shot[] {
  if (!Array.isArray(input)) return [];
  const ids = new Set(productIds);
  const out: Shot[] = [];
  for (const raw of input.slice(0, 9)) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const kind = (KINDS.has(r.kind as ShotKind) ? r.kind : "point") as ShotKind;
    const text = tidy(r.text, 5);
    if (!text) continue;
    const shot: Shot = { kind, text };
    const emph = tidy(r.emph, 2);
    if (emph && text.toLowerCase().includes(emph.toLowerCase())) shot.emph = emph;
    const label = tidy(r.label, 3);
    if (label) shot.label = label;
    if ((kind === "step" || kind === "product") && Number(r.n) > 0) shot.n = Math.round(Number(r.n));
    if (kind === "product") {
      const id = Number(r.productId);
      if (!ids.has(id)) continue; // produk harus dari post ini
      shot.productId = id;
    }
    if (kind === "compare") {
      const list = (Array.isArray(r.productIds) ? r.productIds.map(Number) : productIds).filter((id) => ids.has(id)).slice(0, 3);
      if (list.length < 2) continue;
      shot.productIds = list;
      const pick = Number(r.pick);
      shot.pick = pick >= 1 && pick <= list.length ? Math.round(pick) : 1;
    }
    out.push(shot);
  }
  // pembuka di depan, penutup di belakang (maks satu)
  if (out.length && out[0].kind !== "hook") out[0] = { ...out[0], kind: out[0].kind === "cta" ? "hook" : out[0].kind === "point" ? "hook" : out[0].kind };
  const ctas = out.filter((s) => s.kind === "cta");
  const body = out.filter((s) => s.kind !== "cta");
  return [...body, ctas[ctas.length - 1] ?? { kind: "cta", text: "Cek link di bio" }];
}

/** Naskah cadangan tanpa AI: dari slide post (judul dipotong 5 kata). */
export function shotsFromSlides(slides: Slide[], productIds: number[]): Shot[] {
  const shots: unknown[] = slides.map((s) => {
    if (s.kind === "cover") return { kind: "hook", text: s.headline };
    if (s.kind === "step") return { kind: "step", text: s.headline, n: s.step };
    if (s.kind === "product") return { kind: "product", text: s.headline, productId: s.productId, n: s.step };
    if (s.kind === "compare") return { kind: "compare", text: s.headline, productIds: s.productIds, pick: s.pick };
    if (s.kind === "cta") return { kind: "cta", text: s.headline };
    if (s.kind === "list") return (s.items ?? []).slice(0, 3).map((it) => ({ kind: "point", text: it }));
    if (s.kind === "verdict" && typeof s.rating === "number") return { kind: "point", text: `Nilai ${s.rating} dari 10`, emph: String(s.rating) };
    return { kind: "point", text: s.headline };
  });
  return normalizeShots(shots.flat().slice(0, 8), productIds);
}

/** AI menulis naskah video dari isi post. Gagal → naskah dari slide. */
export async function writeVideoScript(postId: number): Promise<{ shots: Shot[]; ai: boolean; error?: string }> {
  const [p] = await db().select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (!p) throw new Error("Post tidak ditemukan");
  const products = await getProductsByIds(p.productIds);
  const usage = new Usage();
  try {
    const shots = await askAi(p, products, usage);
    await logRun("copywriter", `Menulis naskah video post #${postId} (${shots.length} shot)`, { usage, detail: { postIds: [postId] } });
    return { shots, ai: true };
  } catch (e) {
    await logRun("copywriter", `Naskah video post #${postId} gagal ditulis AI, pakai slide: ${(e as Error).message}`, {
      ok: false,
      usage,
      detail: { error: (e as Error).message, raw: e instanceof AiError ? e.raw : undefined, postIds: [postId] },
    });
    return { shots: shotsFromSlides(p.slides, p.productIds), ai: false, error: (e as Error).message };
  }
}

async function askAi(p: Post, products: Awaited<ReturnType<typeof getProductsByIds>>, usage: Usage) {
  const s = await getSettings();
  const brand = await getBrand();
  const sales = isSalesType(p.contentType) && products.length > 0;
  const slideText = p.slides
    .map((sl, i) => {
      const extra = [sl.body, ...(sl.items ?? []), ...(sl.cons ?? []).map((c) => `minus: ${c}`)].filter(Boolean).join(" | ");
      const prod = sl.productId ? ` [produk id ${sl.productId}]` : sl.productIds ? ` [bandingkan id ${sl.productIds.join(",")}]` : "";
      return `${i + 1}. (${sl.kind}${sl.step ? ` ${sl.step}` : ""}) ${sl.headline}${prod}${extra ? ` — ${extra}` : ""}`;
    })
    .join("\n");
  const prodText = products.map((x) => `- id ${x.id}: ${x.name}${x.price ? ` · ${formatPrice(x.price, x.currency)}` : ""}`).join("\n");

  const system =
    `Kamu sutradara video pendek 9:16 (Reels/TikTok/Shopee Video) di redaksi konten. ${await audience()}\n` +
    `Ubah postingan carousel jadi NASKAH SHOT untuk video 15-25 detik. Tulis dalam ${s.language}.\n` +
    `Aturan WAJIB:\n` +
    `- 5-7 shot. Shot pertama kind "hook" (bikin berhenti scroll), shot terakhir kind "cta".\n` +
    `- text tiap shot MAKSIMAL 5 KATA, sentence case, tanpa titik di akhir, tanpa emoji, tanpa tagar. Satu gagasan per shot.\n` +
    `- emph: 1-2 kata dari text yang distabilo (opsional). label: 1-2 kata konteks kecil (opsional, jarang).\n` +
    `- kind yang boleh: hook, point, step (pakai "n" nomor langkah), cta` +
    (sales ? `, product (pakai "productId" dari daftar produk; harga ditampilkan otomatis — JANGAN tulis harga di text), compare (pakai "productIds" 2-3 id dan "pick" = urutan 1-based produk terbaik)` : "") +
    `.\n- Fakta hanya dari postingan. Jangan mengarang angka.\n` +
    `- cta: ajakan pendek, mis. "Link di bio", "Simpan biar nggak lupa", "Follow ${brand.handle}".` +
    (await brainFor("copywriter")) +
    `\n\nJawab HANYA JSON: {"shots":[{"kind":"hook","text":"","emph":""}]}`;
  const prompt =
    `JENIS KONTEN: ${p.contentType}\nJUDUL: ${p.headline}\n\nSLIDE:\n${slideText}` + (sales ? `\n\nPRODUK:\n${prodText}` : "");

  const { value } = await completeJson<{ shots: unknown[] }>(
    { system, prompt, temperature: 0.7, maxTokens: 1200 },
    {
      onAttempt: (r) => usage.add(r),
      validate: (v) => {
        if (!v || !Array.isArray(v.shots)) return "shots bukan array";
        const n = normalizeShots(v.shots, p.productIds);
        return n.length >= 3 ? null : "shot kurang dari 3";
      },
    },
  );
  return normalizeShots(value.shots, p.productIds);
}
