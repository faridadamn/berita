"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/auth";
import { deletePost, getPostRaw, updatePost, updatePosts } from "@/lib/data";
import { runPipeline } from "@/lib/agents/pipeline";
import { renderPost } from "@/lib/render";
import { logRun } from "@/lib/agents/common";
import sharp from "sharp";
import type { PostStatus } from "@/lib/types";
import { SLIDE_KINDS, isContentType, isTemplate, type Slide } from "@/lib/content";
import { scrapeImages, searchStock } from "@/lib/images";

export type ActionState = { ok?: boolean; message?: string };

/** Tombol "Cari topik sekarang": jalankan Scout → Analis → Copywriter sekarang juga. */
export async function runNow(): Promise<ActionState> {
  await requireSession();
  try {
    const r = await runPipeline({ force: true });
    revalidatePath("/", "layout");
    if ("skipped" in r) return { ok: false, message: r.skipped };
    const parts = [
      r.scout ? `${r.scout.found} topik baru` : null,
      `${r.analis.scored} dinilai (${r.analis.passed} lolos)`,
      `${r.copywriter.drafted} draft ditulis`,
    ].filter(Boolean);
    const err = ("error" in r.analis && r.analis.error) || (r.copywriter.failed?.length ? r.copywriter.failed[0] : null);
    return { ok: !err, message: parts.join(" · ") + (err ? ` — ${err}` : "") };
  } catch (e) {
    await logRun("system", `Putaran manual error: ${(e as Error).message}`, { ok: false, detail: { error: (e as Error).message, stack: (e as Error).stack } }).catch(() => {});
    return { ok: false, message: (e as Error).message };
  }
}

export async function setPostStatus(id: number, status: PostStatus) {
  const s = await requireSession();
  await updatePost(id, { status, reviewedBy: Number(s.userId) });
  revalidatePath("/review");
  revalidatePath(`/review/${id}`);
}

/** Data yang dikirim editor post (client) — dinormalisasi di server. */
export type PostEdit = {
  kicker: string;
  template: string;
  contentType: string;
  slides: Slide[];
  caption: string;
  hashtags: string;
  platformText: { threads?: string; x?: string; linkedin?: string };
};

const KINDS = new Set(SLIDE_KINDS.map((k) => k.key));
const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);

function normalizeSlides(input: unknown, pool: string[]): Slide[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 12).map((raw, i): Slide => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const kind = KINDS.has(r.kind as Slide["kind"]) ? (r.kind as Slide["kind"]) : i === 0 ? "cover" : "body";
    const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 160).trim()).filter(Boolean).slice(0, 8) : undefined);
    const img = r.image === null ? null : typeof r.image === "string" && (pool.includes(r.image) || /^https?:\/\//.test(r.image)) ? r.image : undefined;
    const rating = Number(r.rating);
    return {
      kind,
      headline: str(r.headline, 200).trim() || "(tanpa judul)",
      ...(str(r.body, 600).trim() ? { body: str(r.body, 600).trim() } : {}),
      ...(kind === "step" ? { step: Math.max(1, Math.round(Number(r.step) || 1)) } : {}),
      ...(kind === "list" || kind === "verdict" ? { items: list(r.items) ?? [] } : {}),
      ...(kind === "verdict" ? { cons: list(r.cons) ?? [], ...(Number.isFinite(rating) && String(r.rating ?? "") !== "" ? { rating: Math.max(0, Math.min(10, rating)) } : {}) } : {}),
      ...((kind === "code" || kind === "step") && str(r.code, 2000).trim() ? { code: str(r.code, 2000).replace(/\s+$/, ""), lang: str(r.lang, 20).trim() || undefined } : {}),
      ...(img !== undefined ? { image: img } : {}),
    };
  });
}

