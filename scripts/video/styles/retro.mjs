// Gaya "Retro 70-an"
// Sunburst berputar, pelangi tebal yang tergambar, huruf groovy (Shrikhand) dengan bayangan
// bertumpuk, lencana gerigi untuk harga/diskon. Cocok: promo musiman, event, grand opening.
import { lines, fmtRp, sceneRun, shotImage, photo, readable } from '../lib.mjs';

export const BPM = 100;

export function build(ctx) {
  const { W, Y, F, products } = ctx;
  const C = ctx.palette({ bg: '#F6E7C8', ink: '#4A2511', acc: '#E8590C', acc2: '#F2B705' });
  const TEAL = '#2A9D8F';
  const BROWN = C.ink;
  const p = ctx.project({ background: C.bg });
  p.effects({ grain: 0.09, vignette: 0.2 });
  const GROOVY = ctx.font(p, 'Shrikhand-Regular.ttf', 'Shrikhand', 400);
  const K = Math.round((ctx.FPS * 60) / BPM);
  const RAINBOW = [C.acc, C.acc2, TEAL, BROWN];

  function sunburst(s, x, y, color, n = 18) {
    const l = s.layer('Sunburst', { x, y });
    const R = 1700;
    for (let i = 0; i < n; i++) {
      const a0 = (i * 2 * Math.PI) / n;
      const a1 = a0 + Math.PI / n;
      l.polygon([[0, 0], [Math.cos(a0) * R, Math.sin(a0) * R], [Math.cos(a1) * R, Math.sin(a1) * R]], { fill: color, closed: true });
    }
    l.spin({ speed: 8 });
    return l;
  }
  function rainbow(s, x, y, r, at, { up = true } = {}) {
    const l = s.layer('Pelangi', { x, y });
    RAINBOW.forEach((c, k) => {
      const rr = (r - k * 46) * F;
      l.arc(0, 0, rr, up ? 180 : 0, up ? 360 : 180, { stroke: c, strokeWidth: 44 * F, lineCap: 'butt', fill: 'rgba(0,0,0,0)', draw: [at + k * 3, 16, 'out-cubic'] });
    });
    return l;
  }
  // teks groovy dengan bayangan bertumpuk
  function groovy(s, text, x, y, size, at, { color = C.acc, shadow = BROWN, align = 'center', fit = 960 } = {}) {
    const sz = Math.round(size * F);
    const make = (dx, dy, c, name) => {
      const l = s.layer(name, { x: x + dx, y: y + dy });
      l.text(text, 0, 0, { font: GROOVY, size: sz, color: c, align, valign: 'middle', fit, lineHeight: 1 });
      if (at > 0) {
        l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
        l.pop(at, { from: 0.6, dur: 9, ease: 'out-back', fade: false });
      }
      return l;
    };
    make(14 * F, 14 * F, shadow, `Bayangan 2 ${text}`);
    make(7 * F, 7 * F, C.acc2, `Bayangan 1 ${text}`);
    const top = make(0, 0, color, `Teks ${text}`);
    if (at > 0) s.sfx('pop', { at, volume: -10 });
    return top;
  }
  function title(s, text, yMid, at, size = 190) {
    const ls = lines(text, 2);
    const sz = (ls.length > 2 ? size * 0.82 : size) * F;
    const y0 = yMid - ((ls.length - 1) * sz * 1.05) / 2;
    ls.forEach((ln, j) => groovy(s, ln, W / 2, y0 + j * sz * 1.05, ls.length > 2 ? size * 0.82 : size, at > 0 ? at + j * Math.round(K / 2) : 0));
  }
  function gear(s, x, y, r, text, at, color = C.acc) {
    const l = s.layer(`Lencana ${text}`, { x, y, rotation: -10 });
    l.star(0, 0, r * F, r * 0.86 * F, 20, { fill: color });
    l.circle(0, 0, r * 0.74 * F, { fill: 'rgba(0,0,0,0)', stroke: C.bg, strokeWidth: 6, dash: [10, 8] });
    l.text(text, 0, 4, { font: GROOVY, size: Math.round(r * 0.42 * F), color: readable(color), align: 'center', valign: 'middle', fit: r * 1.3 * F });
    l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
    l.spinIn(at, { turns: 0.5, dur: 14 });
    s.sfx('impact', { at, volume: -9 });
    return l;
  }
  function polaroid(s, file, x, y, w, h, at, rot, product) {
    const l = s.layer(`Foto ${x}-${y}`, { x, y, rotation: rot, shadow: { color: 'rgba(74,37,17,0.35)', blur: 22, x: 10, y: 12 } });
    l.rect(-w / 2 - 22, -h / 2 - 22, w + 44, h + 90, { fill: '#FFF8EC', r: 6 });
    photo(ctx, l, file, 0, 0, w, h, { fit: product ? 'contain' : 'cover', colors: [C.acc, C.acc2] });
    if (at > 0) {
      l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
      l.dropIn(at, { height: 500, dur: 14 });
    }
    return l;
  }

  const BEATS = { hook: 6, point: 4, step: 4, product: 7, compare: 7, cta: 5 };
  const TR = [{ type: 'iris', duration: 14, ease: 'in-out-cubic' }, { type: 'zoom', duration: 12 }, { type: 'slide-left', duration: 12, ease: 'in-out-back' }];
  const end = sceneRun(ctx, p, K, { beats: (s) => BEATS[s.kind] ?? 4, transitions: TR, bg: C.bg }, (s, st, i, { off }) => {
    const at = off + 2;
    s.camera.push({ zoom: 1.05 });
    const burstColor = i % 2 ? 'rgba(242,183,5,0.22)' : 'rgba(232,89,12,0.14)';
    if (st.kind === 'hook') {
      sunburst(s, W / 2, Y(1250), burstColor);
      rainbow(s, W / 2, Y(1250), 520, 0);
      const im = shotImage(ctx, st);
      polaroid(s, im.file, W / 2, Y(1250), 560, Y(560), 0, -4, im.product);
      title(s, st.text, Y(480), 0, 180);
    } else if (st.kind === 'point' || st.kind === 'step') {
      sunburst(s, W / 2, Y(i % 2 ? 1700 : 300), burstColor);
      rainbow(s, W / 2, Y(i % 2 ? 1780 : 160), 480, at, { up: i % 2 === 1 });
      if (st.kind === 'step') gear(s, W / 2, Y(560), 170, String(st.n ?? i), at, i % 2 ? TEAL : C.acc);
      title(s, st.text, Y(st.kind === 'step' ? 1040 : 960), at + K, 190);
      if (st.label) groovy(s, st.label, W / 2, Y(1330), 80, at + 3 * K, { color: TEAL });
    } else if (st.kind === 'product') {
      const pr = products[st.productId];
      sunburst(s, W / 2, Y(760), burstColor);
      polaroid(s, pr?.image, W / 2, Y(720), 620, Y(620), at, 3, true);
      title(s, st.text, Y(1300), at + K, 120);
      if (pr?.price) groovy(s, fmtRp(pr.price, pr.currency), W / 2, Y(1560), 130, at + 3 * K, { color: TEAL });
      if (pr?.discount) gear(s, 860, Y(400), 160, `-${pr.discount}%`, at + 4 * K);
    } else if (st.kind === 'compare') {
      sunburst(s, W / 2, Y(900), burstColor);
      title(s, st.text, Y(330), at, 120);
      const ids = (st.productIds ?? []).filter((id) => products[id]).slice(0, 3);
      const n = ids.length || 1;
      const cw = Math.floor(840 / n) - 30;
      ids.forEach((id, k) => {
        const pr = products[id];
        const x = 120 + k * (cw + 60) + cw / 2;
        const t = at + K + k * Math.round(K / 2);
        polaroid(s, pr.image, x, Y(900), cw, cw, t, k % 2 ? 4 : -4, true);
        groovy(s, fmtRp(pr.price, pr.currency), x, Y(900) + cw / 2 + Y(140), 56, t + 8, { color: TEAL, fit: cw });
        if (k + 1 === (st.pick ?? 1)) gear(s, x + cw / 2 - 10, Y(900) - cw / 2, 100, 'PILIH', at + 4 * K, C.acc);
      });
    } else {
      sunburst(s, W / 2, Y(960), burstColor, 24);
      rainbow(s, W / 2, Y(1760), 560, at);
      title(s, st.text, Y(760), at, 200);
      groovy(s, ctx.handle, W / 2, Y(1180), 90, at + 2 * K, { color: TEAL });
      if (ctx.logo) {
        const lg = s.layer('Logo', { x: W / 2, y: Y(330) });
        lg.image(ctx.logo, 0, 0, { width: 360 * F, height: 140 * F, fit: 'contain', anchor: 'center' });
        lg.fadeIn(at, 8);
      }
      if (ctx.spec.disclosure) s.layer('Disclosure', { fixed: true }).text(ctx.spec.disclosure, W / 2, Y(1640), { size: Math.round(30 * F), weight: 600, color: BROWN, align: 'center', valign: 'middle' });
    }
    if (i > 0) s.sfx('whoosh', { at: Math.max(0, off - 8), dur: 0.5, volume: -15 });
  });
  ctx.music(p, end, BPM, { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', padVol: -20, root: 164.8, chord: [0, 4, 7, 9], brightness: 1200 });
  return p;
}
