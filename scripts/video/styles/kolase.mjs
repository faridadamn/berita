// Gaya "Kolase tempel"
// Huruf guntingan ala surat kaleng untuk kata kunci, kertas sobek, selotip, polaroid, stiker,
// coretan spidol — semuanya "ditempel" di ketukan. Cocok: flash sale, giveaway, promo heboh, Gen Z.
import { lines, fmtRp, sceneRun, shotImage, photo, words } from '../lib.mjs';

export const BPM = 120;

export function build(ctx) {
  const { G, W, Y, F, products } = ctx;
  const { rng, catmullRom, withPressure } = G;
  const C = ctx.palette({ bg: '#C9A57D', ink: '#141414', acc: '#E4312B', acc2: '#FF7EB6' });
  const p = ctx.project({ background: C.bg });
  p.effects({ grain: 0.13, vignette: 0.18 });
  const FT = {
    anton: ctx.font(p, 'Anton-Regular.ttf', 'Anton', 400),
    arch: ctx.font(p, 'ArchivoBlack-Regular.ttf', 'Archivo Black', 400),
    serif: ctx.font(p, 'InstrumentSerif-Italic.ttf', 'Instrument Serif', 400, 'italic'),
    mono: ctx.font(p, 'SpaceMono-Bold.ttf', 'Space Mono', 700),
    groovy: ctx.font(p, 'Shrikhand-Regular.ttf', 'Shrikhand', 400),
  };
  const K = Math.round((ctx.FPS * 60) / BPM);
  const INK = '#141414', YEL = '#FFE14D', WHITE = '#F7F4EC', NEWS = '#E3DED2';
  const RED = C.acc, PINK = C.acc2;
  const R = rng('kolase');

  function torn(l, x, y, w, h, fill, jag = 10) {
    const pts = [];
    const edge = (x0, y0, x1, y1, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / n;
        pts.push([x0 + (x1 - x0) * t + (R() - 0.5) * jag, y0 + (y1 - y0) * t + (R() - 0.5) * jag]);
      }
    };
    edge(x, y, x + w, y, 18);
    edge(x + w, y, x + w, y + h, 10);
    edge(x + w, y + h, x, y + h, 18);
    edge(x, y + h, x, y, 10);
    l.polygon(pts, { fill, closed: true, shadow: { color: 'rgba(0,0,0,0.28)', blur: 14, x: 4, y: 8 } });
  }
  function tape(l, x, y, w, rot) {
    const a = (rot * Math.PI) / 180;
    l.polygon([[-w / 2, -24], [w / 2, -24], [w / 2, 24], [-w / 2, 24]].map(([px, py]) => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]), { fill: 'rgba(250,246,230,0.62)', closed: true });
  }
  const PAPERS = [[WHITE, INK], [INK, WHITE], [YEL, INK], [PINK, INK], [NEWS, RED], [RED, WHITE]];
  const FONTS = [[FT.anton, 1], [FT.arch, 0.82], [FT.serif, 1.05], [FT.mono, 0.86], [FT.groovy, 0.8]];
  function ransom(s, word, cx, y, cell, at, step = 2) {
    const chars = [...word.toUpperCase()].slice(0, 9);
    const c = Math.min(cell, 960 / chars.length) * F;
    const x0 = cx - ((chars.length - 1) * c) / 2;
    chars.forEach((ch, i) => {
      if (ch === ' ') return;
      const [bg, fg] = PAPERS[(i * 2 + Math.floor(R() * 3)) % PAPERS.length];
      const [font, k] = FONTS[(i + Math.floor(R() * 5)) % FONTS.length];
      const l = s.layer(`Huruf ${word} ${i}`, { x: x0 + i * c, y: y + (R() - 0.5) * 30 * F, rotation: (R() - 0.5) * 16 });
      torn(l, -c * 0.47, -c * 0.62, c * 0.94, c * 1.24, bg, 8);
      l.text(ch, 0, 4, { font, weight: font === FT.mono ? 700 : 400, size: c * k, color: fg, align: 'center', valign: 'middle' });
      const t = at + i * step;
      if (at > 0) {
        l.key(0, { opacity: 0 }, 'hold').key(t, { opacity: 1 });
        l.pop(t, { from: 1.8, dur: 5, ease: 'out-quad', fade: false });
        s.sfx('tap', { at: t, volume: -9, pitch: 0.9 + (i % 3) * 0.15 });
      }
    });
  }
  // potongan kertas berisi kalimat
  function strip(s, text, y, at, { fill = WHITE, color = INK, font = FT.arch, size = 96, rot = -2 } = {}) {
    const ls = lines(text, 3);
    const sz = Math.round(size * F);
    const h = ls.length * sz * 1.15 + 50 * F;
    const l = s.layer(`Strip ${text.slice(0, 10)}`, { x: W / 2, y, rotation: rot });
    torn(l, -470, -h / 2, 940, h, fill, 12);
    l.text(ls.join('\n'), 0, 4, { font, size: sz, color, align: 'center', valign: 'middle', lineHeight: 1.12, fit: 880 });
    tape(l, -380, -h / 2, 150, -12);
    tape(l, 380, h / 2, 150, -12);
    if (at > 0) {
      l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
      l.pop(at, { from: 1.4, dur: 6, ease: 'out-back', fade: false });
      s.sfx('tap', { at, volume: -8 });
    }
    return h;
  }
  function polaroid(s, file, x, y, w, h, at, rot, product) {
    const l = s.layer(`Polaroid ${x}-${y}`, { x, y, rotation: rot, shadow: { color: 'rgba(0,0,0,0.35)', blur: 20, x: 6, y: 12 } });
    l.rect(-w / 2 - 22, -h / 2 - 22, w + 44, h + 100, { fill: '#FAFAF5' });
    photo(ctx, l, file, 0, 0, w, h, { fit: product ? 'contain' : 'cover', colors: [RED, PINK] });
    tape(l, 0, -h / 2 - 22, 200, 4);
    if (at > 0) {
      l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
      l.dropIn(at, { height: 400, dur: 12 });
      s.sfx('pop', { at: at + 8, volume: -10 });
    }
  }
  function sticker(s, text, x, y, at, color = YEL, r = 150) {
    const l = s.layer(`Stiker ${text}`, { x, y, rotation: 12 });
    l.star(0, 0, r * F, r * 0.78 * F, 16, { fill: color, stroke: INK, strokeWidth: 6 });
    l.text(text, 0, 4, { font: FT.anton, size: Math.round(r * 0.5 * F), color: INK, align: 'center', valign: 'middle', fit: r * 1.4 * F });
    l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
    l.pop(at, { from: 2.2, dur: 6, ease: 'out-quad', fade: false });
    l.wiggle({ rot: 4, freq: 1.2, seed: 5 });
    s.sfx('impact', { at, volume: -9 });
  }
  function scribble(s, x, y, w, at, color = RED) {
    const l = s.layer(`Coret ${x}-${y}`);
    l.stroke(withPressure(catmullRom([[x, y], [x + w * 0.35, y + 14], [x + w * 0.7, y - 6], [x + w, y + 10]], 30), 'swell'), { brush: 'marker', size: 16, color, reveal: [at, 8, 'out-cubic'] });
  }
  const keyword = (st) => (st.emph && st.emph.length <= 9 ? st.emph : null) || (st.emph || words(st.text).sort((a, b) => b.length - a.length)[0] || st.text).replace(/[^\p{L}\p{N} ]/gu, '');

  const BEATS = { hook: 6, point: 4, step: 4, product: 7, compare: 7, cta: 5 };
  const TR = [{ type: 'cover-up', duration: 8, ease: 'in-out-quart' }, { type: 'cut' }, { type: 'push-right', duration: 8, ease: 'in-out-quart' }, { type: 'flash', duration: 5 }];
  const end = sceneRun(ctx, p, K, { beats: (s) => BEATS[s.kind] ?? 4, transitions: TR, bg: C.bg }, (s, st, i, { off }) => {
    const at = off + 2;
    s.camera.handheld({ amp: 5 });
    if (st.kind === 'hook') {
      const im = shotImage(ctx, st);
      polaroid(s, im.file, W / 2 + 40, Y(1250), 620, Y(560), 0, 5, im.product);
      ransom(s, keyword(st), W / 2, Y(380), 150, 0);
      strip(s, st.text, Y(700), 0, { fill: YEL, size: 110 });
      sticker(s, 'BARU', 180, Y(1520), at + K, PINK);
    } else if (st.kind === 'point' || st.kind === 'step') {
      ransom(s, st.kind === 'step' ? `#${st.n ?? i}` : keyword(st), W / 2, Y(520), 190, at);
      const sub = shotImage(ctx, { kind: 'hook' }).file ?? (ctx.spec.fallbackProduct ? ctx.img(products[ctx.spec.fallbackProduct]?.image) : null);
      if (sub) polaroid(s, sub, i % 2 ? 330 : 750, Y(1420), 380, Y(380), at + 2 * K, i % 2 ? -6 : 6, !ctx.cover);
      strip(s, st.text, Y(930), at + K, { fill: i % 2 ? WHITE : NEWS, font: i % 2 ? FT.arch : FT.serif, size: i % 2 ? 100 : 130, rot: i % 2 ? 2 : -2 });
      scribble(s, 160, Y(1170), 760, at + 2 * K);
      if (st.label) sticker(s, st.label.toUpperCase().slice(0, 8), 860, Y(380), at + 3 * K, YEL, 130);
    } else if (st.kind === 'product') {
      const pr = products[st.productId];
      polaroid(s, pr?.image, W / 2, Y(700), 640, Y(640), at, -3, true);
      strip(s, st.text, Y(1220), at + K, { fill: WHITE, size: 100 });
      if (pr?.price) ransom(s, fmtRp(pr.price, pr.currency).replace('Rp', 'RP '), W / 2, Y(1500), 130, at + 3 * K, 1);
      if (pr?.discount) sticker(s, `-${pr.discount}%`, 860, Y(330), at + 4 * K, YEL, 160);
    } else if (st.kind === 'compare') {
      strip(s, st.text, Y(330), at, { fill: YEL, size: 100 });
      const ids = (st.productIds ?? []).filter((id) => products[id]).slice(0, 3);
      const n = ids.length || 1;
      const cw = Math.floor(860 / n) - 40;
      ids.forEach((id, k) => {
        const pr = products[id];
        const x = 110 + k * (cw + 60) + cw / 2;
        const t = at + K + k * Math.round(K / 2);
        polaroid(s, pr.image, x, Y(900), cw, cw, t, k % 2 ? 5 : -5, true);
        const pl = s.layer(`Harga ${k}`, { x, y: Y(900) + cw / 2 + Y(130), rotation: k % 2 ? 3 : -3 });
        torn(pl, -cw / 2, -Y(40), cw, Y(80), INK, 6);
        pl.text(fmtRp(pr.price, pr.currency), 0, 2, { font: FT.mono, weight: 700, size: Math.round(44 * F), color: WHITE, align: 'center', valign: 'middle', fit: cw - 20 });
        pl.key(0, { opacity: 0 }, 'hold').key(t + 6, { opacity: 1 });
        if (k + 1 === (st.pick ?? 1)) sticker(s, 'PILIH!', x + cw / 2 - 20, Y(900) - cw / 2, at + 4 * K, PINK, 110);
      });
    } else {
      ransom(s, words(st.text).slice(0, 2).join(' '), W / 2, Y(640), 150, at, 2);
      if (words(st.text).length > 2) strip(s, words(st.text).slice(2).join(' '), Y(980), at + 2 * K, { fill: YEL, size: 110 });
      strip(s, ctx.handle, Y(1300), at + 3 * K, { fill: INK, color: WHITE, font: FT.mono, size: 80, rot: 3 });
      if (ctx.logo) {
        const lg = s.layer('Logo', { x: W / 2, y: Y(300), rotation: -4 });
        torn(lg, -230 * F, -90 * F, 460 * F, 180 * F, WHITE, 8);
        lg.image(ctx.logo, 0, 0, { width: 380 * F, height: 140 * F, fit: 'contain', anchor: 'center' });
        lg.fadeIn(at, 6);
      }
      if (ctx.spec.disclosure) s.layer('Disclosure', { fixed: true }).text(ctx.spec.disclosure, W / 2, Y(1640), { size: Math.round(30 * F), weight: 700, color: INK, align: 'center', valign: 'middle' });
    }
  });
  ctx.music(p, end, BPM, { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.xxx.x.x.', padVol: null, beatVol: -16 });
  return p;
}
