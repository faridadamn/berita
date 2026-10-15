"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertAdmin, requireSession } from "@/lib/auth";
import { getChannel, PLATFORMS, platformLabel, saveChannel, type Platform } from "@/lib/channels";
import { ensureRendered, publishPost, settlePostStatus } from "@/lib/agents/publisher";
import { igMe, thMe, xMe } from "@/lib/publish/platforms";
import { renderPost } from "@/lib/render";
import type { ActionState } from "./studio";

const { posts, publications } = schema;
const refresh = (id: number) => {
  revalidatePath(`/review/${id}`);
  revalidatePath("/review");
  revalidatePath("/kalender");
};

/** Siapkan baris publikasi untuk platform terpilih (yang belum terposting). */
async function setTargets(postId: number, platforms: Platform[]) {
  const P = publications;
  // hapus target lama yang tidak dipilih lagi (kecuali sudah terposting / sedang diposting)
  await db()
    .delete(P)
    .where(
      and(
        eq(P.postId, postId),
        inArray(P.status, ["pending", "failed"]),
        platforms.length ? notInArray(P.platform, platforms) : undefined,
      ),
    );
  for (const platform of platforms) {
    await db()
      .insert(P)
      .values({ postId, platform, status: "pending" })
      .onConflictDoUpdate({
        target: [P.postId, P.platform],
        set: { status: "pending", error: null, manual: false },
        setWhere: inArray(P.status, ["pending", "failed"]),
      });
  }
}

function parsePlatforms(f: FormData) {
  return f.getAll("platforms").map(String).filter((p): p is Platform => (PLATFORMS as string[]).includes(p));
}

/** Jadwalkan (atau posting sekarang) ke platform yang dicentang. */
export async function schedulePublish(postId: number, _: ActionState, f: FormData): Promise<ActionState> {
  const s = await requireSession();
  const now = String(f.get("intent")) === "now";
  const platforms = parsePlatforms(f);
  for (const p of platforms) {
    const ch = await getChannel(p);
    if (!ch.enabled) return { ok: false, message: `Kanal ${platformLabel[p]} belum aktif (Admin → Kanal)` };
  }
  let when = new Date();
  if (!now) {
    const local = String(f.get("scheduledAt") ?? "");
    when = new Date(`${local}:00+07:00`);
    if (!local || isNaN(+when)) return { ok: false, message: "Isi tanggal & jam posting" };
  }
  await setTargets(postId, platforms);
  await db()
    .update(posts)
    .set({ status: "scheduled", scheduledAt: when, reviewedBy: Number(s.userId), updatedAt: new Date() })
    .where(eq(posts.id, postId));

  if (!platforms.length) {
    refresh(postId);
    return { ok: true, message: "Terjadwal tanpa kanal otomatis — posting manual pakai panel salin di bawah." };
  }
  if (!now) {
    refresh(postId);
    return { ok: true, message: `Terjadwal ke ${platforms.map((p) => platformLabel[p]).join(", ")}` };
  }
  try {
    const r = await publishPost(postId);
    refresh(postId);
    if (r.failed.length) return { ok: false, message: `${r.published.length ? `Terposting: ${r.published.join(", ")}. ` : ""}Gagal: ${r.failed.join(" | ")}` };
    return { ok: true, message: `Terposting ke ${r.published.join(", ")}` };
  } catch (e) {
    refresh(postId);
    return { ok: false, message: (e as Error).message };
  }
}

export async function unschedule(postId: number) {
  await requireSession();
  await db().delete(publications).where(and(eq(publications.postId, postId), eq(publications.status, "pending")));
  await db().update(posts).set({ status: "approved", scheduledAt: null, updatedAt: new Date() }).where(eq(posts.id, postId));
  refresh(postId);
}

/** Coba lagi satu publikasi yang gagal (langsung diposting). */
export async function retryPublication(pubId: number): Promise<ActionState> {
  await requireSession();
  const [pub] = await db()
    .update(publications)
    .set({ status: "pending", error: null })
    .where(and(eq(publications.id, pubId), eq(publications.status, "failed")))
    .returning();
  if (!pub) return { ok: false, message: "Publikasi tidak dalam status gagal" };
  const r = await publishPost(pub.postId);
  refresh(pub.postId);
  return r.failed.length ? { ok: false, message: r.failed.join(" | ") } : { ok: true, message: "Terposting" };
}

