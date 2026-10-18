import "server-only";
/**
 * File media milik video (voice over, video sendiri) disimpan di disk server (MEDIA_DIR),
 * bukan di database — ukurannya bisa ratusan MB dan dibaca langsung oleh FFmpeg.
 */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebStream } from "node:stream/web";

export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR ?? path.join(process.cwd(), "data/media"));
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";
export const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

export const LIMITS = { vo: 80 * 1024 * 1024, cam: 600 * 1024 * 1024 };

export function postMediaDir(postId: number) {
  return path.join(MEDIA_DIR, `post-${postId}`);
}

/** Path aman di dalam MEDIA_DIR (menolak path di luar). */
export function mediaPath(rel: string) {
  const abs = path.resolve(MEDIA_DIR, rel);
  if (!abs.startsWith(MEDIA_DIR + path.sep)) throw new Error("Path media tidak valid");
  return abs;
}

export function probe(file: string): { seconds: number; hasVideo: boolean; hasAudio: boolean } {
  const r = spawnSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file], { encoding: "utf8" });
  if (r.status !== 0) return { seconds: 0, hasVideo: false, hasAudio: false };
  try {
    const j = JSON.parse(r.stdout) as { format?: { duration?: string }; streams?: { codec_type: string }[] };
    return {
      seconds: Number(j.format?.duration) || 0,
      hasVideo: !!j.streams?.some((s) => s.codec_type === "video"),
      hasAudio: !!j.streams?.some((s) => s.codec_type === "audio"),
    };
  } catch {
    return { seconds: 0, hasVideo: false, hasAudio: false };
  }
}

/** Rekaman browser (webm/opus) kadang tanpa durasi di header → hitung ulang dengan remux ke .m4a / .mp4. */
async function remux(src: string, dest: string, audioOnly: boolean) {
  await new Promise<void>((resolve, reject) => {
    const args = audioOnly
      ? ["-y", "-v", "error", "-i", src, "-vn", "-c:a", "aac", "-b:a", "160k", dest]
      : ["-y", "-v", "error", "-i", src, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-vf", "scale='min(1080,iw)':-2", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", dest];
    const p = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-1500)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `ffmpeg keluar ${code}`))));
  });
}

/** Simpan upload (stream) → normalisasi → {file relatif MEDIA_DIR, seconds}. */
export async function saveUpload(postId: number, kind: "vo" | "cam", body: WebStream<Uint8Array>, name: string) {
  const dir = postMediaDir(postId);
  await mkdir(dir, { recursive: true });
  const stamp = Date.now();
  const raw = path.join(dir, `${kind}-${stamp}.upload`);
  let size = 0;
  const limit = LIMITS[kind];
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > limit) cb(new Error(`File terlalu besar (maks ${Math.round(limit / 1024 / 1024)} MB)`));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body), counter, createWriteStream(raw));
    const info = probe(raw);
    if (kind === "vo" && !info.hasAudio) throw new Error("File tidak berisi audio");
    if (kind === "cam" && !info.hasVideo) throw new Error("File tidak berisi video");
    const out = path.join(dir, `${kind}-${stamp}.${kind === "vo" ? "m4a" : "mp4"}`);
    await remux(raw, out, kind === "vo");
    const fin = probe(out);
    if (!fin.seconds) throw new Error("Durasi media tidak terbaca");
    if (fin.seconds > 180) throw new Error("Maksimal 3 menit");
    return { file: path.relative(MEDIA_DIR, out), name: name.slice(0, 120), seconds: Math.round(fin.seconds * 10) / 10, hasAudio: fin.hasAudio };
  } finally {
    await rm(raw, { force: true });
  }
}

export async function removeMedia(rel: string | undefined | null) {
  if (!rel) return;
  try {
    await rm(mediaPath(rel), { force: true });
  } catch {
    /* abaikan */
  }
}

export async function mediaExists(rel: string | undefined | null) {
  if (!rel) return false;
  try {
    return (await stat(mediaPath(rel))).isFile();
  } catch {
    return false;
  }
}

export const ffmpegOk = () => existsSync(FFMPEG) || spawnSync(FFMPEG, ["-version"], { stdio: "ignore" }).status === 0;
