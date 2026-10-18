// Gaya "Bauhaus"
// Satu komposisi bentuk dasar (lingkaran, persegi, segitiga, balok) yang berpindah & berputar
// tiap ketukan — bentuk-bentuk itu subjek yang bertahan dari awal sampai akhir. Foto/produk
// tampil di dalam lingkaran (mask). Teks tebal rata kiri. Cocok: manifesto, before/after, tips, mindset.
import { fmtRp, hlIndex, readable, rgba } from '../lib.mjs';

export const BPM = 120;

export function build(ctx) {
  const { W, Y, F, products } = ctx;
  const C = ctx.palette({ bg: '#F2EBDD', ink: '#151515', acc: '#E63B2E', acc2: '#F4B700' });
  const BLUE = '#1F4E9C';
  const p = ctx.project({ background: C.bg });
  p.effects({ grain: 0.07, vignette: 0.08 });
  const K = Math.round((ctx.FPS * 60) / BPM);

  const BEATS = { hook: 6, point: 4, step: 4, product: 7, compare: 7, cta: 5 };
  const { plan, end } = ctx.timeline(K, (s) => BEATS[s.kind] ?? 4, { outro: K });
  const s = p.scene('Komposisi', { duration: end, background: C.bg });
  s.note({ action: 'Bentuk dasar berpindah tiap shot (subjek tetap), foto di dalam lingkaran, teks tebal rata kiri' });

  // komposisi: posisi [lingkaran, persegi, segitiga, balok] per tata letak — teks di area yang kosong
  // tiap item: {x, y, s (skala), r (rotasi)}
  const LAYOUTS = [
    { text: [80, 240], circle: { x: 640, y: 1320, s: 1.0, r: 0 }, square: { x: 220, y: 1500, s: 0.8, r: 0 }, tri: { x: 900, y: 760, s: 0.7, r: 0 }, bar: { x: 540, y: 1720, s: 1, r: 0 } },
    { text: [80, 1080], circle: { x: 300, y: 560, s: 0.85, r: 0 }, square: { x: 820, y: 640, s: 1.1, r: 45 }, tri: { x: 160, y: 1660, s: 0.6, r: 90 }, bar: { x: 1010, y: 520, s: 0.6, r: 90 } },
    { text: [80, 300], circle: { x: 760, y: 1320, s: 0.9, r: 0 }, square: { x: 280, y: 1180, s: 0.7, r: 15 }, tri: { x: 380, y: 1650, s: 1, r: 180 }, bar: { x: 540, y: 820, s: 1, r: 0 } },
    { text: [80, 1160], circle: { x: 540, y: 600, s: 1.25, r: 0 }, square: { x: 900, y: 260, s: 0.55, r: 30 }, tri: { x: 140, y: 300, s: 0.55, r: 270 }, bar: { x: 540, y: 1020, s: 1.1, r: 0 } },
  ];
  const layoutFor = (st, i) => (st.kind === 'product' ? 3 : st.kind === 'cta' ? 0 : i % LAYOUTS.length);
  const at = (o) => ({ x: o.x, y: Y(o.y), scale: o.s * F, rotation: o.r });

  // bentuk (persisten)
  const square = s.layer('Persegi');
  square.rect(-170, -170, 340, 340, { fill: C.acc2 });
  const tri = s.layer('Segitiga');
  tri.polygon([[0, -190], [175, 120], [-175, 120]], { fill: BLUE, closed: true });
  const bar = s.layer('Balok');
  bar.rect(-460, -40, 920, 80, { fill: C.ink });
  const circle = s.group('Lingkaran', { mask: 'cetakan-lingkaran' });
  circle.layer('Cetakan', { id: 'cetakan-lingkaran' }).circle(0, 0, 330, { fill: '#000' });
  const fill = circle.layer('Isi');
  fill.circle(0, 0, 330, { fill: C.acc });
  // isi lingkaran berganti: sampul / foto produk / warna
  plan.forEach((st, i) => {
    const show = [i === 0 ? 0 : st.start - 4, null];
    if (i < plan.length - 1) show[1] = plan[i + 1].start - 4;
    let file = null, product = false;
    if (st.kind === 'product') { file = ctx.img(products[st.productId]?.image); product = true; }
    else if (st.kind === 'compare') { const id = (st.productIds ?? [])[(st.pick ?? 1) - 1]; file = ctx.img(products[id]?.image); product = true; }
    else if ((st.kind === 'hook' || i % 3 === 1) && ctx.cover) file = ctx.cover;
    if (!file) return;
    if (product) fill.circle(0, 0, 330, { fill: '#ffffff', show });
    fill.image(file, 0, 0, { width: product ? 470 : 680, height: product ? 470 : 680, fit: product ? 'contain' : 'cover', anchor: 'center', show });
  });

  let prevL = null;
  plan.forEach((st, i) => {
    const L = LAYOUTS[layoutFor(st, i)];
    const P = prevL;
    prevL = L;
    const f = i === 0 ? 0 : st.start - 8;
    const f1 = i === 0 ? 0 : st.start + 6;
    for (const [node, key, ease] of [[circle, 'circle', 'out-back'], [square, 'square', 'out-cubic'], [tri, 'tri', 'out-back'], [bar, 'bar', 'out-quart']]) {
      if (i === 0) node.key(0, at(L[key]), ease);
      else node.key(f, at(P[key]), ease).key(f1, at(L[key]));
    }
    if (i > 0) s.sfx(i % 2 ? 'kick' : 'impact', { at: st.start - 2, volume: -9 });
  });
  // gerak halus antar ketuk supaya tidak pernah diam
  square.spin({ speed: 6 });
  tri.sway({ angle: 4, period: 2 });
  circle.pulse({ amount: 0.02, period: (2 * K) / ctx.FPS });

  const txt = s.layer('Teks');
  plan.forEach((st, i) => {
    const L = LAYOUTS[layoutFor(st, i)];
    const [tx, ty] = L.text;
    const show = [i === 0 ? 0 : st.start, i === plan.length - 1 ? end : st.start + st.dur];
    const a = i === 0 ? null : { type: 'words', effect: i % 2 ? 'drop' : 'slide', at: st.start + 4, stagger: 3, dur: 8, ease: 'out-back' };
    const idx = hlIndex(st.text, st.emph);
    const head = (t, y, size, o = {}) =>
      txt.text(t, tx, Y(y), {
        weight: 800, size: Math.round(size * F), color: C.ink, valign: 'top', maxWidth: 900, lineHeight: 0.98, letterSpacing: -3, show,
        ...(a ? { anim: a } : {}), ...(idx.length ? { highlight: { words: idx, style: 'box', color: C.acc2, at: st.start + 12, dur: 6 } } : {}), ...o,
      });
    const yText = ty;
    if (st.kind === 'step') {
      txt.text(String(st.n ?? i), tx, Y(yText), { weight: 800, size: Math.round(260 * F), color: C.acc, valign: 'top', show, ...(a ? { anim: { ...a, effect: 'pop' } } : {}) });
      head(st.text, yText + 280, 130);
    } else if (st.kind === 'product') {
      const pr = products[st.productId];
      head(st.text, yText, 110);
      if (pr?.price) {
        const pb = s.layer(`Harga ${i}`, { x: 80, y: Y(yText + 330), show });
        const w = 640;
        pb.rect(0, 0, w * F, Y(150), { fill: C.ink });
        pb.text(fmtRp(pr.price, pr.currency), 30 * F, Y(75), { weight: 800, size: Math.round(100 * F), color: C.bg, valign: 'middle', fit: (w - 60) * F });
        pb.key(st.start, { scaleX: 0 }, 'hold').key(st.start + 2 * K, { scaleX: 0 }, 'out-expo').key(st.start + 2 * K + 12, { scaleX: 1 });
        s.sfx('impact', { at: st.start + 2 * K, volume: -8 });
      }
      if (pr?.discount) txt.text(`hemat ${pr.discount}%`, 80, Y(yText + 520), { weight: 800, size: Math.round(64 * F), color: C.acc, valign: 'top', show, anim: { type: 'words', effect: 'pop', at: st.start + 3 * K, dur: 8 } });
    } else if (st.kind === 'compare') {
      head(st.text, yText, 100);
      const ids = (st.productIds ?? []).filter((id) => products[id]).slice(0, 3);
      ids.forEach((id, k) => {
        const pr = products[id];
        const pick = k + 1 === (st.pick ?? 1);
        txt.text(`${pick ? '● ' : ''}${pr.name.slice(0, 18)}`, 80, Y(yText + 260 + k * 110), { weight: 700, size: Math.round(44 * F), color: pick ? C.acc : C.ink, valign: 'top', show, anim: { type: 'words', effect: 'fade', at: st.start + K + k * 6, dur: 6 } });
        txt.text(fmtRp(pr.price, pr.currency), 1000, Y(yText + 260 + k * 110), { weight: 800, size: Math.round(44 * F), color: pick ? C.acc : C.ink, align: 'right', valign: 'top', show, anim: { type: 'words', effect: 'fade', at: st.start + K + k * 6 + 3, dur: 6 } });
      });
    } else if (st.kind === 'cta') {
      head(st.text, yText, 170);
      txt.text(ctx.handle, tx, Y(yText + 420), { weight: 800, size: Math.round(72 * F), color: C.acc, valign: 'top', show, anim: { type: 'words', effect: 'slide', at: st.start + K, dur: 8 } });
      if (ctx.spec.disclosure) txt.text(ctx.spec.disclosure, tx, Y(yText + 530), { weight: 600, size: Math.round(28 * F), color: rgba(C.ink, 0.6), valign: 'top', show });
      if (ctx.logo) {
        const lg = s.layer('Logo', { x: 820, y: Y(140), show: [st.start, null] });
        lg.image(ctx.logo, 0, 0, { width: 300 * F, height: 120 * F, fit: 'contain', anchor: 'center' });
      }
    } else {
      head(st.text, yText, st.kind === 'hook' ? 150 : 160);
      if (st.label) txt.text(st.label.toUpperCase(), tx, Y(yText - 60), { weight: 800, size: Math.round(38 * F), color: readable(C.acc), valign: 'middle', letterSpacing: 4, box: { color: C.acc, padX: 16, padY: 8 }, show });
    }
  });
  s.camera.handheld({ amp: 2 });
  ctx.music(p, end, BPM, { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', padVol: -22, root: 130.8, chord: [0, 5, 7, 12] });
  return p;
}