/** Tandai sudah diposting manual (copy-paste sendiri). */
export async function markManual(postId: number, platform: Platform, _: ActionState, f: FormData): Promise<ActionState> {
  await requireSession();
  const permalink = String(f.get("permalink") ?? "").trim() || null;
  if (permalink && !/^https?:\/\//.test(permalink)) return { ok: false, message: "Link harus diawali https://" };
  await db()
    .insert(publications)
    .values({ postId, platform, status: "published", manual: true, permalink, publishedAt: new Date() })
    .onConflictDoUpdate({
      target: [publications.postId, publications.platform],
      set: { status: "published", manual: true, permalink, publishedAt: new Date(), error: null },
    });
  await settlePostStatus(postId);
  refresh(postId);
  return { ok: true, message: `${platformLabel[platform]} ditandai terposting` };
}

export async function removePublication(pubId: number) {
  await requireSession();
  const [pub] = await db().delete(publications).where(and(eq(publications.id, pubId), notInArray(publications.status, ["publishing"]))).returning();
  if (pub) {
    await settlePostStatus(pub.postId);
    refresh(pub.postId);
  }
}

export async function renderNow(postId: number): Promise<ActionState> {
  await requireSession();
  try {
    const r = await renderPost(postId);
    refresh(postId);
    return { ok: true, message: `${r.count} slide dirender${r.photo ? "" : " (foto artikel tidak bisa diambil, pakai latar gradien)"}` };
  } catch (e) {
    await db().update(posts).set({ renderError: (e as Error).message.slice(0, 500) }).where(eq(posts.id, postId));
    return { ok: false, message: (e as Error).message };
  }
}

export async function ensureRenderedAction(postId: number) {
  await requireSession();
  await ensureRendered(postId);
  refresh(postId);
}

/* ───────────── Kanal (admin) ───────────── */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveChannelAction(platform: Platform, _: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  const ch = await getChannel(platform);
  const old = (ch.creds ?? {}) as Record<string, string>;
  // field rahasia yang dikosongkan = pakai nilai lama
  const keep = (k: string) => str(f, k) || old[k] || "";
  let creds: Record<string, string>;
  if (platform === "instagram") {
    creds = { host: str(f, "host") || "graph.instagram.com", version: str(f, "version") || "v23.0", userId: str(f, "userId"), accessToken: keep("accessToken") };
    if (!creds.userId || !creds.accessToken) return { ok: false, message: "User ID dan access token wajib diisi" };
  } else if (platform === "threads") {
    creds = { userId: str(f, "userId") || "me", accessToken: keep("accessToken") };
    if (!creds.accessToken) return { ok: false, message: "Access token wajib diisi" };
  } else {
    creds = { apiKey: keep("apiKey"), apiSecret: keep("apiSecret"), accessToken: keep("accessToken"), accessSecret: keep("accessSecret") };
    if (Object.values(creds).some((v) => !v)) return { ok: false, message: "Keempat kunci X wajib diisi" };
  }
  const apiBase = str(f, "apiBase");
  if (apiBase) creds.apiBase = apiBase;
  await saveChannel(platform, { creds, lastError: null, tokenRefreshedAt: new Date() });
  revalidatePath("/admin/kanal");
  return testChannel(platform);
}

/** Cek kredensial dengan memanggil endpoint profil; kalau berhasil, kanal diaktifkan. */
export async function testChannel(platform: Platform): Promise<ActionState> {
  await assertAdmin();
  const ch = await getChannel(platform);
  if (!ch.creds) return { ok: false, message: "Kredensial belum diisi" };
  try {
    const c = ch.creds as never;
    const name = platform === "instagram" ? await igMe(c) : platform === "threads" ? await thMe(c) : await xMe(c);
    await saveChannel(platform, { accountName: name ?? null, lastError: null, enabled: true });
    revalidatePath("/admin/kanal");
    return { ok: true, message: `Tersambung sebagai @${name}` };
  } catch (e) {
    await saveChannel(platform, { lastError: (e as Error).message.slice(0, 300) });
    revalidatePath("/admin/kanal");
    return { ok: false, message: (e as Error).message };
  }
}

export async function toggleChannel(platform: Platform, enabled: boolean) {
  await assertAdmin();
  await saveChannel(platform, { enabled });
  revalidatePath("/admin/kanal");
}

export async function disconnectChannel(platform: Platform) {
  await assertAdmin();
  await db().delete(schema.channels).where(eq(schema.channels.platform, platform));
  revalidatePath("/admin/kanal");
}
