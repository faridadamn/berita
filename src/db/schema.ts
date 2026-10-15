import {
  pgTable, pgEnum, serial, text, integer, boolean, timestamp, jsonb, real, varchar, index, uniqueIndex, customType,
} from "drizzle-orm/pg-core";

import type { ContentType, Slide } from "../lib/content";
export type { Slide };

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const roleEnum = pgEnum("role", ["admin", "editor"]);
export const topicStatusEnum = pgEnum("topic_status", ["new", "passed", "rejected", "drafted", "failed"]);
export const postStatusEnum = pgEnum("post_status", [
  "review", "approved", "scheduled", "posting", "posted", "failed", "rejected",
]);
export const agentEnum = pgEnum("agent", ["scout", "analis", "copywriter", "designer", "publisher", "system"]);

/** Detail tambahan log (untuk debugging di halaman Log). */
export type RunDetail = {
  error?: string;
  /** jawaban mentah AI yang gagal diproses (dipotong) */
  raw?: string;
  topicIds?: number[];
  postIds?: number[];
  attempts?: number;
  items?: { label: string; error: string; raw?: string }[];
  stack?: string;
};
export const providerKindEnum = pgEnum("provider_kind", ["openai", "gemini", "anthropic"]);
export const platformEnum = pgEnum("platform", ["instagram", "threads", "x", "linkedin"]);
export const publicationStatusEnum = pgEnum("publication_status", ["pending", "publishing", "published", "failed"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("editor"),
  active: boolean("active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Sumber topik.
 * kind: rss (RSS/Atom — termasuk Reddit, YouTube, HN, Product Hunt, Bluesky, RSSHub),
 *       github (repo baru yang naik daun via GitHub Search API), telegram (kanal publik t.me/s/…)
 */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("rss"),
  /** opsi khusus jenis sumber (mis. github: { language, minStars, days }) */
  config: jsonb("config").$type<Record<string, string | number>>().notNull().default({}),
  /** jenis konten bawaan untuk topik dari sumber ini (mis. GitHub → review) */
  defaultFormat: text("default_format"),
  siteUrl: text("site_url").notNull(),
  feedUrl: text("feed_url").notNull().unique(),
  category: text("category").notNull(), // mis. AI, SOSMED, MARKETING
  active: boolean("active").notNull().default(true),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastError: text("last_error"),
});

/** Topik mentah yang ditemukan Scout, lalu dinilai Analis. */
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => sources.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  summary: text("summary"),
  imageUrl: text("image_url"),
  /** semua kandidat gambar dari sumber (feed, artikel) */
  images: jsonb("images").$type<string[]>().notNull().default([]),
  category: text("category"),
  /** jenis konten (disarankan Analis / sumber / dipilih tim) */
  format: text("format").$type<ContentType>(),
  /** data tambahan: bintang repo, bahasa, catatan dari tim, dll */
  meta: jsonb("meta").$type<Record<string, string | number>>().notNull().default({}),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  score: integer("score"), // 0-100 dari Analis
  scoreReason: text("score_reason"),
  status: topicStatusEnum("status").notNull().default("new"),
}, (t) => [index("topics_status_idx").on(t.status), index("topics_fetched_idx").on(t.fetchedAt)]);

/** Teks khusus per platform (IG pakai caption + hashtag). Link shortlink ditambahkan otomatis saat publish. */
export type PlatformText = { threads?: string; x?: string; linkedin?: string };

