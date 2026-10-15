import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { UA, stripHtml } from "./agents/common";
import { detectPlatform, isPlatform, type ProductPlatform } from "./content";
import { extractImages } from "./images";
import type { ProductRow } from "./types";

const { products, productClicks, posts } = schema;
const DAY = 86_400_000;

export const productShortCode = () => "p" + randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 5);

// select dari satu tabel → drizzle tidak menulis nama tabel, jadi rujukan ke luar subquery harus eksplisit
const PID = sql.raw(`"products"."id"`);
const clicksAll = sql<number>`(select count(*) from ${productClicks} where ${productClicks.productId} = ${PID})`.mapWith(Number);
const postCount = sql<number>`(select count(*) from ${posts} where ${posts.productIds} @> jsonb_build_array(${PID}))`.mapWith(Number);

function toRow(r: typeof products.$inferSelect, clicks: number, clicks7d: number, nPosts: number): ProductRow {
  return { ...r, platform: isPlatform(r.platform) ? r.platform : "other", clicks, clicks7d, posts: nPosts, updatedAt: r.updatedAt.toISOString() };
}

export async function getProducts(opts: { activeOnly?: boolean } = {}) {
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const clicks7d = sql<number>`(select count(*) from ${productClicks} where ${productClicks.productId} = ${PID} and ${productClicks.at} >= ${since}::timestamptz)`.mapWith(Number);
  const q = db().select({ p: products, clicks: clicksAll, clicks7d, posts: postCount }).from(products);
  const rows = await (opts.activeOnly ? q.where(eq(products.active, true)) : q).orderBy(desc(products.active), desc(products.updatedAt)).limit(500);
  return rows.map((r) => toRow(r.p, r.clicks, r.clicks7d, r.posts));
}

export async function getProduct(id: number) {
  if (!Number.isInteger(id)) return null;
  const [r] = await db().select({ p: products, clicks: clicksAll, posts: postCount }).from(products).where(eq(products.id, id));
  return r ? toRow(r.p, r.clicks, 0, r.posts) : null;
}

/** Produk berdasarkan id, urutan mengikuti `ids`. */
export async function getProductsByIds(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db().select().from(products).where(inArray(products.id, ids));
  const m = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => m.get(id)).filter((x): x is typeof products.$inferSelect => !!x);
}

export async function getProductByShortCode(code: string) {
  const [r] = await db().select().from(products).where(eq(products.shortCode, code));
  return r ?? null;
}

export async function recordProductClick(productId: number, opts: { postId?: number | null; channel?: string | null; referrer?: string | null }) {
  await db()
    .insert(productClicks)
    .values({ productId, postId: opts.postId ?? null, channel: opts.channel?.slice(0, 24) || null, referrer: opts.referrer?.slice(0, 500) ?? null });
}

/** Klik produk per kanal & per hari (untuk halaman Jualan / Analitik). */
export async function getSalesStats(days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const [byChannel, byDay, top] = await Promise.all([
    db()
      .select({ channel: sql<string>`coalesce(${productClicks.channel}, 'lain')`, n: sql<number>`count(*)`.mapWith(Number) })
      .from(productClicks)
      .where(gte(productClicks.at, since))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`),
    db()
      .select({ day: sql<string>`to_char(${productClicks.at} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`, n: sql<number>`count(*)`.mapWith(Number) })
      .from(productClicks)
      .where(gte(productClicks.at, since))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db()
      .select({ id: products.id, name: products.name, n: sql<number>`count(*)`.mapWith(Number) })
      .from(productClicks)
      .innerJoin(products, eq(productClicks.productId, products.id))
      .where(gte(productClicks.at, since))
      .groupBy(products.id, products.name)
      .orderBy(sql`3 desc`)
      .limit(10),
  ]);
  const total = byChannel.reduce((a, b) => a + b.n, 0);
  return { total, byChannel, byDay, top };
}

export async function productClicksForPost(postId: number) {
  const [r] = await db().select({ n: sql<number>`count(*)`.mapWith(Number) }).from(productClicks).where(and(eq(productClicks.postId, postId)));
  return r?.n ?? 0;
}

/* ───────────── Ambil data produk dari link ───────────── */

export type ScrapedProduct = {
  name?: string;
  description?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  rating?: number;
  sold?: number;
  images: string[];
  platform: ProductPlatform;
  finalUrl: string;
};

const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${prop}["']`, "i"))?.[1];

/** "Rp 1.299.000" / "1299000.00" / 1299000 → 1299000 */
export function parsePrice(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
  if (typeof v !== "string") return undefined;
  let s = v.replace(/[^\d.,]/g, "");
  if (!s) return undefined;
  // format Indonesia: titik ribuan, koma desimal
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/** "12,5rb" / "1,2jt" / "10K+" / "1.234" → angka */
export function parseCount(v: unknown): number | undefined {
  if (typeof v === "number") return Math.round(v);
  if (typeof v !== "string") return undefined;
  const m = /([\d.,]+)\s*(rb|ribu|k|jt|juta|m)?/i.exec(v);
  if (!m) return undefined;
  const mult = /rb|ribu|k/i.test(m[2] ?? "") ? 1000 : /jt|juta|m/i.test(m[2] ?? "") ? 1_000_000 : 1;
  const num = mult > 1 ? Number(m[1].replace(",", ".")) : Number(m[1].replace(/[.,]/g, ""));
  return Number.isFinite(num) ? Math.round(num * mult) : undefined;
}

function findProductLd(html: string): Record<string, unknown> | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim());
      const list: unknown[] = Array.isArray(j) ? j : j["@graph"] ? j["@graph"] : [j];
      for (const x of list) {
        const t = (x as Record<string, unknown>)?.["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return x as Record<string, unknown>;
      }
    } catch {
      /* lewati */
    }
  }
  return null;
}

