export type AgentKey = "scout" | "analis" | "copywriter" | "designer";

export type PostStatus = "review" | "approved" | "scheduled" | "posting" | "posted" | "failed" | "rejected";

export type TemplateKey = "stabilo" | "putih" | "foto";

export type Slide = { kind: "cover" | "body" | "cta"; headline: string; body?: string };

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
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  /** seed warna gambar placeholder */
  hue: number;
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
  status: "new" | "scored" | "passed" | "rejected" | "drafted";
};

export type Source = {
  id: number;
  name: string;
  siteUrl: string;
  feedUrl: string;
  category: string;
  active: boolean;
  lastFetchedAt: string | null;
  topics24h: number;
};

export type Agent = {
  key: AgentKey;
  name: string;
  role: string;
  status: "standby" | "running" | "off";
  lastActiveAt: string;
};

export type Activity = { id: number; agent: AgentKey; message: string; at: string };

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "editor";
  active: boolean;
  lastSeenAt: string | null;
};

export type BrainNote = { id: number; title: string; content: string; appliesTo: AgentKey[] };
