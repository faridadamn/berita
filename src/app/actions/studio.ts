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
import type { PostStatus, TemplateKey } from "@/lib/types";

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

export async function savePostText(id: number, form: FormData) {
  await requireSession();
  const post = await getPostRaw(id);
  if (!post) return;
  const field = (k: string, d: string) => (form.has(k) ? String(form.get(k) ?? "") : d);
  const slides = post.slides.map((s, i) => ({
    ...s,
    headline: field(`slide-${i}-headline`, s.headline).trim() || s.headline,
    body: field(`slide-${i}-body`, s.body ?? "").trim(),
  }));
  const headline = slides[0]?.headline ?? post.headline;
  const template = field("template", post.template);
  await updatePost(id, {
    headline,
    kicker: field("kicker", post.kicker).trim(),
    template: (["stabilo", "putih", "foto"].includes(template) ? template : post.template) as TemplateKey,
    caption: field("caption", post.caption),
    hashtags: field("hashtags", post.hashtags.join(" "))
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((h) => "#" + h.replace(/^#+/, "")),
    platformText: { threads: field("threads", post.platformText?.threads ?? "").trim(), x: field("x", post.platformText?.x ?? "").trim() },
    slides,
  });
  if (form.get("intent") === "render") {
    try {
      await renderPost(id);
    } catch {
      /* error tersimpan di renderError oleh designer berikutnya */
    }
  }
  revalidatePath(`/review/${id}`);
  revalidatePath("/review");
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