/** Draft post hasil Copywriter (+ Designer di tahap 3), masuk antrian review. */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  contentType: text("content_type").$type<ContentType>().notNull().default("berita"),
  kicker: text("kicker").notNull().default("AI"),
  headline: text("headline").notNull(),
  headlineAlternatives: jsonb("headline_alternatives").$type<string[]>().notNull().default([]),
  caption: text("caption").notNull().default(""),
  hashtags: jsonb("hashtags").$type<string[]>().notNull().default([]),
  template: text("template").notNull().default("stabilo"),
  format: text("format").notNull().default("carousel"), // carousel | single
  slides: jsonb("slides").$type<Slide[]>().notNull().default([]),
  /** pustaka gambar post (URL atau asset:<id>) untuk dipilih per slide */
  images: jsonb("images").$type<string[]>().notNull().default([]),
  platformText: jsonb("platform_text").$type<PlatformText>().notNull().default({}),
  renderedAt: timestamp("rendered_at", { withTimezone: true }),
  /** sidik isi saat terakhir dirender; beda dengan isi sekarang = perlu render ulang */
  renderHash: text("render_hash"),
  renderError: text("render_error"),
  status: postStatusEnum("status").notNull().default("review"),
  shortCode: varchar("short_code", { length: 16 }).notNull().unique(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  igPermalink: text("ig_permalink"),
  // metrik (disinkron dari Instagram Insights di tahap 3)
  views: integer("views").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("posts_status_idx").on(t.status)]);

/** Gambar hasil render Designer (JPEG 1080x1350), disajikan publik di /m/:shortCode/:n. */
export const renders = pgTable("renders", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(), // 1-based
  mime: text("mime").notNull().default("image/jpeg"),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("renders_post_idx").on(t.postId, t.idx)]);

/** Gambar yang diunggah tim (disajikan publik di /a/:id). */
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  mime: text("mime").notNull().default("image/jpeg"),
  data: bytea("data").notNull(),
  width: integer("width"),
  height: integer("height"),
  name: text("name"),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Akun tujuan posting. Kredensial disimpan terenkripsi (JSON → AES-GCM). */
export const channels = pgTable("channels", {
  platform: platformEnum("platform").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  credentialsEnc: text("credentials_enc").notNull().default(""),
  accountName: text("account_name"),
  tokenRefreshedAt: timestamp("token_refreshed_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Satu baris per post × platform. Klaim atomik pending→publishing mencegah posting dobel. */
export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  status: publicationStatusEnum("status").notNull().default("pending"),
  manual: boolean("manual").notNull().default(false),
  remoteId: text("remote_id"),
  permalink: text("permalink"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  metrics: jsonb("metrics").$type<Record<string, number>>().notNull().default({}),
  metricsAt: timestamp("metrics_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (t) => [uniqueIndex("publications_post_platform").on(t.postId, t.platform), index("publications_status_idx").on(t.status)]);

/** Klik shortlink /s/:code → artikel asli. */
export const clicks = pgTable("clicks", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  referrer: text("referrer"),
}, (t) => [index("clicks_post_idx").on(t.postId)]);

/** Log aktivitas agen + biaya AI. */
export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  agent: agentEnum("agent").notNull(),
  message: text("message").notNull(),
  ok: boolean("ok").notNull().default(true),
  provider: text("provider"),
  model: text("model"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  detail: jsonb("detail").$type<RunDetail>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("agent_runs_at_idx").on(t.at), index("agent_runs_ok_idx").on(t.ok)]);

/**
 * Provider AI. Urutan `position` = rantai fallback: kalau provider pertama error/limit,
 * agen otomatis pindah ke berikutnya. API key disimpan terenkripsi (AES-GCM, kunci dari AUTH_SECRET).
 */
export const aiProviders = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: providerKindEnum("kind").notNull(),
  baseUrl: text("base_url").notNull().default(""),
  model: text("model").notNull(),
  apiKeyEnc: text("api_key_enc").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  position: integer("position").notNull().default(0),
  /** USD per 1 juta token, diisi sendiri dari halaman harga provider. 0 = tidak dihitung. */
  priceIn: real("price_in").notNull().default(0),
  priceOut: real("price_out").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** "Brain": pedoman gaya, persona, dan aturan yang disuntikkan ke prompt agen. */
export const brainNotes = pgTable("brain_notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  appliesTo: jsonb("applies_to").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
});
