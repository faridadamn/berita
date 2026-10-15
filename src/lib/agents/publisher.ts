import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl, getChannel, platformLabel, saveChannel, type Platform } from "../channels";
import { getAllRenders, loadPostForRender, renderHashOf, renderPost } from "../render";
import { composeInstagram, composeThreads, composeX } from "../publish/text";
import { igInsights, igRefresh, publishInstagram, publishThreads, publishX, thInsights, thRefresh } from "../publish/platforms";
import { logRun } from "./common";

const { posts, publications, renders } = schema;

/* ───────────── Designer ───────────── */

/** Render ulang kalau isi slide berubah sejak render terakhir (atau belum pernah). */
export async function ensureRendered(postId: number) {
  const p = await loadPostForRender(postId);
  if (!p) throw new Error(`Post #${postId} tidak ditemukan`);
  const [{ n }] = await db().select({ n: sql<number>`count(*)`.mapWith(Number) }).from(renders).where(eq(renders.postId, postId));
  if (n === p.slides.length && p.renderHash === renderHashOf(p)) return { rendered: false };
  const r = await renderPost(postId);
  return { rendered: true, ...r };
}

/** Render draft baru / yang diedit (post yang belum terposting). */
export async function runDesigner(limit = 6) {
  const candidates = await db()
    .select({ id: posts.id })
    .from(posts)
    .where(inArray(posts.status, ["review", "approved", "scheduled"]))
    .orderBy(desc(posts.createdAt))
    .limit(40);
  const done: number[] = [];
  const failed: string[] = [];
  for (const { id } of candidates) {
    if (done.length >= limit) break;
    try {
      const r = await ensureRendered(id);
      if (r.rendered) done.push(id);
    } catch (e) {
      failed.push(`#${id}: ${(e as Error).message}`);
      await db().update(posts).set({ renderError: (e as Error).message.slice(0, 500) }).where(eq(posts.id, id));
    }
  }
  if (done.length || failed.length) {
    await logRun(
      "designer",
      (done.length ? `Render slide untuk ${done.length} post (${done.map((d) => `#${d}`).join(", ")})` : "Render gagal") +
        (failed.length ? ` · ${failed.length} gagal (${failed.join("; ")})` : ""),
      { ok: !failed.length },
    );
  }
  return { rendered: done.length, failed };
}

/* ───────────── Publisher ───────────── */

function mediaUrls(base: string, shortCode: string, idxs: number[], v: string) {
  return idxs.map((i) => `${base}/m/${shortCode}/${i}.jpg?v=${v}`);
}

/** Recompute status post dari status publikasinya. */
export async function settlePostStatus(postId: number) {
  const pubs = await db().select().from(publications).where(eq(publications.postId, postId));
  if (!pubs.length) return;
  const busy = pubs.some((p) => p.status === "pending" || p.status === "publishing");
  const ok = pubs.filter((p) => p.status === "published");
  const ig = ok.find((p) => p.platform === "instagram");
  const firstAt = ok.map((p) => p.publishedAt).filter(Boolean).sort((a, b) => +a! - +b!)[0] ?? null;
  const status = busy ? "posting" : ok.length ? "posted" : "failed";
  await db()
    .update(posts)
    .set({ status, postedAt: ok.length ? firstAt ?? new Date() : null, igPermalink: ig?.permalink ?? null, updatedAt: new Date() })
    .where(eq(posts.id, postId));
}

/** Posting satu post ke semua publikasi pending-nya. Aman dipanggil bersamaan (klaim atomik per baris). */
export async function publishPost(postId: number) {
  const pending = await db()
    .select()
    .from(publications)
    .where(and(eq(publications.postId, postId), eq(publications.status, "pending"), eq(publications.manual, false)));
  if (!pending.length) {
    await settlePostStatus(postId);
    return { published: [] as string[], failed: [] as string[] };
  }
  await db().update(posts).set({ status: "posting" }).where(eq(posts.id, postId));

  const published: string[] = [];
  const failed: string[] = [];
  let prepared: Awaited<ReturnType<typeof prepare>> | null = null;
  let prepareError: string | null = null;
  try {
    prepared = await prepare(postId);
  } catch (e) {
    prepareError = (e as Error).message;
  }

  for (const pub of pending) {
    // klaim: hanya satu proses yang bisa memindahkan pending → publishing
    const [claimed] = await db()
      .update(publications)
      .set({ status: "publishing", startedAt: new Date(), attempts: sql`${publications.attempts} + 1`, error: null })
      .where(and(eq(publications.id, pub.id), eq(publications.status, "pending")))
      .returning();
    if (!claimed) continue;
    const label = platformLabel[pub.platform];
    try {
      if (!prepared) throw new Error(prepareError ?? "Gagal menyiapkan post");
      const r = await publishTo(pub.platform, prepared);
      await db()
        .update(publications)
        .set({ status: "published", remoteId: r.remoteId, permalink: r.permalink, publishedAt: new Date(), error: null })
        .where(eq(publications.id, pub.id));
      published.push(label);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 800);
      await db().update(publications).set({ status: "failed", error: msg }).where(eq(publications.id, pub.id));
      failed.push(`${label}: ${msg}`);
    }
  }
  await settlePostStatus(postId);
  if (published.length || failed.length) {
    await logRun(
      "publisher",
      `Post #${postId}` + (published.length ? ` terposting ke ${published.join(", ")}` : "") + (failed.length ? ` · gagal: ${failed.join("; ")}` : ""),
      { ok: !failed.length },
    );
  }
  return { published, failed };
}

