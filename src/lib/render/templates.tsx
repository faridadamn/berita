/**
 * Template slide untuk renderer (satori → JPEG 1080×1350).
 * Satu kode untuk semua: hasil render, preview di dashboard, dan thumbnail pemilih template.
 *
 * Desain: tiap template = palet + gaya judul + cara menaruh foto. Tiap jenis slide
 * (cover, isi, langkah, daftar, kode, verdict, CTA) memakai palet itu.
 * Catatan satori: <div> dengan >1 anak wajib display:flex; hanya flexbox.
 */
import type { CSSProperties, ReactNode } from "react";
import type { Slide, TemplateKey } from "../content";
import { fitScale, placeholderGradient } from "../fit";

export const W = 1080;
export const H = 1350;
const u = (n: number) => Math.round(n * 10.8);
const PAD = u(6);

type Font = "Inter" | "Anton" | "DM Serif Display";
type Theme = {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  /** warna teks di atas blok aksen */
  onAccent: string;
  /** permukaan kartu (daftar, verdict) */
  card: string;
  cardFg: string;
  codeBg: string;
  codeFg: string;
  head: { font: Font; weight: 400 | 700 | 800; upper: boolean; lh: number; align: "left" | "center"; quotes?: boolean; color?: string; size: number };
  /** cara menaruh foto di cover */
  cover: "framed" | "full" | "top" | "inset";
  radius: number;
  /** garis kolom gaya koran */
  rules?: boolean;
  /** garis aksen di bawah judul */
  underline?: boolean;
  grayscale?: boolean;
};

export const THEMES: Record<TemplateKey, Theme> = {
  stabilo: {
    bg: "#f06bb7", fg: "#0b0b0b", muted: "rgba(0,0,0,.55)", accent: "#0b0b0b", onAccent: "#f06bb7",
    card: "rgba(255,255,255,.38)", cardFg: "#0b0b0b", codeBg: "#111111", codeFg: "#f6f6f6",
    head: { font: "Anton", weight: 400, upper: true, lh: 0.95, align: "center", quotes: true, size: 9 },
    cover: "framed", radius: 2,
  },
  putih: {
    bg: "#ffffff", fg: "#111111", muted: "rgba(0,0,0,.55)", accent: "#f06bb7", onAccent: "#111111",
    card: "#f3f3ef", cardFg: "#111111", codeBg: "#16181d", codeFg: "#eef0f3",
    head: { font: "DM Serif Display", weight: 400, upper: false, lh: 1.05, align: "center", size: 7.6 },
    cover: "framed", radius: 2,
  },
  foto: {
    bg: "#0a0a0a", fg: "#ffffff", muted: "rgba(255,255,255,.7)", accent: "#ff6fb5", onAccent: "#0a0a0a",
    card: "rgba(255,255,255,.08)", cardFg: "#ffffff", codeBg: "#16161a", codeFg: "#f2f2f2",
    head: { font: "Inter", weight: 800, upper: false, lh: 1.05, align: "left", color: "#ff6fb5", size: 7.4 },
    cover: "full", radius: 2,
  },
  minimal: {
    bg: "#f4f1ea", fg: "#141414", muted: "#6b6b6b", accent: "#c6e832", onAccent: "#141414",
    card: "#ffffff", cardFg: "#141414", codeBg: "#141414", codeFg: "#e9f7b0",
    head: { font: "Inter", weight: 800, upper: false, lh: 1.08, align: "left", size: 7.2 },
    cover: "framed", radius: 1.6, underline: true,
  },
  gelap: {
    bg: "#0b1020", fg: "#e8ecf5", muted: "#8b93a7", accent: "#d6f43c", onAccent: "#0b1020",
    card: "#141b2e", cardFg: "#e8ecf5", codeBg: "#060a15", codeFg: "#b6f36b",
    head: { font: "Inter", weight: 800, upper: false, lh: 1.08, align: "left", size: 7.2 },
    cover: "inset", radius: 2,
  },
  split: {
    bg: "#ffd23f", fg: "#111111", muted: "rgba(0,0,0,.6)", accent: "#111111", onAccent: "#ffd23f",
    card: "rgba(255,255,255,.45)", cardFg: "#111111", codeBg: "#111111", codeFg: "#ffe680",
    head: { font: "Anton", weight: 400, upper: true, lh: 0.98, align: "left", size: 8.2 },
    cover: "top", radius: 0,
  },
  koran: {
    bg: "#f5f0e6", fg: "#1a1a1a", muted: "#5a5a5a", accent: "#b91c1c", onAccent: "#ffffff",
    card: "#ece5d6", cardFg: "#1a1a1a", codeBg: "#1a1a1a", codeFg: "#f5f0e6",
    head: { font: "DM Serif Display", weight: 400, upper: false, lh: 1.02, align: "left", size: 8 },
    cover: "framed", radius: 0, rules: true, grayscale: true,
  },
};

