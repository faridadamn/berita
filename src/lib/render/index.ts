import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import { eq, asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { brand } from "../config";
import { isTemplate, slideImage, type Slide, type TemplateKey } from "../content";
import { SlideImage, THEMES, W, H } from "./templates";

type Font = { name: string; data: Buffer; weight: 400 | 500 | 700 | 800; style: "normal" };
let fonts: Font[] | null = null;

async function loadFonts(): Promise<Font[]> {
  if (fonts) return fonts;
  const dir = path.join(process.cwd(), "src/lib/render/fonts");
  const f = (file: string) => readFile(path.join(dir, file));
  fonts = [
    { name: "Inter", data: await f("inter-latin-500-normal.woff"), weight: 500, style: "normal" },
    { name: "Inter", data: await f("inter-latin-700-normal.woff"), weight: 700, style: "normal" },
    { name: "Inter", data: await f("inter-latin-800-normal.woff"), weight: 800, style: "normal" },
    { name: "Anton", data: await f("anton-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "DM Serif Display", data: await f("dm-serif-display-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "JetBrains Mono", data: await f("jetbrains-mono-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "JetBrains Mono", data: await f("jetbrains-mono-latin-700-normal.woff"), weight: 700, style: "normal" },
  ];
  return fonts;
}

/* ───────────── Gambar ───────────── */

const cache = new Map<string, { at: number; data: Buffer | null }>();
const CACHE_MS = 15 * 60_000;

async function fetchImageBytes(ref: string): Promise<Buffer | null> {
  const m = /^asset:(\d+)$/.exec(ref);
  if (m) {
    const [a] = await db().select({ data: schema.assets.data }).from(schema.assets).where(eq(schema.assets.id, Number(m[1])));
    return a?.data ?? null;
  }
  if (!/^https?:\/\//.test(ref)) return null;
  const res = await fetch(ref, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0 BeritaStudio", accept: "image/*" } });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Unduh & normalisasi gambar (JPEG, maks 1200×1500) → data URI. Gagal → null (pakai gradien). */
async function loadPhoto(ref: string | null, grayscale = false): Promise<string | null> {
  if (!ref) return null;
  const key = `${ref}|${grayscale ? 1 : 0}`;
  const hit = cache.get(key);
  let jpg: Buffer | null;
  if (hit && Date.now() - hit.at < CACHE_MS) jpg = hit.data;
  else {
    try {
      const raw = await fetchImageBytes(ref);
      jpg = raw
        ? await sharp(raw).rotate().resize(1200, 1500, { fit: "inside", withoutEnlargement: true }).grayscale(grayscale).jpeg({ quality: 86 }).toBuffer()
        : null;
    } catch {
      jpg = null;
    }
    cache.set(key, { at: Date.now(), data: jpg });
    if (cache.size > 60) cache.delete(cache.keys().next().value!);
  }
  return jpg ? `data:image/jpeg;base64,${jpg.toString("base64")}` : null;
}

/** Hilangkan karakter yang tidak ada di font (emoji dll) supaya tidak jadi kotak. */
const clean = (s: string) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/[ \t]+/g, " ").trim();
const cleanSlide = (s: Slide): Slide => ({
  ...s,
  headline: clean(s.headline ?? ""),
  body: s.body ? clean(s.body) : undefined,
  items: s.items?.map(clean).filter(Boolean),
  cons: s.cons?.map(clean).filter(Boolean),
  // kode: pertahankan spasi & baris
  code: s.code?.replace(/[\u{1F000}-\u{1FAFF}\u{FE0F}\u{200D}]/gu, ""),
});

/* ───────────── Post ───────────── */

export type PostForRender = typeof schema.posts.$inferSelect & { imageUrl: string | null; sourceName: string };

/** Gambar utama post (dipakai cover kalau slide tidak memilih gambar sendiri). */
export const mainImageOf = (p: Pick<PostForRender, "imageUrl" | "images">) => p.imageUrl ?? p.images?.[0] ?? null;

export function renderHashOf(p: Pick<PostForRender, "template" | "slides" | "kicker" | "imageUrl" | "images" | "sourceName">) {
  return createHash("sha1")
    .update(JSON.stringify([p.template, p.slides, p.kicker, mainImageOf(p), p.sourceName, brand.handle, 4]))
    .digest("hex")
    .slice(0, 16);
}

export async function loadPostForRender(postId: number): Promise<PostForRender | null> {
  const [r] = await db()
    .select({ post: schema.posts, imageUrl: schema.topics.imageUrl, topicUrl: schema.topics.url, sourceName: schema.sources.name })
    .from(schema.posts)
    .leftJoin(schema.topics, eq(schema.posts.topicId, schema.topics.id))
    .leftJoin(schema.sources, eq(schema.topics.sourceId, schema.sources.id))
    .where(eq(schema.posts.id, postId));
  if (!r) return null;
  const sourceName = r.sourceName ?? (r.topicUrl && /^https?:/.test(r.topicUrl) ? new URL(r.topicUrl).hostname.replace(/^www\./, "") : "");
  return { ...r.post, imageUrl: r.imageUrl, sourceName };
}

/**
 * Render slide sebuah post jadi JPEG.
 * @param only    indeks slide (0-based) yang dirender; default semua
 * @param template paksa template lain (untuk thumbnail pemilih template)
 * @param width   lebar keluaran (default 1080; thumbnail lebih kecil)
 */
export async function renderSlides(p: PostForRender, opts: { only?: number[]; template?: TemplateKey; width?: number; quality?: number } = {}) {
  const template = opts.template ?? (isTemplate(p.template) ? p.template : "stabilo");
  const gray = !!THEMES[template].grayscale;
  const f = await loadFonts();
  const main = mainImageOf(p);
  const idxs = opts.only ?? p.slides.map((_, i) => i);
  const out: Buffer[] = [];
  for (const i of idxs) {
    const slide = p.slides[i];
    if (!slide) continue;
    const photo = await loadPhoto(slideImage(slide, main), gray);
    const svg = await satori(
      SlideImage({
        template,
        slide: cleanSlide(slide),
        index: i + 1,
        total: p.slides.length,
        kicker: p.kicker || "Info",
        sourceName: p.sourceName,
        handle: brand.handle,
        hue: (p.id * 47) % 360,
        photo,
      }),
      { width: W, height: H, fonts: f, loadAdditionalAsset: async () => "" },
    );
    let img = sharp(Buffer.from(svg));
    if (opts.width && opts.width < W) img = img.resize(opts.width);
    out.push(await img.jpeg({ quality: opts.quality ?? 90, mozjpeg: true }).toBuffer());
  }
  return out;
}

/** Render semua slide sebuah post dan simpan ke tabel renders. */
export async function renderPost(postId: number) {
  const p = await loadPostForRender(postId);
  if (!p) throw new Error(`Post #${postId} tidak ditemukan`);
  if (!p.slides.length) throw new Error("Post tidak punya slide");
  const images = await renderSlides(p);
  await db().transaction(async (tx) => {
    await tx.delete(schema.renders).where(eq(schema.renders.postId, postId));
    await tx.insert(schema.renders).values(images.map((data, i) => ({ postId, idx: i + 1, data, mime: "image/jpeg" })));
    await tx
      .update(schema.posts)
      .set({ renderedAt: new Date(), renderHash: renderHashOf(p), renderError: null })
      .where(eq(schema.posts.id, postId));
  });
  return { count: images.length, photo: !!mainImageOf(p) };
}

export async function getRender(postId: number, idx: number) {
  const [r] = await db()
    .select({ data: schema.renders.data, mime: schema.renders.mime, createdAt: schema.renders.createdAt })
    .from(schema.renders)
    .where(eq(schema.renders.postId, postId))
    .orderBy(asc(schema.renders.idx))
    .offset(idx - 1)
    .limit(1);
  return r ?? null;
}

export async function getAllRenders(postId: number) {
  return db()
    .select({ idx: schema.renders.idx, data: schema.renders.data })
    .from(schema.renders)
    .where(eq(schema.renders.postId, postId))
    .orderBy(asc(schema.renders.idx));
}

export { W, H };