/**
 * Best effort: banyak marketplace (Shopee, TikTok Shop) merender halaman lewat JavaScript dan
 * memblokir bot, jadi data sering kosong → isi manual. Tokopedia, Blibli, Amazon & toko
 * Shopify/WooCommerce biasanya punya JSON-LD Product.
 */
export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const out: ScrapedProduct = { images: [], platform: detectPlatform(url), finalUrl: url };
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html", "accept-language": "id,en;q=0.8" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    out.finalUrl = res.url || url;
    if (out.platform === "other") out.platform = detectPlatform(out.finalUrl);
    if (!res.ok) return out;
    const html = (await res.text()).slice(0, 3_000_000);
    const ld = findProductLd(html);
    if (ld) {
      out.name = typeof ld.name === "string" ? stripHtml(ld.name) : undefined;
      out.description = typeof ld.description === "string" ? stripHtml(ld.description).slice(0, 1500) : undefined;
      const img = ld.image;
      const imgs = (Array.isArray(img) ? img : [img]).map((i) => (typeof i === "string" ? i : (i as { url?: string })?.url)).filter((i): i is string => !!i && /^https?:/.test(i));
      out.images.push(...imgs);
      const offers = (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers) as Record<string, unknown> | undefined;
      if (offers) {
        out.price = parsePrice(offers.price ?? offers.lowPrice);
        out.currency = typeof offers.priceCurrency === "string" ? offers.priceCurrency.toUpperCase() : undefined;
        const hi = parsePrice(offers.highPrice);
        if (hi && out.price && hi > out.price && offers.lowPrice == null) out.originalPrice = hi;
      }
      const ar = ld.aggregateRating as Record<string, unknown> | undefined;
      if (ar) {
        const r = Number(ar.ratingValue);
        if (r > 0 && r <= 5) out.rating = Math.round(r * 10) / 10;
      }
    }
    out.name ??= stripHtml(meta(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || undefined;
    out.description ??= meta(html, "og:description") ? stripHtml(meta(html, "og:description")!).slice(0, 1500) : undefined;
    out.price ??= parsePrice(meta(html, "product:price:amount") ?? meta(html, "og:price:amount") ?? meta(html, "price"));
    out.currency ??= (meta(html, "product:price:currency") ?? meta(html, "og:price:currency") ?? meta(html, "priceCurrency"))?.toUpperCase();
    const sold = /(?:terjual|sold)\s*[:\s]*([\d.,]+\s*(?:rb|ribu|k|jt|juta)?\+?)/i.exec(stripHtml(html.slice(0, 600_000)));
    if (sold) out.sold = parseCount(sold[1]);
    if (out.images.length < 4) out.images.push(...extractImages(html, out.finalUrl));
    out.images = [...new Set(out.images)].slice(0, 8);
    if (out.name) out.name = out.name.replace(/\s*[|\-–]\s*(Shopee|Tokopedia|Lazada|Blibli|Amazon\.?\w*|TikTok).*$/i, "").slice(0, 200);
  } catch {
    /* kembalikan apa adanya */
  }
  return out;
}

/* ───────────── Impor CSV ───────────── */

/** CSV sederhana (koma atau titik koma, tanda kutip ganda). Baris pertama = header. */
export function parseCsv(text: string): Record<string, string>[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** Nama kolom CSV yang dikenali (Indonesia / Inggris). */
export const CSV_COLUMNS: Record<string, string[]> = {
  name: ["nama", "name", "produk", "nama produk", "product", "product name", "judul"],
  url: ["url", "link", "link produk", "product url", "product link"],
  affiliateUrl: ["affiliate", "link affiliate", "affiliate url", "affiliate link", "link afiliasi", "offer link", "link komisi"],
  price: ["harga", "price", "harga jual", "sale price"],
  originalPrice: ["harga asli", "harga coret", "original price", "harga normal"],
  rating: ["rating", "bintang"],
  sold: ["terjual", "sold", "penjualan"],
  image: ["gambar", "image", "foto", "image url", "gambar utama"],
  category: ["kategori", "category"],
  notes: ["catatan", "notes", "keunggulan"],
  promo: ["promo", "voucher", "kode voucher"],
  description: ["deskripsi", "description"],
};

export function csvValue(row: Record<string, string>, key: keyof typeof CSV_COLUMNS) {
  for (const c of CSV_COLUMNS[key]) if (row[c]) return row[c];
  return "";
}
