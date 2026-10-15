export type AgentKey = "scout" | "analis" | "copywriter" | "designer";

export type PostStatus = "review" | "approved" | "scheduled" | "posting" | "posted" | "failed" | "rejected";

import type { ContentType, Slide, TemplateKey } from "./content";
export type { ContentType, Slide, TemplateKey };


export type Post = {
  id: number;
  topicId: number;
  kicker: string;
  category: string;
  headline: string;
  headlineAlternatives: string[];
  caption: string;
  hashtags: string[];
  template: TemplateKey;
  format: "carousel" | "single";
  slides: Slide[];
  status: PostStatus;
  score: number;
  sourceName: string;
  sourceUrl: string;
  shortCode: string;
  scheduledAt: string | null;
  postedAt: string | null;
  igPermalink: string | null;
  createdAt: string;
  updatedAt: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  /** gambar utama dari artikel sumber (og:image / RSS), null kalau tidak ada */
  imageUrl: string | null;
  /** seed warna placeholder kalau tidak ada gambar */
  hue: number;
  platformText: { threads?: string; x?: string; linkedin?: string; tiktok?: string; wa?: string };
  /** mode jualan: produk katalog di post ini */
  productIds: number[];
  contentType: ContentType;
  /** pustaka gambar post */
  images: string[];
  renderCount: number;
  renderedAt: string | null;
  renderHash: string | null;
  renderError: string | null;
};

export type Platform = "instagram" | "threads" | "x" | "linkedin";

export type Publication = {
  id: number;
  platform: Platform;
  status: "pending" | "publishing" | "published" | "failed";
  manual: boolean;
  permalink: string | null;
  error: string | null;
  attempts: number;
  metrics: Record<string, number>;
  publishedAt: string | null;
};

export type ChannelView = {
  platform: Platform;
  label: string;
  enabled: boolean;
  configured: boolean;
  accountName: string | null;
  lastError: string | null;
  tokenRefreshedAt: string | null;
  /** nilai non-rahasia untuk form (id user, host, versi) */
  publicFields: Record<string, string>;
  /** kunci rahasia → versi tersamar */
  secretMasks: Record<string, string>;
};

export type Topic = {
  id: number;
  title: string;
  url: string;
  sourceName: string;
  category: string;
  fetchedAt: string;
  score: number | null;
  scoreReason: string | null;
  status: "new" | "passed" | "rejected" | "drafted" | "failed";
};

export type Source = {
  id: number;
  name: string;
  siteUrl: string;
  feedUrl: string;
  category: string;
  active: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  topics24h: number;
  kind: string;
  defaultFormat: string | null;
};

export type Agent = {
  key: AgentKey;
  name: string;
  role: string;
  status: "standby" | "running" | "off";
  lastActiveAt: string | null;
  lastMessage: string | null;
};

export type Activity = { id: number; agent: AgentKey | "publisher"; message: string; at: string; ok: boolean };

export type ProviderView = {
  id: number;
  name: string;
  kind: "openai" | "gemini" | "anthropic";
  baseUrl: string;
  model: string;
  keyMasked: string;
  enabled: boolean;
  position: number;
  priceIn: number;
  priceOut: number;
};

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "editor";
  active: boolean;
  lastSeenAt: string | null;
};

export type BrainNote = { id: number; title: string; content: string; appliesTo: AgentKey[] };

export type ProductRow = {
  id: number;
  name: string;
  url: string;
  affiliateUrl: string;
  platform: import("./content").ProductPlatform;
  price: number | null;
  originalPrice: number | null;
  currency: string;
  rating: number | null;
  sold: number | null;
  images: string[];
  description: string;
  category: string;
  notes: string;
  promo: string;
  active: boolean;
  shortCode: string;
  clicks: number;
  clicks7d: number;
  posts: number;
  updatedAt: string;
};