export type SlideInput = {
  template: TemplateKey;
  slide: Slide;
  index: number; // 1-based
  total: number;
  kicker: string;
  sourceName: string;
  handle: string;
  hue: number;
  /** data URI gambar slide ini (sudah diunduh), atau null */
  photo: string | null;
};

const col: CSSProperties = { display: "flex", flexDirection: "column" };
const row: CSSProperties = { display: "flex", flexDirection: "row" };

function Photo({ src, hue, style }: { src: string | null; hue: number; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", position: "relative", overflow: "hidden", backgroundImage: placeholderGradient(hue), ...style }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
    </div>
  );
}

const headText = (t: Theme, s: string) => {
  const x = t.head.upper ? s.toUpperCase() : s;
  return t.head.quotes ? `“${x}”` : x;
};

function Headline({ t, text, base, ideal, align, color }: { t: Theme; text: string; base?: number; ideal: number; align?: "left" | "center"; color?: string }) {
  const size = Math.round(u(base ?? t.head.size) * fitScale(text, ideal));
  const a = align ?? t.head.align;
  return (
    <div style={{ ...col, alignItems: a === "center" ? "center" : "flex-start" }}>
      <div
        style={{
          display: "flex",
          fontFamily: t.head.font,
          fontWeight: t.head.weight,
          fontSize: size,
          lineHeight: t.head.lh,
          color: color ?? t.head.color ?? t.fg,
          textAlign: a,
          justifyContent: a === "center" ? "center" : "flex-start",
          letterSpacing: t.head.font === "Inter" ? -1 : 0,
        }}
      >
        {headText(t, text)}
      </div>
      {t.underline ? <div style={{ display: "flex", width: u(16), height: u(1.4), backgroundColor: t.accent, marginTop: u(2.4) }} /> : null}
    </div>
  );
}

function Body({ t, text, size = 3.4, align, color }: { t: Theme; text?: string; size?: number; align?: "left" | "center"; color?: string }) {
  if (!text) return null;
  const a = align ?? t.head.align;
  return (
    <div style={{ display: "flex", fontSize: Math.round(u(size) * fitScale(text, 220, 0.75)), lineHeight: 1.4, fontWeight: 500, color: color ?? t.fg, textAlign: a, justifyContent: a === "center" ? "center" : "flex-start" }}>
      {text}
    </div>
  );
}

function Header({ t, s, dark }: { t: Theme; s: SlideInput; dark?: boolean }) {
  const c = dark ? "rgba(255,255,255,.75)" : t.muted;
  return (
    <div style={{ ...row, justifyContent: "space-between", alignItems: "center", fontSize: u(2.5), color: c, fontWeight: 500, paddingBottom: t.rules ? u(1.6) : 0, ...(t.rules ? { borderBottom: `${u(0.3)}px solid ${t.fg}` } : {}) }}>
      <div style={{ ...row, alignItems: "center", gap: u(1.4) }}>
        <div style={{ display: "flex", backgroundColor: t.accent, color: t.onAccent, padding: `${u(0.4)}px ${u(1.4)}px`, borderRadius: u(0.6), fontWeight: 700, fontSize: u(2.2), letterSpacing: 2 }}>
          {s.kicker.toUpperCase().slice(0, 18)}
        </div>
        <div>{s.handle}</div>
      </div>
      <div>{`${s.index}/${s.total}`}</div>
    </div>
  );
}

function Footer({ t, s, dark }: { t: Theme; s: SlideInput; dark?: boolean }) {
  const c = dark ? "rgba(255,255,255,.65)" : t.muted;
  return (
    <div style={{ ...row, justifyContent: "space-between", fontSize: u(2.3), color: c, fontWeight: 500, paddingTop: t.rules ? u(1.4) : 0, ...(t.rules ? { borderTop: `${u(0.15)}px solid ${t.fg}` } : {}) }}>
      <div>{s.sourceName ? `Sumber: ${s.sourceName}` : s.handle}</div>
      <div>{s.index < s.total ? "Geser ›" : s.handle}</div>
    </div>
  );
}