/** Simpan seluruh isi editor post. `render` = langsung render ulang gambar. */
export async function savePost(id: number, data: PostEdit, render: boolean): Promise<ActionState> {
  await requireSession();
  const post = await getPostRaw(id);
  if (!post) return { ok: false, message: "Post tidak ditemukan" };
  const slides = normalizeSlides(data.slides, post.images ?? []);
  if (!slides.length) return { ok: false, message: "Minimal satu slide" };
  await updatePost(id, {
    headline: slides[0].headline,
    kicker: str(data.kicker, 24).trim() || post.kicker,
    template: isTemplate(data.template) ? data.template : post.template,
    contentType: isContentType(data.contentType) ? data.contentType : post.contentType,
    caption: str(data.caption, 2200),
    hashtags: str(data.hashtags, 400)
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((h) => "#" + h.replace(/^#+/, ""))
      .slice(0, 15),
    platformText: {
      threads: str(data.platformText?.threads, 500).trim(),
      x: str(data.platformText?.x, 280).trim(),
      linkedin: str(data.platformText?.linkedin, 3000).trim(),
    },
    slides,
  });
  let msg = "Tersimpan";
  if (render) {
    try {
      const r = await renderPost(id);
      msg = `Tersimpan & ${r.count} slide dirender`;
    } catch (e) {
      msg = `Tersimpan, tapi render gagal: ${(e as Error).message}`;
    }
  }
  revalidatePath(`/review/${id}`);
  revalidatePath("/review");
  return { ok: !msg.includes("gagal"), message: msg };
}

/* ───────────── Pustaka gambar post ───────────── */

async function addToPool(id: number, refs: string[]) {
  const post = await getPostRaw(id);
  if (!post) throw new Error("Post tidak ditemukan");
  const images = [...(post.images ?? [])];
  for (const r of refs) if (r && !images.includes(r)) images.push(r);
  await db().update(schema.posts).set({ images: images.slice(0, 30), updatedAt: new Date() }).where(eq(schema.posts.id, id));
  revalidatePath(`/review/${id}`);
  return images.length - (post.images?.length ?? 0);
}

export async function addImageUrl(id: number, url: string): Promise<ActionState> {
  await requireSession();
  const u = url.trim();
  if (!/^https?:\/\/\S+$/.test(u)) return { ok: false, message: "URL gambar harus diawali https://" };
  try {
    const r = await fetch(u, { method: "GET", signal: AbortSignal.timeout(12_000), headers: { "user-agent": "Mozilla/5.0 BeritaStudio" } });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) return { ok: false, message: `Bukan gambar yang bisa diambil (HTTP ${r.status}, ${type || "tanpa tipe"})` };
  } catch (e) {
    return { ok: false, message: `Tidak bisa mengambil gambar: ${(e as Error).message}` };
  }
  await addToPool(id, [u]);
  return { ok: true, message: "Gambar ditambahkan" };
}

export async function uploadImage(id: number, _: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireSession();
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: "Pilih file gambar dulu" };
  const refs: string[] = [];
  for (const f of files.slice(0, 10)) {
    if (f.size > 12 * 1024 * 1024) return { ok: false, message: `${f.name} lebih dari 12 MB` };
    try {
      const img = sharp(Buffer.from(await f.arrayBuffer())).rotate().resize(1600, 2000, { fit: "inside", withoutEnlargement: true });
      const data = await img.jpeg({ quality: 88 }).toBuffer();
      const meta = await sharp(data).metadata();
      const [a] = await db()
        .insert(schema.assets)
        .values({ data, mime: "image/jpeg", width: meta.width, height: meta.height, name: f.name.slice(0, 120), uploadedBy: Number(s.userId) })
        .returning({ id: schema.assets.id });
      refs.push(`asset:${a.id}`);
    } catch {
      return { ok: false, message: `${f.name} bukan gambar yang valid` };
    }
  }
  await addToPool(id, refs);
  return { ok: true, message: `${refs.length} gambar diunggah` };
}

export async function removeImage(id: number, ref: string) {
  await requireSession();
  const post = await getPostRaw(id);
  if (!post) return;
  await db()
    .update(schema.posts)
    .set({
      images: (post.images ?? []).filter((x) => x !== ref),
      // slide yang memakai gambar ini kembali ke otomatis
      slides: post.slides.map((sl) => (sl.image === ref ? { ...sl, image: undefined } : sl)),
      updatedAt: new Date(),
    })
    .where(eq(schema.posts.id, id));
  revalidatePath(`/review/${id}`);
}

/** Ambil ulang semua gambar dari artikel sumber (og:image + gambar di dalam artikel). */
export async function scrapeArticleImages(id: number): Promise<ActionState> {
  await requireSession();
  const [r] = await db()
    .select({ url: schema.topics.url, images: schema.topics.images, imageUrl: schema.topics.imageUrl })
    .from(schema.posts)
    .innerJoin(schema.topics, eq(schema.posts.topicId, schema.topics.id))
    .where(eq(schema.posts.id, id));
  if (!r) return { ok: false, message: "Post ini tidak punya artikel sumber" };
  const found = [r.imageUrl, ...(r.images ?? []), ...(await scrapeImages(r.url))].filter((x): x is string => !!x);
  const added = await addToPool(id, found);
  return { ok: true, message: added ? `${added} gambar baru dari artikel` : "Tidak ada gambar baru di artikel" };
}

export async function searchStockImages(query: string): Promise<{ ok: boolean; message?: string; results?: { thumb: string; url: string; credit: string }[] }> {
  await requireSession();
  try {
    return { ok: true, results: await searchStock(query) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function addStockImage(id: number, url: string): Promise<ActionState> {
  await requireSession();
  if (!/^https:\/\/images\.pexels\.com\//.test(url)) return { ok: false, message: "URL tidak valid" };
  await addToPool(id, [url]);
  return { ok: true, message: "Ditambahkan" };
}

export async function applyAlternative(id: number, headline: string) {
  await requireSession();
  const post = await getPostRaw(id);
  if (!post) return;
  const alts = [post.headline, ...post.headlineAlternatives.filter((h) => h !== headline)];
  await db()
    .update(schema.posts)
    .set({
      headline,
      headlineAlternatives: alts,
      slides: post.slides.map((s, i) => (i === 0 ? { ...s, headline } : s)),
      updatedAt: new Date(),
    })
    .where(eq(schema.posts.id, id));
  revalidatePath(`/review/${id}`);
}

export async function removePost(id: number) {
  await requireSession();
  await deletePost(id);
  revalidatePath("/review");
  redirect("/review");
}

export async function bulkSetStatus(ids: number[], status: PostStatus) {
  const s = await requireSession();
  await updatePosts(ids.filter(Number.isInteger), { status, reviewedBy: Number(s.userId) });
  revalidatePath("/review");
}

/** Kembalikan topik ke antrian (mis. topik yang ditolak Analis tapi menurut tim layak). */
export async function requeueTopic(id: number, to: "new" | "passed") {
  await requireSession();
  await db()
    .update(schema.topics)
    .set(to === "new" ? { status: "new", score: null, scoreReason: null } : { status: "passed", scoreReason: "Dipaksa tulis oleh tim" })
    .where(eq(schema.topics.id, id));
  revalidatePath("/radar");
}
