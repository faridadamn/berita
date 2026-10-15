import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AiError, completeJson } from "../ai";
import { getBrand } from "../brand-kit";
import { appUrl } from "../channels";
import { discountOf, formatCount, formatPrice, platformOf, type ContentType, type Slide } from "../content";
import { getProductsByIds } from "../products";
import { getSettings } from "../settings";
import { Usage, audience, brainFor, logRun } from "./common";
import { arr, clean, insertPost, pickTemplate } from "./copywriter";

type Product = typeof schema.products.$inferSelect;
export type SalesType = Extract<ContentType, "promo" | "rekomendasi" | "perbandingan">;

type Pair = { headline: string; body: string };
type SalesDraft = {
  kicker: string;
  headline: string;
  alternatives: string[];
  subline: string;
  caption: string;
  hashtags: string[];
  threads: string;
  x: string;
  linkedin: string;
  tiktok: string;
  wa: string;
  // promo
  problem?: Pair;
  benefits?: string[];
  pitch?: Pair;
  // rekomendasi
  picks?: { id: number; headline: string; body: string }[];
  // perbandingan
  fits?: { id: number; fit: string }[];
  pick?: number;
  verdict?: Pair;
};

export const SALES_LIMITS: Record<SalesType, [number, number]> = { promo: [1, 1], rekomendasi: [2, 7], perbandingan: [2, 3] };

const SPEC: Record<SalesType, { rules: string; shape: string; check: (d: SalesDraft, ps: Product[]) => string | null }> = {
  promo: {
    rules:
      `Buat konten PROMO / "racun" untuk SATU produk: hook masalah → manfaat → produk → ajakan.\n` +
      `- problem: {headline maks 7 kata: masalah/keinginan yang relate, body maks 30 kata}\n` +
      `- benefits: 3-4 manfaat konkret (maks 7 kata per poin), dari data produk/catatan — jangan mengarang spesifikasi\n` +
      `- pitch: {headline maks 7 kata kenapa produk ini, body maks 22 kata (sebut promo/voucher kalau ada)}`,
    shape: `"problem":{"headline":"","body":""},"benefits":[""],"pitch":{"headline":"","body":""}`,
    check: (d) => (d.problem?.headline && arr(d.benefits).length >= 2 && d.pitch?.headline ? null : "problem/benefits/pitch kosong"),
  },
  rekomendasi: {
    rules:
      `Buat konten REKOMENDASI beberapa produk (gaya "N barang yang wajib kamu punya untuk …").\n` +
      `- picks: SATU entri untuk SETIAP produk, urutan sama dengan daftar, tiap {id: id produk, headline maks 6 kata alasan/kegunaan (bukan nama produk), body maks 22 kata cocok untuk siapa / kenapa}`,
    shape: `"picks":[{"id":0,"headline":"","body":""}]`,
    check: (d, ps) => (arr(d.picks).length >= Math.min(2, ps.length) ? null : "picks kurang"),
  },
  perbandingan: {
    rules:
      `Buat konten PERBANDINGAN produk yang jujur (bukan menjatuhkan salah satu).\n` +
      `- fits: SATU entri untuk SETIAP produk, tiap {id, fit: "cocok untuk …" maks 8 kata}\n` +
      `- pick: id produk yang paling worth it untuk kebanyakan orang\n` +
      `- verdict: {headline maks 7 kata, body maks 30 kata alasan pilihan + kapan pilih yang lain}`,
    shape: `"fits":[{"id":0,"fit":""}],"pick":0,"verdict":{"headline":"","body":""}`,
    check: (d, ps) => (arr(d.fits).length >= ps.length && d.verdict?.headline ? null : "fits/verdict kosong"),
  },
};