async function prepare(postId: number) {
  await ensureRendered(postId);
  const p = await loadPostForRender(postId);
  if (!p) throw new Error("Post hilang");
  const imgs = await getAllRenders(postId);
  if (!imgs.length) throw new Error("Belum ada gambar render");
  const base = appUrl();
  const link = base ? `${base}/s/${p.shortCode}` : null;
  const all = imgs.map((r) => r.idx);
  const nonCta = p.slides.map((s, i) => (s.kind === "cta" ? null : i + 1)).filter((x): x is number => x !== null && all.includes(x));
  return { p, imgs, base, link, all, nonCta };
}

async function publishTo(platform: Platform, x: NonNullable<Awaited<ReturnType<typeof prepare>>>) {
  const { p, imgs, base, link, all, nonCta } = x;
  const src = { headline: p.headline, caption: p.caption, hashtags: p.hashtags, platformText: p.platformText };
  const v = p.renderHash ?? "1";

  if (platform === "instagram") {
    const ch = await getChannel("instagram");
    if (!ch.enabled || !ch.creds) throw new Error("Kanal Instagram belum aktif");
    if (!base?.startsWith("https://") && !process.env.ALLOW_HTTP_MEDIA) throw new Error("APP_URL harus https publik (Instagram mengambil gambar dari URL)");
    return publishInstagram(ch.creds, mediaUrls(base!, p.shortCode, all, v), composeInstagram(src));
  }
  if (platform === "threads") {
    const ch = await getChannel("threads");
    if (!ch.enabled || !ch.creds) throw new Error("Kanal Threads belum aktif");
    if (!base?.startsWith("https://") && !process.env.ALLOW_HTTP_MEDIA) throw new Error("APP_URL harus https publik (Threads mengambil gambar dari URL)");
    const idxs = nonCta.length ? nonCta : all;
    return publishThreads(ch.creds, mediaUrls(base!, p.shortCode, idxs, v), composeThreads(src, link));
  }
  const ch = await getChannel("x");
  if (!ch.enabled || !ch.creds) throw new Error("Kanal X belum aktif");
  const idxs = (nonCta.length ? nonCta : all).slice(0, 4);
  return publishX(ch.creds, imgs.filter((r) => idxs.includes(r.idx)).map((r) => r.data), composeX(src, link), ch.accountName);
}

/** Posting semua post terjadwal yang waktunya sudah lewat. */
export async function runPublisher() {
  const due = await db()
    .select({ id: posts.id })
    .from(posts)
    .where(and(inArray(posts.status, ["scheduled", "posting"]), isNotNull(posts.scheduledAt), lte(posts.scheduledAt, new Date())))
    .orderBy(asc(posts.scheduledAt))
    .limit(5);
  let count = 0;
  for (const { id } of due) {
    const r = await publishPost(id);
    count += r.published.length;
  }
  return { posts: due.length, published: count };
}

