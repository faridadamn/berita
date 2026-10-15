"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/auth";
import { isContentType, isSalesType, type ContentType } from "@/lib/content";
import { rewriteSalesPost, type SalesType } from "@/lib/agents/sales";
import { draftTopic, rewritePost } from "@/lib/agents/copywriter";
import { fetchSource } from "@/lib/sources/fetch-source";
import { renderPost } from "@/lib/render";
import type { ActionState } from "./studio";

/**
 * "Buat konten": dari link (artikel, repo GitHub, video YouTube) atau dari ide/topik saja.
 * Membuat topik lalu langsung menulis draft (melewati Analis), lalu membuka halaman review-nya.
 */
export async function createContent(_: ActionState, f: FormData): Promise<ActionState> {
  await requireSession();
  const url = String(f.get("url") ?? "").trim();
  const idea = String(f.get("idea") ?? "").trim();
  const notes = String(f.get("notes") ?? "").trim().slice(0, 1000);
  const fmt = String(f.get("format") ?? "auto");
  const format: ContentType | undefined = isContentType(fmt) ? fmt : undefined;

  if (!url && !idea) return { ok: false, message: "Isi link atau tulis idenya" };
  if (url && !/^https?:\/\/\S+$/.test(url)) return { ok: false, message: "Link harus diawali https://" };

  let topicId: number;
  if (url) {
    const [existing] = await db().select({ id: schema.topics.id }).from(schema.topics).where(eq(schema.topics.url, url));
    if (existing) {
      topicId = existing.id;
      await db()
        .update(schema.topics)
        .set({ status: "passed", ...(format ? { format } : {}), ...(notes ? { meta: { notes } } : {}) })
        .where(eq(schema.topics.id, topicId));
    } else {
      const src = await fetchSource(url);
      const [t] = await db()
        .insert(schema.topics)
        .values({
          title: (src.title ?? url).slice(0, 300),
          url,
          summary: src.text.slice(0, 1200) || null,
          imageUrl: src.images[0] ?? null,
          images: src.images,
          category: src.kind === "github" ? "REPO" : src.kind === "youtube" ? "VIDEO" : "MANUAL",
          status: "passed",
          score: 100,
          scoreReason: "Dibuat manual oleh tim",
          format: format ?? (src.kind === "github" ? "review" : undefined),
          meta: { ...src.meta, ...(notes ? { notes } : {}) },
        })
        .returning({ id: schema.topics.id });
      topicId = t.id;
    }
  } else {
    const [t] = await db()
      .insert(schema.topics)
      .values({
        title: idea.slice(0, 300),
        url: `ide:${randomBytes(8).toString("hex")}`,
        category: "IDE",
        status: "passed",
        score: 100,
        scoreReason: "Ide dari tim (tanpa sumber — cek fakta!)",
        format: format ?? "tips",
        meta: notes ? { notes } : {},
      })
      .returning({ id: schema.topics.id });
    topicId = t.id;
  }

  let postId: number;
  try {
    postId = await draftTopic(topicId, { format, notes: notes || undefined });
  } catch (e) {
    await db().update(schema.topics).set({ status: "failed", scoreReason: `Gagal ditulis: ${(e as Error).message}`.slice(0, 500) }).where(eq(schema.topics.id, topicId));
    return { ok: false, message: `Gagal menulis draft: ${(e as Error).message}. Detail di halaman Log.` };
  }
  try {
    await renderPost(postId);
  } catch {
    /* Designer akan mencoba lagi */
  }
  revalidatePath("/review");
  redirect(`/review/${postId}`);
}

/** "Tulis ulang sebagai …" di halaman review. */
export async function rewriteAs(postId: number, _: ActionState, f: FormData): Promise<ActionState> {
  await requireSession();
  const fmt = String(f.get("format") ?? "");
  const notes = String(f.get("notes") ?? "").trim().slice(0, 1000);
  try {
    const [p] = await db().select({ productIds: schema.posts.productIds, contentType: schema.posts.contentType }).from(schema.posts).where(eq(schema.posts.id, postId));
    if (!p) return { ok: false, message: "Post tidak ditemukan" };
    const isSalesPost = p.productIds.length > 0;
    if (isSalesType(fmt) || (isSalesPost && !fmt)) {
      if (!isSalesPost) return { ok: false, message: "Jenis jualan butuh produk — buat dari halaman Jualan (pilih produk lalu Buat konten)" };
      await rewriteSalesPost(postId, (isSalesType(fmt) ? fmt : p.contentType) as SalesType, notes || undefined);
    } else if (isSalesPost) {
      return { ok: false, message: "Post jualan hanya bisa ditulis ulang sebagai Promo, Rekomendasi, atau Perbandingan" };
    } else await rewritePost(postId, { format: isContentType(fmt) ? fmt : undefined, notes: notes || undefined });
    try {
      await renderPost(postId);
    } catch {
      /* lanjut */
    }
    revalidatePath(`/review/${postId}`);
    return { ok: true, message: "Draft ditulis ulang & dirender" };
  } catch (e) {
    return { ok: false, message: `${(e as Error).message}` };
  }
}
