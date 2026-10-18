"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/auth";
import { STYLE_FOR, VIDEO_STYLES, isContentType, isVideoStyle, type Shot, type VideoOptions } from "@/lib/content";
import { normalizeShots, writeVideoScript } from "@/lib/agents/video";
import { gerakStatus, getVideo, queueVideo, saveScript } from "@/lib/video";
import type { ActionState } from "./studio";

const CORNERS = ["kanan-bawah", "kiri-bawah", "kanan-atas", "kiri-atas"] as const;
const LAYOUTS = ["full", "pip", "split-top", "split-bottom"] as const;

/** Opsi dari editor; file VO / video sendiri selalu diambil dari server (tidak dipercaya dari browser). */
function cleanOptions(o: Partial<VideoOptions> | undefined, server: VideoOptions | undefined): VideoOptions {
  const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
  const cam = server?.cam ?? null;
  return {
    motionBlur: !!o?.motionBlur,
    music: o?.music === "none" ? "none" : "beat",
    style: isVideoStyle(o?.style) ? o.style : server?.style,
    colors: o?.colors === "style" ? "style" : "brand",
    layout: cam ? pick(o?.layout, LAYOUTS, "pip") : "full",
    pipCorner: pick(o?.pipCorner, CORNERS, "kanan-bawah"),
    pipShape: o?.pipShape === "kotak" ? "kotak" : "bulat",
    vo: server?.vo ?? null,
    cam: cam ? { ...cam, useAudio: o?.cam?.useAudio ?? cam.useAudio } : null,
  };
}
void VIDEO_STYLES;

/** AI menulis naskah video dari isi post (menimpa naskah lama). */
export async function generateVideoScript(postId: number): Promise<ActionState & { shots?: Shot[] }> {
  await requireSession();
  const r = await writeVideoScript(postId);
  const v = await getVideo(postId);
  const opts = cleanOptions(v?.options, v?.options);
  if (!opts.style) {
    const [p] = await db().select({ contentType: schema.posts.contentType }).from(schema.posts).where(eq(schema.posts.id, postId));
    opts.style = p && isContentType(p.contentType) ? STYLE_FOR[p.contentType] : "papan";
  }
  await saveScript(postId, r.shots, opts);
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
  const cur = await getVideo(postId);
  await saveScript(postId, script, cleanOptions(options, cur?.options));
  if (render) {
    const st = gerakStatus();
    if (!st.ok) return { ok: false, message: `Naskah disimpan, tapi belum bisa render: ${st.reason}` };
    await queueVideo(postId);
  }
  revalidatePath(`/review/${postId}`);
  return { ok: true, message: render ? "Masuk antrean render — biasanya 1–3 menit" : "Naskah disimpan" };
}
