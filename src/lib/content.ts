/**
 * Model konten bersama (server + browser). Tidak boleh import modul server.
 */

/* ───────────── Jenis konten ───────────── */

export type ContentType = "berita" | "tutorial" | "review" | "tips" | "opini";

export const CONTENT_TYPES: { key: ContentType; label: string; desc: string }[] = [
  { key: "berita", label: "Berita", desc: "Rangkuman berita + sudut pandang, arahkan ke artikel asli" },
  { key: "tutorial", label: "Tutorial", desc: "Langkah-langkah bernomor, boleh ada potongan kode/perintah" },
  { key: "review", label: "Review", desc: "Review repo / tool / produk: apa itu, fitur, plus-minus, verdict" },
  { key: "tips", label: "Tips / Daftar", desc: "Listicle: 5 cara, 7 tools, dsb." },
  { key: "opini", label: "Opini / Insight", desc: "Satu argumen kuat dengan poin pendukung" },
];

export const isContentType = (v: unknown): v is ContentType => CONTENT_TYPES.some((c) => c.key === v);

/* ───────────── Slide ───────────── */

export type SlideKind = "cover" | "body" | "step" | "list" | "code" | "verdict" | "cta";

export type Slide = {
  kind: SlideKind;
  headline: string;
  body?: string;
  /** step: nomor langkah */
  step?: number;
  /** step: label di samping nomor (default "LANGKAH"; tips → "TIPS") */
  label?: string;
  /** list: poin-poin; verdict: dipakai sebagai kelebihan */
  items?: string[];
  /** verdict: kekurangan */
  cons?: string[];
  /** verdict: nilai 0-10 */
  rating?: number;
  /** code: isi kode / perintah */
  code?: string;
  lang?: string;
  /**
   * Gambar slide ini: URL https, "asset:<id>" (upload), null = tanpa gambar,
   * undefined = otomatis (cover pakai gambar utama, lainnya tanpa gambar).
   */
  image?: string | null;
};

export const SLIDE_KINDS: { key: SlideKind; label: string }[] = [
  { key: "cover", label: "Cover" },
  { key: "body", label: "Isi" },
  { key: "step", label: "Langkah" },
  { key: "list", label: "Daftar" },
  { key: "code", label: "Kode" },
  { key: "verdict", label: "Verdict" },
  { key: "cta", label: "Penutup (CTA)" },
];

/** Gambar efektif sebuah slide. */
export function slideImage(slide: Slide, mainImage: string | null): string | null {
  if (slide.image === undefined) return slide.kind === "cover" ? mainImage : null;
  return slide.image;
}

/* ───────────── Template visual ───────────── */

export type TemplateKey = "stabilo" | "putih" | "foto" | "minimal" | "gelap" | "split" | "koran";

export const TEMPLATES: { key: TemplateKey; label: string; desc: string }[] = [
  { key: "stabilo", label: "Stabilo", desc: "Pink stabilo, headline kapital tebal" },
  { key: "putih", label: "Putih editorial", desc: "Putih bersih, judul serif" },
  { key: "foto", label: "Foto penuh", desc: "Foto full-bleed, teks di atas gradasi" },
  { key: "minimal", label: "Minimal (LinkedIn)", desc: "Krem profesional, aksen garis lime" },
  { key: "gelap", label: "Gelap tech", desc: "Navy gelap, aksen neon, cocok untuk tech/repo" },
  { key: "split", label: "Split", desc: "Foto di atas, teks di blok warna di bawah" },
  { key: "koran", label: "Koran", desc: "Gaya surat kabar, serif & garis kolom" },
];

export const isTemplate = (v: unknown): v is TemplateKey => TEMPLATES.some((t) => t.key === v);

/** Template yang disarankan per jenis konten (dirotasi Copywriter). */
export const TEMPLATE_ROTATION: Record<ContentType, TemplateKey[]> = {
  berita: ["stabilo", "putih", "foto", "split", "koran"],
  tutorial: ["gelap", "minimal", "split"],
  review: ["gelap", "minimal", "split"],
  tips: ["minimal", "stabilo", "split", "putih"],
  opini: ["putih", "koran", "minimal", "foto"],
};

/* ───────────── Referensi gambar ───────────── */

/** "asset:12" → URL publik /a/12 (relatif terhadap basePath). */
export function imageSrc(ref: string | null | undefined, basePath = "") {
  if (!ref) return null;
  const m = /^asset:(\d+)$/.exec(ref);
  return m ? `${basePath}/a/${m[1]}` : ref;
}

/** Gambar OpenGraph GitHub untuk repo (bagus untuk review repo). */
export function githubOgImage(url: string) {
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i.exec(url);
  return m ? `https://opengraph.githubassets.com/1/${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
}
