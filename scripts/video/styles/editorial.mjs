// Gaya "Editorial" · majalah serif
// Foto di bingkai lengkung (clip) yang pelan-pelan zoom, judul serif besar dengan kata miring
// berwarna, garis tipis, ritme lambat & dissolve. Cocok: review produk premium, brand story, opini.
import { sceneRun, shotImage, photo, fmtRp, hlIndex, rgba } from '../lib.mjs';

export const BPM = 75;

export function build(ctx) {
  const { W, Y, F, products } = ctx;
  const C = ctx.palette({ bg: '#F4EFE6', ink: '#1E1B16', acc: '#B4532A', acc2: '#7A6F5F' });
  const p = ctx.project({ background: C.bg });
  p.effects({ grain: 0.05, vignette: 0.1 });
  const SERIF = ctx.font(p, 'InstrumentSerif-Regular.ttf', 'Instrument Serif', 400);
  const ITAL = ctx.font(p, 'InstrumentSerif-Italic.ttf', 'Instrument Serif Italic', 400);
  const K = Math.round((ctx.FPS * 60) / BPM);
  const small = (o) => ({ weight: 600, size: Math.round(34 * F), color: C.acc2, valign: 'middle', letterSpacing: 4, case: 'upper', ...o });

  // bingkai lengkung + foto yang perlahan zoom
  function arch(s, file, x, y, w, h, at, { product = false, name = 'Lengkung', dur = 4 * K } = {}) {
    const r = w / 2;
    const d = `M ${x - r} ${y + h / 2} L ${x - r} ${y - h / 2 + r} A ${r} ${r} 0 0 1 ${x + r} ${y - h / 2 + r} L ${x + r} ${y + h / 2} Z`;
    const g = s.group(name, { clip: { d } });
    const ph = g.layer('Foto', { x, y });
    if (product) ph.rect(-w / 2, -h / 2, w, h, { fill: '#ffffff' });
    photo(ctx, ph, file, 0, 0, w * (product ? 0.86 : 1), h * (product ? 0.8 : 1), { fit: product ? 'contain' : 'cover', colors: [C.acc, C.acc2] });
    ph.key(at, { scale: 1.12 }, 'out-sine').key(at + dur, { scale: 1.0 });
    const line = s.layer(`${name} garis`);
    line.path(d, { stroke: C.ink, strokeWidth: 3, fill: 'rgba(0,0,0,0)', ...(at > 0 ? { draw: [at, 18, 'in-out-sine'] } : {}) });
    if (at > 0) g.key(0, { opacity: 0 }, 'hold').key(at, { opacity: 0 }, 'out-sine').key(at + 14, { opacity: 1 });
  }
  function serif(s, text, x, y, { size = 150, align = 'left', at = 0, emph, maxWidth = 920, color = C.ink, anim = true } = {}) {
    const idx = hlIndex(text, emph);
    const l = s.layer(`Teks ${text.slice(0, 12)}`, { x, y });
    l.text(text, 0, 0, {
      font: SERIF, size: Math.round(size * F), color, align, valign: 'top', maxWidth, lineHeight: 0.98,
      ...(idx.length ? { highlight: { words: idx, style: 'color', color: C.acc, at: at + 12, dur: 8 } } : {}),
      ...(anim ? { anim: { type: 'words', effect: 'blur', at, stagger: 5, dur: 14 } } : {}),
    });
    return l;
  }
  function rules(s, at) {
    const r = s.layer('Garis');
    r.line(80, Y(210), 1000, Y(210), { stroke: C.ink, strokeWidth: 2, draw: [at, 20, 'in-out-sine'] });
    r.line(80, Y(1720), 1000, Y(1720), { stroke: C.ink, strokeWidth: 2, draw: [at + 6, 20, 'in-out-sine'] });
  }
  function kicker(s, i, text, at) {
    const k = s.layer('Kicker', { fixed: true });
    k.text(`No. ${String(i + 1).padStart(2, '0')}`, 80, Y(170), small({ color: C.ink }));
    k.text(text, 1000, Y(170), small({ align: 'right' }));
    k.fadeIn(at, 10);
  }

  const BEATS = { hook: 5, point: 3.5, step: 3.5, product: 6, compare: 6, cta: 4 };
  const TR = [{ type: 'fade', duration: 18, ease: 'in-out-sine' }, { type: 'dip', duration: 16, color: C.bg }, { type: 'blur', duration: 16, amount: 20 }];
  const end = sceneRun(ctx, p, K, { beats: (s) => BEATS[s.kind] ?? 4, transitions: TR, bg: C.bg }, (s, st, i, { off, dur }) => {
    const at = off + 2;
    rules(s, i === 0 ? 0 : at);
    kicker(s, i, st.label || ctx.spec.kicker || ctx.B.name || '', i === 0 ? 0 : at);
    s.camera.key(0, { zoom: 1.0 }, 'in-out-sine').key(dur, { zoom: 1.035 });
    if (st.kind === 'hook') {
      const im = shotImage(ctx, st);
      arch(s, im.file, 540, Y(1190), 780, Y(860), 0, { product: im.product, dur });
      serif(s, st.text, 80, Y(250), { size: 200, emph: st.emph, anim: false });
    } else if (st.kind === 'point' || st.kind === 'step') {
      const left = i % 2 === 1;
      if (st.kind === 'step') {
        const n = s.layer('Nomor', { x: left ? 80 : 1000, y: Y(300) });
        n.text(String(st.n ?? i), 0, 0, { font: ITAL, size: Math.round(420 * F), color: C.acc, align: left ? 'left' : 'right', valign: 'top', anim: { type: 'chars', effect: 'blur', at, dur: 14 } });
      } else if (ctx.cover && i % 3 === 1) {
        arch(s, ctx.cover, left ? 760 : 320, Y(560), 440, Y(640), at, { dur });
      }
      serif(s, st.text, 80, Y(st.kind === 'step' ? 900 : ctx.cover && i % 3 === 1 ? 1000 : 560), { size: 250, emph: st.emph, at: at + 6 });
      const orn = s.layer('Ornamen');
      orn.text('—', 80, Y(1560), { font: SERIF, size: Math.round(90 * F), color: C.acc, valign: 'middle', anim: { type: 'chars', effect: 'fade', at: at + K, dur: 10 } });
    } else if (st.kind === 'product') {
      const pr = products[st.productId];
      arch(s, pr?.image, 540, Y(800), 700, Y(900), at, { product: true, dur });
      serif(s, st.text, 80, Y(1290), { size: 150, emph: st.emph, at: at + K });
      if (pr?.price) {
        const pl = s.layer('Harga', { x: 1000, y: Y(1580) });
        pl.text(fmtRp(pr.price, pr.currency), 0, 0, { font: ITAL, size: Math.round(150 * F), color: C.acc, align: 'right', valign: 'middle', anim: { type: 'words', effect: 'blur', at: at + 2 * K, dur: 14 } });
        if (pr.originalPrice && pr.originalPrice > pr.price) {
          pl.text(`dari ${fmtRp(pr.originalPrice, pr.currency)}`, 0, Y(-90), small({ align: 'right', anim: { type: 'words', effect: 'fade', at: at + 2 * K + 10, dur: 10 } }));
        }
      }
      const meta = [pr?.platform, pr?.rating ? `rating ${pr.rating}` : null, pr?.soldText].filter(Boolean).join('  ·  ');
      if (meta) {
        const m = s.layer('Meta');
        m.text(meta, 80, Y(1650), small({ letterSpacing: 2, size: Math.round(30 * F), anim: { type: 'words', effect: 'fade', at: at + 3 * K, dur: 8 } }));
      }
    } else if (st.kind === 'compare') {
      serif(s, st.text, 80, Y(260), { size: 170, emph: st.emph, at });
      const ids = (st.productIds ?? []).filter((id) => products[id]).slice(0, 3);
      const n = ids.length || 1;
      const cw = Math.floor((920 - (n - 1) * 30) / n);
      ids.forEach((id, k) => {
        const pr = products[id];
        const x = 80 + k * (cw + 30) + cw / 2;
        const t = at + K + k * Math.round(K / 3);
        arch(s, pr.image, x, Y(900), cw, Y(cw * 1.35 * (1920 / 1920)), t, { product: true, name: `Lengkung ${k}`, dur });
        const pick = k + 1 === (st.pick ?? 1);
        const tl = s.layer(`Teks produk ${k}`, { x, y: Y(900) + Y(cw * 0.7) + Y(40) });
        tl.text(fmtRp(pr.price, pr.currency), 0, 0, { font: ITAL, size: Math.round(64 * F), color: pick ? C.acc : C.ink, align: 'center', valign: 'top', fit: cw, anim: { type: 'words', effect: 'blur', at: t + 10, dur: 10 } });
        if (pr.fit) tl.text(pr.fit, 0, Y(90), small({ align: 'center', valign: 'top', size: Math.round(26 * F), letterSpacing: 1, maxWidth: cw, anim: { type: 'words', effect: 'fade', at: t + 14, dur: 8 } }));
        if (pick) {
          const u = s.layer('Pilihan');
          u.line(x - cw / 2 + 20, Y(900) + Y(cw * 0.7) + Y(150), x + cw / 2 - 20, Y(900) + Y(cw * 0.7) + Y(150), { stroke: C.acc, strokeWidth: 4, draw: [at + 3 * K, 14, 'in-out-sine'] });
          u.text('pilihan editor', x, Y(900) - Y(cw * 0.68) - Y(40), { font: ITAL, size: Math.round(48 * F), color: C.acc, align: 'center', valign: 'middle', anim: { type: 'words', effect: 'blur', at: at + 3 * K, dur: 12 } });
        }
      });
    } else {
      if (ctx.logo) {
        const lg = s.layer('Logo', { x: 540, y: Y(560) });
        lg.image(ctx.logo, 0, 0, { width: 360 * F, height: 140 * F, fit: 'contain', anchor: 'center' });
        lg.fadeIn(at, 14);
      }
      serif(s, st.text, 540, Y(720), { size: 270, align: 'center', emph: st.emph, at: at + 6, maxWidth: 960 });
      const h = s.layer('Handle');
      h.text(ctx.handle, 540, Y(1340), { font: ITAL, size: Math.round(80 * F), color: C.acc, align: 'center', valign: 'middle', anim: { type: 'words', effect: 'blur', at: at + 2 * K, dur: 12 } });
      if (ctx.spec.disclosure) h.text(ctx.spec.disclosure, 540, Y(1620), small({ align: 'center', size: Math.round(26 * F), letterSpacing: 1, color: rgba(C.ink, 0.6) }));
    }
    s.sfx(i === 0 ? 'chime' : 'swoosh', { at: Math.max(0, off - 6), dur: 0.8, volume: -18 });
  });
  ctx.music(p, end, BPM, { kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', beatVol: -21, padVol: -18, root: 146.8, chord: [0, 3, 7, 10], brightness: 700 });
  return p;
}
