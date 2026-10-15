import "server-only";
import type { InstagramCreds, ThreadsCreds, XCreds } from "../channels";
import { oauth1Header } from "./oauth1";

export class PublishError extends Error {}

export type PublishResult = { remoteId: string; permalink: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_MS = Number(process.env.PUBLISH_POLL_MS ?? 3000);
const MAX_WAIT_MS = Number(process.env.PUBLISH_MAX_WAIT_MS ?? 90_000);

async function call(url: string, init: RequestInit & { form?: Record<string, string> } = {}) {
  const { form, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      ...(form ? { method: "POST", body: new URLSearchParams(form), headers: { ...(rest.headers ?? {}), "content-type": "application/x-www-form-urlencoded" } } : {}),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new PublishError(`Koneksi gagal: ${(e as Error).message}`);
  }
  const text = await res.text();
  let j: any;
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    throw new PublishError(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || j.error || (Array.isArray(j.errors) && !j.data)) {
    const e = j.error ?? j.errors?.[0] ?? j;
    const msg = e?.error_user_msg || e?.message || e?.detail || e?.title || JSON.stringify(e).slice(0, 300);
    throw new PublishError(`HTTP ${res.status}: ${msg}`);
  }
  return j;
}

/* ───────────────────────── Instagram ───────────────────────── */

const igBase = (c: InstagramCreds) => (c.apiBase || `https://${c.host || "graph.instagram.com"}`).replace(/\/+$/, "") + `/${c.version || "v23.0"}`;

async function igWait(c: InstagramCreds, id: string) {
  const t0 = Date.now();
  for (;;) {
    const j = await call(`${igBase(c)}/${id}?fields=status_code,status&access_token=${encodeURIComponent(c.accessToken)}`);
    if (j.status_code === "FINISHED" || j.status_code === "PUBLISHED") return;
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") throw new PublishError(`Instagram menolak media: ${j.status ?? j.status_code}`);
    if (Date.now() - t0 > MAX_WAIT_MS) throw new PublishError("Instagram terlalu lama memproses media");
    await sleep(POLL_MS);
  }
}

export async function igMe(c: InstagramCreds) {
  const j = await call(`${igBase(c)}/${c.userId}?fields=username&access_token=${encodeURIComponent(c.accessToken)}`);
  return j.username as string;
}

export async function publishInstagram(c: InstagramCreds, imageUrls: string[], caption: string): Promise<PublishResult> {
  const base = igBase(c);
  const token = c.accessToken;
  let creationId: string;
  const urls = imageUrls.slice(0, 10);
  if (urls.length === 1) {
    const j = await call(`${base}/${c.userId}/media`, { form: { image_url: urls[0], caption, access_token: token } });
    creationId = j.id;
  } else {
    const children: string[] = [];
    for (const image_url of urls) {
      const j = await call(`${base}/${c.userId}/media`, { form: { image_url, is_carousel_item: "true", access_token: token } });
      children.push(j.id);
    }
    for (const id of children) await igWait(c, id);
    const j = await call(`${base}/${c.userId}/media`, {
      form: { media_type: "CAROUSEL", children: children.join(","), caption, access_token: token },
    });
    creationId = j.id;
  }
  await igWait(c, creationId);
  const pub = await call(`${base}/${c.userId}/media_publish`, { form: { creation_id: creationId, access_token: token } });
  let permalink: string | null = null;
  try {
    permalink = (await call(`${base}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`)).permalink ?? null;
  } catch {
    /* permalink opsional */
  }
  return { remoteId: pub.id, permalink };
}

export async function igInsights(c: InstagramCreds, mediaId: string) {
  const base = igBase(c);
  const tk = encodeURIComponent(c.accessToken);
  const out: Record<string, number> = {};
  for (const metrics of ["views,reach,saved,shares,likes,comments,total_interactions", "reach,saved,shares,likes,comments"]) {
    try {
      const j = await call(`${base}/${mediaId}/insights?metric=${metrics}&access_token=${tk}`);
      for (const d of j.data ?? []) out[d.name] = Number(d.values?.[0]?.value ?? d.total_value?.value ?? 0);
      break;
    } catch (e) {
      if (metrics.startsWith("reach")) throw e;
    }
  }
  return out;
}

/** Perpanjang token Instagram Login (60 hari). Token Facebook Login (Page) tidak perlu. */
export async function igRefresh(c: InstagramCreds) {
  if (!(c.host || "graph.instagram.com").includes("instagram")) return null;
  const root = (c.apiBase || "https://graph.instagram.com").replace(/\/+$/, "");
  const j = await call(`${root}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(c.accessToken)}`);
  return j.access_token as string;
}

/* ───────────────────────── Threads ───────────────────────── */

const thBase = (c: ThreadsCreds) => (c.apiBase || "https://graph.threads.net").replace(/\/+$/, "") + "/v1.0";

async function thWait(c: ThreadsCreds, id: string) {
  const t0 = Date.now();
  for (;;) {
    const j = await call(`${thBase(c)}/${id}?fields=status,error_message&access_token=${encodeURIComponent(c.accessToken)}`);
    if (j.status === "FINISHED" || j.status === "PUBLISHED") return;
    if (j.status === "ERROR" || j.status === "EXPIRED") throw new PublishError(`Threads menolak media: ${j.error_message ?? j.status}`);
    if (Date.now() - t0 > MAX_WAIT_MS) throw new PublishError("Threads terlalu lama memproses media");
    await sleep(POLL_MS);
  }
}

export async function thMe(c: ThreadsCreds) {
  const j = await call(`${thBase(c)}/me?fields=username&access_token=${encodeURIComponent(c.accessToken)}`);
  return j.username as string;
}

export async function publishThreads(c: ThreadsCreds, imageUrls: string[], text: string): Promise<PublishResult> {
  const base = thBase(c);
  const token = c.accessToken;
  const user = c.userId || "me";
  let creationId: string;
  const urls = imageUrls.slice(0, 20);
  if (urls.length === 0) {
    creationId = (await call(`${base}/${user}/threads`, { form: { media_type: "TEXT", text, access_token: token } })).id;
  } else if (urls.length === 1) {
    creationId = (await call(`${base}/${user}/threads`, { form: { media_type: "IMAGE", image_url: urls[0], text, access_token: token } })).id;
  } else {
    const children: string[] = [];
    for (const image_url of urls) {
      children.push((await call(`${base}/${user}/threads`, { form: { media_type: "IMAGE", image_url, is_carousel_item: "true", access_token: token } })).id);
    }
    for (const id of children) await thWait(c, id);
    creationId = (await call(`${base}/${user}/threads`, { form: { media_type: "CAROUSEL", children: children.join(","), text, access_token: token } })).id;
  }
  await thWait(c, creationId);
  const pub = await call(`${base}/${user}/threads_publish`, { form: { creation_id: creationId, access_token: token } });
  let permalink: string | null = null;
  try {
    permalink = (await call(`${base}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`)).permalink ?? null;
  } catch {
    /* opsional */
  }
  return { remoteId: pub.id, permalink };
}

export async function thInsights(c: ThreadsCreds, mediaId: string) {
  const j = await call(`${thBase(c)}/${mediaId}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${encodeURIComponent(c.accessToken)}`);
  const out: Record<string, number> = {};
  for (const d of j.data ?? []) out[d.name] = Number(d.values?.[0]?.value ?? d.total_value?.value ?? 0);
  return out;
}

export async function thRefresh(c: ThreadsCreds) {
  const root = (c.apiBase || "https://graph.threads.net").replace(/\/+$/, "");
  const j = await call(`${root}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(c.accessToken)}`);
  return j.access_token as string;
}

/* ───────────────────────── X ───────────────────────── */

const xBase = (c: XCreds) => (c.apiBase || "https://api.x.com").replace(/\/+$/, "");

export async function xMe(c: XCreds) {
  const url = `${xBase(c)}/2/users/me`;
  const j = await call(url, { headers: { authorization: oauth1Header("GET", url, c) } });
  return j.data?.username as string;
}

export async function publishX(c: XCreds, images: Buffer[], text: string, username?: string | null): Promise<PublishResult> {
  const mediaIds: string[] = [];
  for (const img of images.slice(0, 4)) {
    const url = `${xBase(c)}/2/media/upload`;
    const fd = new FormData();
    fd.append("media", new Blob([new Uint8Array(img)], { type: "image/jpeg" }), "slide.jpg");
    fd.append("media_category", "tweet_image");
    const j = await call(url, { method: "POST", body: fd, headers: { authorization: oauth1Header("POST", url, c) } });
    const id = j.data?.id ?? j.media_id_string;
    if (!id) throw new PublishError("Upload gambar ke X tidak mengembalikan media id");
    mediaIds.push(String(id));
  }
  const url = `${xBase(c)}/2/tweets`;
  const j = await call(url, {
    method: "POST",
    headers: { authorization: oauth1Header("POST", url, c), "content-type": "application/json" },
    body: JSON.stringify({ text, ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) }),
  });
  const id = j.data?.id;
  if (!id) throw new PublishError("X tidak mengembalikan id post");
  return { remoteId: id, permalink: `https://x.com/${username || "i/web"}/status/${id}` };
}
