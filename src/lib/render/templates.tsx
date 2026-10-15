/**
 * Template slide untuk renderer (satori → JPEG 1080×1350).
 * Satu kode untuk semua: hasil render, preview di dashboard, dan thumbnail pemilih template.
 *
 * Desain: tiap template = palet + gaya judul + cara menaruh foto. Tiap jenis slide
 * (cover, isi, langkah, daftar, kode, verdict, CTA) memakai palet itu.
 * Catatan satori: <div> dengan >1 anak wajib display:flex; hanya flexbox.
 */
import type { CSSProperties, ReactNode } from "react";
import { discountOf, formatCount, formatPrice, platformOf, type ProductView, type Slide, type TemplateKey } from "../content";
import { FONT_CHOICES, fontFamilyOf, readableOn, rgba, luminance, type BrandKit } from "../brand";
import { fitScale, placeholderGradient } from "../fit";

export const W = 1080;
export const H = 1350;
const u = (n: number) => Math.round(n * 10.8);
const PAD = u(6);

export type Theme = {
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
  head: { font: string; weight: 400 | 500 | 700 | 800; upper: boolean; lh: number; align: "left" | "center"; quotes?: boolean; color?: string; size: number; tight?: boolean };
  /** font teks isi */
  body: string;
  /** font angka besar (nomor langkah, rating) */
  num: string;
  numWeight?: 400 | 700 | 800;
  /** font & kapital judul CTA */
  cta: { font: string; upper: boolean; weight?: 400 | 700 | 800 };
  /** warna judul CTA di latar gelap (template foto) */
  ctaHi?: string;
  underlineColor?: string;
  /** cara menaruh foto di cover */
  cover: "framed" | "full" | "top" | "inset";
  radius: number;
  /** garis kolom gaya koran */
  rules?: boolean;
  /** garis aksen di bawah judul */
  underline?: boolean;
  grayscale?: boolean;
};

