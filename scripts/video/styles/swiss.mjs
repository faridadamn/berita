// Gaya "Swiss" · poster tipografi internasional
// Grid tegas, angka raksasa yang bleed keluar layar, satu warna aksen, judul KAPITAL per baris
// yang masuk di ketukan (wipe), tata letak kiri/kanan bergantian, penutup latar hitam.
// Cocok: listicle, tips, "3 aturan", edukasi tegas, berita singkat.
import { lines, fmtRp, sceneRun, shotImage, photo, readable } from '../lib.mjs';

export const BPM = 120;

export function build(ctx) {
  const { W, H, Y, F, products } = ctx;
  const C = ctx.palette({ bg: '#EFEDE8', ink: '#111111', acc: '#E3001B', acc2: '#5E5B55' });
  const GREY = '#5E5B55';
  const p = ctx.project({ background: C.bg });
  p.effects({ grain: 0.04 });
  const BLK = ctx.font(p, 'ArchivoBlack-Regular.ttf', 'Archivo Black', 400);
  const K = Math.round((ctx.FPS * 60) / BPM);
  const blk = (o) => ({ font: BLK, weight: 400, color: C.ink, valign: 'middle', ...o });
  const body = (o) => ({ weight: 700, size: Math.round(54 * F), color: GREY, valign: 'top', lineHeight: 1.3, maxWidth: 860, ...o });
  const total = ctx.shots.length;

  function grid(s, color) {
    const g = s.layer('Grid');
    [80, 1000].forEach((x, i) => g.line(x, 0, x, H, { stroke: color, strokeWidth: 3, draw: [i * 3, 14, 'out-cubic'] }));
    [Y(260), Y(1560)].forEach((y, i) => g.line(0, y, W, y, { stroke: color, strokeWidth: 3, draw: [4 + i * 3, 14, 'out-cubic'] }));
  }
  function header(s, left, right, color) {
    const l = s.layer('Label', { fixed: true });
    l.text(left, 80, Y(200), { weight: 800, size: Math.round(40 * F), color, valign: 'middle', letterSpacing: 2, case: 'upper' });
    l.text(right, 1000, Y(200), { weight: 800, size: Math.round(40 * F), color, valign: 'middle', align: 'right' });
    l.fadeIn(0, 6);
  }
  // judul KAPITAL: tiap baris wipe di ketukan
  function title(s, text, { x = 80, y0, right = false, color = C.ink, at = 0, size, instant = false } = {}) {
    const ls = lines(text.toUpperCase(), 2);
    const sz = Math.round((size ?? (ls.length > 2 ? 150 : 180)) * F);
    ls.forEach((ln, j) => {
      const t = at + j * Math.round(K / 2);
      const l = s.layer(`Judul ${j}`, { x: right ? 1000 : x, y: y0 + j * sz * 0.98 });
      l.text(ln, 0, 0, blk({ size: sz, color, align: right ? 'right' : 'left', fit: 920 }));
      if (instant) return;
      l.wipeIn(t, { dir: right ? 'left' : 'right', dur: 5, ease: 'out-cubic', rect: [-1100, -sz, 2200, sz * 2] });
      s.sfx('tap', { at: t, volume: -10 });
    });
    return y0 + ls.length * sz * 0.98;
  }

  const TR = [
    { type: 'push-left', duration: 10, ease: 'in-out-quart' },
    { type: 'wipe-up', duration: 10, ease: 'in-out-quart' },
    { type: 'cover-left', duration: 10, ease: 'in-out-quart' },
    { type: 'cut' },
  ];
  const isInv = (st, i) => (st.kind === 'point' || st.kind === 'step') && i % 3 === 2;
  const BEATS = { hook: 6, point: 5, step: 5, product: 8, compare: 8, cta: 6 };
  const end = sceneRun(ctx, p, K, { beats: (s) => BEATS[s.kind] ?? 5, transitions: TR, bg: (st, i) => (st.kind === 'cta' ? C.ink : isInv(st, i) ? C.acc : C.bg) }, (s, st, i, { off }) => {
    const inv = isInv(st, i);
    const fg = st.kind === 'cta' ? C.bg : inv ? C.bg : C.ink;
    const acc = inv ? C.ink : C.acc;
    const at = off + 2;
    grid(s, st.kind === 'cta' ? '#333' : fg);
    header(s, st.label || ctx.spec.kicker || 'info', `${String(i + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`, fg);
    s.camera.push({ zoom: 1.03 });

    if (st.kind === 'hook') {
      const n = String(i + 1);
      const big = s.layer('Angka', { x: 1160, y: Y(1180) });
      big.text((st.emph || st.text).split(' ')[0].toUpperCase().slice(0, 6), 0, 0, blk({ size: Math.round(620 * F), color: C.acc, align: 'right', fit: 1600 }));
      big.key(0, { y: Y(2400) }, 'out-expo').key(10, { y: Y(1180) });
      void n;
      const im = shotImage(ctx, st);
      if (im.file) {
        const ph = s.layer('Foto', { x: 0, y: 0, clip: { rect: [80, Y(1180), 920, Y(380)] } });
        photo(ctx, ph, im.file, 540, Y(1370), 920, Y(380), { fit: im.product ? 'contain' : 'cover' });
        ph.wipeIn(at + 2 * K, { dir: 'up', dur: 8, ease: 'out-cubic', rect: [80, Y(1180), 920, Y(380)] });
      }
      title(s, st.text, { y0: Y(520), at: 0, size: 190, instant: true });
      s.sfx('boom', { at: 2, volume: -8 });
    } else if (st.kind === 'point' || st.kind === 'step') {
      const right = i % 2 === 1;
      const no = st.kind === 'step' ? String(st.n ?? i).padStart(2, '0') : String(i).padStart(2, '0');
      const num = s.layer('Nomor', { x: right ? 1000 : 80, y: Y(470) });
      num.text(no, 0, 0, blk({ size: Math.round(380 * F), color: acc, align: right ? 'right' : 'left' }));
      num.wipeIn(at, { dir: 'up', dur: 8, ease: 'out-cubic', rect: [-1100, -Y(260), 2200, Y(520)] });
      s.sfx('impact', { at, volume: -10 });
      const bar = s.layer('Bar', { x: right ? 1000 : 80, y: Y(690) });
      bar.rect(right ? -920 : 0, 0, 920, 18, { fill: acc });
      bar.key(0, { scaleX: 0 }, 'hold').key(at + 4, { scaleX: 0 }, 'out-expo').key(at + 14, { scaleX: 1 });
      const yEnd = title(s, st.text, { y0: Y(840), right, color: fg, at: at + K });
      if (st.emph) {
        const sb = s.layer('Sub', { fixed: true });
        sb.text(st.emph, right ? 1000 : 80, yEnd + Y(30), body({ color: inv ? C.bg : GREY, align: right ? 'right' : 'left', anim: { type: 'words', effect: 'fade', at: at + 3 * K, stagger: 1, dur: 6 } }));
      }
    } else if (st.kind === 'product') {
      const pr = products[st.productId];
      const ph = s.layer('Foto', { x: 0, y: 0 });
      ph.rect(80, Y(300), 920, Y(700), { fill: '#ffffff' });
      photo(ctx, ph, pr?.image, 540, Y(650), 880, Y(660), { fit: 'contain' });
      ph.wipeIn(at, { dir: 'down', dur: 10, ease: 'out-cubic', rect: [80, Y(300), 920, Y(700)] });
      title(s, st.text, { y0: Y(1110), at: at + K, size: 110 });
      if (pr?.price) {
        const pl = s.layer('Harga', { x: 80, y: Y(1440) });
        pl.text(fmtRp(pr.price, pr.currency), 0, 0, blk({ size: Math.round(150 * F), color: C.acc, fit: 640, anim: { type: 'count', from: pr.originalPrice ?? Math.round(pr.price * 1.5), to: pr.price, at: at + 3 * K, dur: 18, prefix: pr.currency === 'IDR' ? 'Rp' : '', separator: '.', ease: 'out-cubic' } }));
        s.sfx('coin', { at: at + 3 * K + 18, volume: -10 });
      }
      if (pr?.discount) {
        const d = s.layer('Diskon', { x: 1000, y: Y(1440) });
        d.rect(-300, -Y(90), 300, Y(180), { fill: C.ink });
        d.text(`-${pr.discount}%`, -150, 0, blk({ size: Math.round(96 * F), color: C.bg, align: 'center', fit: 270 }));
        d.wipeIn(at + 4 * K, { dir: 'left', dur: 6, rect: [-310, -Y(100), 320, Y(200)] });
        s.sfx('impact', { at: at + 4 * K, volume: -8 });
      }
    } else if (st.kind === 'compare') {
      title(s, st.text, { y0: Y(400), at, size: 120 });
      const ids = (st.productIds ?? []).filter((id) => products[id]);
      const rowH = Y(240);
      ids.forEach((id, k) => {
        const pr = products[id];
        const pick = k + 1 === (st.pick ?? 1);
        const y = Y(900) + k * rowH;
        const t = at + 2 * K + k * Math.round(K / 2);
        const r = s.layer(`Baris ${k}`, { x: 0, y });
        if (pick) r.rect(80, 0, 920, rowH - 14, { fill: C.acc });
        r.line(80, rowH - 7, 1000, rowH - 7, { stroke: C.ink, strokeWidth: 3 });
        photo(ctx, r, pr.image, 80 + rowH / 2, rowH / 2 - 7, rowH - 40, rowH - 40, { fit: 'contain', colors: ['#fff', '#eee'] });
        const fc = pick ? readable(C.acc) : C.ink;
        r.text(pr.name.toUpperCase().slice(0, 22), 80 + rowH + 10, rowH * 0.35, blk({ size: Math.round(40 * F), color: fc, maxWidth: 460 }));
        if (pr.fit) r.text(pr.fit, 80 + rowH + 10, rowH * 0.66, { weight: 700, size: Math.round(32 * F), color: fc, valign: 'middle', maxWidth: 460 });
        r.text(pr.price ? fmtRp(pr.price, pr.currency) : '', 980, rowH / 2 - 7, blk({ size: Math.round(64 * F), color: fc, align: 'right', fit: 300 }));
        r.wipeIn(t, { dir: 'right', dur: 6, ease: 'out-cubic', rect: [70, -10, 940, rowH + 10] });
        s.sfx(pick ? 'impact' : 'tap', { at: t, volume: -10 });
      });
    } else {
      // CTA: kata per ketuk, satu kata aksen
      const ws = st.text.toUpperCase().split(/\s+/).slice(0, 5);
      const sz = Math.round((ws.length > 3 ? 190 : 230) * F);
      ws.forEach((w, k) => {
        const l = s.layer(`Kata ${k}`, { x: 80, y: Y(520) + k * sz * 1.02 });
        l.text(w, 0, 0, blk({ size: sz, color: k === 0 ? C.acc : C.bg, fit: 920 }));
        l.key(0, { opacity: 0 }, 'hold').key(off + k * K, { opacity: 1 });
        l.pop(off + k * K, { from: 1.25, dur: 5, ease: 'out-cubic', fade: false });
        s.sfx(k === 0 ? 'impact' : 'kick', { at: off + k * K, volume: -8 });
      });
      const h = s.layer('Handle', { fixed: true });
      if (ctx.logo) h.image(ctx.logo, 1000 - 160 * F, Y(1450), { width: 320 * F, height: 120 * F, fit: 'contain', anchor: 'center' });
      h.text(ctx.handle, 80, Y(1450), { weight: 800, size: Math.round(56 * F), color: C.bg, valign: 'middle', anim: { type: 'words', effect: 'fade', at: off + ws.length * K, dur: 6 } });
      if (ctx.spec.disclosure) h.text(ctx.spec.disclosure, 80, Y(1640), { weight: 600, size: Math.round(30 * F), color: '#777', valign: 'middle' });
    }
  });
  ctx.music(p, end, BPM, { kick: 'x...x...x...x...', hat: 'xxxxxxxxxxxxxxxx', padVol: null });
  return p;
}