/** Kanvas W×H; `back` = lapisan latar penuh (foto, gradien), `children` = konten berpadding. */
function Frame({ t, back, children, bg }: { t: Theme; back?: ReactNode; children: ReactNode; bg?: string }) {
  return (
    <div style={{ display: "flex", width: W, height: H, position: "relative", overflow: "hidden", fontFamily: "Inter", backgroundColor: bg ?? t.bg, color: t.fg }}>
      {back}
      <div style={{ ...col, position: "absolute", top: PAD, left: PAD, width: W - 2 * PAD, height: H - 2 * PAD }}>{children}</div>
    </div>
  );
}

const fullPhoto = (s: SlideInput) => [
  <Photo key="p" src={s.photo} hue={s.hue} style={{ position: "absolute", top: 0, left: 0, width: W, height: H }} />,
  <div key="g" style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: "linear-gradient(to top, rgba(0,0,0,.96) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.05) 100%)" }} />,
];

/* ───────────── Cover ───────────── */

function Cover(t: Theme, s: SlideInput) {
  const { slide } = s;
  if (t.cover === "full") {
    return (
      <Frame t={t} back={fullPhoto(s)}>
        <Header t={t} s={s} dark />
        <div style={{ ...col, marginTop: "auto", gap: u(2.6) }}>
          <Headline t={t} text={slide.headline} ideal={50} />
          <Body t={t} text={slide.body} color="rgba(255,255,255,.85)" />
          <Footer t={t} s={s} dark />
        </div>
      </Frame>
    );
  }
  if (t.cover === "top") {
    const ph = Math.round(H * 0.5);
    return (
      <Frame
        t={t}
        back={[
          <Photo key="p" src={s.photo} hue={s.hue} style={{ position: "absolute", top: 0, left: 0, width: W, height: ph }} />,
          <div key="b" style={{ display: "flex", position: "absolute", top: ph, left: 0, width: W, height: u(1.2), backgroundColor: t.fg }} />,
        ]}
      >
        <div style={{ ...col, height: ph - PAD + u(2), justifyContent: "flex-start" }}>
          <div style={{ ...row, justifyContent: "space-between" }}>
            <div style={{ display: "flex", backgroundColor: t.bg, color: t.fg, padding: `${u(0.6)}px ${u(1.6)}px`, fontWeight: 800, fontSize: u(2.3), letterSpacing: 2 }}>
              {s.kicker.toUpperCase()}
            </div>
            <div style={{ display: "flex", backgroundColor: t.bg, color: t.fg, padding: `${u(0.6)}px ${u(1.6)}px`, fontWeight: 700, fontSize: u(2.3) }}>{`${s.index}/${s.total}`}</div>
          </div>
        </div>
        <div style={{ ...col, flexGrow: 1, justifyContent: "center", gap: u(2.4), paddingTop: u(3) }}>
          <Headline t={t} text={slide.headline} ideal={44} />
          <Body t={t} text={slide.body} />
        </div>
        <Footer t={t} s={s} />
      </Frame>
    );
  }
  if (t.cover === "inset") {
    return (
      <Frame t={t}>
        <Header t={t} s={s} />
        <div style={{ ...col, marginTop: u(5), gap: u(2.6) }}>
          <Headline t={t} text={slide.headline} ideal={50} />
          <Body t={t} text={slide.body} color={t.muted} />
        </div>
        <Photo
          src={s.photo}
          hue={s.hue}
          style={{ marginTop: u(4), flexGrow: 1, borderRadius: u(t.radius), border: `${u(0.35)}px solid ${t.accent}`, boxShadow: `0 0 ${u(5)}px rgba(214,244,60,.25)` }}
        />
        <div style={{ ...col, marginTop: u(3) }}>
          <Footer t={t} s={s} />
        </div>
      </Frame>
    );
  }
  // framed (stabilo / putih / minimal / koran)
  const center = t.head.align === "center";
  return (
    <Frame t={t}>
      <Header t={t} s={s} />
      <div style={{ ...col, marginTop: u(t.rules ? 3 : 4), gap: u(2.2) }}>
        <Headline t={t} text={slide.headline} ideal={center ? 42 : 52} />
        <Body t={t} text={slide.body} color={t.muted} size={3.1} />
      </div>
      <Photo
        src={s.photo}
        hue={s.hue}
        style={{ marginTop: u(3.6), flexGrow: 1, borderRadius: u(t.radius), ...(t.head.quotes ? { boxShadow: "0 20px 40px rgba(0,0,0,.25)" } : {}) }}
      />
      <div style={{ ...col, marginTop: u(3) }}>
        <Footer t={t} s={s} />
      </div>
    </Frame>
  );
}

