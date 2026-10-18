import "server-only";
/**
 * Gabungkan video Gerak dengan voice over dan/atau video sendiri (PIP / split) memakai FFmpeg.
 * Musik dari Gerak otomatis mengecil saat ada suara (sidechain ducking).
 */
import { spawn } from "node:child_process";
import type { VideoOptions } from "../content";
import { FFMPEG, mediaPath, probe } from "./media";

const hexToFf = (h: string) => "0x" + h.replace("#", "").slice(0, 6);

/** Topeng alpha: lingkaran / kotak sudut membulat. */
function maskExpr(shape: "bulat" | "kotak", r = 48) {
  if (shape === "bulat") return "if(lte(hypot(X-W/2,Y-H/2),W/2-1),255,0)";
  return `if(gt(abs(X-W/2),W/2-${r})*gt(abs(Y-H/2),H/2-${r}),if(lte(hypot(abs(X-W/2)-(W/2-${r}),abs(Y-H/2)-(H/2-${r})),${r}),255,0),255)`;
}

export async function compose(opts: {
  template: string;
  out: string;
  options: VideoOptions;
  accent: string;
  onProgress?: (p: number) => void;
}) {
  const { template, out, options, accent } = opts;
  const t = probe(template);
  const T = t.seconds;
  const cam = options.cam?.file ? mediaPath(options.cam.file) : null;
  const vo = options.vo?.file ? mediaPath(options.vo.file) : null;
  const camInfo = cam ? probe(cam) : null;
  const layout = cam ? options.layout ?? "pip" : "full";

  const inputs = ["-i", template];
  let camIdx = -1;
  let voIdx = -1;
  if (cam) {
    camIdx = inputs.length / 2;
    inputs.push("-i", cam);
  }
  if (vo) {
    voIdx = inputs.length / 2;
    inputs.push("-i", vo);
  }

  const f: string[] = [];
  // video
  if (!cam || layout === "full") f.push("[0:v]null[v]");
  else if (layout === "pip") {
    const shape = options.pipShape ?? "bulat";
    const w = shape === "bulat" ? 420 : 400;
    const h = shape === "bulat" ? 420 : 520;
    const b = 10;
    const corner = options.pipCorner ?? "kanan-bawah";
    const right = corner.startsWith("kanan");
    const bottom = corner.endsWith("bawah");
    const x = right ? 1080 - w - b * 2 - 44 : 44;
    // bawah: di atas area UI aplikasi (±21% bawah), atas: di bawah area status (±9%)
    const y = bottom ? 1920 - 420 - h - b * 2 : 200;
    f.push(
      `[${camIdx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,tpad=stop_mode=clone:stop_duration=600,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${maskExpr(shape)}'[cam]`,
      `color=c=${hexToFf(accent)}:s=${w + b * 2}x${h + b * 2}:d=${Math.ceil(T) + 1},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${maskExpr(shape, 58)}'[ring]`,
      `[ring][cam]overlay=${b}:${b}[bubble]`,
      `[0:v][bubble]overlay=${x}:${y}:shortest=0:eof_action=pass[v]`,
    );
  } else {
    // split: kanvas Gerak 1080×1080 + video sendiri 1080×840
    f.push(`[${camIdx}:v]scale=1080:840:force_original_aspect_ratio=increase,crop=1080:840,setsar=1,tpad=stop_mode=clone:stop_duration=600[cam]`);
    f.push(layout === "split-top" ? `[cam][0:v]vstack=inputs=2[v]` : `[0:v][cam]vstack=inputs=2[v]`);
  }

  // audio
  const voice = vo ? `${voIdx}:a` : cam && options.cam?.useAudio !== false && camInfo?.hasAudio ? `${camIdx}:a` : null;
  const music = t.hasAudio ? "0:a" : null;
  if (voice && music) {
    f.push(
      `[${voice}]aresample=48000,aformat=channel_layouts=stereo,apad,asplit=2[v1][v2]`,
      `[${music}]aresample=48000,aformat=channel_layouts=stereo,volume=0.7[m0]`,
      `[m0][v1]sidechaincompress=threshold=0.015:ratio=12:attack=20:release=400[m]`,
      `[m][v2]amix=inputs=2:normalize=0:duration=first[a]`,
    );
  } else if (voice) f.push(`[${voice}]aresample=48000,aformat=channel_layouts=stereo,apad[a]`);
  else if (music) f.push(`[${music}]anull[a]`);

  const args = ["-y", "-v", "error", "-progress", "pipe:1", ...inputs, "-filter_complex", f.join(";"), "-map", "[v]"];
  if (voice || music) args.push("-map", "[a]", "-c:a", "aac", "-b:a", "160k");
  args.push("-t", T.toFixed(2), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out);

  await new Promise<void>((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stdout.on("data", (d: Buffer) => {
      const m = /out_time_ms=(\d+)/.exec(d.toString());
      if (m && T) opts.onProgress?.(Math.min(1, Number(m[1]) / 1e6 / T));
    });
    p.stderr.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-3000)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Gabung video gagal: ${err.trim() || code}`))));
  });
}
