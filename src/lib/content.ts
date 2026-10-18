/**
 * Model konten bersama (server + browser). Tidak boleh import modul server.
 */

/* ───────────── Jenis konten ───────────── */

export type ContentType = "berita" | "tutorial" | "review" | "tips" | "opini" | "promo" | "rekomendasi" | "perbandingan";

export const CONTENT_TYPES: { key: ContentType; label: string; desc: string }[] = [
  { key: "berita", label: "Berita", desc: "Rangkuman berita + sudut pandang, arahkan ke artikel asli" },
  { key: "tutorial", label: "Tutorial", desc: "Langkah-langkah bernomor, boleh ada potongan kode/perintah" },
  { key: "review", label: "Review", desc: "Review repo / tool / produk: apa itu, fitur, plus-minus, verdict" },
  { key: "tips", label: "Tips / Daftar", desc: "Listicle: 5 cara, 7 tools, dsb." },
  { key: "opini", label: "Opini / Insight", desc: "Satu argumen kuat dengan poin pendukung" },
  { key: "promo", label: "Jualan: Promo / Racun", desc: "1 produk: hook masalah → manfaat → kartu produk & harga → CTA" },
  { key: "rekomendasi", label: "Jualan: Rekomendasi", desc: "Beberapa produk: \"5 barang wajib punya…\", satu kartu per produk" },
  { key: "perbandingan", label: "Jualan: Perbandingan", desc: "2–3 produk diadu: tabel harga, rating, cocok untuk siapa, pilihan terbaik" },
];

export const SALES_TYPES: ContentType[] = ["promo", "rekomendasi", "perbandingan"];
export const isSalesType = (v: unknown) => SALES_TYPES.includes(v as ContentType);

export const isContentType = (v: unknown): v is ContentType => CONTENT_TYPES.some((c) => c.key === v);

/* ───────────── Slide ───────────── */

export type SlideKind = "cover" | "body" | "step" | "list" | "code" | "verdict" | "cta" | "product" | "compare";

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
  /** product: id produk di katalog (harga/rating diambil dari katalog, bukan ditulis AI) */
  productId?: number;
  /** compare: produk yang dibandingkan (2–3); items[i] = "cocok untuk" produk ke-i */
  productIds?: number[];
  /** compare: produk pilihan (1-based) */
  pick?: number;
};

export const SLIDE_KINDS: { key: SlideKind; label: string }[] = [
  { key: "cover", label: "Cover" },
  { key: "body", label: "Isi" },
  { key: "step", label: "Langkah" },
  { key: "list", label: "Daftar" },
  { key: "code", label: "Kode" },
  { key: "verdict", label: "Verdict" },
  { key: "cta", label: "Penutup (CTA)" },
  { key: "product", label: "Kartu produk" },
  { key: "compare", label: "Perbandingan produk" },
];

/** Gambar efektif sebuah slide. */
export function slideImage(slide: Slide, mainImage: string | null, productImage?: string | null): string | null {
  if (slide.image === undefined) {
    if (slide.kind === "product") return productImage ?? null;
    return slide.kind === "cover" ? mainImage : null;
  }
  return slide.image;
}

/* ───────────── Template visual ───────────── */

export type TemplateKey = "brand" | "stabilo" | "putih" | "foto" | "minimal" | "gelap" | "split" | "koran";