/* ───────────── Isi (dengan/tanpa gambar) ───────────── */

function BodySlide(t: Theme, s: SlideInput) {
  const { slide } = s;
  if (s.photo && t.cover === "full") {
    return (
      <Frame t={t} back={fullPhoto(s)}>
        <Header t={t} s={s} dark />
        <div style={{ ...col, marginTop: "auto", gap: u(2.4) }}>
          <Headline t={t} text={slide.headline} base={6} ideal={40} />
          <Body t={t} text={slide.body} color="rgba(255,255,255,.88)" size={3.6} />
          <Footer t={t} s={s} dark />
        </div>
      </Frame>
    );
  }
  if (s.photo) {
    return (
      <Frame t={t}>
        <Header t={t} s={s} />
        <div style={{ ...col, marginTop: u(4), gap: u(2.2) }}>
          <Headline t={t} text={slide.headline} base={6} ideal={40} />
          <Body t={t} text={slide.body} size={3.3} />
        </div>
        <Photo src={s.photo} hue={s.hue} style={{ marginTop: u(3.4), flexGrow: 1, borderRadius: u(t.radius) }} />
        <div style={{ ...col, marginTop: u(3) }}>
          <Footer t={t} s={s} />
        </div>
      </Frame>
    );
  }
  // tanpa gambar: teks besar di tengah
  return (
    <Frame t={t}>
      <Header t={t} s={s} />
      <div style={{ ...col, flexGrow: 1, justifyContent: "center", gap: u(3.4) }}>
        <Headline t={t} text={slide.headline} base={7} ideal={36} />
        <Body t={t} text={slide.body} size={4.2} />
      </div>
      <Footer t={t} s={s} />
    </Frame>
  );
}

/* ───────────── Langkah (tutorial) ───────────── */

function StepSlide(t: Theme, s: SlideInput) {
  const { slide } = s;
  const n = slide.step ?? s.index - 1;
  const badge = (
    <div style={{ ...row, alignItems: "center", gap: u(2.4) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: u(13), height: u(13), borderRadius: u(t.radius > 0 ? 2.4 : 0), backgroundColor: t.accent, color: t.onAccent, fontFamily: "Anton", fontSize: u(8) }}>
        {String(n)}
      </div>
      <div style={{ display: "flex", fontSize: u(2.6), fontWeight: 800, letterSpacing: 4, color: t.muted }}>{`${(slide.label || "LANGKAH").toUpperCase().slice(0, 14)} ${n}`}</div>
    </div>
  );
  if (!s.photo) {
    // tanpa gambar: isi di tengah, teks lebih besar
    return (
      <Frame t={t}>
        <Header t={t} s={s} />
        <div style={{ ...col, flexGrow: 1, justifyContent: "center", gap: u(3.2) }}>
          {badge}
          <Headline t={t} text={slide.headline} base={slide.code ? 6.6 : 7.4} ideal={34} align="left" />
          <Body t={t} text={slide.body} size={slide.code ? 3.6 : 4.2} align="left" />
          {slide.code ? <CodeBox t={t} code={slide.code} lang={slide.lang} /> : null}
        </div>
        <Footer t={t} s={s} />
      </Frame>
    );
  }
  return (
    <Frame t={t}>
      <Header t={t} s={s} />
      <div style={{ ...col, marginTop: u(5), gap: u(3) }}>
        {badge}
        <Headline t={t} text={slide.headline} base={6.2} ideal={36} align="left" />
        <Body t={t} text={slide.body} size={3.5} align="left" />
      </div>
      {slide.code ? <CodeBox t={t} code={slide.code} lang={slide.lang} /> : null}
      <Photo src={s.photo} hue={s.hue} style={{ marginTop: u(3.4), flexGrow: 1, borderRadius: u(t.radius) }} />
      <div style={{ ...col, marginTop: u(3) }}>
        <Footer t={t} s={s} />
      </div>
    </Frame>
  );
}

/* ───────────── Kode ───────────── */