export const THEMES: Record<Exclude<TemplateKey, "brand">, Theme> = {
  stabilo: {
    bg: "#f06bb7", fg: "#0b0b0b", muted: "rgba(0,0,0,.55)", accent: "#0b0b0b", onAccent: "#f06bb7",
    card: "rgba(255,255,255,.38)", cardFg: "#0b0b0b", codeBg: "#111111", codeFg: "#f6f6f6",
    head: { font: "Anton", weight: 400, upper: true, lh: 0.95, align: "center", quotes: true, size: 9 },
    cover: "framed", radius: 2,
    body: "Inter", num: "Anton", cta: { font: "Anton", upper: true },
  },
  putih: {
    bg: "#ffffff", fg: "#111111", muted: "rgba(0,0,0,.55)", accent: "#f06bb7", onAccent: "#111111",
    card: "#f3f3ef", cardFg: "#111111", codeBg: "#16181d", codeFg: "#eef0f3",
    head: { font: "DM Serif Display", weight: 400, upper: false, lh: 1.05, align: "center", size: 7.6 },
    cover: "framed", radius: 2,
    body: "Inter", num: "Anton", cta: { font: "DM Serif Display", upper: false },
  },
  foto: {
    bg: "#0a0a0a", fg: "#ffffff", muted: "rgba(255,255,255,.7)", accent: "#ff6fb5", onAccent: "#0a0a0a",
    card: "rgba(255,255,255,.08)", cardFg: "#ffffff", codeBg: "#16161a", codeFg: "#f2f2f2",
    head: { font: "Inter", weight: 800, upper: false, lh: 1.05, align: "left", color: "#ff6fb5", size: 7.4, tight: true },
    cover: "full", radius: 2,
    body: "Inter", num: "Anton", cta: { font: "Anton", upper: true }, ctaHi: "#d6f43c",
  },
  minimal: {
    bg: "#f4f1ea", fg: "#141414", muted: "#6b6b6b", accent: "#c6e832", onAccent: "#141414",
    card: "#ffffff", cardFg: "#141414", codeBg: "#141414", codeFg: "#e9f7b0",
    head: { font: "Inter", weight: 800, upper: false, lh: 1.08, align: "left", size: 7.2, tight: true },
    cover: "framed", radius: 1.6, underline: true,
    body: "Inter", num: "Anton", cta: { font: "Anton", upper: true },
  },
  gelap: {
    bg: "#0b1020", fg: "#e8ecf5", muted: "#8b93a7", accent: "#d6f43c", onAccent: "#0b1020",
    card: "#141b2e", cardFg: "#e8ecf5", codeBg: "#060a15", codeFg: "#b6f36b",
    head: { font: "Inter", weight: 800, upper: false, lh: 1.08, align: "left", size: 7.2, tight: true },
    cover: "inset", radius: 2,
    body: "Inter", num: "Anton", cta: { font: "Anton", upper: true },
  },
  split: {
    bg: "#ffd23f", fg: "#111111", muted: "rgba(0,0,0,.6)", accent: "#111111", onAccent: "#ffd23f",
    card: "rgba(255,255,255,.45)", cardFg: "#111111", codeBg: "#111111", codeFg: "#ffe680",
    head: { font: "Anton", weight: 400, upper: true, lh: 0.98, align: "left", size: 8.2 },
    cover: "top", radius: 0,
    body: "Inter", num: "Anton", cta: { font: "Anton", upper: true },
  },
  koran: {
    bg: "#f5f0e6", fg: "#1a1a1a", muted: "#5a5a5a", accent: "#b91c1c", onAccent: "#ffffff",
    card: "#ece5d6", cardFg: "#1a1a1a", codeBg: "#1a1a1a", codeFg: "#f5f0e6",
    head: { font: "DM Serif Display", weight: 400, upper: false, lh: 1.02, align: "left", size: 8 },
    cover: "framed", radius: 0, rules: true, grayscale: true,
    body: "Inter", num: "Anton", cta: { font: "DM Serif Display", upper: false },
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
  /** tema hasil themeFor(); default THEMES[template] */
  theme?: Theme;
  /** logo brand (sudah diunduh) — tampil kalau ada */
  logo?: Logo | null;
  logoPlacement?: BrandKit["logoPlacement"];
  bullet?: BrandKit["bullet"];
  /** produk untuk slide product/compare (foto sudah berupa data URI) */
  products?: Record<number, ProductView>;
};

export type Logo = { src: string; w: number; h: number };

const weightOf = (key: string): 400 | 700 | 800 => {
  const w = FONT_CHOICES.find((f) => f.key === key)?.weights ?? [400];
  return w.includes(800) ? 800 : w.includes(700) ? 700 : 400;
};
const styleOf = (key: string) => FONT_CHOICES.find((f) => f.key === key)?.style ?? "sans";

/** Tema template "brand" dibangun dari Brand Kit. */
export function brandTheme(k: BrandKit): Theme {
  const c = k.colors;
  const dark = luminance(c.background) < 0.3;
  const hs = styleOf(k.headFont);
  const head = fontFamilyOf(k.headFont);
  const hw = k.headFont.startsWith("custom:") ? 700 : weightOf(k.headFont);
  return {
    bg: c.background, fg: c.text, muted: rgba(c.text, 0.62), accent: c.primary, onAccent: readableOn(c.primary),
    card: rgba(c.text, dark ? 0.08 : 0.06), cardFg: c.text,
    codeBg: dark ? "#07090c" : "#16181d", codeFg: "#eef0f3",
    head: { font: head, weight: hw, upper: k.headUpper || hs === "display", lh: hs === "display" ? 0.98 : 1.06, align: "left", size: hs === "display" ? 8.6 : 7.3, tight: hs === "sans" && hw >= 700 },
    body: fontFamilyOf(k.bodyFont), num: head, numWeight: hw,
    cta: { font: head, upper: k.headUpper || hs === "display", weight: hw },
    cover: k.cover, radius: k.radius, underline: true, underlineColor: c.secondary,
  };
}

/** Tema efektif: template + override Brand Kit (font/aksen) kalau diaktifkan. */
export function themeFor(template: TemplateKey, kit?: BrandKit | null): Theme {
  if (template === "brand") return kit ? brandTheme(kit) : THEMES.gelap;
  let t: Theme = THEMES[template] ?? THEMES.stabilo;
  if (!kit) return t;
  if (kit.applyFontsAll) {
    const hs = styleOf(kit.headFont);
    const hw = kit.headFont.startsWith("custom:") ? 700 : weightOf(kit.headFont);
    const head = fontFamilyOf(kit.headFont);
    t = {
      ...t,
      head: { ...t.head, font: head, weight: hw, upper: t.head.upper || hs === "display", tight: hs === "sans" && hw >= 700 },
      body: fontFamilyOf(kit.bodyFont),
      cta: { font: head, upper: t.head.upper || hs === "display", weight: hw },
    };
  }
  if (kit.applyAccentAll) {
    // jangan pakai aksen yang sama dengan latar (tidak terlihat)
    const same = Math.abs(luminance(kit.colors.primary) - luminance(t.bg)) < 0.08;
    const accent = same ? kit.colors.secondary : kit.colors.primary;
    t = { ...t, accent, onAccent: readableOn(accent), head: { ...t.head, color: t.head.color ? accent : undefined } };
  }
  return t;
}

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
          letterSpacing: t.head.tight ? -1 : 0,
        }}
      >
        {headText(t, text)}
      </div>
      {t.underline ? <div style={{ display: "flex", width: u(16), height: u(1.4), backgroundColor: t.underlineColor ?? t.accent, marginTop: u(2.4) }} /> : null}
    </div>
  );
}

