/**
 * Brand Kit — dipakai renderer (template "Brand" + override global) dan AI (nama/handle).
 * File ini dipakai server & browser: jangan import modul server.
 */

export type FontChoice = { key: string; family: string; label: string; style: "sans" | "display" | "serif"; weights: number[] };

/** Font bawaan (file .woff ada di src/lib/render/fonts). */
export const FONT_CHOICES: FontChoice[] = [
  { key: "inter", family: "Inter", label: "Inter", style: "sans", weights: [500, 700, 800] },
  { key: "plus-jakarta-sans", family: "Plus Jakarta Sans", label: "Plus Jakarta Sans", style: "sans", weights: [500, 700, 800] },
  { key: "poppins", family: "Poppins", label: "Poppins", style: "sans", weights: [500, 700, 800] },
  { key: "montserrat", family: "Montserrat", label: "Montserrat", style: "sans", weights: [500, 700, 800] },
  { key: "space-grotesk", family: "Space Grotesk", label: "Space Grotesk", style: "sans", weights: [500, 700] },
  { key: "anton", family: "Anton", label: "Anton (display tebal)", style: "display", weights: [400] },
  { key: "bebas-neue", family: "Bebas Neue", label: "Bebas Neue (display)", style: "display", weights: [400] },
  { key: "dm-serif-display", family: "DM Serif Display", label: "DM Serif Display", style: "serif", weights: [400] },
  { key: "playfair-display", family: "Playfair Display", label: "Playfair Display", style: "serif", weights: [400, 700, 800] },
];

export type BrandKit = {
  name: string;
  handle: string;
  /** deskripsi akun & audiens untuk AI */
  about: string;
  colors: { primary: string; secondary: string; background: string; text: string };
  /** key FONT_CHOICES atau "custom:<assetId>" */
  headFont: string;
  bodyFont: string;
  headUpper: boolean;
  /** referensi gambar "asset:<id>" */
  logo: string | null;
  logoPlacement: "header" | "footer" | "none";
  bullet: "angka" | "titik" | "centang" | "panah";
  cover: "framed" | "full" | "top" | "inset";
  /** 0 = siku, 3 = sangat bulat */
  radius: number;
  /** terapkan ke 7 template lain juga */
  applyFontsAll: boolean;
  applyAccentAll: boolean;
  applyLogoAll: boolean;
  customFonts: { id: number; name: string }[];
  /** berubah tiap simpan → render lama ditandai perlu dirender ulang */
  version: number;
};

export const defaultBrandKit = (name = "Studio", handle = "@akunkamu"): BrandKit => ({
  name,
  handle,
  about: "merangkum berita AI, marketing, dan media sosial untuk audiens Indonesia (marketer, kreator, pemilik UMKM).",
  colors: { primary: "#d6f43c", secondary: "#f06bb7", background: "#0f1114", text: "#f4f4f2" },
  headFont: "plus-jakarta-sans",
  bodyFont: "inter",
  headUpper: false,
  logo: null,
  logoPlacement: "header",
  bullet: "angka",
  cover: "framed",
  radius: 2,
  applyFontsAll: false,
  applyAccentAll: false,
  applyLogoAll: false,
  customFonts: [],
  version: 1,
});

export const fontFamilyOf = (key: string) =>
  key.startsWith("custom:") ? `Custom${key.slice(7)}` : FONT_CHOICES.find((f) => f.key === key)?.family ?? "Inter";

export const isDisplayFont = (key: string) => FONT_CHOICES.find((f) => f.key === key)?.style === "display";

/* ───────────── utilitas warna ───────────── */

export function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export const rgba = (hex: string, a: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** Warna teks yang terbaca di atas warna latar ini. */
export const readableOn = (hex: string) => (luminance(hex) > 0.42 ? "#0b0b0b" : "#ffffff");
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);

/** Bersihkan kit dari input (form / DB) — field rusak jatuh ke default. */
export function normalizeKit(raw: unknown, base: BrandKit): BrandKit {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<BrandKit> & Record<string, unknown>;
  const c = (r.colors ?? {}) as Partial<BrandKit["colors"]>;
  const customFonts = Array.isArray(r.customFonts)
    ? r.customFonts.filter((f): f is { id: number; name: string } => !!f && Number.isInteger(f.id) && typeof f.name === "string").slice(0, 8)
    : base.customFonts;
  const fontOk = (k: unknown) =>
    typeof k === "string" && (FONT_CHOICES.some((f) => f.key === k) || customFonts.some((f) => `custom:${f.id}` === k));
  const str = (v: unknown, d: string, max = 60) => (typeof v === "string" ? v.trim().slice(0, max) : d);
  let handle = str(r.handle, base.handle, 40);
  if (handle && !handle.startsWith("@")) handle = "@" + handle;
  return {
    name: str(r.name, base.name) || base.name,
    handle: handle || base.handle,
    about: str(r.about, base.about, 600) || base.about,
    colors: {
      primary: isHex(c.primary) ? c.primary : base.colors.primary,
      secondary: isHex(c.secondary) ? c.secondary : base.colors.secondary,
      background: isHex(c.background) ? c.background : base.colors.background,
      text: isHex(c.text) ? c.text : base.colors.text,
    },
    headFont: fontOk(r.headFont) ? (r.headFont as string) : base.headFont,
    bodyFont: fontOk(r.bodyFont) ? (r.bodyFont as string) : base.bodyFont,
    headUpper: typeof r.headUpper === "boolean" ? r.headUpper : base.headUpper,
    logo: typeof r.logo === "string" && /^asset:\d+$/.test(r.logo) ? r.logo : r.logo === null ? null : base.logo,
    logoPlacement: pick(r.logoPlacement, ["header", "footer", "none"] as const, base.logoPlacement),
    bullet: pick(r.bullet, ["angka", "titik", "centang", "panah"] as const, base.bullet),
    cover: pick(r.cover, ["framed", "full", "top", "inset"] as const, base.cover),
    radius: typeof r.radius === "number" && r.radius >= 0 && r.radius <= 4 ? r.radius : base.radius,
    applyFontsAll: typeof r.applyFontsAll === "boolean" ? r.applyFontsAll : base.applyFontsAll,
    applyAccentAll: typeof r.applyAccentAll === "boolean" ? r.applyAccentAll : base.applyAccentAll,
    applyLogoAll: typeof r.applyLogoAll === "boolean" ? r.applyLogoAll : base.applyLogoAll,
    customFonts,
    version: typeof r.version === "number" ? r.version : base.version,
  };
}

/** Bagian kit yang memengaruhi gambar sebuah template (untuk sidik render). */
export function kitRenderKey(k: BrandKit, template: string) {
  const fonts = template === "brand" || k.applyFontsAll ? [k.headFont, k.bodyFont, k.headUpper] : null;
  const look = template === "brand" ? [k.colors, k.cover, k.radius] : k.applyAccentAll ? [k.colors.primary, k.colors.secondary] : null;
  const logo = template === "brand" || k.applyLogoAll ? [k.logo, k.logoPlacement] : null;
  return [k.handle, k.bullet, fonts, look, logo];
}
