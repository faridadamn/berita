import {
  pgTable, pgEnum, serial, text, integer, boolean, timestamp, jsonb, real, varchar, index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "editor"]);
export const topicStatusEnum = pgEnum("topic_status", ["new", "scored", "passed", "rejected", "drafted"]);
export const postStatusEnum = pgEnum("post_status", [
  "review", "approved", "scheduled", "posting", "posted", "failed", "rejected",
]);
export const agentEnum = pgEnum("agent", ["scout", "analis", "copywriter", "designer", "publisher"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("editor"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sumber topik (biasanya RSS media). */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  siteUrl: text("site_url").notNull(),
  feedUrl: text("feed_url").notNull(),
  category: text("category").notNull(), // mis. AI, SOSMED, MARKETING
  active: boolean("active").notNull().default(true),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
});

/** Topik mentah yang ditemukan Scout, lalu dinilai Analis. */
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => sources.id),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  summary: text("summary"),
  imageUrl: text("image_url"),
  category: text("category"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  score: integer("score"), // 0-100 dari Analis
  scoreReason: text("score_reason"),
  status: topicStatusEnum("status").notNull().default("new"),
}, (t) => [index("topics_status_idx").on(t.status)]);

export type Slide = { kind: "cover" | "body" | "cta"; headline: string; body?: string; imageUrl?: string };

/** Draft post hasil Copywriter + Designer, masuk antrian review. */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => topics.id),
  kicker: text("kicker").notNull().default("AI"),
  headline: text("headline").notNull(),
  headlineAlternatives: jsonb("headline_alternatives").$type<string[]>().notNull().default([]),
  caption: text("caption").notNull().default(""),
  hashtags: jsonb("hashtags").$type<string[]>().notNull().default([]),
  template: text("template").notNull().default("stabilo"),
  format: text("format").notNull().default("carousel"), // carousel | single
  slides: jsonb("slides").$type<Slide[]>().notNull().default([]),
  renderUrls: jsonb("render_urls").$type<string[]>().notNull().default([]),
  status: postStatusEnum("status").notNull().default("review"),
  shortCode: varchar("short_code", { length: 16 }).unique(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  igMediaId: text("ig_media_id"),
  igPermalink: text("ig_permalink"),
  error: text("error"),
  // metrik (disinkron dari Instagram Insights)
  views: integer("views").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("posts_status_idx").on(t.status)]);

/** Klik shortlink /s/:code → artikel asli. */
export const clicks = pgTable("clicks", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
});

/** Log aktivitas agen + biaya AI. */
export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  agent: agentEnum("agent").notNull(),
  message: text("message").notNull(),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
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
