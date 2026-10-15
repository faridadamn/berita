import "server-only";
/**
 * Satu-satunya pintu baca/tulis data untuk halaman. Semua query Drizzle ada di sini.
 */
import { asc, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { mask, decrypt } from "./crypto";
import { isContentType, isTemplate } from "./content";
import { getSettings, inWorkHours } from "./settings";
import type { Activity, Agent, AgentKey, BrainNote, Post, PostStatus, ProviderView, Publication, Source, TeamMember, Topic } from "./types";

const { posts, topics, sources, clicks, agentRuns, users, brainNotes, aiProviders, publications, renders } = schema;
const DAY = 86_400_000;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Awal hari ini & awal bulan ini dalam WIB. */
function wibStarts() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const day = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000);
  const month = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 3600_000);
  return { day, month };
}

export async function getAiCost() {
  const { day, month } = wibStarts();
  const [r] = await db()
    .select({
      today: sql<number>`coalesce(sum(${agentRuns.costUsd}) filter (where ${agentRuns.at} >= ${day.toISOString()}::timestamptz), 0)`,
      month: sum(agentRuns.costUsd),
    })
    .from(agentRuns)
    .where(gte(agentRuns.at, month));
  return { todayUsd: Number(r?.today ?? 0), monthUsd: Number(r?.month ?? 0) };
}

export async function getOverview() {
  const since = new Date(Date.now() - DAY);
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const s = await getSettings();
  const [t] = await db()
    .select({
      total: count(),
      unscored: sql<number>`count(*) filter (where ${topics.status} = 'new')`,
      passed: sql<number>`count(*) filter (where ${topics.score} >= ${s.threshold})`,
      queued: sql<number>`count(*) filter (where ${topics.status} = 'passed')`,
    })
    .from(topics)
    .where(gte(topics.fetchedAt, since));
  const [p] = await db()
    .select({
      review: sql<number>`count(*) filter (where ${posts.status} = 'review')`,
      scheduled: sql<number>`count(*) filter (where ${posts.status} = 'scheduled')`,
      postedWeek: sql<number>`count(*) filter (where ${posts.status} = 'posted' and ${posts.postedAt} >= ${weekAgo.toISOString()}::timestamptz)`,
    })
    .from(posts);
  return {
    topicsIn24h: Number(t.total),
    topicsUnscored: Number(t.unscored),
    passed24h: Number(t.passed),
    passedQueuedForWriting: Number(t.queued),
    reviewCount: Number(p.review),
    scheduledCount: Number(p.scheduled),
    postedThisWeek: Number(p.postedWeek),
    settings: s,
  };
}

const agentMeta: { key: AgentKey; name: string; role: string }[] = [
  { key: "scout", name: "Scout", role: "Pemantau topik" },
  { key: "analis", name: "Analis", role: "Cek potensi viral" },
  { key: "copywriter", name: "Copywriter", role: "Headline & caption" },
  { key: "designer", name: "Designer", role: "Render gambar" },
];

export async function getAgents(): Promise<Agent[]> {
  const s = await getSettings();
  const last = await db()
    .selectDistinctOn([agentRuns.agent], { agent: agentRuns.agent, at: agentRuns.at, message: agentRuns.message })
    .from(agentRuns)
    .orderBy(agentRuns.agent, desc(agentRuns.at));
  const lock = await db().select().from(schema.settings).where(eq(schema.settings.key, "pipeline_lock"));
  const running = !!lock[0] && new Date((lock[0].value as { until: string }).until) > new Date();
  const active = s.mode !== "off" && (s.mode === "manual" || inWorkHours(s));
  return agentMeta.map((m) => {
    const l = last.find((x) => x.agent === m.key);
    const off = m.key !== "designer" && !active; // Designer bukan AI, selalu siap
    return {
      ...m,
      status: running ? "running" : off ? "off" : "standby",
      lastActiveAt: iso(l?.at),
      lastMessage: l?.message ?? null,
    };
  });
}

