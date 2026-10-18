// Gaya "Struk" · struk kasir thermal
// Satu struk panjang keluar dari printer baris demi baris (tiap shot = satu blok cetakan),
// foto dicetak hitam-putih ala thermal, harga dicoret pulpen, ditutup stempel ajakan.
// Cocok: promo / jualan langsung, rekap, F&B, "racun" barang murah.
import { rgba, fmtRp, wrapCount, shotImage, photo, onBg } from '../lib.mjs';

export const BPM = 100;

export function build(ctx) {
  const { G, W, H, Y, F, products } = ctx;
  const { catmullRom, withPressure, ellipsePoints } = G;
  const C = ctx.palette({ bg: '#1F3B30', ink: '#1A1A1A', paper: '#F7F3EA', acc: '#D7261E', acc2: '#D7261E' });
  // aksen dipakai di atas kertas → cek kontras ke kertas, bukan ke latar
  const RED = ctx.useBrand ? onBg(ctx.brandColors.acc, C.paper, onBg(ctx.brandColors.acc2, C.paper, '#D7261E')) : '#D7261E';
  const p = ctx.project({ background: C.bg });
  p.effects({ grain: 0.06, vignette: 0.28 });
  const MONO = ctx.font(p, 'SpaceMono-Regular.ttf', 'Space Mono', 400);
  ctx.font(p, 'SpaceMono-Bold.ttf', 'Space Mono', 700);
  const HAND = ctx.font(p, 'Caveat-700.ttf', 'Caveat', 700);
  const K = Math.round((ctx.FPS * 60) / BPM);

  const BEATS = { hook: 5, point: 3.5, step: 3.5, product: 6, compare: 6, cta: 5 };
  const { plan, end } = ctx.timeline(K, (s) => BEATS[s.kind] ?? 4, { outro: 2 * K });
  const s = p.scene('Struk', { duration: end, background: C.bg });
  s.note({ action: 'Struk keluar dari printer, tiap shot dicetak sebagai blok; foto thermal; stempel ajakan' });

  const X0 = 80;
  const RW = 920;
  const PAD = 50;
  const TW = RW - PAD * 2;
  const SLOT = Y(1600);
  const mono = (o = {}) => ({ font: MONO, color: C.ink, valign: 'top', ...o });
  const frame = s.group('Area struk', { clip: { rect: [0, 0, W, SLOT] } });
  const paper = frame.group('Kertas');
  const sheet = paper.layer('Lembar');
  const txt = paper.layer('Cetakan');
  const pics = paper.layer('Foto', { filter: 'grayscale(1) contrast(1.25)' });

  // blok cetakan: [{y, h, at}] — y relatif atas kertas
  let y = 50;
  const blocks = [];
  const add = (h, at, draw) => {
    blocks.push({ y, h, at });
    draw(y);
    s.sfx('tick', { at, volume: -13, pitch: 1300 + (blocks.length % 3) * 140 });
    y += h;
  };
  const rule = (at) => add(Y(50), at, (yy) => txt.line(X0 + PAD, yy + Y(25), X0 + RW - PAD, yy + Y(25), { stroke: C.ink, strokeWidth: 3, dash: [10, 10], show: [at, null] }));
  const bigLines = (text, at, size, { bold = true, color = C.ink, align = 'left' } = {}) => {
    const sz = Math.round(size * F);
    const n = wrapCount(text, sz, TW, 0.62);
    const h = n * sz * 1.12 + Y(24);
    add(h, at, (yy) => txt.text(text, align === 'center' ? X0 + RW / 2 : X0 + PAD, yy, mono({ size: sz, weight: bold ? 700 : 400, color, maxWidth: TW, lineHeight: 1.12, align, show: [at, null], anim: { type: 'chars', effect: 'none', at, dur: 1, stagger: 0.6 } })));
  };
  const pair = (l, r, at, { size = 52, color = C.ink, id } = {}) => {
    const sz = Math.round(size * F);
    add(sz * 1.5, at, (yy) => {
      txt.text(l, X0 + PAD, yy + sz * 0.75, mono({ size: sz, valign: 'middle', show: [at, null], maxWidth: TW - 300 * F, ...(id ? { id } : {}) }));
      txt.text(r, X0 + RW - PAD, yy + sz * 0.75, mono({ size: sz, weight: 700, valign: 'middle', align: 'right', color, show: [at, null] }));
    });
  };
  const pic = (file, at, isProduct) => {
    const h = Y(isProduct ? 520 : 470);
    add(h + Y(30), at, (yy) => {
      if (!photo(ctx, pics, file, X0 + RW / 2, yy + h / 2, TW, h, { fit: isProduct ? 'contain' : 'cover', show: [at, null], colors: ['#444', '#999'] })) return;
    });
  };
  const marks = []; // coretan & stempel (dibuat setelah posisi akhir diketahui)

  plan.forEach((st, i) => {
    const t0 = st.kind === 'hook' ? 0 : st.start + 2;
    const step = Math.max(4, Math.round(K / 2));
    if (st.kind === 'hook') {
      bigLines((ctx.B.name || 'TOKO').toUpperCase(), t0, 92, { align: 'center' });
      pair(new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }), ctx.handle, t0 + 4, { size: 40, color: rgba(C.ink, 0.6) });
      rule(t0 + 6);
      const im = shotImage(ctx, st);
      if (im.file) pic(im.file, t0, im.product);
      bigLines(st.text, t0, 104);
      rule(t0 + step);
    } else if (st.kind === 'point' || st.kind === 'step') {
      const no = st.kind === 'step' ? `#${String(st.n ?? i).padStart(2, '0')}` : st.label ? st.label.toUpperCase() : `ITEM ${String(i).padStart(2, '0')}`;
      pair(no, 'x1', t0, { size: 44, color: RED });
      bigLines(st.text, t0 + step, 96);
      if (st.emph) marks.push({ kind: 'under', block: blocks.length - 1, at: t0 + 2 * step });
      rule(t0 + 2 * step);
    } else if (st.kind === 'product') {
      const pr = products[st.productId];
      if (pr?.image) pic(pr.image, t0, true);
      bigLines(st.text, t0 + step, 80);
      if (pr) {
        pair((pr.platform ?? 'harga').toUpperCase(), pr.price ? fmtRp(pr.price, pr.currency) : '-', t0 + 2 * step, { size: 62 });
        if (pr.originalPrice && pr.price && pr.originalPrice > pr.price) {
          pair('harga normal', fmtRp(pr.originalPrice, pr.currency), t0 + 2 * step + 4, { size: 44, color: rgba(C.ink, 0.6) });
          marks.push({ kind: 'strike', block: blocks.length - 1, at: st.start + Math.round(st.dur * 0.6) });
          pair('HEMAT', `-${pr.discount}%`, t0 + 2 * step + 8, { size: 62, color: RED });
        }
        if (pr.rating || pr.soldText) pair(pr.rating ? `rating ${pr.rating}` : '', pr.soldText ?? '', t0 + 3 * step, { size: 40, color: rgba(C.ink, 0.65) });
      }
      rule(t0 + 3 * step + 4);
    } else if (st.kind === 'compare') {
      bigLines(st.text, t0, 80);
      rule(t0 + 4);
      const ids = (st.productIds ?? []).filter((id) => products[id]);
      ids.forEach((id, k) => {
        const pr = products[id];
        const name = pr.name.length > 15 ? pr.name.slice(0, 14) + '…' : pr.name;
        pair(`${k + 1}. ${name}`, pr.price ? fmtRp(pr.price, pr.currency) : '-', t0 + step + k * step, { size: 46 });
        if (pr.fit) pair(`   ${pr.fit.slice(0, 26)}`, '', t0 + step + k * step + 3, { size: 34, color: rgba(C.ink, 0.6) });
        if (k + 1 === (st.pick ?? 1)) marks.push({ kind: 'circle', block: blocks.length - (pr.fit ? 2 : 1), at: st.start + Math.round(st.dur * 0.65) });
      });
      rule(t0 + (ids.length + 1) * step);
    } else {
      pair('TOTAL', ctx.handle || '', t0, { size: 64 });
      rule(t0 + 4);
      bigLines(st.text.toUpperCase(), t0 + step, 110, { align: 'center' });
      marks.push({ kind: 'stamp', block: blocks.length - 1, at: st.start + Math.round(2.5 * K), text: st.text });
      if (ctx.spec.disclosure) bigLines(ctx.spec.disclosure, t0 + 2 * step, 34, { bold: false, color: rgba(C.ink, 0.6), align: 'center' });
      bigLines('terima kasih :)', t0 + 2 * step + 4, 44, { bold: false, align: 'center' });
    }
  });

  // kertas: tinggi total + tepi sobek
  const PH = y + 60;
  const zig = [];
  for (let x = 0; x <= RW; x += 30) zig.push([X0 + x, PH + ((x / 30) % 2) * 22]);
  sheet.polygon([[X0, 0], [X0 + RW, 0], ...zig.reverse()], { fill: C.paper, closed: true, shadow: { color: 'rgba(0,0,0,0.35)', blur: 40, y: 18 } });

  // kertas naik tiap blok tercetak: blok terakhir tepat di atas mulut printer, lalu kamera menyusul
  paper.key(0, { y: Math.max(Y(160), SLOT - blocks.filter((b) => b.at === 0).reduce((a, b) => a + b.h, 0) - 90) }, 'hold');
  blocks.filter((b) => b.at > 0).forEach((b) => paper.key(b.at, { y: Math.min(Y(120), SLOT - (b.y + b.h) - 30) }, 'out-cubic'));
  const lastAt = blocks[blocks.length - 1].at;

  // coretan & stempel di posisi kertas pada saat itu (ikut kertas: layer di dalam group kertas)
  const pen = paper.layer('Pulpen');
  marks.forEach((m, k) => {
    const b = blocks[m.block];
    if (!b) return;
    const yy = b.y + b.h / 2;
    if (m.kind === 'strike') {
      pen.stroke(withPressure(catmullRom([[X0 + RW - 420, yy + 4], [X0 + RW - 220, yy - 6], [X0 + RW - 40, yy + 2]], 24), 'swell'), { brush: 'ink', size: 12, color: RED, reveal: [m.at, 8, 'out-cubic'], seed: k });
      s.sfx('scratch', { at: m.at, dur: 0.35, volume: -12 });
    } else if (m.kind === 'under') {
      pen.stroke(withPressure(catmullRom([[X0 + PAD, b.y + b.h - Y(16)], [X0 + 400, b.y + b.h - Y(4)], [X0 + RW - PAD - 80, b.y + b.h - Y(14)]], 24), 'swell'), { brush: 'ink', size: 10, color: RED, reveal: [m.at, 8, 'out-cubic'], seed: k });
      s.sfx('scratch', { at: m.at, dur: 0.3, volume: -14 });
    } else if (m.kind === 'circle') {
      pen.stroke(ellipsePoints(X0 + RW / 2, yy, RW / 2 - 10, b.h * 0.9 + 20, { start: 200, end: 570, n: 70, pressure: (t) => 0.4 + 0.6 * Math.sin(Math.PI * t) }), { brush: 'ink', size: 10, color: RED, reveal: [m.at, 12, 'in-out-sine'] });
      s.sfx('scratch', { at: m.at, dur: 0.5, volume: -12 });
    } else if (m.kind === 'stamp') {
      const stp = paper.layer('Stempel', { x: X0 + RW / 2, y: yy, rotation: -9 });
      const w = Math.min(RW - 60, 140 + m.text.length * 44 * F);
      stp.rect(-w / 2, -Y(110), w, Y(220), { stroke: RED, strokeWidth: 10, r: 12, sketch: { roughness: 1.2, passes: 1, fill: 'none', seed: 4 } });
      stp.key(0, { opacity: 0 }, 'hold').key(m.at, { opacity: 0.92 });
      stp.pop(m.at, { from: 2.2, dur: 5, ease: 'out-quad', fade: false });
      s.sfx('impact', { at: m.at, volume: -6 });
      s.camera.shake({ amp: 14, freq: 20, from: m.at + 3, to: m.at + 11, decay: true });
    }
  });

  // mulut printer
  const printer = s.layer('Printer');
  printer.rect(90, SLOT, W - 180, Y(220), { fill: '#121212', r: [0, 0, 24, 24] });
  printer.rect(120, SLOT, W - 240, 18, { fill: '#000' });
  printer.circle(W - 170, SLOT + Y(90), 12, { fill: '#3BD16F' });
  printer.text('KASIR', 150, SLOT + Y(92), { font: MONO, weight: 700, size: Math.round(40 * F), color: '#5C5C5C', valign: 'middle', letterSpacing: 6 });
  printer.key(0, { opacity: 1 }, 'hold').key(lastAt + K, { opacity: 1 }, 'in-cubic').key(lastAt + 2 * K, { opacity: 0, y: Y(240) });

  // kamera: dekat ke baris yang sedang dicetak, lalu mundur di akhir
  s.camera.handheld({ amp: 3 });
  s.camera.key(0, { zoom: 1.08, y: Y(60) }, 'in-out-sine');
  plan.forEach((st, i) => {
    const z = i % 2 ? 1.12 : 1.0;
    s.camera.key(st.start + 2, { zoom: z, y: i % 2 ? Y(140) : Y(40) }, 'in-out-cubic');
  });
  s.camera.key(lastAt + K, { zoom: 1.0, y: 0 }, 'in-out-sine').key(end, { zoom: 0.94, y: 0 });

  ctx.music(p, end, BPM, { hat: '..x...x...x...x.', beatVol: -18, padVol: null });
  return p;
}
