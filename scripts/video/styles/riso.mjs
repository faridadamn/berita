// Gaya "Riso" · cetak risograph 2 tinta
// Dua tinta multiply yang meleset & bergetar, halftone berputar, huruf condensed raksasa (Anton),
// kotak tinta untuk label, bintang cetak. Cocok: launching, open PO, promo heboh, event.
import { lines, fmtRp, sceneRun, shotImage, photo } from '../lib.mjs';

export const BPM = 120;

export function build(ctx) {
  const { G, W, Y, F, products } = ctx;
  const { rng } = G;
  const C = ctx.palette({ bg: '#F3EEE3', ink: '#1B1B1B', acc: '#FF48B0', acc2: '#0078BF' });
  const PINK = C.acc;
  const BLUE = C.acc2;
  const p = ctx.project({ background: C.bg });
  p.effects({ grain: 0.11, vignette: 0.06 });
  const ANTON = ctx.font(p, 'Anton-Regular.ttf', 'Anton', 400);
  const K = Math.round((ctx.FPS * 60) / BPM);
  const anton = (o) => ({ font: ANTON, weight: 400, valign: 'middle', align: 'center', ...o });
  const R = rng('riso');

  function riso(s, name, text, x, y, size, at, { offset = [10, 7], seed = 1, fit = 980 } = {}) {
    const make = (color, dx, dy, sd) => {
      const l = s.layer(`${name} ${color}`, { x: x + dx, y: y + dy, blend: 'multiply' });
      l.text(text, 0, 0, anton({ size, color, fit }));
      l.wiggle({ amp: 2.5, freq: 3, seed: sd });
      if (at > 0) l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
      return l;
    };
    const b = make(BLUE, offset[0], offset[1], seed);
    const pk = make(PINK, 0, 0, seed + 7);
    if (at > 0) {
      b.pop(at, { from: 1.35, dur: 6, ease: 'out-cubic', fade: false });
      pk.pop(at + 2, { from: 1.35, dur: 6, ease: 'out-cubic', fade: false });
    }
  }
  function halftone(layer, cx, cy, rad, color, step = 30, maxR = 13) {
    for (let y = cy - rad; y <= cy + rad; y += step)
      for (let x = cx - rad; x <= cx + rad; x += step) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d > 1) continue;
        const r = maxR * (1 - d * d);
        if (r > 1.2) layer.circle(x, y, r, { fill: color });
      }
  }
  function sun(s, x, y, color, at = 0) {
    const l = s.layer('Halftone', { x, y, blend: 'multiply' });
    halftone(l, 0, 0, 420 * F, color, Math.round(32 * F), 13 * F);
    if (at) l.zoomIn(at, { from: 0.6, dur: 16 });
    l.spin({ speed: 5 });
  }
  function stars(s, at, n = 6) {
    for (let i = 0; i < n; i++) {
      const st = s.layer(`Bintang ${i}`, { x: 100 + R() * 880, y: Y(260 + R() * 1300), blend: 'multiply' });
      st.star(0, 0, (26 + R() * 30) * F, 10 * F, 4, { fill: i % 2 ? PINK : BLUE });
      st.key(0, { opacity: 0 }, 'hold').key(at + i * 2, { opacity: 1 });
      st.pop(at + i * 2, { dur: 6 }).spin({ speed: i % 2 ? 40 : -40 });
    }
  }
  function box(s, text, y, at, color = BLUE, rot = -2) {
    const b = s.layer(`Kotak ${text}`, { x: W / 2, y, rotation: rot });
    const sz = Math.round(150 * F);
    b.rect(-450, -sz * 0.62, 900, sz * 1.24, { fill: color });
    b.text(text.toUpperCase(), 0, 4, anton({ size: sz, color: C.bg, fit: 860 }));
    b.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
    b.wipeIn(at, { dir: 'right', dur: 6, ease: 'out-cubic', rect: [-460, -sz, 920, sz * 2] });
    s.sfx('impact', { at, volume: -8 });
  }
  function bigTitle(s, text, yTop, at, size = 300) {
    const ls = lines(text.toUpperCase(), 2);
    const sz = Math.round((ls.length > 2 ? size * 0.78 : size) * F);
    ls.forEach((ln, j) => {
      riso(s, `Baris ${j}`, ln, W / 2, yTop + j * sz * 1.02, sz, at > 0 ? at + j * K : 0, { seed: j * 3 + 1, offset: j % 2 ? [-11, 8] : [10, 7] });
      if (at > 0) s.sfx('kick', { at: at + j * K, volume: -7 });
    });
    return yTop + ls.length * sz * 1.02;
  }
  function printPhoto(s, file, x, y, w, h, at, isProduct) {
    const a = s.layer('Foto biru', { x: x + 12, y: y + 9, blend: 'multiply', filter: 'grayscale(1) contrast(1.4)' });
    photo(ctx, a, file, 0, 0, w, h, { fit: isProduct ? 'contain' : 'cover', colors: [BLUE, PINK] });
    const b = s.layer('Bingkai', { x, y });
    b.rect(-w / 2, -h / 2, w, h, { stroke: PINK, strokeWidth: 12, fill: 'rgba(0,0,0,0)' });
    for (const l of [a, b]) {
      l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
      l.pop(at, { from: 1.2, dur: 7, ease: 'out-cubic', fade: false });
    }
    a.wiggle({ amp: 2, freq: 2, seed: 9 });
  }

  const BEATS = { hook: 6, point: 4, step: 4, product: 7, compare: 7, cta: 5 };
  const TR = [
    { type: 'cut' },
    { type: 'wipe-left', duration: 8, ease: 'in-out-quart' },
    { type: 'flash', duration: 6 },
    { type: 'slide-up', duration: 10, ease: 'in-out-quart' },
  ];
  const end = sceneRun(ctx, p, K, { beats: (s) => BEATS[s.kind] ?? 4, transitions: TR, bg: C.bg }, (s, st, i, { off }) => {
    const at = off + 2;
    s.camera.push({ zoom: 1.04 });
    if (st.kind === 'hook') {
      sun(s, 760, Y(520), BLUE);
      const im = shotImage(ctx, st);
      const yEnd = bigTitle(s, st.text, Y(380), 0, 290);
      if (im.file) printPhoto(s, im.file, W / 2, Math.min(Y(1380), yEnd + Y(330)), 760, Y(520), at + K, im.product);
      else stars(s, at + K);
      s.camera.shake({ amp: 6, freq: 14, from: at + K, to: at + K + 6, decay: true });
    } else if (st.kind === 'point' || st.kind === 'step') {
      sun(s, i % 2 ? 260 : 820, Y(i % 2 ? 1450 : 420), i % 2 ? PINK : BLUE, at);
      if (st.kind === 'step') riso(s, 'Nomor', String(st.n ?? i), W / 2, Y(420), Math.round(520 * F), at, { seed: 11 });
      const nl = lines(st.text, 2).length;
      const yEnd = bigTitle(s, st.text, st.kind === 'step' ? Y(820) : Y(960) - (nl - 1) * Y(150), at + (st.kind === 'step' ? K : 0), 300);
      if (st.label || st.emph) box(s, st.label || st.emph, Math.min(Y(1560), yEnd + Y(120)), at + 3 * K, i % 2 ? PINK : BLUE, i % 2 ? 2 : -2);
      stars(s, at + 2 * K, 4);
    } else if (st.kind === 'product') {
      const pr = products[st.productId];
      sun(s, 820, Y(400), PINK, at);
      printPhoto(s, pr?.image, W / 2, Y(640), 760, Y(700), at, true);
      bigTitle(s, st.text, Y(1150), at + K, 130);
      if (pr?.price) {
        const sz = Math.round(190 * F);
        riso(s, 'Harga', fmtRp(pr.price, pr.currency), W / 2, Y(1500), sz, at + 3 * K, { seed: 21, fit: 900 });
        s.sfx('coin', { at: at + 3 * K, volume: -9 });
      }
      if (pr?.discount) {
        const d = s.layer('Diskon', { x: 860, y: Y(380), rotation: 12, blend: 'multiply' });
        d.star(0, 0, 170 * F, 130 * F, 14, { fill: BLUE });
        d.text(`-${pr.discount}%`, 0, 6, anton({ size: Math.round(90 * F), color: C.bg, fit: 220 }));
        d.key(0, { opacity: 0 }, 'hold').key(at + 4 * K, { opacity: 1 });
        d.pop(at + 4 * K, { from: 2, dur: 6, fade: false });
        d.spin({ speed: 10 });
        s.sfx('impact', { at: at + 4 * K, volume: -8 });
      }
    } else if (st.kind === 'compare') {
      bigTitle(s, st.text, Y(330), at, 150);
      const ids = (st.productIds ?? []).filter((id) => products[id]).slice(0, 3);
      const n = ids.length || 1;
      const cw = Math.floor(900 / n) - 20;
      ids.forEach((id, k) => {
        const pr = products[id];
        const x = 90 + k * (cw + 20) + cw / 2;
        const t = at + K + k * Math.round(K / 2);
        printPhoto(s, pr.image, x, Y(900), cw, cw, t, true);
        const pick = k + 1 === (st.pick ?? 1);
        riso(s, `Harga ${k}`, fmtRp(pr.price, pr.currency), x, Y(900) + cw / 2 + Y(90), Math.round(70 * F), t + 4, { seed: 30 + k, fit: cw });
        if (pr.fit) {
          const f = s.layer(`Cocok ${k}`, { x, y: Y(900) + cw / 2 + Y(170) });
          f.text(pr.fit.toUpperCase(), 0, 0, anton({ size: Math.round(40 * F), color: C.ink, fit: cw, maxWidth: cw }));
          f.fadeIn(t + 8, 6);
        }
        if (pick) {
          const tag = s.layer('Pilihan', { x, y: Y(900) - cw / 2 - Y(40), rotation: -4, blend: 'multiply' });
          tag.rect(-cw / 2, -Y(44), cw, Y(88), { fill: PINK });
          tag.text('PILIHAN', 0, 2, anton({ size: Math.round(56 * F), color: C.bg, fit: cw - 20 }));
          tag.key(0, { opacity: 0 }, 'hold').key(at + 4 * K, { opacity: 1 });
          tag.pop(at + 4 * K, { from: 1.8, dur: 6, fade: false });
          s.sfx('impact', { at: at + 4 * K, volume: -8 });
        }
      });
    } else {
      sun(s, W / 2, Y(760), PINK, at);
      bigTitle(s, st.text, Y(560), at, 230);
      box(s, ctx.handle || 'follow', Y(1360), at + 3 * K, BLUE, -3);
      if (ctx.logo) {
        const lg = s.layer('Logo', { x: W / 2, y: Y(260) });
        lg.image(ctx.logo, 0, 0, { width: 380 * F, height: 150 * F, fit: 'contain', anchor: 'center' });
        lg.fadeIn(at, 8);
      }
      if (ctx.spec.disclosure) {
        const d = s.layer('Disclosure', { fixed: true });
        d.text(ctx.spec.disclosure, W / 2, Y(1600), { size: Math.round(30 * F), weight: 600, color: C.ink, align: 'center', valign: 'middle' });
      }
      stars(s, at + K, 7);
    }
  });
  ctx.music(p, end, BPM, { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', padVol: -24, root: 174.6 });
  return p;
}
