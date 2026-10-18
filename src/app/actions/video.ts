"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/auth";
import type { Shot, VideoOptions } from "@/lib/content";
import { normalizeShots, writeVideoScript } from "@/lib/agents/video";
import { gerakStatus, getVideo, queueVideo, saveScript } from "@/lib/video";
import type { ActionState } from "./studio";

const cleanOptions = (o: VideoOptions | undefined): VideoOptions => ({ motionBlur: !!o?.motionBlur, music: o?.music === "none" ? "none" : "beat" });

/** AI menulis naskah video dari isi post (menimpa naskah lama). */
export async function generateVideoScript(postId: number): Promise<ActionState & { shots?: Shot[] }> {
  await requireSession();
  const r = await writeVideoScript(postId);
  const v = await getVideo(postId);
  await saveScript(postId, r.shots, cleanOptions(v?.options));
  revalidatePath(`/review/${postId}`);
  return {
    ok: true,
    shots: r.shots,
    message: r.ai ? `Naskah ${r.shots.length} shot ditulis AI — cek & edit, lalu Render` : `AI gagal (${r.error}); naskah dibuat dari slide — edit dulu ya`,
  };
}

/** Simpan naskah dari editor; `render` = langsung masuk antrean render. */
export async function saveVideo(postId: number, shots: Shot[], options: VideoOptions, render: boolean): Promise<ActionState> {
  await requireSession();
  const [p] = await db().select({ productIds: schema.posts.productIds }).from(schema.posts).where(eq(schema.posts.id, postId));
  if (!p) return { ok: false, message: "Post tidak ditemukan" };
  const script = normalizeShots(shots, p.productIds);
  if (script.length < 2) return { ok: false, message: "Minimal 2 shot (pembuka + penutup)" };
  await saveScript(postId, script, cleanOptions(options));
  if (render) {
    const st = gerakStatus();
    if (!st.ok) return { ok: false, message: `Naskah disimpan, tapi belum bisa render: ${st.reason}` };
    await queueVideo(postId);
  }
  revalidatePath(`/review/${postId}`);
  return { ok: true, message: render ? "Masuk antrean render — biasanya 1–3 menit" : "Naskah disimpan" };
}
