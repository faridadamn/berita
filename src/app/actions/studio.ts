"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { deletePost, updatePost } from "@/lib/data";
import * as mock from "@/lib/mock";
import type { PostStatus, TemplateKey } from "@/lib/types";

/** Tahap 2: panggil job Scout sungguhan (fetch RSS → simpan topics). Sekarang cuma nulis log. */
export async function runScoutNow() {
  await requireSession();
  mock.activity.unshift({
    id: Date.now(),
    agent: "scout",
    message: "Dipicu manual — belum ada topik baru (mode dummy)",
    at: new Date().toISOString(),
  });
  mock.agents[0].lastActiveAt = new Date().toISOString();
  revalidatePath("/");
}

export async function setPostStatus(id: number, status: PostStatus) {
  await requireSession();
  await updatePost(id, { status });
  revalidatePath("/review");
  revalidatePath(`/review/${id}`);
}

export async function schedulePost(id: number, form: FormData) {
  await requireSession();
  const local = String(form.get("scheduledAt") ?? "");
  if (!local) return;
  // input datetime-local dianggap WIB (UTC+7)
  const iso = new Date(`${local}:00+07:00`).toISOString();
  await updatePost(id, { status: "scheduled", scheduledAt: iso });
  revalidatePath("/review");
  revalidatePath(`/review/${id}`);
  revalidatePath("/kalender");
}

export async function savePostText(id: number, form: FormData) {
  await requireSession();
  const post = mock.posts.find((p) => p.id === id);
  if (!post) return;
  const headline = String(form.get("headline") ?? post.headline);
  const slides = post.slides.map((s, i) => (i === 0 ? { ...s, headline } : s));
  await updatePost(id, {
    headline,
    kicker: String(form.get("kicker") ?? post.kicker),
    template: String(form.get("template") ?? post.template) as TemplateKey,
    caption: String(form.get("caption") ?? post.caption),
    slides,
  });
  // Tahap 3: kalau intent === "render", panggil Designer untuk render ulang gambar.
  revalidatePath(`/review/${id}`);
  revalidatePath("/review");
}

export async function removePost(id: number) {
  await requireSession();
  await deletePost(id);
  revalidatePath("/review");
  redirect("/review");
}

export async function bulkSetStatus(ids: number[], status: PostStatus) {
  await requireSession();
  for (const id of ids) await updatePost(id, { status });
  revalidatePath("/review");
}
