// Gaya "Data signal"
// Latar gelap bergrid, satu angka raksasa yang dihitung, garis grafik satu goresan yang tumbuh
// sepanjang video (subjek yang bertahan), anotasi serif miring, label mono. Perbandingan = grafik
// batang harga. Cocok: berita dengan angka, insight, perbandingan harga, review berbasis data.
import { fmtRp, numberIn, hlIndex, rgba, readable } from '../lib.mjs';

export const BPM = 120;

export function build(ctx) {
  const { G, W, H, Y, F, products } = ctx;
  const { withPressure, catmullRom } = G;
  const base = { bg: '#0B0F14', ink: '#E8EDF2', acc: '#3DF5A7', acc2: '#7AA2FF' };
  const C = ctx.palette(base);
  // gaya ini selalu gelap; aksen brand dipakai kalau terbaca di latar gelap
  const p = ctx.project({ background: C.bg });
  p.effects({ grain: 0.05, vignette: 0.3 });
  const MONO = ctx.font(p, 'SpaceMono-Regular.ttf', 'Space Mono', 400);
  ctx.font(p, 'SpaceMono-Bold.ttf', 'Space Mono', 700);
  const SERIF = ctx.font(p, 'InstrumentSerif-Italic.ttf', 'Instrument Serif Italic', 400);
  const K = Math.round((ctx.FPS * 60) / BPM);
  const mono = (o) => ({ font: MONO, color: rgba(C.ink, 0.6), size: Math.round(34 * F), valign: 'middle', letterSpacing: 3, ...o });
  const glowMode = 'lighter';

  const BEATS = { hook: 6, point: 4, step: 4, product: 7, compare: 8, cta: 5 };
  const { plan, end } = ctx.timeline(K, (s) => BEATS[s.kind] ?? 4, { outro: K });
  const s = p.scene('Sinyal', { duration: end, background: C.bg });
  s.note({ action: 'Grafik satu goresan tumbuh tiap shot; angka raksasa dihitung; anotasi serif; batang harga untuk perbandingan' });

  // grid & sumbu
  const grid = s.layer('Grid', { depth: 1.2 });
  for (let x = 80; x <= 1000; x += 115) grid.line(x, Y(1180), x, Y(1640), { stroke: rgba(C.ink, 0.07), strokeWidth: 2 });
  for (let y = Y(1180); y <= Y(1640); y += Y(92)) grid.line(80, y, 1000, y, { stroke: rgba(C.ink, 0.07), strokeWidth: 2 });
  grid.line(80, Y(1640), 1000, Y(1640), { stroke: rgba(C.ink, 0.35), strokeWidth: 3, draw: [0, 20, 'out-cubic'] });

  // grafik: satu titik per shot, naik pelan dengan variasi, puncak di shot dengan angka/produk
  const n = plan.length;
  const pts = plan.map((st, i) => {
    const x = 80 + (920 * (i + 0.5)) / n;
    const lift = st.kind === 'cta' ? 1 : (i + 1) / n;
    const wiggle = i % 2 ? -0.12 : 0.05;
    const y = Y(1600) - Y(400) * Math.max(0.05, Math.min(1, lift * 0.85 + wiggle));
    return [x, y];
  });
  const chart = s.layer('Grafik', ctx.FX ? { glow: { color: C.acc, radius: 30, strength: 1.2, mode: glowMode } } : {});
  const dot = s.layer('Titik', { x: pts[0][0], y: pts[0][1], ...(ctx.FX ? { glow: { color: C.acc, radius: 40, strength: 1.5, mode: glowMode } } : {}) });
  dot.circle(0, 0, 16, { fill: C.acc });
  dot.pulse({ amount: 0.25, period: (2 * K) / ctx.FPS });
  plan.forEach((st, i) => {
    if (i === 0) return;
    const a = pts[i - 1], b = pts[i];
    chart.stroke(withPressure(catmullRom([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (i % 2 ? 20 : -20)], b], 16), 'flat'), { brush: 'marker', size: 10, color: C.acc, reveal: [st.start - 6, 12, 'in-out-sine'] });
    dot.key(st.start - 6, { x: a[0], y: a[1] }, 'in-out-sine').key(st.start + 6, { x: b[0], y: b[1] });
    s.sfx('tick', { at: st.start, volume: -14, pitch: 1500 + i * 80 });
  });
  // area di bawah garis
  const area = s.layer('Area');
  area.polygon([[pts[0][0], Y(1640)], ...pts, [pts[n - 1][0], Y(1640)]], { fill: { type: 'linear', from: [0, Y(1180)], to: [0, Y(1640)], stops: [[0, rgba(C.acc, 0.18)], [1, rgba(C.acc, 0)]] }, closed: true });
  area.key(0, { opacity: 0 }, 'hold').key(plan[n - 1].start, { opacity: 0 }, 'in-out-sine').key(plan[n - 1].start + 20, { opacity: 1 });

  const hud = s.layer('Label atas', { fixed: true });
  hud.text((ctx.spec.kicker || 'DATA').toUpperCase(), 80, Y(150), mono({ color: C.acc }));
  hud.text(ctx.handle, 1000, Y(150), mono({ align: 'right' }));

  const txt = s.layer('Teks');
  plan.forEach((st, i) => {
    const show = [st.start + (i === 0 ? 0 : 2), i === n - 1 ? end : st.start + st.dur];
    const at = i === 0 ? 0 : st.start + 4;
    const lab = (t, y, o = {}) => txt.text(t, 80, y, mono({ show, anim: { type: 'chars', effect: 'none', at, stagger: 0.8, dur: 1 }, ...o }));
    const big = (t, y, o = {}) =>
      txt.text(t, 80, y, {
        font: MONO, weight: 700, size: Math.round(120 * F), color: C.ink, valign: 'top', maxWidth: 920, lineHeight: 1.05, show,
        ...(i === 0 ? {} : { anim: { type: 'scramble', at, dur: 14 } }),
        ...(hlIndex(t, st.emph).length ? { highlight: { words: hlIndex(t, st.emph), style: 'color', color: C.acc, at: at + 14, dur: 6 } } : {}),
        ...o,
      });
    const note = (t, y) => txt.text(t, 80, y, { font: SERIF, size: Math.round(64 * F), color: C.acc2, valign: 'top', maxWidth: 900, show, anim: { type: 'words', effect: 'fade', at: at + K, stagger: 3, dur: 8 } });

    const num = numberIn(st.text);
    if (st.kind === 'product') {
      const pr = products[st.productId];
      lab(`PRODUK · ${(pr?.platform ?? '').toUpperCase()}`, Y(300));
      big(st.text, Y(360), { size: Math.round(84 * F), maxWidth: 600 });
      if (pr?.price) {
        const pl = s.layer(`Harga ${i}`, { x: 80, y: Y(760), show, ...(ctx.FX ? { glow: { color: C.acc, radius: 36, strength: 1, mode: glowMode } } : {}) });
        pl.text(fmtRp(pr.price, pr.currency), 0, 0, { font: MONO, weight: 700, size: Math.round(150 * F), color: C.acc, valign: 'top', fit: 920, anim: { type: 'count', from: pr.originalPrice ?? Math.round(pr.price * 1.6), to: pr.price, at: at + K, dur: 26, ease: 'out-expo', prefix: pr.currency === 'IDR' ? 'Rp' : '', separator: '.' } });
        s.sfx('riser', { at: at + K, dur: 0.9, volume: -18 });
      }
      const meta = [pr?.discount ? `-${pr.discount}% dari ${fmtRp(pr.originalPrice, pr?.currency)}` : null, pr?.rating ? `rating ${pr.rating}` : null, pr?.soldText].filter(Boolean);
      if (meta.length) note(meta.join(' · '), Y(960));
      if (pr?.image) {
        const ph = s.layer(`Foto ${i}`, { x: 840, y: Y(470), show });
        ph.rect(-150 * F, -150 * F, 300 * F, 300 * F, { fill: '#ffffff', r: 20 });
        ph.image(pr.image, 0, 0, { width: 260 * F, height: 260 * F, fit: 'contain', anchor: 'center' });
        ph.key(show[0], { opacity: 0, scale: 0.8 }, 'out-back').key(show[0] + 10, { opacity: 1, scale: 1 });
      }
    } else if (st.kind === 'compare') {
      lab('PERBANDINGAN HARGA', Y(300));
      big(st.text, Y(360), { size: Math.round(84 * F) });
      const ids = (st.productIds ?? []).filter((id) => products[id]).slice(0, 3);
      const max = Math.max(...ids.map((id) => products[id].price ?? 0), 1);
      ids.forEach((id, k) => {
        const pr = products[id];
        const pick = k + 1 === (st.pick ?? 1);
        const y = Y(640) + k * Y(150);
        const w = Math.max(60, 600 * ((pr.price ?? 0) / max));
        const bar = s.layer(`Batang ${k}`, { x: 80, y, show, ...(pick && ctx.FX ? { glow: { color: C.acc, radius: 30, strength: 1.2, mode: glowMode } } : {}) });
        bar.rect(0, 0, w, Y(70), { fill: pick ? C.acc : rgba(C.ink, 0.25), r: 6 });
        bar.key(st.start, { scaleX: 0 }, 'hold').key(at + k * 6, { scaleX: 0 }, 'out-expo').key(at + k * 6 + 16, { scaleX: 1 });
        txt.text(`${pr.name.slice(0, 22)}`, 80, y + Y(96), mono({ show, size: Math.round(28 * F) }));
        txt.text(fmtRp(pr.price, pr.currency), 1000, y + Y(35), { font: MONO, weight: 700, size: Math.round(48 * F), color: pick ? C.acc : C.ink, align: 'right', valign: 'middle', show, anim: { type: 'chars', effect: 'fade', at: at + k * 6 + 12, stagger: 1, dur: 3 } });
        if (pick) note(pr.fit ? `pilihan: ${pr.fit.toLowerCase()}` : 'pilihan paling masuk akal', Y(1060));
      });
      s.sfx('impact', { at: at + 2, volume: -14 });
    } else if (st.kind === 'cta') {
      lab('KESIMPULAN', Y(300));
      big(st.text, Y(420), { size: Math.round(150 * F) });
      txt.text(ctx.handle, 80, Y(820), { font: SERIF, size: Math.round(96 * F), color: C.acc, valign: 'top', show, anim: { type: 'words', effect: 'fade', at: at + K, dur: 10 } });
      if (ctx.spec.disclosure) lab(ctx.spec.disclosure, Y(1000), { size: Math.round(24 * F) });
      if (ctx.logo) {
        const lg = s.layer('Logo', { x: 860, y: Y(330), show });
        lg.image(ctx.logo, 0, 0, { width: 240 * F, height: 100 * F, fit: 'contain', anchor: 'center' });
      }
    } else if (num != null && st.kind !== 'step') {
      // angka raksasa
      lab(st.label ? st.label.toUpperCase() : `SINYAL ${String(i + 1).padStart(2, '0')}`, Y(300));
      const nl = s.layer(`Angka ${i}`, { x: 80, y: Y(340), show, ...(ctx.FX ? { glow: { color: C.acc, radius: 50, strength: 1.3, mode: glowMode } } : {}) });
      const dec = String(num).includes('.') ? 1 : 0;
      nl.text(String(num).replace('.', ','), 0, 0, { font: MONO, weight: 700, size: Math.round(380 * F), color: C.acc, valign: 'top', fit: 920, anim: { type: 'count', from: 0, to: num, at, dur: 28, ease: 'out-expo', decimals: dec, decimal: ',' } });
      txt.text(st.text, 80, Y(780), { font: MONO, weight: 700, size: Math.round(96 * F), color: C.ink, valign: 'top', maxWidth: 920, show, ...(i === 0 ? {} : { anim: { type: 'scramble', at: at + 10, dur: 12 } }) });
      s.sfx('riser', { at, dur: 0.9, volume: -18 });
    } else {
      lab(st.kind === 'step' ? `LANGKAH ${String(st.n ?? i).padStart(2, '0')}` : st.label ? st.label.toUpperCase() : `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`, Y(300));
      big(st.text, Y(380), { size: Math.round((st.kind === 'hook' ? 120 : 130) * F) });
      if (st.kind === 'hook' && ctx.cover) {
        const ph = s.layer('Sampul', { x: 540, y: Y(1060), show, filter: 'grayscale(0.6) contrast(1.1)' });
        ph.image(ctx.cover, 0, 0, { width: 920, height: Y(220), fit: 'cover', anchor: 'center', radius: 12 });
      } else if (st.emph) note(`— ${st.emph}`, Y(860));
    }
    s.camera.key(st.start, { zoom: i % 2 ? 1.04 : 1.0 }, 'in-out-sine').key(st.start + st.dur, { zoom: i % 2 ? 1.0 : 1.04 });
  });

  ctx.music(p, end, BPM, { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', padVol: -21, root: 110, chord: [0, 7, 10, 15], brightness: 600 });
  void H;
  void readable;
  return p;
}