export async function getActivity(limit = 10): Promise<Activity[]> {
  const rows = await db().select().from(agentRuns).orderBy(desc(agentRuns.at)).limit(limit);
  return rows.map((r) => ({ id: r.id, agent: r.agent as Activity["agent"], message: r.message, at: r.at.toISOString(), ok: r.ok }));
}

export const reviewTabs: { key: PostStatus; label: string }[] = [
  { key: "review", label: "Perlu review" },
  { key: "approved", label: "Disetujui" },
  { key: "scheduled", label: "Terjadwal" },
  { key: "posting", label: "Sedang posting" },
  { key: "failed", label: "Gagal posting" },
  { key: "posted", label: "Sudah posting" },
  { key: "rejected", label: "Ditolak" },
];

export async function getPostCounts() {
  const rows = await db().select({ status: posts.status, n: count() }).from(posts).groupBy(posts.status);
  const counts = Object.fromEntries(reviewTabs.map((t) => [t.key, 0])) as Record<PostStatus, number>;
  for (const r of rows) counts[r.status] = Number(r.n);
  return counts;
}

const clickCount = sql<number>`(select count(*) from ${clicks} where ${clicks.postId} = ${posts.id})`.mapWith(Number);
const renderCount = sql<number>`(select count(*) from ${renders} where ${renders.postId} = ${posts.id})`.mapWith(Number);

function postQuery() {
  return db()
    .select({ post: posts, topic: topics, sourceName: sources.name, clicks: clickCount, renderCount })
    .from(posts)
    .leftJoin(topics, eq(posts.topicId, topics.id))
    .leftJoin(sources, eq(topics.sourceId, sources.id));
}

type PostRow = Awaited<ReturnType<typeof postQuery>>[number];

function toPost({ post: p, topic: t, sourceName, clicks: c, renderCount: rc }: PostRow): Post {
  return {
    id: p.id,
    topicId: p.topicId ?? 0,
    kicker: p.kicker,
    category: t?.category ?? "",
    headline: p.headline,
    headlineAlternatives: p.headlineAlternatives,
    caption: p.caption,
    hashtags: p.hashtags,
    template: isTemplate(p.template) ? p.template : "stabilo",
    format: p.format === "single" ? "single" : "carousel",
    slides: p.slides,
    status: p.status,
    score: t?.score ?? 0,
    sourceName: sourceName ?? (t?.url && /^https?:/.test(t.url) ? new URL(t.url).hostname.replace(/^www\./, "") : "Ide tim"),
    sourceUrl: t?.url ?? "#",
    shortCode: p.shortCode,
    scheduledAt: iso(p.scheduledAt),
    postedAt: iso(p.postedAt),
    igPermalink: p.igPermalink,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    views: p.views,
    reach: p.reach,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    clicks: c,
    imageUrl: t?.imageUrl ?? null,
    hue: (p.id * 47) % 360,
    platformText: p.platformText ?? {},
    productIds: p.productIds ?? [],
    contentType: isContentType(p.contentType) ? p.contentType : "berita",
    images: p.images ?? [],
    renderCount: rc,
    renderedAt: iso(p.renderedAt),
    renderHash: p.renderHash,
    renderError: p.renderError,
  };
}

export async function getPosts(status?: PostStatus) {
  const q = postQuery();
  const rows = await (status ? q.where(eq(posts.status, status)) : q).orderBy(desc(posts.createdAt)).limit(200);
  return rows.map(toPost);
}

export async function getPost(id: number) {
  if (!Number.isFinite(id)) return null;
  const [r] = await postQuery().where(eq(posts.id, id));
  return r ? toPost(r) : null;
}

export async function getPublications(postId: number): Promise<Publication[]> {
  const rows = await db().select().from(publications).where(eq(publications.postId, postId)).orderBy(asc(publications.id));
  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    status: r.status,
    manual: r.manual,
    permalink: r.permalink,
    error: r.error,
    attempts: r.attempts,
    metrics: r.metrics,
    publishedAt: iso(r.publishedAt),
  }));
}

export async function getPostByShortCode(code: string) {
  const [r] = await postQuery().where(eq(posts.shortCode, code));
  return r ? toPost(r) : null;
}

