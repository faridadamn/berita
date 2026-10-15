import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import { eq, asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { brand } from "../config";
import { SlideImage, W, H, type SlideInput } from "./templates";

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
  ];
  return fonts;
}

/** Unduh foto artikel → JPEG 1080x1350 (crop tengah) sebagai data URI. Gagal → null (pakai gradien). */
async function loadPhoto(url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0 BeritaStudio" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const jpg = await sharp(buf).rotate().resize(W, H, { fit: "cover", position: "attention" }).jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Hilangkan karakter yang tidak ada di font (emoji dll) supaya tidak jadi kotak. */
const clean = (s: string) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();

type PostForRender = typeof schema.posts.$inferSelect & { imageUrl: string | null; sourceName: string };

export function renderHashOf(p: Pick<PostForRender, "template" | "slides" | "kicker" | "imageUrl" | "sourceName">) {
  return createHash("sha1")
    .update(JSON.stringify([p.template, p.slides, p.kicker, p.imageUrl, p.sourceName, brand.handle, 2]))
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
  const sourceName = r.sourceName ?? (r.topicUrl ? new URL(r.topicUrl).hostname.replace(/^www\./, "") : "—");
  return { ...r.post, imageUrl: r.imageUrl, sourceName };
}

/** Render semua slide sebuah post jadi JPEG dan simpan ke tabel renders. */
export async function renderPost(postId: number) {
  const p = await loadPostForRender(postId);
  if (!p) throw new Error(`Post #${postId} tidak ditemukan`);
  if (!p.slides.length) throw new Error("Post tidak punya slide");
  const [f, photo] = await Promise.all([loadFonts(), loadPhoto(p.imageUrl)]);
  const template = (["stabilo", "putih", "foto"].includes(p.template) ? p.template : "stabilo") as SlideInput["template"];

  const images: Buffer[] = [];
  for (const [i, s] of p.slides.entries()) {
    const svg = await satori(
      SlideImage({
        template,
        kind: s.kind,
        headline: clean(s.headline),
        body: s.body ? clean(s.body) : undefined,
        index: i + 1,
        kicker: p.kicker,
        sourceName: p.sourceName,
        handle: brand.handle,
        hue: (p.id * 47) % 360,
        photo,
      }),
      { width: W, height: H, fonts: f, loadAdditionalAsset: async () => "" },
    );
    images.push(await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toBuffer());
  }

  await db().transaction(async (tx) => {
    await tx.delete(schema.renders).where(eq(schema.renders.postId, postId));
    await tx.insert(schema.renders).values(images.map((data, i) => ({ postId, idx: i + 1, data, mime: "image/jpeg" })));
    await tx
      .update(schema.posts)
      .set({ renderedAt: new Date(), renderHash: renderHashOf(p), renderError: null })
      .where(eq(schema.posts.id, postId));
  });
  return { count: images.length, photo: !!photo };
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
