/**
 * Bahan bersama semua gaya video Berita → Gerak.
 * Satu `ctx` berisi: engine Gerak, spec, ukuran kanvas, warna (Brand Kit atau warna asli gaya),
 * font, daftar shot, produk, pembantu teks/harga/timing, dan musik.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = join(HERE, 'fonts');

/* ───────────── warna ───────────── */
export const hex = (h) => {
  const n = parseInt(String(h).replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const lum = (h) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hex(h);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
export const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
export const readable = (bg) => (lum(bg) > 0.42 ? '#111111' : '#ffffff');
/** Warna `want` kalau cukup kontras di atas `bg`, kalau tidak `fallback`. */
export const onBg = (want, bg, fallback, min = 2.2) => (contrast(want, bg) >= min ? want : fallback);

/* ───────────── teks ───────────── */
export const words = (t) => String(t).trim().split(/\s+/).filter(Boolean);
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** Indeks kata yang distabilo. */
export function hlIndex(text, emph) {
  if (!emph) return [];
  const e = String(emph).split(/\s+/).map(norm).filter(Boolean);
  return words(text).map((w, i) => (e.includes(norm(w)) ? i : -1)).filter((i) => i >= 0).slice(0, 3);
}
/** Pecah teks pendek jadi baris seimbang (maks `per` kata per baris). */
export function lines(text, per = 2) {
  const w = words(text);
  if (w.length <= per) return [w.join(' ')];
  const n = Math.ceil(w.length / per);
  const out = [];
  const size = Math.ceil(w.length / n);
  for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(' '));
  return out;
}
export const fmtRp = (n, cur = 'IDR') =>
  n == null ? '' : cur === 'IDR' ? 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : `${cur} ${n}`;
/** Angka pertama di teks ("Naik 30 persen" → 30). */
export function numberIn(text) {
  const m = /(\d+(?:[.,]\d+)?)/.exec(String(text));
  return m ? Number(m[1].replace(',', '.')) : null;
}

/* ───────────── konteks ───────────── */
export function makeContext(G, spec) {
  const W = spec.canvas?.w ?? 1080;
  const H = spec.canvas?.h ?? 1920;
  const compact = H < 1500;
  const B = spec.brand ?? { colors: {} };
  const brandColors = {
    bg: B.colors?.background ?? '#ffffff',
    ink: B.colors?.text ?? '#111111',
    acc: B.colors?.primary ?? '#e11d48',
    acc2: B.colors?.secondary ?? '#ffd23f',
  };
  const useBrand = spec.colors !== 'style';

  // fitur Gerak versi baru
  const CAN_GLOW = (() => {
    try {
      G.project({ preset: 'reels' }).scene('cek', { duration: 1 }).layer('cek', { glow: { radius: 10 } });
      return true;
    } catch {
      return false;
    }
  })();
  const CAN_BLUR = typeof G.project({ preset: 'reels' }).motionBlur === 'function';

  const img = (f) => (f && existsSync(f) ? f : null);
  const shots = (spec.shots ?? []).filter((s) => s && s.text).map((s, i) => ({ ...s, i }));
  if (!shots.length) throw new Error('Spec tidak punya shot');
  if (shots[shots.length - 1].kind !== 'cta') shots.push({ kind: 'cta', text: 'Cek link di bio', i: shots.length });
  const products = spec.products ?? {};
  const minFrames = Math.round((spec.minSeconds ?? 0) * (spec.fps ?? 30));

  const ctx = {
    G, spec, W, H, compact, FPS: spec.fps ?? 30, B, brandColors, useBrand, CAN_GLOW, CAN_BLUR,
    FX: spec.glow !== false && CAN_GLOW,
    shots, products, img, cover: img(spec.cover),
    /** posisi vertikal yang dirancang untuk 1920 → kanvas sekarang */
    Y: (v) => Math.round((v * H) / 1920),
    /** skala ukuran huruf/objek untuk kanvas pendek (mode split) */
    F: compact ? 0.68 : 1,
    handle: B.handle ?? '',
    logo: img(B.logo),
    /**
     * Palet gaya: `style` = warna asli gaya; dengan Brand Kit, aksen diganti warna brand
     * (latar & tinta gaya tetap supaya karakternya tidak hilang, kecuali gaya meminta `brandBg`).
     */
    palette(style, { brandBg = false } = {}) {
      if (!useBrand) return { ...style };
      const bg = brandBg ? brandColors.bg : style.bg;
      const ink = brandBg ? brandColors.ink : style.ink;
      return {
        ...style,
        bg,
        ink,
        acc: onBg(brandColors.acc, bg, onBg(brandColors.acc2, bg, style.acc)),
        acc2: onBg(brandColors.acc2, bg, style.acc2 ?? style.acc, 1.4),
      };
    },
    project(opts = {}) {
      const p = G.project({ title: spec.title ?? 'Berita', width: W, height: H, fps: ctx.FPS, ...opts });
      if (spec.motionBlur && CAN_BLUR) p.motionBlur({ samples: 6, shutter: 0.6 });
      return p;
    },
    /** daftarkan font bawaan Berita (scripts/video/fonts) */
    font(p, file, family, weight = 400, style) {
      const f = join(FONT_DIR, file);
      if (!existsSync(f)) return 'Plus Jakarta Sans';
      return p.font(f, { family, weight, ...(style ? { style } : {}) });
    },
    /** font Brand Kit (judul / isi), fallback Plus Jakarta Sans */
    brandFonts(p) {
      const head = B.headFont?.file && existsSync(B.headFont.file) ? p.font(B.headFont.file, { family: B.headFont.family, weight: B.headFont.weight ?? 700 }) : 'Plus Jakarta Sans';
      const body = B.bodyFont?.file && existsSync(B.bodyFont.file) ? p.font(B.bodyFont.file, { family: B.bodyFont.family, weight: B.bodyFont.weight ?? 600 }) : 'Plus Jakarta Sans';
      return { head, body, headW: B.headFont?.weight ?? 800, display: !!B.headFont?.display, upper: !!B.headFont?.display || !!B.upper };
    },
    /**
     * Jadwal shot: `beats(shot)` ketuk per shot → {start, dur} (frame).
     * Kalau ada VO / video sendiri yang lebih panjang, semua durasi diregangkan supaya cukup.
     */
    timeline(K, beats, { intro = 0, outro = 0 } = {}) {
      let durs = ctx.shots.map((s) => Math.round(beats(s) * K));
      const natural = intro + durs.reduce((a, b) => a + b, 0) + outro;
      if (minFrames > natural) {
        const f = (minFrames - intro - outro) / (natural - intro - outro);
        durs = durs.map((d) => Math.round(d * f));
      }
      let t = intro;
      const plan = ctx.shots.map((s, i) => {
        const r = { ...s, start: t, dur: durs[i] };
        t += durs[i];
        return r;
      });
      return { plan, end: t + outro };
    },
    /** musik latar sintetis (beat + pad) kecuali dimatikan / ada file musik */
    music(p, end, bpm, { kick = 'x.....x...x.....', snare = '....x.......x...', hat = 'x.x.x.x.x.x.x.x.', root = 130.8, chord = [0, 4, 7, 11], beatVol = -17, padVol = -23, brightness = 900 } = {}) {
      if (spec.silent) return;
      const secs = end / ctx.FPS;
      if (spec.music && existsSync(spec.music)) {
        p.audio(spec.music, { at: 0, volume: spec.musicVolume ?? -16, fadeOut: 1.5, duration: secs });
        return;
      }
      const bars = Math.ceil(secs / ((60 / bpm) * 4)) + 1;
      p.sfx('beat', { at: 0, bpm, bars, volume: beatVol, kick, snare, hat });
      if (padVol != null) p.sfx('pad', { at: 0, dur: secs, root, chord, brightness, volume: padVol });
    },
    fmtRp,
    glow(color, o = {}) {
      return ctx.FX ? { glow: { color, radius: 40, strength: 1, ...o } } : {};
    },
  };
  return ctx;
}

/** Lingkaran/kotak gambar sampul cadangan kalau tidak ada foto. */
export function placeholder(layer, x, y, w, h, colors, text, font = 'Plus Jakarta Sans', o = {}) {
  layer.rect(x - w / 2, y - h / 2, w, h, { fill: { type: 'linear', angle: 135, stops: [[0, colors[0]], [1, colors[1]]] }, r: o.r ?? 0, ...(o.show ? { show: o.show } : {}) });
  if (text) layer.text(text, x, y, { font, weight: 800, size: Math.min(w, h) * 0.18, color: readable(colors[0]), align: 'center', valign: 'middle', maxWidth: w - 40, ...(o.show ? { show: o.show } : {}) });
}

/**
 * Gaya berbasis scene: satu scene per shot, transisi bergiliran.
 * `render(scene, shot, index, { off })` — `off` = frame transisi (isi sebaiknya muncul setelahnya).
 */
export function sceneRun(ctx, p, K, { beats, transitions = [], bg, outro = 0 }, render) {
  const { plan, end } = ctx.timeline(K, beats, { outro });
  plan.forEach((st, i) => {
    const tr = i === 0 ? null : transitions.length ? transitions[(i - 1) % transitions.length] : null;
    const off = tr && tr.type !== 'cut' ? tr.duration ?? 10 : 0;
    const extra = i === plan.length - 1 ? outro : 0;
    const s = p.scene(`${i + 1} ${st.kind}`, {
      duration: st.dur + off + extra,
      background: typeof bg === 'function' ? bg(st, i) : bg,
      ...(tr ? { transition: tr } : {}),
    });
    s.note({ action: `${st.kind}: ${st.text}` });
    render(s, st, i, { off, dur: st.dur + extra });
  });
  return end;
}

/** Foto (cover / produk) atau kotak warna cadangan. */
export function photo(ctx, layer, file, x, y, w, h, { fit = 'cover', radius = 0, colors, label, font, show, stroke, strokeWidth } = {}) {
  if (file && ctx.img(file)) {
    layer.image(file, x, y, { width: w, height: h, fit, anchor: 'center', radius, ...(stroke ? { stroke, strokeWidth } : {}), ...(show ? { show } : {}) });
    return true;
  }
  placeholder(layer, x, y, w, h, colors ?? [ctx.brandColors.acc, ctx.brandColors.acc2], label, font, { r: radius, show });
  return false;
}

/** Gambar untuk shot: produk → foto produk, lainnya → sampul. */
export function shotImage(ctx, st) {
  if (st.kind === 'product') return { file: ctx.img(ctx.products[st.productId]?.image), product: true };
  if (st.kind === 'compare') {
    const id = (st.productIds ?? [])[(st.pick ?? 1) - 1];
    return { file: ctx.img(ctx.products[id]?.image), product: true };
  }
  return { file: ctx.cover, product: false };
}

/** Bungkus teks kira-kira (lebar karakter ≈ k × ukuran huruf) → jumlah baris. */
export function wrapCount(text, size, maxWidth, k = 0.56) {
  const per = Math.max(1, Math.floor(maxWidth / (size * k)));
  let n = 1;
  let len = 0;
  for (const w of words(text)) {
    if (len && len + 1 + w.length > per) {
      n++;
      len = w.length;
    } else len += (len ? 1 : 0) + w.length;
  }
  return n;
}