export async function getPublishedPosts(limit = 60) {
  const rows = await postQuery().where(eq(posts.status, "posted")).orderBy(desc(posts.postedAt)).limit(limit);
  return rows.map(toPost);
}

/** Post terjadwal/terposting dalam rentang tanggal (untuk kalender). */
export async function getCalendarPosts(from: Date, to: Date) {
  const rows = await postQuery().where(
    sql`coalesce(${posts.postedAt}, ${posts.scheduledAt}) between ${from.toISOString()}::timestamptz and ${to.toISOString()}::timestamptz`,
  );
  return rows.map(toPost);
}

type PostPatch = Partial<
  Pick<
    typeof posts.$inferInsert,
    "status" | "scheduledAt" | "headline" | "kicker" | "caption" | "template" | "format" | "slides" | "hashtags" | "reviewedBy" | "platformText" | "contentType" | "images" | "productIds"
  >
>;

export async function updatePost(id: number, patch: PostPatch) {
  await db().update(posts).set({ ...patch, updatedAt: new Date() }).where(eq(posts.id, id));
}

export async function updatePosts(ids: number[], patch: PostPatch) {
  if (!ids.length) return;
  await db().update(posts).set({ ...patch, updatedAt: new Date() }).where(inArray(posts.id, ids));
}

export async function getPostRaw(id: number) {
  const [p] = await db().select().from(posts).where(eq(posts.id, id));
  return p ?? null;
}

export async function deletePost(id: number) {
  await db().delete(posts).where(eq(posts.id, id));
}

export async function recordClick(postId: number, referrer: string | null) {
  await db().insert(clicks).values({ postId, referrer: referrer?.slice(0, 500) ?? null });
}

export async function getTopics(filter?: Topic["status"]): Promise<Topic[]> {
  const q = db()
    .select({ t: topics, sourceName: sources.name })
    .from(topics)
    .leftJoin(sources, eq(topics.sourceId, sources.id));
  const rows = await (filter ? q.where(eq(topics.status, filter)) : q).orderBy(desc(topics.fetchedAt)).limit(150);
  return rows.map(({ t, sourceName }) => ({
    id: t.id,
    title: t.title,
    url: t.url,
    sourceName: sourceName ?? "—",
    category: t.category ?? "",
    fetchedAt: t.fetchedAt.toISOString(),
    score: t.score,
    scoreReason: t.scoreReason,
    status: t.status,
  }));
}

export async function getTopicCounts() {
  const rows = await db().select({ status: topics.status, n: count() }).from(topics).groupBy(topics.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Partial<Record<Topic["status"], number>>;
}

export async function getSources(): Promise<Source[]> {
  const since = new Date(Date.now() - DAY);
  const rows = await db()
    .select({
      s: sources,
      n: sql<number>`(select count(*) from ${topics} where ${topics.sourceId} = ${sources.id} and ${topics.fetchedAt} >= ${since.toISOString()}::timestamptz)`.mapWith(Number),
    })
    .from(sources)
    .orderBy(asc(sources.name));
  return rows.map(({ s, n }) => ({
    id: s.id,
    name: s.name,
    siteUrl: s.siteUrl,
    feedUrl: s.feedUrl,
    category: s.category,
    active: s.active,
    lastFetchedAt: iso(s.lastFetchedAt),
    lastError: s.lastError,
    topics24h: n,
    kind: s.kind,
    defaultFormat: s.defaultFormat,
  }));
}

export async function getTeam(): Promise<TeamMember[]> {
  const rows = await db().select().from(users).orderBy(asc(users.id));
  return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, lastSeenAt: iso(u.lastSeenAt) }));
}

export async function getBrain(): Promise<BrainNote[]> {
  const rows = await db().select().from(brainNotes).orderBy(asc(brainNotes.id));
  return rows.map((b) => ({ id: b.id, title: b.title, content: b.content, appliesTo: b.appliesTo as AgentKey[] }));
}