function CodeBox({ t, code, lang, grow }: { t: Theme; code: string; lang?: string; grow?: boolean }) {
  const lines = code.replace(/\t/g, "  ").split("\n").slice(0, 18);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const fs = Math.max(u(2.1), Math.min(u(3.3), Math.floor((W - 2 * PAD - u(8)) / (longest * 0.62))));
  return (
    <div style={{ ...col, marginTop: u(3.4), flexGrow: grow ? 1 : 0, backgroundColor: t.codeBg, borderRadius: u(Math.max(1.2, t.radius)), padding: u(3), gap: u(1.6), overflow: "hidden" }}>
      <div style={{ ...row, alignItems: "center", gap: u(1) }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ display: "flex", width: u(1.6), height: u(1.6), borderRadius: 999, backgroundColor: c }} />
        ))}
        {lang ? <div style={{ display: "flex", marginLeft: u(1.6), fontFamily: "JetBrains Mono", fontSize: u(2), color: "rgba(255,255,255,.5)" }}>{lang}</div> : null}
      </div>
      <div style={{ ...col, fontFamily: "JetBrains Mono", fontSize: fs, lineHeight: 1.45, color: t.codeFg }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", whiteSpace: "pre", minHeight: fs * 1.45 }}>
            {l.slice(0, 64) || " "}
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeSlide(t: Theme, s: SlideInput) {
  const { slide } = s;
  return (
    <Frame t={t}>
      <Header t={t} s={s} />
      <div style={{ ...col, marginTop: u(4.4), gap: u(2.2) }}>
        <Headline t={t} text={slide.headline} base={6} ideal={36} align="left" />
      </div>
      <div style={{ ...col, flexGrow: 1, justifyContent: "center" }}>
        <CodeBox t={t} code={slide.code || "# (kosong)"} lang={slide.lang} />
        {slide.body ? (
          <div style={{ ...col, marginTop: u(3) }}>
            <Body t={t} text={slide.body} size={3.2} align="left" color={t.muted} />
          </div>
        ) : null}
      </div>
      <div style={{ ...col, marginTop: u(3) }}>
        <Footer t={t} s={s} />
      </div>
    </Frame>
  );
}

/* ───────────── Daftar ───────────── */

function ListSlide(t: Theme, s: SlideInput) {
  const { slide } = s;
  const items = (slide.items ?? []).filter(Boolean).slice(0, 6);
  const fs = items.length > 4 ? 3.2 : 3.6;
  return (
    <Frame t={t}>
      <Header t={t} s={s} />
      <div style={{ ...col, marginTop: u(4.4), gap: u(2) }}>
        <Headline t={t} text={slide.headline} base={6.2} ideal={34} align="left" />
        <Body t={t} text={slide.body} size={3} align="left" color={t.muted} />
      </div>
      <div style={{ ...col, flexGrow: 1, justifyContent: "center", gap: u(1.8), marginTop: u(3) }}>
        {items.map((it, i) => (
          <div key={i} style={{ ...row, alignItems: "center", gap: u(2.4), backgroundColor: t.card, color: t.cardFg, borderRadius: u(Math.max(1, t.radius)), padding: `${u(2.2)}px ${u(2.6)}px` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: u(6), height: u(6), flexShrink: 0, borderRadius: 999, backgroundColor: t.accent, color: t.onAccent, fontWeight: 800, fontSize: u(3) }}>
              {String(i + 1)}
            </div>
            <div style={{ display: "flex", fontSize: Math.round(u(fs) * fitScale(it, 70, 0.75)), fontWeight: 600, lineHeight: 1.3 }}>{it}</div>
          </div>
        ))}
      </div>
      <div style={{ ...col, marginTop: u(3) }}>
        <Footer t={t} s={s} />
      </div>
    </Frame>
  );
}

/* ───────────── Verdict (review) ───────────── */

function VerdictSlide(t: Theme, s: SlideInput) {
  const { slide } = s;
  const pros = (slide.items ?? []).filter(Boolean).slice(0, 4);
  const cons = (slide.cons ?? []).filter(Boolean).slice(0, 3);
  const rating = typeof slide.rating === "number" ? Math.max(0, Math.min(10, slide.rating)) : null;
  const Item = ({ text, plus }: { text: string; plus: boolean }) => (
    <div style={{ ...row, alignItems: "flex-start", gap: u(1.8) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: u(4.2), height: u(4.2), flexShrink: 0, borderRadius: 999, backgroundColor: plus ? "#16a34a" : "#dc2626", color: "#fff", fontWeight: 800, fontSize: u(3), lineHeight: 1 }}>
        {plus ? "+" : "–"}
      </div>
      <div style={{ display: "flex", fontSize: Math.round(u(3) * fitScale(text, 60, 0.8)), fontWeight: 600, lineHeight: 1.3 }}>{text}</div>
    </div>
  );
  return (
    <Frame t={t}>
      <Header t={t} s={s} />
      <div style={{ ...row, marginTop: u(4.4), alignItems: "center", gap: u(3) }}>
        <div style={{ ...col, flexGrow: 1, flexShrink: 1 }}>
          <Headline t={t} text={slide.headline} base={6} ideal={30} align="left" />
        </div>
        {rating !== null ? (
          <div style={{ ...col, alignItems: "center", justifyContent: "center", width: u(22), height: u(22), flexShrink: 0, borderRadius: 999, backgroundColor: t.accent, color: t.onAccent }}>
            <div style={{ display: "flex", fontFamily: "Anton", fontSize: u(10), lineHeight: 1 }}>{rating % 1 ? rating.toFixed(1) : String(rating)}</div>
            <div style={{ display: "flex", fontSize: u(2.4), fontWeight: 800 }}>/ 10</div>
          </div>
        ) : null}
      </div>
      <div style={{ ...col, flexGrow: 1, justifyContent: "center", gap: u(2.4), marginTop: u(3) }}>
        {pros.length ? (
          <div style={{ ...col, gap: u(1.6), backgroundColor: t.card, color: t.cardFg, borderRadius: u(Math.max(1, t.radius)), padding: u(3) }}>
            <div style={{ display: "flex", fontSize: u(2.4), fontWeight: 800, letterSpacing: 3, opacity: 0.7 }}>KELEBIHAN</div>
            {pros.map((p, i) => <Item key={i} text={p} plus />)}
          </div>
        ) : null}
        {cons.length ? (
          <div style={{ ...col, gap: u(1.6), backgroundColor: t.card, color: t.cardFg, borderRadius: u(Math.max(1, t.radius)), padding: u(3) }}>
            <div style={{ display: "flex", fontSize: u(2.4), fontWeight: 800, letterSpacing: 3, opacity: 0.7 }}>KEKURANGAN</div>
            {cons.map((p, i) => <Item key={i} text={p} plus={false} />)}
          </div>
        ) : null}
        {slide.body ? <Body t={t} text={slide.body} size={3.1} align="left" /> : null}
      </div>
      <div style={{ ...col, marginTop: u(3) }}>
        <Footer t={t} s={s} />
      </div>
    </Frame>
  );
}

/* ───────────── CTA ───────────── */

function CtaSlide(t: Theme, s: SlideInput) {
  const { slide } = s;
  const dark = t.cover === "full";
  return (
    <Frame t={t} bg={dark ? "#0a0a0a" : undefined}>
      <Header t={t} s={s} dark={dark} />
      <div style={{ ...col, flexGrow: 1, justifyContent: "center", gap: u(3.2) }}>
        <div style={{ display: "flex", width: u(12), height: u(1.4), backgroundColor: t.accent }} />
        <div style={{ display: "flex", fontFamily: t.head.font === "DM Serif Display" ? "DM Serif Display" : "Anton", fontSize: Math.round(u(10) * fitScale(slide.headline, 28)), lineHeight: 0.98, color: dark ? "#d6f43c" : t.fg }}>
          {t.head.font === "DM Serif Display" ? slide.headline : slide.headline.toUpperCase()}
        </div>
        <Body t={t} text={slide.body} size={3.6} align="left" color={dark ? "rgba(255,255,255,.85)" : t.fg} />
      </div>
      <div style={{ ...row, justifyContent: "space-between", alignItems: "center", fontSize: u(2.6), fontWeight: 700, color: dark ? "#fff" : t.fg }}>
        <div>{s.handle}</div>
        <div style={{ display: "flex", color: dark ? "rgba(255,255,255,.6)" : t.muted, fontWeight: 500, fontSize: u(2.3) }}>{s.sourceName ? `Sumber: ${s.sourceName}` : ""}</div>
      </div>
    </Frame>
  );
}

export function SlideImage(s: SlideInput) {
  const t = THEMES[s.template] ?? THEMES.stabilo;
  switch (s.slide.kind) {
    case "cover":
      return Cover(t, s);
    case "step":
      return StepSlide(t, s);
    case "list":
      return ListSlide(t, s);
    case "code":
      return CodeSlide(t, s);
    case "verdict":
      return VerdictSlide(t, s);
    case "cta":
      return CtaSlide(t, s);
    default:
      return BodySlide(t, s);
  }
}