export const TEMPLATES: { key: TemplateKey; label: string; desc: string }[] = [
  { key: "brand", label: "Brand Kit", desc: "100% ikut warna, font & logo di Brand Kit" },
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
  promo: ["brand", "stabilo", "foto", "split"],
  rekomendasi: ["brand", "minimal", "stabilo", "split"],
  perbandingan: ["brand", "minimal", "gelap"],
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

/* ───────────── Produk (mode jualan) ───────────── */

export type ProductPlatform = "shopee" | "tokopedia" | "tiktokshop" | "lazada" | "blibli" | "amazon" | "other";

export const PLATFORMS: { key: ProductPlatform; label: string; color: string; host: RegExp }[] = [
  { key: "shopee", label: "Shopee", color: "#ee4d2d", host: /(^|\.)(shopee\.|shope\.ee|shp\.ee)/i },
  { key: "tokopedia", label: "Tokopedia", color: "#03ac0e", host: /(^|\.)(tokopedia\.|tokopedia\.link)/i },
  { key: "tiktokshop", label: "TikTok Shop", color: "#111111", host: /(^|\.)tiktok\.com/i },
  { key: "lazada", label: "Lazada", color: "#0f146d", host: /(^|\.)(lazada\.|lzd\.co)/i },
  { key: "blibli", label: "Blibli", color: "#0095da", host: /(^|\.)blibli\./i },
  { key: "amazon", label: "Amazon", color: "#ff9900", host: /(^|\.)(amazon\.|amzn\.)/i },
  { key: "other", label: "Toko", color: "#6b7280", host: /$^/ },
];
export const isPlatform = (v: unknown): v is ProductPlatform => PLATFORMS.some((p) => p.key === v);
export const platformOf = (key: string) => PLATFORMS.find((p) => p.key === key) ?? PLATFORMS[PLATFORMS.length - 1];
export function detectPlatform(url: string): ProductPlatform {
  try {
    const h = new URL(url).hostname;
    return PLATFORMS.find((p) => p.host.test(h))?.key ?? "other";
  } catch {
    return "other";
  }
}

/** Data produk yang ditampilkan di slide (diambil dari katalog saat render). */
export type ProductView = {
  id: number;
  name: string;
  platform: ProductPlatform;
  price: number | null;
  originalPrice: number | null;
  currency: string;
  rating: number | null;
  sold: number | null;
  image: string | null;
};

export function formatPrice(n: number | null | undefined, currency = "IDR") {
  if (n == null) return "";
  if (currency === "IDR") return "Rp" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sym: Record<string, string> = { USD: "$", EUR: "€", SGD: "S$", MYR: "RM" };
  return (sym[currency] ?? currency + " ") + n.toFixed(2).replace(/\.00$/, "");
}

export const discountOf = (price: number | null, original: number | null) =>
  price && original && original > price ? Math.round((1 - price / original) * 100) : 0;

/** 12500 → "12,5rb", 1200000 → "1,2jt" */
export function formatCount(n: number | null | undefined) {
  if (n == null) return "";
  const f = (x: number) => (x >= 10 ? Math.floor(x).toString() : (Math.floor(x * 10) / 10).toString().replace(".", ","));
  if (n >= 1_000_000) return f(n / 1_000_000) + "jt";
  if (n >= 1000) return f(n / 1000) + "rb";
  return String(n);
}

/* ───────────── Video (Gerak) ───────────── */

export type ShotKind = "hook" | "point" | "step" | "product" | "compare" | "cta";

/** Satu shot video 9:16. Teks ≤ 5 kata (aturan Gerak: satu gagasan besar per shot). */
export type Shot = {
  kind: ShotKind;
  text: string;
  /** kata yang distabilo */
  emph?: string;
  /** label kecil (mis. "Praktis", "Pilihan aku") */
  label?: string;
  /** step: nomor; product: nomor urut (rekomendasi) */
  n?: number;
  productId?: number;
  productIds?: number[];
  pick?: number;
};

export const SHOT_KINDS: { key: ShotKind; label: string }[] = [
  { key: "hook", label: "Pembuka" },
  { key: "point", label: "Poin" },
  { key: "step", label: "Langkah" },
  { key: "product", label: "Produk" },
  { key: "compare", label: "Bandingkan" },
  { key: "cta", label: "Penutup" },
];

export type VideoStyle = "papan" | "struk" | "swiss" | "riso" | "editorial" | "buku" | "retro" | "kolase" | "data" | "bauhaus";

export const VIDEO_STYLES: { key: VideoStyle; label: string; desc: string }[] = [
  { key: "papan", label: "Papan", desc: "Satu papan Brand Kit, kamera pindah antar shot, foto melompat" },
  { key: "struk", label: "Struk kasir", desc: "Struk thermal keluar dari printer, coretan pulpen, stempel" },
  { key: "swiss", label: "Swiss poster", desc: "Grid tegas, angka raksasa, judul kapital per ketuk" },
  { key: "riso", label: "Risograph", desc: "2 tinta meleset, halftone, huruf condensed raksasa" },
  { key: "editorial", label: "Editorial", desc: "Serif majalah, foto bingkai lengkung, ritme pelan" },
  { key: "buku", label: "Buku tulis", desc: "Tulisan tangan di kertas bergaris, stabilo, sticky note" },
  { key: "retro", label: "Retro 70-an", desc: "Sunburst, pelangi, huruf groovy, lencana gerigi" },
  { key: "kolase", label: "Kolase tempel", desc: "Huruf guntingan, selotip, polaroid, stiker" },
  { key: "data", label: "Data signal", desc: "Gelap, angka raksasa dihitung, grafik tumbuh, batang harga" },
  { key: "bauhaus", label: "Bauhaus", desc: "Bentuk dasar berpindah tiap ketuk, foto dalam lingkaran" },
];
export const isVideoStyle = (v: unknown): v is VideoStyle => VIDEO_STYLES.some((s) => s.key === v);

/** Gaya video yang cocok per jenis konten (dipakai sebagai saran awal). */
export const STYLE_FOR: Record<ContentType, VideoStyle> = {
  berita: "data",
  tutorial: "buku",
  review: "editorial",
  tips: "swiss",
  opini: "editorial",
  promo: "kolase",
  rekomendasi: "retro",
  perbandingan: "data",
};

export type VideoLayout = "full" | "pip" | "split-top" | "split-bottom";
export type MediaFile = { file: string; name: string; seconds: number };

export type VideoOptions = {
  motionBlur?: boolean;
  music?: "beat" | "none";
  style?: VideoStyle;
  /** brand = aksen Brand Kit, style = warna asli gaya */
  colors?: "brand" | "style";
  layout?: VideoLayout;
  pipCorner?: "kanan-bawah" | "kiri-bawah" | "kanan-atas" | "kiri-atas";
  pipShape?: "bulat" | "kotak";
  /** voice over (file di MEDIA_DIR) */
  vo?: MediaFile | null;
  /** video sendiri (talking head) */
  cam?: (MediaFile & { useAudio?: boolean }) | null;
};

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