export async function getProviders(): Promise<ProviderView[]> {
  const rows = await db().select().from(aiProviders).orderBy(asc(aiProviders.position), asc(aiProviders.id));
  return rows.map((p) => {
    let keyMasked = "••••";
    try {
      keyMasked = p.apiKeyEnc ? mask(decrypt(p.apiKeyEnc)) : "(tanpa key)";
    } catch {
      keyMasked = "⚠ tidak bisa dibuka (AUTH_SECRET berubah?)";
    }
    return {
      id: p.id, name: p.name, kind: p.kind, baseUrl: p.baseUrl, model: p.model, keyMasked,
      enabled: p.enabled, position: p.position, priceIn: p.priceIn, priceOut: p.priceOut,
    };
  });
}

export async function getAnalytics() {
  const posted = await getPublishedPosts(100);

  const byCat = new Map<string, { views: number; n: number }>();
  for (const p of posted) {
    const k = p.category || "LAIN";
    const c = byCat.get(k) ?? { views: 0, n: 0 };
    c.views += p.views;
    c.n += 1;
    byCat.set(k, c);
  }
  const categories = [...byCat.entries()]
    .map(([name, v]) => ({ name, value: Math.round(v.views / v.n) }))
    .sort((a, b) => b.value - a.value);

  const slots = ["00–06", "06–09", "09–12", "12–15", "15–18", "18–21", "21–24"];
  const edges = [6, 9, 12, 15, 18, 21, 24];
  const bySlot = slots.map((name) => ({ name, sum: 0, n: 0 }));
  for (const p of posted) {
    const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date(p.postedAt!))) % 24;
    const i = edges.findIndex((e) => h < e);
    bySlot[i].sum += p.reach;
    bySlot[i].n += 1;
  }
  const hours = bySlot.filter((s) => s.n).map((s) => ({ name: s.name, value: Math.round(s.sum / s.n) }));

  const readerRows = await db()
    .select({ name: sql<string>`coalesce(${sources.name}, 'Lainnya')`, value: count(clicks.id) })
    .from(clicks)
    .innerJoin(posts, eq(clicks.postId, posts.id))
    .leftJoin(topics, eq(posts.topicId, topics.id))
    .leftJoin(sources, eq(topics.sourceId, sources.id))
    .groupBy(sql`1`)
    .orderBy(desc(count(clicks.id)));
  const readers = readerRows.map((r) => ({ name: r.name, value: Number(r.value) }));

  const totals = posted.reduce(
    (a, p) => ({
      views: a.views + p.views,
      reach: a.reach + p.reach,
      interactions: a.interactions + p.likes + p.comments + p.shares + p.saves,
    }),
    { views: 0, reach: 0, interactions: 0 },
  );
  const [c] = await db().select({ n: count() }).from(clicks);

  return { posted, categories, hours, readers, totals: { ...totals, clicks: Number(c.n) } };
}

export async function touchUser(id: number) {
  await db().update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
}


/* ───────────── Log ───────────── */

export type LogRow = {
  id: number;
  agent: string;
  message: string;
  ok: boolean;
  provider: string | null;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  detail: import("@/db/schema").RunDetail | null;
  at: string;
};

export async function getLogs(opts: { errorsOnly?: boolean; agent?: string; before?: number; limit?: number } = {}) {
  const conds = [];
  if (opts.errorsOnly) conds.push(eq(agentRuns.ok, false));
  if (opts.agent) conds.push(sql`${agentRuns.agent} = ${opts.agent}`);
  if (opts.before) conds.push(sql`${agentRuns.id} < ${opts.before}`);
  const q = db().select().from(agentRuns);
  const rows = await (conds.length ? q.where(sql.join(conds, sql` and `)) : q)
    .orderBy(desc(agentRuns.id))
    .limit(opts.limit ?? 50);
  return rows.map(
    (r): LogRow => ({
      id: r.id, agent: r.agent, message: r.message, ok: r.ok, provider: r.provider, model: r.model,
      tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsd: r.costUsd, detail: r.detail ?? null, at: r.at.toISOString(),
    }),
  );
}

export async function getErrorCount(hours = 24) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const [r] = await db()
    .select({ n: count() })
    .from(agentRuns)
    .where(sql`${agentRuns.ok} = false and ${agentRuns.at} >= ${since}::timestamptz`);
  return Number(r?.n ?? 0);
}
