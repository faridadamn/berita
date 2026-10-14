import "server-only";
/**
 * Lapisan akses data. Tahap 1: membaca/menulis data dummy di memori (reset tiap server restart).
 * Tahap 2: ganti isi tiap fungsi dengan query Drizzle (lihat src/db/schema.ts) — tanda tangan fungsinya tetap.
 */
import * as mock from "./mock";
import type { PostStatus } from "./types";
import { scoreThreshold } from "./config";

const DAY = 24 * 60 * 60 * 1000;
const within24h = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < DAY;

export async function getAiCost() {
  return mock.aiCost;
}

export async function getOverview() {
  const topics24 = mock.topics.filter((t) => within24h(t.fetchedAt));
  const passed24 = topics24.filter((t) => (t.score ?? 0) >= scoreThreshold);
  const review = mock.posts.filter((p) => p.status === "review");
  const scheduled = mock.posts.filter((p) => p.status === "scheduled");
  const weekAgo = Date.now() - 7 * DAY;
  const postedWeek = mock.posts.filter((p) => p.postedAt && new Date(p.postedAt).getTime() > weekAgo);
  return {
    topicsIn24h: 79, // angka contoh; nanti = topics24.length
    topicsUnscored: topics24.filter((t) => t.score === null).length,
    passed24h: Math.max(passed24.length, 17),
    passedQueuedForWriting: passed24.filter((t) => t.status === "passed").length,
    reviewCount: review.length,
    scheduledCount: scheduled.length,
    postedThisWeek: postedWeek.length,
  };
}

export async function getAgents() {
  return mock.agents;
}

export async function getActivity(limit = 10) {
  return mock.activity.slice(0, limit);
}

export const reviewTabs: { key: PostStatus; label: string }[] = [
  { key: "review", label: "Perlu review" },
  { key: "approved", label: "Disetujui" },
  { key: "scheduled", label: "Terjadwal" },
  { key: "failed", label: "Gagal posting" },
  { key: "posted", label: "Sudah posting" },
  { key: "rejected", label: "Ditolak" },
];

export async function getPostCounts() {
  const counts = Object.fromEntries(reviewTabs.map((t) => [t.key, 0])) as Record<PostStatus, number>;
  for (const p of mock.posts) counts[p.status] = (counts[p.status] ?? 0) + 1;
  return counts;
}

export async function getPosts(status?: PostStatus) {
  const list = status ? mock.posts.filter((p) => p.status === status) : mock.posts;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPost(id: number) {
  return mock.posts.find((p) => p.id === id) ?? null;
}

export async function getPostByShortCode(code: string) {
  return mock.posts.find((p) => p.shortCode === code) ?? null;
}

export async function getPublishedPosts() {
  return mock.posts
    .filter((p) => p.status === "posted")
    .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
}

type PostPatch = Partial<
  Pick<
    (typeof mock.posts)[number],
    "status" | "scheduledAt" | "headline" | "kicker" | "caption" | "template" | "format" | "slides" | "hashtags"
  >
>;

export async function updatePost(id: number, patch: PostPatch) {
  const p = mock.posts.find((x) => x.id === id);
  if (!p) return null;
  Object.assign(p, patch);
  return p;
}

export async function deletePost(id: number) {
  const i = mock.posts.findIndex((x) => x.id === id);
  if (i >= 0) mock.posts.splice(i, 1);
}

export async function recordClick(postId: number) {
  const p = mock.posts.find((x) => x.id === postId);
  if (p) p.clicks += 1;
}

export async function getTopics() {
  return [...mock.topics].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
}

export async function getSources() {
  return mock.sources;
}

export async function getTeam() {
  return mock.team;
}

export async function getBrain() {
  return mock.brain;
}

export async function getAnalytics() {
  const posted = await getPublishedPosts();

  const byCat = new Map<string, { views: number; n: number }>();
  for (const p of posted) {
    const c = byCat.get(p.category) ?? { views: 0, n: 0 };
    c.views += p.views;
    c.n += 1;
    byCat.set(p.category, c);
  }
  const categories = [...byCat.entries()]
    .map(([name, v]) => ({ name, value: Math.round(v.views / v.n) }))
    .sort((a, b) => b.value - a.value);

  const slots = ["06–09", "09–12", "12–15", "15–18", "21–24"];
  const bySlot = slots.map((s) => ({ name: s, sum: 0, n: 0 }));
  for (const p of posted) {
    const h = Number(
      new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(
        new Date(p.postedAt!),
      ),
    );
    const idx = h < 9 ? 0 : h < 12 ? 1 : h < 15 ? 2 : h < 18 ? 3 : 4;
    bySlot[idx].sum += p.reach;
    bySlot[idx].n += 1;
  }
  const hours = bySlot.map((s, i) => ({
    name: s.name,
    value: s.n ? Math.round(s.sum / s.n) : [102, 91, 131, 85, 147][i], // fallback contoh
  }));

  const bySource = new Map<string, number>();
  for (const p of mock.posts) bySource.set(p.sourceName, (bySource.get(p.sourceName) ?? 0) + p.clicks);
  for (const s of mock.sources) if (!bySource.has(s.name)) bySource.set(s.name, 0);
  const readers = [...bySource.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const totals = posted.reduce(
    (a, p) => ({
      views: a.views + p.views,
      reach: a.reach + p.reach,
      clicks: a.clicks + p.clicks,
      interactions: a.interactions + p.likes + p.comments + p.shares + p.saves,
    }),
    { views: 0, reach: 0, clicks: 0, interactions: 0 },
  );

  return { posted, categories, hours, readers, totals };
}