/* ───────────── Insights & token ───────────── */

/** Tarik metrik IG & Threads untuk post 14 hari terakhir (maks sekali per jam per publikasi). */
export async function syncInsights() {
  const since = new Date(Date.now() - 14 * 86_400_000);
  const hourAgo = new Date(Date.now() - 3600_000);
  const rows = await db()
    .select()
    .from(publications)
    .where(
      and(
        eq(publications.status, "published"),
        eq(publications.manual, false),
        inArray(publications.platform, ["instagram", "threads"]),
        gte(publications.publishedAt, since),
        sql`(${publications.metricsAt} is null or ${publications.metricsAt} < ${hourAgo.toISOString()}::timestamptz)`,
      ),
    )
    .limit(30);
  if (!rows.length) return { synced: 0 };
  const ig = await getChannel("instagram");
  const th = await getChannel("threads");
  let synced = 0;
  for (const r of rows) {
    try {
      if (!r.remoteId) continue;
      if (r.platform === "instagram" && ig.creds) {
        const m = await igInsights(ig.creds, r.remoteId);
        await db().update(publications).set({ metrics: m, metricsAt: new Date() }).where(eq(publications.id, r.id));
        await db()
          .update(posts)
          .set({ views: m.views ?? 0, reach: m.reach ?? 0, likes: m.likes ?? 0, comments: m.comments ?? 0, shares: m.shares ?? 0, saves: m.saved ?? 0 })
          .where(eq(posts.id, r.postId));
        synced++;
      } else if (r.platform === "threads" && th.creds) {
        const m = await thInsights(th.creds, r.remoteId);
        await db().update(publications).set({ metrics: m, metricsAt: new Date() }).where(eq(publications.id, r.id));
        synced++;
      }
    } catch (e) {
      // jangan coba terus tiap menit kalau error
      await db().update(publications).set({ metricsAt: new Date() }).where(eq(publications.id, r.id));
      await saveChannel(r.platform, { lastError: `Insights: ${(e as Error).message}`.slice(0, 300) });
    }
  }
  return { synced };
}

/** Token IG (Instagram Login) & Threads berlaku 60 hari — perpanjang tiap ±20 hari. */
export async function refreshTokens() {
  const stale = (d: Date | null) => !d || Date.now() - d.getTime() > 20 * 86_400_000;
  const out: string[] = [];
  const ig = await getChannel("instagram");
  if (ig.creds && ig.enabled && stale(ig.tokenRefreshedAt)) {
    try {
      const t = await igRefresh(ig.creds);
      await saveChannel("instagram", { ...(t ? { creds: { ...ig.creds, accessToken: t } } : {}), tokenRefreshedAt: new Date(), lastError: null });
      if (t) out.push("Instagram");
    } catch (e) {
      await saveChannel("instagram", { lastError: `Perpanjang token gagal: ${(e as Error).message}`.slice(0, 300) });
    }
  }
  const th = await getChannel("threads");
  if (th.creds && th.enabled && stale(th.tokenRefreshedAt)) {
    try {
      const t = await thRefresh(th.creds);
      await saveChannel("threads", { creds: { ...th.creds, accessToken: t }, tokenRefreshedAt: new Date(), lastError: null });
      out.push("Threads");
    } catch (e) {
      await saveChannel("threads", { lastError: `Perpanjang token gagal: ${(e as Error).message}`.slice(0, 300) });
    }
  }
  if (out.length) await logRun("publisher", `Token ${out.join(" & ")} diperpanjang`);
  return out;
}

/** Publikasi yang macet di "publishing" > 15 menit (proses mati di tengah jalan). Tidak di-retry otomatis supaya tidak dobel. */
export async function flagStuck() {
  const r = await db()
    .update(publications)
    .set({ status: "failed", error: "Proses berhenti di tengah jalan — cek dulu di platform apakah sudah terposting sebelum mencoba lagi" })
    .where(and(eq(publications.status, "publishing"), lte(publications.startedAt, new Date(Date.now() - 15 * 60_000))))
    .returning({ postId: publications.postId });
  for (const { postId } of r) await settlePostStatus(postId);
  return r.length;
}