function Body({ t, text, size = 3.4, align, color }: { t: Theme; text?: string; size?: number; align?: "left" | "center"; color?: string }) {
  if (!text) return null;
  const a = align ?? t.head.align;
  return (
    <div style={{ display: "flex", fontFamily: t.body, fontSize: Math.round(u(size) * fitScale(text, 220, 0.75)), lineHeight: 1.4, fontWeight: 500, color: color ?? t.fg, textAlign: a, justifyContent: a === "center" ? "center" : "flex-start" }}>
      {text}
    </div>
  );
}

function LogoImg({ logo, h }: { logo: Logo; h: number }) {
  const w = Math.min(u(30), Math.round((logo.w / logo.h) * h));
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo.src} alt="" width={w} height={Math.round((w / logo.w) * logo.h)} style={{ objectFit: "contain" }} />;
}

function Header({ t, s, dark }: { t: Theme; s: SlideInput; dark?: boolean }) {
  const c = dark ? "rgba(255,255,255,.75)" : t.muted;
  const logo = s.logo && s.logoPlacement === "header" ? s.logo : null;
  return (
    <div style={{ ...row, justifyContent: "space-between", alignItems: "center", fontSize: u(2.5), color: c, fontWeight: 500, paddingBottom: t.rules ? u(1.6) : 0, ...(t.rules ? { borderBottom: `${u(0.3)}px solid ${t.fg}` } : {}) }}>
      <div style={{ ...row, alignItems: "center", gap: u(1.4) }}>
        <div style={{ display: "flex", backgroundColor: t.accent, color: t.onAccent, padding: `${u(0.4)}px ${u(1.4)}px`, borderRadius: u(0.6), fontWeight: 700, fontSize: u(2.2), letterSpacing: 2 }}>
          {s.kicker.toUpperCase().slice(0, 18)}
        </div>
        {logo ? <LogoImg logo={logo} h={u(4.4)} /> : <div>{s.handle}</div>}
      </div>
      <div>{`${s.index}/${s.total}`}</div>
    </div>
  );
}

function Footer({ t, s, dark }: { t: Theme; s: SlideInput; dark?: boolean }) {
  const c = dark ? "rgba(255,255,255,.65)" : t.muted;
  const logo = s.logo && s.logoPlacement === "footer" ? s.logo : null;
  return (
    <div style={{ ...row, justifyContent: "space-between", alignItems: "center", fontSize: u(2.3), color: c, fontWeight: 500, paddingTop: t.rules ? u(1.4) : 0, ...(t.rules ? { borderTop: `${u(0.15)}px solid ${t.fg}` } : {}) }}>
      <div style={{ ...row, alignItems: "center", gap: u(1.6) }}>
        {logo ? <LogoImg logo={logo} h={u(3.6)} /> : null}
        <div>{s.sourceName ? `Sumber: ${s.sourceName}` : logo ? "" : s.handle}</div>
      </div>
      <div>{s.index < s.total ? "Geser ›" : s.handle}</div>
    </div>
  );
}