function describe(p: Product) {
  const disc = discountOf(p.price, p.originalPrice);
  return [
    `- id ${p.id}: ${p.name}`,
    `  toko: ${platformOf(p.platform).label}` + (p.category ? ` · kategori: ${p.category}` : ""),
    p.price ? `  harga: ${formatPrice(p.price, p.currency)}` + (disc ? ` (diskon ${disc}% dari ${formatPrice(p.originalPrice, p.currency)})` : "") : "  harga: (tidak diketahui — jangan sebut harga)",
    p.rating ? `  rating: ${p.rating}` : "",
    p.sold ? `  terjual: ${formatCount(p.sold)}+` : "",
    p.promo ? `  promo/voucher: ${p.promo}` : "",
    p.description ? `  deskripsi: ${p.description.replace(/\s+/g, " ").slice(0, 600)}` : "",
    p.notes ? `  catatan dari penjual (penting): ${p.notes.replace(/\s+/g, " ").slice(0, 600)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const productLink = (base: string | null, p: Pick<Product, "shortCode">, channel: string, postId?: number) =>
  `${base ?? ""}/p/${p.shortCode}?c=${channel}${postId ? `&post=${postId}` : ""}`;

function buildSlides(type: SalesType, d: SalesDraft, ps: Product[], headline: string, cta: Slide): Slide[] {
  const byId = new Map(ps.map((p) => [p.id, p]));
  const cover: Slide = { kind: "cover", headline, body: clean(d.subline, 200) };
  let mid: Slide[] = [];
  if (type === "promo") {
    const p = ps[0];
    mid = [
      { kind: "body", headline: clean(d.problem?.headline, 90), body: clean(d.problem?.body, 260) },
      { kind: "list", headline: "Kenapa worth it", items: arr<string>(d.benefits).map((x) => clean(x, 80)).filter(Boolean).slice(0, 4) },
      { kind: "product", productId: p.id, headline: clean(d.pitch?.headline, 90) || "Ini dia", body: clean(d.pitch?.body, 200) },
    ];
  } else if (type === "rekomendasi") {
    const picks = arr<{ id: number; headline: string; body: string }>(d.picks);
    mid = ps.map((p, i) => {
      const x = picks.find((k) => Number(k?.id) === p.id) ?? picks[i];
      return { kind: "product", productId: p.id, step: i + 1, headline: clean(x?.headline, 90) || `Pilihan ${i + 1}`, body: clean(x?.body, 200) };
    });
  } else {
    const fits = arr<{ id: number; fit: string }>(d.fits);
    const pickId = byId.has(Number(d.pick)) ? Number(d.pick) : ps[0].id;
    mid = [
      {
        kind: "compare",
        productIds: ps.map((p) => p.id),
        pick: ps.findIndex((p) => p.id === pickId) + 1,
        headline: "Mana yang cocok buat kamu?",
        items: ps.map((p, i) => clean((fits.find((f) => Number(f?.id) === p.id) ?? fits[i])?.fit, 80)),
      },
      { kind: "product", productId: pickId, headline: clean(d.verdict?.headline, 90) || "Pilihan kami", body: clean(d.verdict?.body, 220) },
    ];
  }
  return [cover, ...mid, cta];
}

/** Tulis draft jualan dari produk katalog. Tidak menyimpan — pemanggil yang menyimpan. */
export async function writeSalesDraft(ps: Product[], type: SalesType, opts: { notes?: string; usage: Usage; postId?: number }) {
  const [min, max] = SALES_LIMITS[type];
  if (ps.length < min) throw new Error(`${type} butuh minimal ${min} produk`);
  ps = ps.slice(0, max);
  const s = await getSettings();
  const brand = await getBrand();
  const spec = SPEC[type];
  const multi = ps.length > 1;

  const system =
    `Kamu adalah Copywriter affiliate / social commerce. ${await audience()}\n` +
    `Tulis dalam ${s.language}. ${spec.rules}\n` +
    `Aturan penting:\n- Fakta produk (harga, diskon, rating, terjual, fitur) HANYA dari data yang diberikan. Jangan mengarang angka, spesifikasi, testimoni, atau klaim kesehatan/keuangan.\n` +
    `- Jujur & tidak lebay: boleh antusias, tapi jangan klaim "paling murah", "dijamin", "pasti" kecuali ada di data.\n` +
    `- headline cover maks 9 kata, bikin berhenti scroll (masalah, rasa penasaran, atau angka dari data)\n- alternatives: 2 headline alternatif\n` +
    `- kicker: 1-2 kata (mis. Racun, Rekomendasi, Vs, Review)\n- subline: 1 kalimat pendek di bawah headline cover\n` +
    `- caption: Instagram 2-4 paragraf pendek, sebut ${multi ? "nama-nama produk" : "nama produk"} & harga dari data, tutup dengan ajakan: ${s.salesCta}\n` +
    `- hashtags: 3-6 hashtag (boleh #racun #rekomendasi + kategori)\n` +
    `- tiktok: caption TikTok / Shopee Video / Reels maks 300 karakter, gaya ngobrol, ajakan cek keranjang kuning atau link di bio, 3 hashtag di akhir\n` +
    `- wa: pesan broadcast WhatsApp/Telegram 2-4 kalimat, akrab seperti ke teman, boleh emoji, TANPA link (link ditambahkan otomatis di bawahnya)\n` +
    `- threads: 2-3 kalimat (maks 400 karakter), tanpa hashtag & tanpa "link di bio"\n- x: 1-2 kalimat (maks 200 karakter), tanpa hashtag & tanpa "link di bio"\n` +
    `- linkedin: 400-900 karakter, sudut pandang rekomendasi/pengalaman yang berguna (bukan hard selling), tanpa "link di bio"\n` +
    `- Jangan pakai emoji di headline/slide (tidak ter-render di gambar)` +
    (await brainFor("copywriter")) +
    `\n\nJawab HANYA JSON: {"kicker":"","headline":"","alternatives":["",""],"subline":"",${spec.shape},"caption":"","hashtags":[""],"tiktok":"","wa":"","threads":"","x":"","linkedin":""}`;

  const prompt =
    `JENIS KONTEN: ${type.toUpperCase()}\n` +
    (opts.notes ? `ARAHAN DARI TIM (wajib diikuti): ${opts.notes}\n` : "") +
    `AKUN: ${brand.handle}\n\nPRODUK:\n${ps.map(describe).join("\n\n")}`;

  const { value: d } = await completeJson<SalesDraft>(
    { system, prompt, temperature: 0.8, maxTokens: 3200 },
    {
      onAttempt: (r) => opts.usage.add(r),
      validate: (v) =>
        !v || typeof v !== "object" ? "bukan objek" : !String(v.headline ?? "").trim() ? "headline kosong" : !String(v.caption ?? "").trim() ? "caption kosong" : spec.check(v, ps),
    },
  );

  const headline = clean(d.headline, 140);
  const cta: Slide = {
    kind: "cta",
    headline: multi ? "Semua link ada di bio" : "Link-nya ada di bio",
    body: `Buka profil ${brand.handle}, klik link di bio, pilih post ini.` + (ps.find((p) => p.promo) ? ` Jangan lupa pakai promo: ${ps.find((p) => p.promo)!.promo}.` : " Simpan post ini biar nggak lupa."),
  };
  const lead = type === "perbandingan" ? (ps.find((p) => p.id === Number(d.pick)) ?? ps[0]) : ps[0];
  const slides = buildSlides(type, d, ps, headline, cta).map((sl) => (sl.kind === "cover" && lead.images[0] ? { ...sl, image: lead.images[0] } : sl));

  const hashtags = arr<string>(d.hashtags)
    .map((h) => "#" + String(h).replace(/^#+/, "").replace(/\s+/g, ""))
    .filter((h) => h.length > 1)
    .slice(0, 8);
  const disclosure = s.salesDisclosure.trim();
  const withDisc = (t: string) => (disclosure ? `${t.trim()}\n\n${disclosure}` : t.trim());
  const short = disclosure ? " #ad" : "";
  const base = appUrl();
  const waLinks = ps.map((p) => `🛒 ${p.name.slice(0, 70)}${p.price ? ` — ${formatPrice(p.price, p.currency)}` : ""}\n${productLink(base, p, "wa", opts.postId)}`).join("\n\n");

  const values = {
    contentType: type as ContentType,
    kicker: clean(d.kicker, 20) || (type === "promo" ? "Racun" : type === "perbandingan" ? "Vs" : "Rekomendasi"),
    headline,
    headlineAlternatives: arr<string>(d.alternatives).map((a) => clean(a, 140)).filter(Boolean).slice(0, 3),
    caption: withDisc(String(d.caption ?? "")).slice(0, 2150),
    hashtags,
    platformText: {
      threads: (String(d.threads ?? "").trim().slice(0, 440) + short).trim(),
      x: (String(d.x ?? "").trim().slice(0, 220) + short).trim(),
      linkedin: withDisc(String(d.linkedin ?? "")).slice(0, 2900),
      tiktok: withDisc(String(d.tiktok ?? "")).slice(0, 2100),
      wa: `${String(d.wa ?? "").trim()}\n\n${waLinks}${disclosure ? `\n\n_${disclosure.replace(/\s*#ad\s*$/i, "")}_` : ""}`.slice(0, 3000),
    },
    format: "carousel",
    slides,
    images: [...new Set(ps.flatMap((p) => p.images))].slice(0, 20),
    productIds: ps.map((p) => p.id),
  };
  return values;
}

/** Halaman Jualan → "Buat konten": topik jualan:<acak> + post. Mengembalikan id post. */
export async function createSalesPost(productIds: number[], type: SalesType, notes?: string) {
  const ps = await getProductsByIds(productIds);
  if (!ps.length) throw new Error("Produk tidak ditemukan");
  const usage = new Usage();
  const title = ps.map((p) => p.name).join(" · ").slice(0, 300);
  try {
    const [t] = await db()
      .insert(schema.topics)
      .values({
        title,
        url: `jualan:${randomBytes(8).toString("hex")}`,
        category: "JUALAN",
        status: "drafted",
        score: 100,
        scoreReason: "Konten jualan dari katalog",
        format: type,
        imageUrl: ps[0].images[0] ?? null,
        images: [...new Set(ps.flatMap((p) => p.images))].slice(0, 20),
        meta: { ...(notes ? { notes } : {}), products: ps.map((p) => p.id).join(",") },
      })
      .returning({ id: schema.topics.id });
    const values = await writeSalesDraft(ps, type, { notes, usage });
    const id = await insertPost({ ...values, topicId: t.id }, await pickTemplate(type, 0));
    // link WA butuh id post untuk pelacakan → tulis ulang dengan id
    const fixed = values.platformText.wa.replace(/\/p\/(\w+)\?c=wa(?!&)/g, `/p/$1?c=wa&post=${id}`);
    await db().update(schema.posts).set({ platformText: { ...values.platformText, wa: fixed } }).where(eq(schema.posts.id, id));
    await logRun("copywriter", `Menulis konten ${type} untuk ${ps.length} produk (post #${id})`, { usage, detail: { postIds: [id], topicIds: [t.id] } });
    return id;
  } catch (e) {
    await logRun("copywriter", `Gagal menulis konten ${type} (${title.slice(0, 80)}): ${(e as Error).message}`, {
      ok: false,
      usage,
      detail: { error: (e as Error).message, raw: e instanceof AiError ? e.raw : undefined },
    });
    throw e;
  }
}

/** Tulis ulang post jualan (jenis jualan lain / arahan baru). */
export async function rewriteSalesPost(postId: number, type: SalesType, notes?: string) {
  const [p] = await db().select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (!p) throw new Error("Post tidak ditemukan");
  if (!p.productIds.length) throw new Error("Post ini belum terhubung ke produk katalog — buat konten jualan dari halaman Jualan");
  const ps = await getProductsByIds(p.productIds);
  const [min] = SALES_LIMITS[type];
  if (ps.length < min) throw new Error(`${type} butuh minimal ${min} produk (post ini punya ${ps.length})`);
  const usage = new Usage();
  try {
    const values = await writeSalesDraft(type === "promo" ? ps.slice(0, 1) : ps, type, { notes, usage, postId });
    await db()
      .update(schema.posts)
      .set({ ...values, images: [...new Set([...values.images, ...p.images])].slice(0, 30), template: await pickTemplate(type, 0), updatedAt: new Date() })
      .where(eq(schema.posts.id, postId));
    if (p.topicId) await db().update(schema.topics).set({ format: type }).where(eq(schema.topics.id, p.topicId));
    await logRun("copywriter", `Menulis ulang post #${postId} sebagai ${type}`, { usage, detail: { postIds: [postId] } });
  } catch (e) {
    await logRun("copywriter", `Gagal menulis ulang post #${postId}: ${(e as Error).message}`, {
      ok: false,
      usage,
      detail: { error: (e as Error).message, raw: e instanceof AiError ? e.raw : undefined, postIds: [postId] },
    });
    throw e;
  }
}
