#!/usr/bin/env node
/**
 * Berita → Gerak: membangun video 9:16 dari "spec" (JSON) lalu merendernya dengan engine Gerak.
 *
 *   node scripts/video/gerak-build.mjs spec.json out.mp4 [--sheet sheet.png] [--draft] [--frame 2s out.png]
 *
 * Gerak dicari di GERAK_PATH (folder repo gerak, mis. /home/ubuntu/gerak) atau paket npm "gerak".
 * Progres dicetak sebagai baris JSON: {"progress":0.42}
 *
 * Gaya video ada di ./styles/<nama>.mjs (spec.style, default "papan"). Semua gaya memakai
 * naskah shot yang sama (hook, point, step, product, compare, cta) — lihat ./lib.mjs.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const pos = [];
const opt = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--draft') opt.draft = true;
  else if (args[i] === '--sheet') opt.sheet = args[++i];
  else if (args[i] === '--frame') opt.frame = [args[++i], args[++i]];
  else pos.push(args[i]);
}
const [specFile, outFile] = pos;
if (!specFile || (!outFile && !opt.sheet && !opt.frame)) {
  console.error('pakai: gerak-build.mjs spec.json out.mp4 [--sheet x.png] [--draft] [--frame 2s x.png]');
  process.exit(2);
}

async function loadGerak() {
  const base = process.env.GERAK_PATH;
  if (base) {
    const entry = resolve(base, 'src/index.mjs');
    if (!existsSync(entry)) throw new Error(`GERAK_PATH tidak berisi gerak (tidak ada ${entry})`);
    return import(pathToFileURL(entry).href);
  }
  return import('gerak');
}

const G = await loadGerak();
const { renderMovie, renderSheet, saveFrame } = G;
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const { makeContext } = await import('./lib.mjs');
const STYLES = ['papan', 'struk', 'swiss', 'riso', 'editorial', 'buku', 'retro', 'kolase', 'data', 'bauhaus'];
const styleName = STYLES.includes(spec.style) ? spec.style : 'papan';
const style = await import(`./styles/${styleName}.mjs`);
const ctx = makeContext(G, spec);
if (!ctx.CAN_GLOW || (spec.motionBlur && !ctx.CAN_BLUR)) {
  console.error('Catatan: versi Gerak di server belum mendukung glow/motion blur — render tanpa efek. Update gerak (git pull) untuk efek lengkap.');
}
const p = await style.build(ctx);
const K = Math.round((ctx.FPS * 60) / (style.BPM ?? 100));

/* ───────────── keluaran ───────────── */
if (opt.sheet) await renderSheet(p, opt.sheet, { every: Math.round(K), thumb: 220, cols: 8 });
if (opt.frame) await saveFrame(p, /^\d+$/.test(opt.frame[0]) ? Number(opt.frame[0]) : opt.frame[0], opt.frame[1]);
if (outFile) {
  const draft = !!opt.draft;
  let lastPct = -1;
  await renderMovie(p, outFile, {
    scale: draft ? 0.5 : 1,
    audio: !spec.silent,
    crf: draft ? 28 : 20,
    preset: draft ? 'veryfast' : 'medium',
    onProgress: ({ done, total }) => {
      const pct = Math.floor((done / total) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        console.log(JSON.stringify({ progress: done / total }));
      }
    },
  });
  console.log(JSON.stringify({ done: true, seconds: p.seconds, frames: p.duration }));
}