/** Kanvas W×H; `back` = lapisan latar penuh (foto, gradien), `children` = konten berpadding. */
function Frame({ t, back, children, bg }: { t: Theme; back?: ReactNode; children: ReactNode; bg?: string }) {
  return (
    <div style={{ display: "flex", width: W, height: H, position: "relative", overflow: "hidden", fontFamily: t.body, backgroundColor: bg ?? t.bg, color: t.fg }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: u(13), height: u(13), borderRadius: u(t.radius > 0 ? 2.4 : 0), backgroundColor: t.accent, color: t.onAccent, fontFamily: t.num, fontWeight: t.numWeight ?? 400, fontSize: u(t.numWeight ? 7 : 8) }}>
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
            <Bullet t={t} kind={s.bullet ?? "angka"} n={i + 1} />
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

function Bullet({ t, kind, n }: { t: Theme; kind: NonNullable<SlideInput["bullet"]>; n: number }) {
  const box: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  if (kind === "titik") return <div style={{ ...box, width: u(2.4), height: u(2.4), margin: `0 ${u(1.8)}px`, borderRadius: 999, backgroundColor: t.accent }} />;
  if (kind === "panah")
    return <div style={{ ...box, width: u(6), height: u(6), color: t.accent, fontWeight: 800, fontSize: u(6), lineHeight: 1, marginTop: -u(0.8) }}>›</div>;
  if (kind === "centang")
    return (
      <div style={{ ...box, width: u(6), height: u(6), borderRadius: u(Math.min(t.radius, 1.4)), backgroundColor: t.accent }}>
        <div style={{ display: "flex", width: u(1.6), height: u(3), marginTop: -u(0.6), borderRight: `${u(0.7)}px solid ${t.onAccent}`, borderBottom: `${u(0.7)}px solid ${t.onAccent}`, transform: "rotate(45deg)" }} />
      </div>
    );
  return (
    <div style={{ ...box, width: u(6), height: u(6), borderRadius: 999, backgroundColor: t.accent, color: t.onAccent, fontWeight: 800, fontSize: u(3) }}>{String(n)}</div>
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
            <div style={{ display: "flex", fontFamily: t.num, fontWeight: t.numWeight ?? 400, fontSize: u(t.numWeight ? 8.6 : 10), lineHeight: 1 }}>{rating % 1 ? rating.toFixed(1) : String(rating)}</div>
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
        <div style={{ display: "flex", fontFamily: t.cta.font, fontWeight: t.cta.weight ?? 400, letterSpacing: t.cta.weight && !t.cta.upper ? -1 : 0, fontSize: Math.round(u(t.cta.weight && !t.cta.upper ? 8.4 : 10) * fitScale(slide.headline, 28)), lineHeight: t.cta.weight ? 1.02 : 0.98, color: dark ? (t.ctaHi ?? t.accent) : t.fg }}>
          {t.cta.upper ? slide.headline.toUpperCase() : slide.headline}
        </div>
        <Body t={t} text={slide.body} size={3.6} align="left" color={dark ? "rgba(255,255,255,.85)" : t.fg} />
      </div>
      <div style={{ ...row, justifyContent: "space-between", alignItems: "center", fontSize: u(2.6), fontWeight: 700, color: dark ? "#fff" : t.fg }}>
        <div style={{ ...row, alignItems: "center", gap: u(1.8) }}>
          {s.logo && s.logoPlacement !== "none" ? <LogoImg logo={s.logo} h={u(5)} /> : null}
          <div>{s.handle}</div>
        </div>
        <div style={{ display: "flex", color: dark ? "rgba(255,255,255,.6)" : t.muted, fontWeight: 500, fontSize: u(2.3) }}>{s.sourceName ? `Sumber: ${s.sourceName}` : ""}</div>
      </div>
    </Frame>
  );
}

/* ───────────── Produk (mode jualan) ───────────── */

function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#f5b301" />
    </svg>
  );
}

function ProductPhoto({ src, hue, style, children }: { src: string | null; hue: number; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", position: "relative", overflow: "hidden", backgroundColor: "#ffffff", ...(src ? {} : { backgroundImage: placeholderGradient(hue) }), ...style }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" }} />
      ) : null}
      {children}
    </div>
  );
}

