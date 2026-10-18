import "server-only";
/**
 * Video 9:16 lewat engine Gerak.
 * Alur: naskah (shot) → spec JSON + file gambar/font di folder sementara → child process
 * `node scripts/video/gerak-build.mjs spec.json out.mp4` → MP4 disimpan di tabel videos.
 * Satu render sekaligus per proses server (render makan CPU); sisanya antre.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { FONT_CHOICES, fontFamilyOf, isDisplayFont, kitRenderKey, type BrandKit } from "../brand";
import { discountOf, formatCount, platformOf, type Shot, type VideoOptions } from "../content";
import { logRun } from "../agents/common";
import { imageToFile, loadPostForRender, mainImageOf, type PostForRender } from "../render";
import { getSettings } from "../settings";

const { videos } = schema;
const STUCK_MS = 30 * 60_000;

/* ───────────── ketersediaan Gerak ───────────── */

export type GerakStatus = { ok: boolean; reason?: string; where?: string };
let statusCache: { at: number; v: GerakStatus } | null = null;

export function gerakStatus(): GerakStatus {
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.v;
  let v: GerakStatus;
  const gp = process.env.GERAK_PATH;
  const local = path.join(process.cwd(), "node_modules/gerak/src/index.mjs");
  const where = gp ? path.resolve(gp, "src/index.mjs") : local;
  if (!existsSync(where)) v = { ok: false, reason: gp ? `GERAK_PATH (${gp}) tidak berisi repo gerak` : "Gerak belum terpasang — isi GERAK_PATH dengan folder gerak di VPS" };
  else if (spawnSync(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) v = { ok: false, reason: "FFmpeg tidak ditemukan (sudo apt install ffmpeg)" };
  else v = { ok: true, where: path.dirname(path.dirname(where)) };
  statusCache = { at: Date.now(), v };
  return v;
}

/* ───────────── sidik isi ───────────── */

export function videoSourceHash(p: PostForRender, script: Shot[], options: VideoOptions) {
  return createHash("sha1")
    .update(JSON.stringify([script, options, kitRenderKey(p.kit, "brand"), p.kit.handle, p.products, mainImageOf(p), 1]))
    .digest("hex")
    .slice(0, 16);
}

/* ───────────── spec ───────────── */

function fontFile(key: string): { file: string; weight: number } | null {
  const f = FONT_CHOICES.find((c) => c.key === key);
  if (!f) return null;
  const weight = Math.max(...f.weights);
  return { file: path.join(process.cwd(), "src/lib/render/fonts", `${f.key}-latin-${weight}-normal.woff`), weight };
}

async function kitFont(kit: BrandKit, key: string, dir: string) {
  if (key.startsWith("custom:")) {
    const id = Number(key.slice(7));
    const [a] = await db().select({ data: schema.assets.data, mime: schema.assets.mime }).from(schema.assets).where(eq(schema.assets.id, id));
    if (!a) return null;
    const ext = a.mime.includes("woff") ? "woff" : a.mime.includes("otf") ? "otf" : "ttf";
    const file = path.join(dir, `font-${id}.${ext}`);
    await writeFile(file, a.data);
    return { family: `Custom${id}`, file, weight: 700, display: false };
  }
  const f = fontFile(key);
  return f ? { family: fontFamilyOf(key), file: f.file, weight: f.weight, display: isDisplayFont(key) } : null;
}

/** Bangun spec + unduh aset ke `dir`. */
export async function buildSpec(p: PostForRender, script: Shot[], options: VideoOptions, dir: string) {
  const kit = p.kit;
  const [head, body, settings] = await Promise.all([kitFont(kit, kit.headFont, dir), kitFont(kit, kit.bodyFont, dir), getSettings()]);
  const cover = await imageToFile(mainImageOf(p), path.join(dir, "cover.jpg"));
  const logo = kit.logo ? await imageToFile(kit.logo, path.join(dir, "logo.png"), { png: true, max: 800 }) : null;

  // "cocok untuk" dari slide perbandingan
  const fits = new Map<number, string>();
  for (const sl of p.slides) if (sl.kind === "compare") (sl.productIds ?? []).forEach((id, i) => sl.items?.[i] && fits.set(id, sl.items[i]));

  const used = new Set<number>();
  for (const s of script) {
    if (s.productId) used.add(s.productId);
    for (const id of s.productIds ?? []) used.add(id);
  }
  const products: Record<number, unknown> = {};
  for (const id of used) {
    const v = p.products[id];
    if (!v) continue;
    const plat = platformOf(v.platform);
    products[id] = {
      name: v.name,
      price: v.price,
      originalPrice: v.originalPrice,
      currency: v.currency,
      discount: discountOf(v.price, v.originalPrice) || null,
      rating: v.rating,
      soldText: v.sold ? `${formatCount(v.sold)}+ terjual` : null,
      platform: v.platform === "other" ? null : plat.label,
      platformColor: plat.color,
      image: await imageToFile(v.image, path.join(dir, `p${id}.jpg`)),
      fit: fits.get(id) ?? null,
    };
  }
  const sales = p.productIds.length > 0;
  return {
    title: p.headline,
    fps: 30,
    bpm: 100,
    seed: p.shortCode,
    kicker: p.kicker,
    brand: {
      name: kit.name,
      handle: kit.handle,
      colors: kit.colors,
      headFont: head,
      bodyFont: body,
      upper: kit.headUpper,
      logo,
    },
    cover,
    fallbackProduct: !cover && p.productIds[0] ? p.productIds[0] : undefined,
    shots: script,
    products,
    disclosure: sales && settings.salesDisclosure ? "Link affiliate · #ad" : undefined,
    motionBlur: !!options.motionBlur,
    music: options.music === "none" ? null : undefined,
    silent: options.music === "none",
  };
}

/* ───────────── antrian ───────────── */

let running = false;

export async function getVideo(postId: number) {
  const [v] = await db()
    .select({
      id: videos.id, status: videos.status, progress: videos.progress, script: videos.script, options: videos.options, sizeBytes: videos.sizeBytes,
      seconds: videos.seconds, sourceHash: videos.sourceHash, error: videos.error, startedAt: videos.startedAt, renderedAt: videos.renderedAt,
      hasData: sql<boolean>`${videos.data} is not null`,
    })
    .from(videos)
    .where(eq(videos.postId, postId));
  return v ?? null;
}

export async function saveScript(postId: number, script: Shot[], options: VideoOptions) {
  await db()
    .insert(videos)
    .values({ postId, script, options })
    .onConflictDoUpdate({ target: videos.postId, set: { script, options, updatedAt: new Date() } });
}

/** Masukkan ke antrean lalu mulai kalau mesin sedang kosong. */
export async function queueVideo(postId: number) {
  await db().update(videos).set({ status: "queued", progress: 0, error: null, updatedAt: new Date() }).where(eq(videos.postId, postId));
  void kick();
}

/** Render berikutnya di antrean (dipanggil setelah antre, setelah render selesai, dan oleh cron). */
export async function kick(): Promise<{ started?: number; busy?: boolean; reset?: number }> {
  // render yang "rendering" terlalu lama (server restart di tengah jalan) → gagal
  const reset = await db()
    .update(videos)
    .set({ status: "failed", error: "Render terhenti di tengah jalan (server restart?) — klik Render lagi", updatedAt: new Date() })
    .where(and(eq(videos.status, "rendering"), lte(videos.startedAt, new Date(Date.now() - STUCK_MS))))
    .returning({ id: videos.id });
  if (running) return { busy: true, reset: reset.length };
  const st = gerakStatus();
  if (!st.ok) return { reset: reset.length };
  // klaim atomik: hanya satu yang berubah queued → rendering
  const [next] = await db().select({ id: videos.id, postId: videos.postId }).from(videos).where(eq(videos.status, "queued")).orderBy(asc(videos.updatedAt)).limit(1);
  if (!next) return { reset: reset.length };
  const claimed = await db()
    .update(videos)
    .set({ status: "rendering", progress: 0, startedAt: new Date(), error: null })
    .where(and(eq(videos.id, next.id), eq(videos.status, "queued")))
    .returning({ id: videos.id });
  if (!claimed.length) return { reset: reset.length };
  running = true;
  void render(next.postId).finally(() => {
    running = false;
    void kick();
  });
  return { started: next.postId, reset: reset.length };
}

async function render(postId: number) {
  const t0 = Date.now();
  const dir = await mkdtemp(path.join(os.tmpdir(), `berita-video-${postId}-`));
  try {
    const [row] = await db().select({ script: videos.script, options: videos.options }).from(videos).where(eq(videos.postId, postId));
    const p = await loadPostForRender(postId);
    if (!row || !p) throw new Error("Post atau naskah hilang");
    if (!row.script.length) throw new Error("Naskah video kosong");
    const spec = await buildSpec(p, row.script, row.options, dir);
    const specFile = path.join(dir, "spec.json");
    const out = path.join(dir, "video.mp4");
    await writeFile(specFile, JSON.stringify(spec));
    const result = await runBuilder(specFile, out, async (progress) => {
      await db().update(videos).set({ progress }).where(eq(videos.postId, postId));
    });
    const data = await readFile(out);
    await db()
      .update(videos)
      .set({
        status: "done", progress: 1, data, sizeBytes: data.length, seconds: result.seconds ?? null,
        sourceHash: videoSourceHash(p, row.script, row.options), renderedAt: new Date(), error: null, updatedAt: new Date(),
      })
      .where(eq(videos.postId, postId));
    await logRun("designer", `Video post #${postId} dirender (${result.seconds?.toFixed(1) ?? "?"} dtk, ${(data.length / 1e6).toFixed(1)} MB, ${Math.round((Date.now() - t0) / 1000)} dtk proses)`, {
      detail: { postIds: [postId] },
    });
  } catch (e) {
    const msg = (e as Error).message.slice(0, 2000);
    await db().update(videos).set({ status: "failed", error: msg, updatedAt: new Date() }).where(eq(videos.postId, postId));
    await logRun("designer", `Render video post #${postId} gagal: ${msg.split("\n")[0]}`, { ok: false, detail: { error: msg, postIds: [postId] } });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runBuilder(specFile: string, out: string, onProgress: (p: number) => Promise<void>): Promise<{ seconds?: number }> {
  return new Promise((resolve, reject) => {
    const script = path.join(process.cwd(), "scripts/video/gerak-build.mjs");
    const child = spawn(process.execPath, [script, specFile, out], {
      env: { ...process.env, GERAK_PATH: process.env.GERAK_PATH ?? path.join(process.cwd(), "node_modules/gerak") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let buf = "";
    let last = 0;
    let seconds: number | undefined;
    const timer = setTimeout(() => child.kill("SIGKILL"), Number(process.env.VIDEO_TIMEOUT_MIN ?? 20) * 60_000);
    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        try {
          const j = JSON.parse(l);
          if (typeof j.progress === "number" && Date.now() - last > 2000) {
            last = Date.now();
            void onProgress(Math.min(0.99, j.progress));
          }
          if (j.done) seconds = j.seconds;
        } catch {
          /* bukan JSON */
        }
      }
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0 && existsSync(out)) resolve({ seconds });
      else reject(new Error(signal === "SIGKILL" ? "Render melebihi batas waktu (VIDEO_TIMEOUT_MIN)" : stderr.trim() || `Gerak keluar dengan kode ${code}`));
    });
  });
}

/* ───────────── baca video (dengan Range) ───────────── */

export async function videoResponse(postId: number, req: Request, opts: { download?: string; cache?: string } = {}) {
  const [meta] = await db()
    .select({ size: sql<number>`octet_length(${videos.data})`.mapWith(Number), at: videos.renderedAt })
    .from(videos)
    .where(and(eq(videos.postId, postId), sql`${videos.data} is not null`));
  if (!meta?.size) return new Response("not found", { status: 404 });
  const size = meta.size;
  const headers: Record<string, string> = {
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
    "cache-control": opts.cache ?? "private, max-age=60",
    ...(meta.at ? { "last-modified": meta.at.toUTCString() } : {}),
    ...(opts.download ? { "content-disposition": `attachment; filename="${opts.download}"` } : {}),
  };
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  let start = 0;
  let end = size - 1;
  if (range) {
    if (range[1]) start = Number(range[1]);
    if (range[2]) end = Math.min(size - 1, Number(range[2]));
    if (!range[1] && range[2]) {
      start = Math.max(0, size - Number(range[2]));
      end = size - 1;
    }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  }
  const len = end - start + 1;
  const [chunk] = await db()
    .select({ part: sql<Buffer>`substring(${videos.data} from ${start + 1} for ${len})` })
    .from(videos)
    .where(eq(videos.postId, postId));
  const body = new Uint8Array(chunk.part);
  return new Response(body, {
    status: range ? 206 : 200,
    headers: { ...headers, "content-length": String(body.length), ...(range ? { "content-range": `bytes ${start}-${end}/${size}` } : {}) },
  });
}
