// Gaya "Papan" · satu dunia ala Brand Kit
// Semua shot = stasiun di satu papan besar berwarna brand. Kamera pindah antar stasiun & ganti
// ukuran shot, foto sampul / foto produk melompat dari stasiun ke stasiun, rute kuas menyambung
// semuanya, penutup extreme wide. Font & warna 100% dari Brand Kit.
import { rgba, readable, onBg, lum, hlIndex, fmtRp } from '../lib.mjs';

export const BPM = 100;

export function build(ctx) {
  const { G, W, H, Y, F, shots, products, img } = ctx;
  const { rng, catmullRom, withPressure, ellipsePoints } = G;
  const BG = ctx.brandColors.bg;
  const INK = ctx.brandColors.ink;
  const ACC = ctx.brandColors.acc;
  const ACC2 = ctx.brandColors.acc2;
  const DARK = lum(BG) < 0.3;
  const ACC_TXT = onBg(ACC, BG, onBg(ACC2, BG, INK));
  const GLOW_MODE = DARK ? 'lighter' : 'screen';
  const FX = ctx.FX;

  const p = ctx.project({ background: BG });
  p.effects({ grain: DARK ? 0.05 : 0.06, vignette: DARK ? 0.22 : 0.12 });
  const bf = ctx.brandFonts(p);
  const HEAD = bf.head, BODY = bf.body, HEAD_W = bf.headW, DISPLAY = bf.display;
  const caseOf = (t) => (bf.upper ? t.toUpperCase() : t);
  const K = Math.round((ctx.FPS * 60) / BPM);

  const BEATS = { hook: 5, point: 4, step: 4, product: 6, compare: 7, cta: 4 };
  const COL = 1320;
  const ROW = Y(1500);
  const TRAVEL = 14;
  const { plan } = ctx.timeline(K, (s) => BEATS[s.kind] ?? 4);
  const station = plan.map((s, i) => {
    const row = Math.floor(i / 2);
    const col = row % 2 === 0 ? i % 2 : 1 - (i % 2);
    return { ...s, ox: col * COL, oy: row * ROW, flip: i % 2 === 1 };
  });
  const last = station[station.length - 1];
  const WIDE_AT = last.start + Math.max(Math.round(2.5 * K), last.dur - 4 * K);
  const END = WIDE_AT + 4 * K;
  const worldW = COL + W;
  const worldH = (Math.floor((station.length - 1) / 2) + 1) * ROW + Y(600);

  const s = p.scene('Papan', { duration: END, background: BG });
  s.note({ action: `Satu papan brand, ${station.length} stasiun, subjek melompat antar stasiun, akhir extreme wide.` });

  // latar hidup
  const R = rng('latar-' + (ctx.spec.seed ?? 'berita'));
  for (let i = 0; i < 7; i++) {
    const c = s.layer(`Bulatan ${i}`, { x: -400 + R() * (worldW + 800), y: -400 + R() * (worldH + 800), depth: 2.2 + R() * 1.5 });
    const r = 260 + R() * 420;
    c.circle(0, 0, r, { fill: rgba(i % 2 ? ACC : ACC2, DARK ? 0.1 : 0.14) });
    c.float({ amp: 30 + R() * 30, period: 6 + R() * 5, phase: R() });
    c.spin({ speed: (R() - 0.5) * 6 });
  }
  const grid = s.layer('Garis papan', { depth: 1.3 });
  for (let x = -800; x < worldW + 800; x += 240) grid.line(x, -800, x, worldH + 800, { stroke: rgba(INK, 0.045), strokeWidth: 2 });
  for (let y = -800; y < worldH + 800; y += 240) grid.line(-800, y, worldW + 800, y, { stroke: rgba(INK, 0.045), strokeWidth: 2 });

  // rute kuas antar stasiun
  const route = s.layer('Rute', FX ? { glow: { color: ACC2, radius: 40, strength: 0.7, mode: GLOW_MODE } } : {});
  const center = (st) => [st.ox + W / 2, st.oy + H / 2];
  for (let i = 1; i < station.length; i++) {
    const a = center(station[i - 1]);
    const b = center(station[i]);
    const mid = [(a[0] + b[0]) / 2 + (i % 2 ? 160 : -160), (a[1] + b[1]) / 2 + (i % 2 ? -120 : 120)];
    route.stroke(withPressure(catmullRom([a, mid, b], 40), 'swell'), { brush: 'marker', size: 46, color: rgba(ACC2, 0.85), reveal: [station[i].start - TRAVEL - 4, TRAVEL + 10, 'in-out-sine'], seed: i });
  }

  // teks
  const nWords = (t) => t.trim().split(/\s+/).filter(Boolean).length;
  function headSize(text, base = 1) {
    const n = nWords(text);
    let size = n <= 2 ? 190 : n === 3 ? 168 : 150;
    if (text.length > 26) size *= 0.86;
    if (DISPLAY) size *= 1.22;
    return Math.round(size * base * F);
  }
  const EFFECTS = ['rise', 'pop', 'drop', 'slide', 'stamp'];
  const hl = (text, emph, at) => {
    const idx = hlIndex(text, emph);
    return idx.length ? { highlight: { words: idx, style: 'marker', color: rgba(ACC, DARK ? 0.55 : 0.7), at, dur: 10 } } : {};
  };
  function bigText(layer, st, text, x, y, { size, align = 'left', maxWidth = 900, color = INK, at = st.start + 4, emph } = {}) {
    return layer.text(caseOf(text), x, y, {
      font: HEAD, weight: HEAD_W, size: size ?? headSize(text), color, align, valign: 'top', maxWidth, lineHeight: DISPLAY ? 0.95 : 1.04,
      letterSpacing: DISPLAY ? 1 : -2,
      anim: { type: 'words', effect: EFFECTS[st.i % EFFECTS.length], at, stagger: 3, dur: 10, ease: 'out-back' },
      ...hl(text, emph, at + 10),
    });
  }
  function label(layer, text, x, y, { at, color = INK, size = 52, align = 'left', bg } = {}) {
    return layer.text(text, x, y, {
      font: BODY, weight: 700, size: Math.round(size * F), color, align, valign: 'middle', maxWidth: 900,
      ...(bg ? { box: { color: bg, padX: 22, padY: 12, radius: 14 } } : {}),
      anim: { type: 'words', effect: 'fade', at, stagger: 2, dur: 8 },
    });
  }

  // subjek: kartu yang melompat
  const subject = s.group('Subjek', { x: W / 2, y: H / 2 });
  const card = subject.layer('Kartu', { shadow: { color: 'rgba(0,0,0,0.28)', blur: 40, x: 0, y: 18 } });
  const CW = 600, CH = 600;
  const slots = station.map((st) => {
    if (st.kind === 'product' && products[st.productId]) return { file: img(products[st.productId].image), product: true };
    if (st.kind === 'compare') {
      const pid = (st.productIds ?? [])[(st.pick ?? 1) - 1];
      if (pid && products[pid]) return { file: img(products[pid].image), product: true };
    }
    const fb = ctx.spec.fallbackProduct ? img(products[ctx.spec.fallbackProduct]?.image) : null;
    return { file: ctx.cover ?? fb, product: !ctx.cover && !!fb };
  });
  let prevKey = null;
  let runStart = 0;
  const pushRun = (key, from, to) => {
    if (!key) return;
    const [file, isProduct] = key.split('|');
    const show = [from, to];
    card.rect(-CW / 2 - 18, -CH / 2 - 18, CW + 36, CH + 36, { fill: '#ffffff', r: 26, show });
    if (file && file !== 'none') card.image(file, 0, 0, { width: CW, height: CH, fit: isProduct === '1' ? 'contain' : 'cover', anchor: 'center', radius: 16, show });
    else {
      card.rect(-CW / 2, -CH / 2, CW, CH, { fill: { type: 'linear', angle: 135, stops: [[0, ACC], [1, ACC2]] }, r: 16, show });
      card.text(caseOf((ctx.spec.kicker || ctx.B.name || '•').slice(0, 10)), 0, 0, { font: HEAD, weight: HEAD_W, size: 120, color: readable(ACC), align: 'center', valign: 'middle', maxWidth: CW - 60, show });
    }
  };
  station.forEach((st, i) => {
    const key = `${slots[i].file ?? 'none'}|${slots[i].product ? 1 : 0}`;
    const from = i === 0 ? 0 : st.start - Math.round(TRAVEL / 2);
    if (key !== prevKey) {
      pushRun(prevKey, runStart, from);
      prevKey = key;
      runStart = from;
    }
  });
  pushRun(prevKey, runStart, null);
  const badge = subject.layer('Stiker', { x: CW / 2 - 10, y: -CH / 2 + 10, rotation: 8 });
  const badgeAt = [];
  station.forEach((st) => {
    const n = st.kind === 'step' ? st.n : st.kind === 'product' && st.n ? st.n : null;
    if (!n) return;
    const show = [st.start - 2, st.start + st.dur - 6];
    badge.circle(0, 0, 92, { fill: ACC, stroke: '#ffffff', strokeWidth: 10, show });
    badge.text(String(n), 0, 6, { font: HEAD, weight: HEAD_W, size: 104, color: readable(ACC), align: 'center', valign: 'middle', show });
    badgeAt.push(st.start);
  });
  badgeAt.forEach((f) => {
    badge.key(f - 2, { scale: 0 }, 'out-back').key(f + 8, { scale: 1 });
    s.sfx('pop', { at: f, volume: -12 });
  });

  // stasiun
  const world = s.layer('Isi stasiun');
  const fxLayer = (name, x, y, color) => s.layer(name, { x, y, ...(FX ? { glow: { color, radius: 46, strength: 1, mode: GLOW_MODE } } : {}) });
  const camKeys = [];
  const C = (px, py, zoom) => ({ x: px - W / 2, y: py - H / 2, zoom });
  const subjectAt = [];

  for (const st of station) {
    const { ox, oy } = st;
    const at = st.start + 4;
    const L = (x, y) => [ox + x, oy + Y(y)];
    const left = !st.flip;
    if (st.kind === 'hook') {
      world.text(caseOf(st.text), ...L(80, 250), {
        font: HEAD, weight: HEAD_W, size: headSize(st.text, 1.05), color: INK, valign: 'top', maxWidth: 920, lineHeight: DISPLAY ? 0.95 : 1.04, letterSpacing: DISPLAY ? 1 : -2,
        ...hl(st.text, st.emph, 0),
      });
      subjectAt.push([540, Y(1120), 1.32 * F, -3]);
      if (st.label) label(world, st.label, ...L(80, 1640), { at: at + 12, size: 50 });
      camKeys.push([0, C(ox + 540, oy + Y(960), 1.0), 'in-out-sine']);
      camKeys.push([Math.round(1.5 * K), C(ox + 540, oy + Y(1120), 1.6), 'in-out-cubic']);
      camKeys.push([Math.round(1.5 * K) + 14, C(ox + 540, oy + Y(1100), 1.68), 'in-out-sine']);
      camKeys.push([st.start + st.dur - TRAVEL, C(ox + 540, oy + Y(980), 0.92), 'in-out-cubic']);
      s.sfx('whoosh', { at: st.start + 6, dur: 0.5, volume: -14 });
      s.sfx('pop', { at, volume: -11 });
    } else if (st.kind === 'point' || st.kind === 'step') {
      const textY = left ? 260 : 1040;
      const subj = left ? [700, Y(1240), 0.82 * F, 4] : [420, Y(600), 0.82 * F, -4];
      if (st.kind === 'step') {
        const num = fxLayer(`Nomor ${st.i}`, ...L(90, textY - 10), ACC_TXT);
        num.text(String(st.n ?? ''), 0, 0, { font: HEAD, weight: HEAD_W, size: Math.round(260 * F), color: ACC_TXT, valign: 'top', anim: { type: 'chars', effect: 'stamp', at, dur: 8 } });
        bigText(world, st, st.text, ...L(90, textY + 270), { size: headSize(st.text, 0.86), emph: st.emph, at: at + 6, maxWidth: 880 });
        s.sfx('impact', { at, volume: -14 });
      } else bigText(world, st, st.text, ...L(80, textY), { emph: st.emph, maxWidth: 900 });
      if (st.label) label(world, st.label, ...L(84, textY - 66), { at: at - 2, color: readable(ACC), bg: ACC, size: 44 });
      subjectAt.push(subj);
      const close = st.i % 2 === 0;
      camKeys.push([st.start, close ? C(ox + 540, oy + Y(textY + 220), 1.45) : C(ox + 540, oy + Y(960), 0.78), 'in-out-sine']);
      camKeys.push([st.start + st.dur - TRAVEL, C(ox + 540, oy + Y(960), close ? 1.0 : 0.94), 'in-out-cubic']);
      s.sfx('swoosh', { at: st.start - TRAVEL, dur: 0.45, volume: -16 });
      s.sfx('tap', { at, volume: -12 });
    } else if (st.kind === 'product') {
      const pr = products[st.productId];
      bigText(world, st, st.text, ...L(80, 230), { size: headSize(st.text, 0.8), emph: st.emph, maxWidth: 920 });
      subjectAt.push([540, Y(880), 0.9 * F, st.flip ? 3 : -3]);
      if (pr) {
        const PRICE_AT = st.start + 2 * K;
        if (pr.price) {
          const priceL = fxLayer(`Harga ${st.i}`, ...L(80, 1250), ACC_TXT);
          priceL.text(fmtRp(pr.price, pr.currency), 0, 0, {
            font: HEAD, weight: HEAD_W, size: Math.round((DISPLAY ? 190 : 150) * F), color: ACC_TXT, valign: 'top', fit: 900,
            anim: { type: 'count', from: pr.originalPrice && pr.originalPrice > pr.price ? pr.originalPrice : Math.round(pr.price * 1.6), to: pr.price, at: PRICE_AT, dur: 22, ease: 'out-cubic', prefix: pr.currency === 'IDR' ? 'Rp' : '', separator: '.' },
          });
          if (FX) priceL.key(PRICE_AT + 20, { glow: 2 }, 'out-cubic').key(PRICE_AT + 40, { glow: 0.7 });
          const ring = s.layer(`Lingkar ${st.i}`, { x: ox + 80 + 330 * F, y: oy + Y(1250) + 85 * F });
          ring.stroke(withPressure(ellipsePoints(0, 0, 400 * F, 130 * F, { start: -100, end: 250, n: 80 }), 'swell'), { brush: 'ink', size: 14, color: ACC2, reveal: [PRICE_AT + 22, 12, 'out-cubic'], seed: st.i });
          s.sfx('coin', { at: PRICE_AT + 22, volume: -10 });
        }
        const meta = [];
        if (pr.originalPrice && pr.price && pr.originalPrice > pr.price) meta.push(fmtRp(pr.originalPrice, pr.currency));
        if (pr.rating) meta.push(`rating ${String(pr.rating).replace('.', ',')}`);
        if (pr.soldText) meta.push(pr.soldText);
        if (meta.length) world.text(meta.join('   ·   '), ...L(84, 1500), { font: BODY, weight: 600, size: Math.round(46 * F), color: rgba(INK, 0.7), valign: 'middle', anim: { type: 'words', effect: 'fade', at: PRICE_AT + 26, stagger: 2, dur: 8 } });
        if (pr.discount) {
          const stamp = s.layer(`Diskon ${st.i}`, { x: ox + 840, y: oy + Y(520), rotation: -12, scale: F, ...(FX ? { glow: { color: '#e11d48', radius: 40, strength: 0.8, mode: GLOW_MODE } } : {}) });
          stamp.circle(0, 0, 118, { fill: '#e11d48', stroke: '#ffffff', strokeWidth: 10 });
          stamp.text(`-${pr.discount}%`, 0, 4, { font: HEAD, weight: HEAD_W, size: 70, color: '#ffffff', align: 'center', valign: 'middle', fit: 190 });
          stamp.key(0, { opacity: 0 }, 'hold').key(PRICE_AT + 30, { opacity: 1 });
          stamp.pop(PRICE_AT + 30, { from: 2.4, dur: 7, ease: 'out-quad', fade: false });
          s.sfx('impact', { at: PRICE_AT + 30, volume: -10 });
          s.camera.shake({ amp: 6, freq: 14, from: PRICE_AT + 30, to: PRICE_AT + 38, decay: true });
        }
        if (pr.platform) label(world, pr.platform, ...L(84, 1180), { at: PRICE_AT - 4, color: '#ffffff', bg: pr.platformColor ?? INK, size: 40 });
        camKeys.push([st.start, C(ox + 540, oy + Y(900), 0.8), 'in-out-sine']);
        camKeys.push([PRICE_AT - 6, C(ox + 540, oy + Y(900), 0.92), 'in-out-cubic']);
        camKeys.push([PRICE_AT + 6, C(ox + 505, oy + Y(1330), 1.28), 'in-out-sine']);
        camKeys.push([st.start + st.dur - TRAVEL, C(ox + 540, oy + Y(1000), 1.0), 'in-out-cubic']);
      } else {
        camKeys.push([st.start, C(ox + 540, oy + Y(960), 0.9), 'in-out-sine']);
        camKeys.push([st.start + st.dur - TRAVEL, C(ox + 540, oy + Y(960), 1.0), 'in-out-cubic']);
      }
    } else if (st.kind === 'compare') {
      const ids = (st.productIds ?? []).filter((id) => products[id]).slice(0, 3);
      const n = Math.max(ids.length, 2);
      bigText(world, st, st.text, ...L(80, 220), { size: headSize(st.text, 0.82), emph: st.emph, maxWidth: 920 });
      const gap = 30;
      const cw = Math.floor(((920 - gap * (n - 1)) / n) * (ctx.compact ? 0.8 : 1));
      const pickIdx = Math.max(0, (st.pick ?? 1) - 1);
      ids.forEach((id, k) => {
        const pr = products[id];
        const cx = ox + 80 + k * ((920 - gap * (n - 1)) / n + gap) + (920 - gap * (n - 1)) / n / 2;
        const cy = oy + Y(860);
        const isPick = k === pickIdx;
        const appear = st.start + 6 + k * Math.round(K / 2);
        if (!isPick) {
          const c = s.layer(`Pembanding ${st.i}-${k}`, { x: cx, y: cy, rotation: k % 2 ? 3 : -3, shadow: { color: 'rgba(0,0,0,0.2)', blur: 24, y: 10 } });
          c.rect(-cw / 2, -cw / 2, cw, cw, { fill: '#ffffff', r: 18 });
          if (img(pr.image)) c.image(pr.image, 0, 0, { width: cw - 24, height: cw - 24, fit: 'contain', anchor: 'center', radius: 10 });
          c.key(0, { opacity: 0 }, 'hold').key(appear, { opacity: 1 });
          c.dropIn(appear, { height: 260, dur: 14 });
          s.sfx('tap', { at: appear + 10, volume: -12 });
        }
        world.text(pr.price ? fmtRp(pr.price, pr.currency) : '', cx, cy + cw / 2 + 40 * F, { font: HEAD, weight: HEAD_W, size: Math.round((n === 3 ? 70 : 84) * F), color: isPick ? ACC_TXT : INK, align: 'center', valign: 'top', fit: cw + 40, anim: { type: 'words', effect: 'rise', at: appear + 12, dur: 8 } });
        if (pr.fit) world.text(pr.fit, cx, cy + cw / 2 + (n === 3 ? 140 : 170) * F, { font: BODY, weight: 600, size: Math.round((n === 3 ? 36 : 42) * F), color: rgba(INK, 0.75), align: 'center', valign: 'top', maxWidth: cw + 40, lineHeight: 1.15, anim: { type: 'words', effect: 'fade', at: appear + 16, stagger: 2, dur: 6 } });
        if (isPick) {
          const PICK_AT = st.start + Math.round(st.dur * 0.55);
          subjectAt.push([cx - ox, cy - oy, cw / CW, 0]);
          const ring = s.layer(`Pilihan ${st.i}`, { x: cx, y: cy });
          ring.stroke(withPressure(ellipsePoints(0, 0, cw * 0.62, cw * 0.66, { start: -95, end: 260, n: 80 }), 'swell'), { brush: 'ink', size: 14, color: ACC2, reveal: [PICK_AT, 12, 'out-cubic'], seed: 7 });
          const tag = fxLayer(`Tag ${st.i}`, cx, cy - cw / 2 - 40 * F, ACC);
          tag.text(caseOf(st.label || 'Pilihan aku'), 0, 0, { font: BODY, weight: 800, size: Math.round(40 * F), color: readable(ACC), align: 'center', valign: 'middle', box: { color: ACC, padX: 22, padY: 12, radius: 12 } });
          tag.key(0, { opacity: 0 }, 'hold').key(PICK_AT + 6, { opacity: 1 });
          tag.pop(PICK_AT + 6, { from: 0, dur: 8, ease: 'out-back', fade: false });
          s.sfx('ding', { at: PICK_AT + 6, volume: -10 });
          camKeys.push([st.start, C(ox + 540, oy + Y(1000), 0.82), 'in-out-sine']);
          camKeys.push([PICK_AT - 4, C(ox + 540, oy + Y(1000), 0.95), 'in-out-cubic']);
          camKeys.push([PICK_AT + 8, C(cx, cy + 60 * F, 1.5), 'in-out-sine']);
          camKeys.push([st.start + st.dur - TRAVEL, C(cx, cy + 40 * F, 1.6), 'in-out-cubic']);
        }
      });
      if (!ids.length || pickIdx >= ids.length) {
        subjectAt.push([540, Y(900), 0.9 * F, 0]);
        camKeys.push([st.start, C(ox + 540, oy + Y(960), 0.9), 'in-out-sine']);
      }
    } else {
      let y = 520;
      if (ctx.logo) {
        const logo = s.layer('Logo', { x: ox + 540, y: oy + Y(470) });
        logo.image(ctx.logo, 0, 0, { width: 420 * F, height: 180 * F, fit: 'contain', anchor: 'center' });
        logo.key(0, { opacity: 0 }, 'hold').key(st.start + 2, { opacity: 1 });
        logo.pop(st.start + 2, { from: 0.4, dur: 10, ease: 'out-back', fade: false });
        y = 640;
      }
      bigText(world, st, st.text, ...L(540, y), { size: headSize(st.text, 1.1), align: 'center', emph: st.emph, maxWidth: 960 });
      label(world, ctx.handle, ...L(540, y + 420), { at: at + 10, align: 'center', size: 64, color: ACC_TXT });
      if (ctx.spec.disclosure) label(world, ctx.spec.disclosure, ...L(540, y + 520), { at: at + 14, align: 'center', size: 34, color: rgba(INK, 0.6) });
      subjectAt.push([540, ctx.compact ? Y(1560) : Y(1360), (ctx.compact ? 0.45 : 0.62) * F, -6]);
      camKeys.push([st.start, C(ox + 540, oy + Y(900), 1.25), 'in-out-sine']);
      camKeys.push([WIDE_AT - 6, C(ox + 540, oy + Y(920), 1.1), 'in-out-sine']);
      s.sfx('chime', { at, volume: -10 });
    }
  }

  station.forEach((st, i) => {
    const [lx, ly, sc, rot] = subjectAt[i];
    const x = st.ox + lx;
    const y = st.oy + ly;
    if (i === 0) {
      subject.key(0, { x, y, scale: sc * 0.9, rotation: rot - 6 }, 'out-back').key(st.start + 10, { x, y, scale: sc, rotation: rot });
      s.sfx('bubble', { at: st.start, volume: -10 });
      return;
    }
    const f0 = st.start - TRAVEL;
    const [px, py, psc, prot] = subjectAt[i - 1];
    const x0 = station[i - 1].ox + px;
    const y0 = station[i - 1].oy + py;
    subject.key(f0, { x: x0, rotation: prot, scale: psc }, 'in-out-sine').key(st.start + 2, { x, rotation: rot, scale: sc });
    subject.key(f0, { y: y0 }, 'out-quad').key(f0 + (TRAVEL + 2) / 2, { y: Math.min(y0, y) - Y(260) }, 'in-quad').key(st.start + 2, { y });
    card.key(st.start + 1, { scaleX: 1, scaleY: 1 }, 'out-quad').key(st.start + 3, { scaleX: 1.12, scaleY: 0.88 }, 'out-back').key(st.start + 11, { scaleX: 1, scaleY: 1 });
  });
  subject.float({ amp: 8, period: 2.4 });

  // penutup extreme wide
  const fit = Math.min(W / (worldW + 300), H / (worldH + 300));
  camKeys.push([WIDE_AT + Math.round(1.5 * K), { x: worldW / 2 - W / 2, y: worldH / 2 - H / 2 - Y(260), zoom: fit }, 'linear']);
  camKeys.push([END, { x: worldW / 2 - W / 2, y: worldH / 2 - H / 2 - Y(260), zoom: fit * 1.04 }, 'linear']);
  s.sfx('swoosh', { at: WIDE_AT, dur: 0.8, volume: -13 });
  const hud = s.layer('HUD', { fixed: true });
  if (ctx.handle) hud.text(ctx.handle, 72, Y(150), { font: BODY, weight: 700, size: Math.round(34 * F), color: rgba(INK, 0.55), valign: 'middle', show: [0, WIDE_AT] });

  camKeys.sort((a, b) => a[0] - b[0]);
  let lastF = -1;
  for (const [f, v, e] of camKeys) {
    const ff = Math.max(f, lastF + 1);
    s.camera.key(ff, v, e);
    lastF = ff;
  }
  ctx.music(p, END, BPM);
  return p;
}