function Chip({ text, bg, fg, size = 2.3 }: { text: string; bg: string; fg: string; size?: number }) {
  return (
    <div style={{ display: "flex", backgroundColor: bg, color: fg, padding: `${u(0.5)}px ${u(1.4)}px`, borderRadius: u(0.7), fontWeight: 800, fontSize: u(size), letterSpacing: 1 }}>{text}</div>
  );
}

function Meta({ t, p, size = 2.6, color }: { t: Theme; p: ProductView; size?: number; color?: string }) {
  const bits: ReactNode[] = [];
  if (p.rating != null)
    bits.push(
      <div key="r" style={{ ...row, alignItems: "center", gap: u(0.6) }}>
        <Star size={u(size * 1.1)} />
        <div>{p.rating.toFixed(1)}</div>
      </div>,
    );
  if (p.sold) bits.push(<div key="s">{`${formatCount(p.sold)}+ terjual`}</div>);
  if (!bits.length) return null;
  return <div style={{ ...row, alignItems: "center", gap: u(2), fontSize: u(size), fontWeight: 600, color: color ?? t.muted }}>{bits}</div>;
}

function Price({ t, p, size = 7 }: { t: Theme; p: ProductView; size?: number }) {
  if (p.price == null) return null;
  const disc = discountOf(p.price, p.originalPrice);
  return (
    <div style={{ ...row, alignItems: "flex-end", gap: u(1.8), flexWrap: "wrap" }}>
      <div style={{ display: "flex", fontFamily: t.num, fontWeight: t.numWeight ?? 400, fontSize: u(size), lineHeight: 1, color: t.fg }}>{formatPrice(p.price, p.currency)}</div>
      {disc ? (
        <div style={{ display: "flex", fontSize: u(size * 0.42), color: t.muted, textDecoration: "line-through", marginBottom: u(0.4) }}>{formatPrice(p.originalPrice, p.currency)}</div>
      ) : null}
    </div>
  );
}

const missing = (t: Theme, s: SlideInput, what: string) => (
  <Frame t={t}>
    <Header t={t} s={s} />
    <div style={{ ...col, flexGrow: 1, justifyContent: "center", gap: u(2) }}>
      <Headline t={t} text={s.slide.headline || "Produk"} base={6} ideal={36} align="left" />
      <Body t={t} text={what} size={3} align="left" color={t.muted} />
    </div>
    <Footer t={t} s={s} />
  </Frame>
);

function ProductSlide(t: Theme, s: SlideInput) {
  const { slide } = s;
  const p = slide.productId ? s.products?.[slide.productId] : undefined;
  if (!p) return missing(t, s, "Pilih produk dari katalog untuk slide ini.");
  const disc = discountOf(p.price, p.originalPrice);
  const plat = platformOf(p.platform);
  return (
    <Frame t={t}>
      <Header t={t} s={s} />
      <div style={{ ...col, marginTop: u(3.4), gap: u(1.6) }}>
        <Headline t={t} text={slide.headline} base={5.6} ideal={34} align="left" />
      </div>
      <ProductPhoto src={s.photo} hue={s.hue} style={{ marginTop: u(3), flexGrow: 1, borderRadius: u(Math.max(1.2, t.radius)) }}>
        <div style={{ ...row, position: "absolute", top: u(2), left: u(2), right: u(2), justifyContent: "space-between" }}>
          {disc ? <Chip text={`-${disc}%`} bg="#e11d48" fg="#ffffff" size={3} /> : <div style={{ display: "flex" }} />}
          {slide.step ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: u(8), height: u(8), borderRadius: 999, backgroundColor: t.accent, color: t.onAccent, fontFamily: t.num, fontWeight: t.numWeight ?? 400, fontSize: u(4.6) }}>
              {String(slide.step)}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", position: "absolute", bottom: u(2), left: u(2) }}>
          <Chip text={plat.label} bg={plat.color} fg="#ffffff" />
        </div>
      </ProductPhoto>
      <div style={{ ...col, marginTop: u(2.8), gap: u(1.4) }}>
        <div style={{ display: "flex", fontSize: Math.round(u(2.9) * fitScale(p.name, 60, 0.8)), fontWeight: 600, color: t.muted, lineHeight: 1.3 }}>
          {p.name.length > 90 ? p.name.slice(0, 88) + "…" : p.name}
        </div>
        <div style={{ ...row, justifyContent: "space-between", alignItems: "flex-end", gap: u(2) }}>
          <Price t={t} p={p} />
          <Meta t={t} p={p} />
        </div>
        {slide.body ? <Body t={t} text={slide.body} size={2.9} align="left" /> : null}
      </div>
      <div style={{ ...col, marginTop: u(2.6) }}>
        <Footer t={t} s={s} />
      </div>
    </Frame>
  );
}

