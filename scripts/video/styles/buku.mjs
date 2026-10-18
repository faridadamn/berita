// Gaya "Buku tulis" · catatan tangan di kertas bergaris
// Satu halaman buku yang ditulis baris demi baris (satu dunia), kamera turun mengikuti pulpen.
// Stabilo di kata penting, nomor dilingkari, foto ditempel selotip, harga dilingkari merah,
// penutup sticky note. Cocok: tutorial, tips, hitungan, catatan belajar, review jujur.
import { fmtRp, hlIndex, shotImage, photo, wrapCount, rgba } from '../lib.mjs';

export const BPM = 90;

export function build(ctx) {
  const { G, W, H, Y, F, products } = ctx;
  const { catmullRom, withPressure, ellipsePoints } = G;
  const C = ctx.palette({ bg: '#FBFAF4', ink: '#1E3A8A', acc: '#C62828', acc2: '#FFE14D' });
  const PEN = C.ink;
  const RED = C.acc;
  const HL = ctx.useBrand ? rgba(ctx.brandColors.acc2, 0.75) : 'rgba(255,225,77,0.85)';
  const p = ctx.project({ background: '#FBFAF4' });
  p.effects({ grain: 0.06, vignette: 0.14 });
  const HAND = ctx.font(p, 'PatrickHand-Regular.ttf', 'Patrick Hand', 400);
  const CAV = ctx.font(p, 'Caveat-700.ttf', 'Caveat', 700);
  const K = Math.round((ctx.FPS * 60) / BPM);

  const LH = Math.round(150 * F);
  const TOP = Y(240);
  const L = (n) => TOP + LH * n; // garis dasar baris ke-n
  const X = 190;
  const TW = 820;
  const hand = (o) => ({ font: HAND, size: Math.round(98 * F), color: PEN, valign: 'baseline', ...o });
  const write = (at, n) => ({ type: 'chars', effect: 'fade', at, stagger: Math.max(0.5, 16 / Math.max(1, n)), dur: 3 });

  const BEATS = { hook: 5, point: 4, step: 4, product: 6, compare: 6, cta: 5 };
  const { plan, end } = ctx.timeline(K, (s) => BEATS[s.kind] ?? 4, { outro: K });
  // hitung baris tiap shot
  let row = 1;
  const blocks = plan.map((st) => {
    const size = st.kind === 'hook' ? 210 : st.kind === 'cta' ? 0 : st.kind === 'point' || st.kind === 'step' ? 150 : 130;
    const n = st.kind === 'cta' ? 0 : wrapCount(st.text, size * F, TW, 0.42);
    let rows = n * (st.kind === 'hook' ? 1.3 : 1) + 1;
    if (st.kind === 'hook' && (ctx.cover || shotImage(ctx, st).file)) rows += 4.5;
    if (st.kind === 'product') rows += 5;
    if (st.kind === 'compare') rows += (st.productIds ?? []).length * 1.3 + 1;
    if (st.kind === 'cta') rows = 5;
    const b = { ...st, row, rows: Math.ceil(rows), size };
    row += Math.ceil(rows) + 0.5;
    return b;
  });
  const pageH = L(row + 6);

  const s = p.scene('Catatan', { duration: end });
  s.note({ action: 'Satu halaman buku ditulis baris demi baris; kamera turun mengikuti; stabilo, lingkaran, sticky note' });
  const paper = s.layer('Kertas');
  for (let n = -2; L(n) < pageH + H; n++) paper.line(-100, L(n) + 12, W + 100, L(n) + 12, { stroke: '#AFC9E8', strokeWidth: 2 });
  paper.line(150, -200, 150, pageH + H, { stroke: '#E79A9A', strokeWidth: 3 });
  paper.line(160, -200, 160, pageH + H, { stroke: '#E79A9A', strokeWidth: 2 });
  for (let y = Y(400); y < pageH + H; y += Y(560)) paper.circle(70, y, 24, { fill: '#E9E5D8' });

  const ink = s.layer('Tulisan');
  const marks = s.layer('Coretan');
  const camAt = [];
  const ring = (cx, cy, rx, ry, at, color = RED) => {
    marks.stroke(ellipsePoints(cx, cy, rx, ry, { start: 200, end: 570, n: 70, pressure: (t) => 0.4 + 0.6 * Math.sin(Math.PI * t) }), { brush: 'ink', size: 9, color, reveal: [at, 12, 'in-out-sine'] });
    s.sfx('scratch', { at, dur: 0.5, volume: -16 });
  };
  const textAt = (b) => (b.i === 0 ? 0 : b.start + 4);

  blocks.forEach((b) => {
    const at = textAt(b);
    const y0 = L(b.row);
    camAt.push([b.start, y0 + (b.rows * LH) / 2]);
    if (b.kind === 'hook') {
      const sz = Math.round(210 * F);
      ink.text(b.text, X, y0 + LH * 0.4, hand({ font: CAV, size: sz, maxWidth: TW, lineHeight: 0.9, ...(b.i === 0 ? {} : { anim: write(at, b.text.length) }) }));
      const n = wrapCount(b.text, sz, TW, 0.36);
      marks.stroke(withPressure(catmullRom([[X, y0 + LH * 0.4 + n * sz * 0.9 - sz * 0.6 + 16], [X + 300, y0 + LH * 0.4 + n * sz * 0.9 - sz * 0.6 + 26], [X + 700, y0 + LH * 0.4 + n * sz * 0.9 - sz * 0.6 + 12]], 30), 'taper'), { brush: 'ink', size: 10, color: PEN, reveal: [at + K, 10, 'out-cubic'] });
      const im = shotImage(ctx, b);
      if (im.file) taped(im.file, 560, y0 + LH * 0.4 + n * sz * 0.9 + LH * 2.6, 620, Math.round(LH * 4.4), at + 2 * K, -3, im.product);
    } else if (b.kind === 'point' || b.kind === 'step') {
      let x = X;
      if (b.kind === 'step') {
        ink.text(String(b.n ?? b.i), X + 26, y0 + LH, hand({ font: CAV, size: Math.round(190 * F), color: RED, anim: write(at, 1) }));
        ring(X + 62, y0 + LH - 60 * F, 84 * F, 90 * F, at + 4);
        x = X + 170;
      }
      const sz = Math.round(150 * F);
      const idx = hlIndex(b.text, b.emph);
      // stabilo di belakang baris pertama kalau ada kata penting
      if (idx.length) marks.stroke([[x, y0 + LH - sz * 0.32, 1], [Math.min(1000, x + Math.min(TW, b.text.length * sz * 0.42)), y0 + LH - sz * 0.32, 1]], { brush: 'highlighter', size: sz * 1.05, color: HL, reveal: [at + 2 * K, 8, 'out-cubic'] });
      ink.text(b.text, x, y0 + LH, hand({ size: sz, maxWidth: TW - (x - X), lineHeight: LH / sz, anim: write(at + 4, b.text.length) }));
      if (b.label) ink.text(`(${b.label})`, 1000, y0 + LH * (b.rows - 0.4), hand({ font: CAV, size: Math.round(70 * F), color: RED, align: 'right', anim: write(at + 2 * K, b.label.length) }));
      s.sfx('scratch', { at: at + 4, dur: 0.6, volume: -15 });
    } else if (b.kind === 'product') {
      const pr = products[b.productId];
      const sz = Math.round(130 * F);
      ink.text(b.text, X, y0 + LH, hand({ size: sz, maxWidth: TW, lineHeight: LH / sz, anim: write(at, b.text.length) }));
      const nl = wrapCount(b.text, sz, TW, 0.42);
      const yy = y0 + LH * (nl + 0.5);
      taped(pr?.image, 360, yy + LH * 2.2, 380, Math.round(LH * 3.6), at + K, 4, true);
      if (pr?.price) {
        const py = yy + LH * 2;
        if (pr.originalPrice && pr.originalPrice > pr.price) {
          ink.text(fmtRp(pr.originalPrice, pr.currency), 1000, py - LH, hand({ size: Math.round(70 * F), align: 'right', color: rgba(PEN, 0.7), anim: write(at + 2 * K, 8) }));
          marks.stroke([[760, py - LH - 24 * F, 0.8], [1000, py - LH - 30 * F, 0.8]], { brush: 'ink', size: 8, color: RED, reveal: [at + 3 * K - 6, 6] });
        }
        ink.text(fmtRp(pr.price, pr.currency), 1000, py + LH * 0.3, hand({ size: Math.round(150 * F), align: 'right', anim: write(at + 2 * K + 8, 8) }));
        ring(830, py + LH * 0.3 - 40 * F, 210 * F, 80 * F, at + 3 * K, RED);
        if (pr.discount) ink.text(`hemat ${pr.discount}%!`, 1000, py + LH * 1.5, hand({ font: CAV, size: Math.round(84 * F), color: RED, align: 'right', anim: write(at + 4 * K, 10) }));
      }
    } else if (b.kind === 'compare') {
      const sz = Math.round(130 * F);
      ink.text(b.text, X, y0 + LH, hand({ size: sz, maxWidth: TW, lineHeight: LH / sz, anim: write(at, b.text.length) }));
      const nl = wrapCount(b.text, sz, TW, 0.42);
      (b.productIds ?? []).filter((id) => products[id]).forEach((id, k) => {
        const pr = products[id];
        const yy = y0 + LH * (nl + 1.2 + k * 1.3);
        const t = at + K + k * Math.round(K / 2);
        const name = pr.name.length > 16 ? pr.name.slice(0, 15) + '…' : pr.name;
        ink.text(`${k + 1}. ${name}`, X, yy, hand({ size: Math.round(80 * F), anim: write(t, name.length) }));
        ink.text(fmtRp(pr.price, pr.currency), 1000, yy, hand({ size: Math.round(80 * F), align: 'right', anim: write(t + 6, 8) }));
        if (pr.fit) ink.text(pr.fit, X + 50, yy + LH * 0.55, hand({ size: Math.round(44 * F), color: rgba(PEN, 0.7), anim: write(t + 8, pr.fit.length) }));
        if (k + 1 === (b.pick ?? 1)) {
          ring(590, yy - 20 * F, 450, 62 * F, at + 3 * K);
          const st = s.layer('Bintang', { x: 1040, y: yy - 70 * F });
          st.stroke('M 0 -40 L 11 -11 L 42 -11 L 18 6 L 26 37 L 0 19 L -26 37 L -18 6 L -42 -11 L -11 -11 Z', { brush: 'pen', size: 6, color: RED, reveal: [at + 3 * K + 10, 10, 'in-out-sine'] });
        }
      });
    } else {
      // sticky note ajakan
      const nx = 560, ny = y0 + LH * 2.3;
      const note = s.layer('Sticky', { x: nx, y: ny, rotation: -4 });
      const w = 800, h = Math.round(LH * 3.8);
      note.rect(-w / 2, -h / 2, w, h, { fill: '#FFE873', shadow: { color: 'rgba(0,0,0,0.18)', blur: 24, y: 10 } });
      note.rect(-w / 2, -h / 2, w, 40, { fill: 'rgba(0,0,0,0.05)' });
      note.text(b.text, 0, -h * 0.08, { font: CAV, weight: 700, size: Math.round(160 * F), color: '#3B2F00', align: 'center', valign: 'middle', maxWidth: w - 60, lineHeight: 0.9 });
      note.text(ctx.handle, 0, h * 0.34, { font: HAND, size: Math.round(72 * F), color: RED, align: 'center', valign: 'middle' });
      note.key(0, { opacity: 0 }, 'hold').key(b.start + 2, { opacity: 1 });
      note.dropIn(b.start + 2, { height: 500, dur: 12 });
      s.sfx('pop', { at: b.start + 10, volume: -8 });
      if (ctx.spec.disclosure) ink.text(ctx.spec.disclosure, X, y0 + LH * 4.6, hand({ size: Math.round(40 * F), color: rgba(PEN, 0.6) }));
    }
  });

  function taped(file, x, y, w, h, at, rot, product) {
    const l = s.layer(`Foto ${Math.round(y)}`, { x, y, rotation: rot, shadow: { color: 'rgba(0,0,0,0.2)', blur: 18, y: 8 } });
    l.rect(-w / 2 - 14, -h / 2 - 14, w + 28, h + 28, { fill: '#ffffff' });
    photo(ctx, l, file, 0, 0, w, h, { fit: product ? 'contain' : 'cover', colors: [ctx.brandColors.acc, ctx.brandColors.acc2] });
    const tp = (tx, ty, a) => l.polygon([[-70, -22], [70, -22], [70, 22], [-70, 22]].map(([px, py]) => { const r = (a * Math.PI) / 180; return [tx + px * Math.cos(r) - py * Math.sin(r), ty + px * Math.sin(r) + py * Math.cos(r)]; }), { fill: 'rgba(250,246,230,0.7)', closed: true });
    tp(-w / 2 + 20, -h / 2 - 4, -30);
    tp(w / 2 - 20, -h / 2 - 4, 30);
    if (at > 0) {
      l.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 1 });
      l.dropIn(at, { height: 300, dur: 12 });
      s.sfx('tap', { at: at + 10, volume: -10 });
    }
  }

  // kamera: turun ke blok yang sedang ditulis (tangan sedikit goyang), mundur sedikit di akhir
  s.camera.handheld({ amp: 4 });
  const cy = (y) => Math.max(0, y - H / 2);
  s.camera.key(0, { x: 0, y: 0, zoom: 1 }, 'hold');
  camAt.forEach(([f, y], k) => {
    if (k === 0) return;
    const z = k % 2 ? 1.08 : 1.0;
    s.camera.key(Math.max(1, f - 10), { y: cy(camAt[k - 1][1]), zoom: k % 2 ? 1.0 : 1.08 }, 'in-out-cubic').key(f + 4, { y: cy(y), zoom: z });
  });
  const lastY = camAt[camAt.length - 1][1];
  s.camera.key(end - K, { y: cy(lastY), zoom: 1.0 }, 'in-out-sine').key(end, { y: cy(lastY), zoom: 0.94 });

  ctx.music(p, end, BPM, { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', beatVol: -16, padVol: -18, root: 196 });
  return p;
}