function CompareSlide(t: Theme, s: SlideInput) {
  const { slide } = s;
  const ps = (slide.productIds ?? []).map((id) => s.products?.[id]).filter((x): x is ProductView => !!x).slice(0, 3);
  if (ps.length < 2) return missing(t, s, "Perbandingan butuh minimal 2 produk dari katalog.");
  const n = ps.length;
  const gap = u(2);
  const cw = Math.floor((W - 2 * PAD - gap * (n - 1)) / n);
  const notes = slide.items ?? [];
  return (
    <Frame t={t}>
      <Header t={t} s={s} />
      <div style={{ ...col, marginTop: u(3.6) }}>
        <Headline t={t} text={slide.headline} base={5.8} ideal={34} align="left" />
      </div>
      <div style={{ ...row, flexGrow: 1, gap, marginTop: u(3.4), alignItems: "stretch" }}>
        {ps.map((p, i) => {
          const picked = slide.pick === i + 1;
          const plat = platformOf(p.platform);
          const disc = discountOf(p.price, p.originalPrice);
          return (
            <div
              key={p.id}
              style={{
                ...col, width: cw, gap: u(1.4), backgroundColor: t.card, color: t.cardFg, borderRadius: u(Math.max(1.2, t.radius)), padding: u(2), position: "relative",
                ...(picked ? { border: `${u(0.5)}px solid ${t.accent}` } : { border: `${u(0.5)}px solid transparent` }),
              }}
            >
              <ProductPhoto src={p.image} hue={(s.hue + i * 50) % 360} style={{ width: cw - u(5), height: cw - u(5), borderRadius: u(Math.max(0.8, t.radius * 0.6)) }}>
                {disc ? (
                  <div style={{ display: "flex", position: "absolute", top: u(1), left: u(1) }}>
                    <Chip text={`-${disc}%`} bg="#e11d48" fg="#ffffff" size={2} />
                  </div>
                ) : null}
              </ProductPhoto>
              {picked ? <Chip text="PILIHAN KAMI" bg={t.accent} fg={t.onAccent} size={1.9} /> : null}
              <div style={{ display: "flex", fontSize: u(n === 3 ? 2.3 : 2.7), fontWeight: 700, lineHeight: 1.25 }}>{p.name.length > 54 ? p.name.slice(0, 52) + "…" : p.name}</div>
              <Price t={t} p={p} size={n === 3 ? 4.2 : 5.2} />
              <Meta t={t} p={p} size={n === 3 ? 2 : 2.3} />
              <div style={{ display: "flex", marginTop: "auto" }}>
                <Chip text={plat.label} bg={plat.color} fg="#ffffff" size={1.9} />
              </div>
              {notes[i] ? <div style={{ display: "flex", fontFamily: t.body, fontSize: Math.round(u(n === 3 ? 2.2 : 2.5) * fitScale(notes[i], 60, 0.75)), lineHeight: 1.35, color: t.cardFg, opacity: 0.85 }}>{notes[i]}</div> : null}
            </div>
          );
        })}
      </div>
      {slide.body ? (
        <div style={{ ...col, marginTop: u(2.4) }}>
          <Body t={t} text={slide.body} size={2.8} align="left" />
        </div>
      ) : null}
      <div style={{ ...col, marginTop: u(2.4) }}>
        <Footer t={t} s={s} />
      </div>
    </Frame>
  );
}

export function SlideImage(s: SlideInput) {
  const t = s.theme ?? themeFor(s.template);
  switch (s.slide.kind) {
    case "product":
      return ProductSlide(t, s);
    case "compare":
      return CompareSlide(t, s);
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
