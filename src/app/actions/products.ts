"use server";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { assertAdmin, requireSession } from "@/lib/auth";
import { detectPlatform, isPlatform, isSalesType } from "@/lib/content";
import { createSalesPost, SALES_LIMITS, type SalesType } from "@/lib/agents/sales";
import { csvValue, parseCount, parseCsv, parsePrice, productShortCode, scrapeProduct } from "@/lib/products";
import { renderPost } from "@/lib/render";
import { saveSettings } from "@/lib/settings";
import type { ActionState } from "./studio";

const { products } = schema;
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const isUrl = (u: string) => /^https?:\/\/\S+$/i.test(u);

async function insertProduct(values: Omit<typeof products.$inferInsert, "shortCode">) {
  for (let i = 0; ; i++) {
    try {
      const [p] = await db().insert(products).values({ ...values, shortCode: productShortCode() }).returning({ id: products.id });
      return p.id;
    } catch (e) {
      if (i >= 3 || !/short_code/.test(String((e as Error).message))) throw e;
    }
  }
}

/** Tambah produk dari link (data diambil otomatis sebisanya), lalu buka halaman edit. */
export async function addProductFromLink(_: ActionState, f: FormData): Promise<ActionState> {
  await requireSession();
  const url = str(f, "url", 2000);
  const affiliateUrl = str(f, "affiliateUrl", 2000);
  if (!isUrl(url) && !isUrl(affiliateUrl)) return { ok: false, message: "Isi link produk (https://…)" };
  if (affiliateUrl && !isUrl(affiliateUrl)) return { ok: false, message: "Link affiliate harus diawali https://" };
  const src = isUrl(url) ? url : affiliateUrl;
  const s = await scrapeProduct(src);
  const host = (() => {
    try {
      return new URL(s.finalUrl).hostname.replace(/^www\./, "");
    } catch {
      return "toko";
    }
  })();
  const id = await insertProduct({
    name: (str(f, "name", 200) || s.name || `Produk dari ${host}`).slice(0, 200),
    url: isUrl(url) ? url : s.finalUrl,
    affiliateUrl,
    platform: s.platform,
    price: parsePrice(str(f, "price")) ?? s.price ?? null,
    originalPrice: s.originalPrice ?? null,
    currency: s.currency && /^[A-Z]{3}$/.test(s.currency) ? s.currency : "IDR",
    rating: s.rating ?? null,
    sold: s.sold ?? null,
    images: s.images,
    description: s.description ?? "",
  });
  revalidatePath("/jualan");
  redirect(`/jualan/${id}?baru=${s.name ? 1 : 0}`);
}

export async function saveProduct(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  await requireSession();
  const name = str(f, "name", 200);
  if (!name) return { ok: false, message: "Nama produk wajib diisi" };
  const url = str(f, "url", 2000);
  const affiliateUrl = str(f, "affiliateUrl", 2000);
  if (url && !isUrl(url)) return { ok: false, message: "Link produk harus diawali https://" };
  if (affiliateUrl && !isUrl(affiliateUrl)) return { ok: false, message: "Link affiliate harus diawali https://" };
  if (!url && !affiliateUrl) return { ok: false, message: "Isi minimal satu link (produk atau affiliate)" };
  const platform = str(f, "platform");
  const rating = Number(str(f, "rating").replace(",", "."));
  await db()
    .update(products)
    .set({
      name,
      url,
      affiliateUrl,
      platform: isPlatform(platform) ? platform : detectPlatform(affiliateUrl || url),
      price: parsePrice(str(f, "price")) ?? null,
      originalPrice: parsePrice(str(f, "originalPrice")) ?? null,
      currency: /^[A-Z]{3}$/.test(str(f, "currency")) ? str(f, "currency") : "IDR",
      rating: rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
      sold: parseCount(str(f, "sold")) ?? null,
      category: str(f, "category", 60),
      description: str(f, "description", 2000),
      notes: str(f, "notes", 1500),
      promo: str(f, "promo", 200),
      active: f.get("active") === "on",
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));
  revalidatePath("/jualan");
  revalidatePath(`/jualan/${id}`);
  return { ok: true, message: "Produk disimpan. Post yang memakai produk ini otomatis ditandai perlu render ulang." };
}

async function getImages(id: number) {
  const [p] = await db().select({ images: products.images }).from(products).where(eq(products.id, id));
  return p?.images ?? [];
}
async function setImages(id: number, images: string[]) {
  await db().update(products).set({ images: [...new Set(images)].slice(0, 12), updatedAt: new Date() }).where(eq(products.id, id));
  revalidatePath(`/jualan/${id}`);
  revalidatePath("/jualan");
}

export async function addProductImages(id: number, _: ActionState, f: FormData): Promise<ActionState> {
  const s = await requireSession();
  const refs: string[] = [];
  const url = str(f, "imageUrl", 2000);
  if (url) {
    if (!isUrl(url)) return { ok: false, message: "Link gambar harus diawali https://" };
    refs.push(url);
  }
  for (const file of f.getAll("file").filter((x): x is File => x instanceof File && x.size > 0).slice(0, 8)) {
    if (file.size > 12 * 1024 * 1024) return { ok: false, message: `${file.name} lebih dari 12 MB` };
    try {
      const data = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
      const m = await sharp(data).metadata();
      const [a] = await db()
        .insert(schema.assets)
        .values({ data, mime: "image/jpeg", width: m.width, height: m.height, name: file.name.slice(0, 120), uploadedBy: Number(s.userId) })
        .returning({ id: schema.assets.id });
      refs.push(`asset:${a.id}`);
    } catch {
      return { ok: false, message: `${file.name} bukan gambar yang valid` };
    }
  }
  if (!refs.length) return { ok: false, message: "Tempel link gambar atau pilih file" };
  await setImages(id, [...(await getImages(id)), ...refs]);
  return { ok: true, message: `${refs.length} gambar ditambahkan` };
}

export async function removeProductImage(id: number, ref: string) {
  await requireSession();
  await setImages(id, (await getImages(id)).filter((x) => x !== ref));
}

export async function setMainProductImage(id: number, ref: string) {
  await requireSession();
  const imgs = await getImages(id);
  await setImages(id, [ref, ...imgs.filter((x) => x !== ref)]);
}

export async function rescrapeProduct(id: number): Promise<ActionState> {
  await requireSession();
  const [p] = await db().select().from(products).where(eq(products.id, id));
  if (!p) return { ok: false, message: "Produk tidak ditemukan" };
  const s = await scrapeProduct(p.url || p.affiliateUrl);
  const got = [s.name && "nama", s.price && "harga", s.rating && "rating", s.images.length && `${s.images.length} gambar`].filter(Boolean);
  if (!got.length) return { ok: false, message: "Tidak ada data yang bisa diambil (toko memblokir bot / halaman dirender JavaScript). Isi manual ya." };
  await db()
    .update(products)
    .set({
      price: s.price ?? p.price,
      originalPrice: s.originalPrice ?? p.originalPrice,
      rating: s.rating ?? p.rating,
      sold: s.sold ?? p.sold,
      images: [...new Set([...p.images, ...s.images])].slice(0, 12),
      description: p.description || s.description || "",
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));
  revalidatePath(`/jualan/${id}`);
  return { ok: true, message: `Diperbarui: ${got.join(", ")}` };
}

export async function toggleProduct(id: number) {
  await requireSession();
  const [p] = await db().select({ active: products.active }).from(products).where(eq(products.id, id));
  if (p) await db().update(products).set({ active: !p.active, updatedAt: new Date() }).where(eq(products.id, id));
  revalidatePath("/jualan");
}

export async function deleteProduct(id: number) {
  await requireSession();
  await db().delete(products).where(eq(products.id, id));
  revalidatePath("/jualan");
  redirect("/jualan");
}

/** Impor CSV (mis. ekspor dari Shopee Affiliate / Tokopedia Affiliate, atau buatan sendiri). */
export async function importProductsCsv(_: ActionState, f: FormData): Promise<ActionState> {
  await requireSession();
  const file = f.get("file");
  let text = str(f, "csv", 500_000);
  if (file instanceof File && file.size) {
    if (file.size > 2 * 1024 * 1024) return { ok: false, message: "File CSV maksimal 2 MB" };
    text = (await file.text()).replace(/^﻿/, "");
  }
  if (!text) return { ok: false, message: "Pilih file CSV atau tempel isinya" };
  const rows = parseCsv(text);
  if (!rows.length) return { ok: false, message: "CSV kosong atau tidak ada baris data" };
  let added = 0;
  const skipped: number[] = [];
  for (const [i, r] of rows.slice(0, 500).entries()) {
    const name = csvValue(r, "name").slice(0, 200);
    const url = csvValue(r, "url");
    const aff = csvValue(r, "affiliateUrl");
    if (!name || (!isUrl(url) && !isUrl(aff))) {
      skipped.push(i + 2);
      continue;
    }
    const rating = Number(csvValue(r, "rating").replace(",", "."));
    const img = csvValue(r, "image");
    await insertProduct({
      name,
      url: isUrl(url) ? url : "",
      affiliateUrl: isUrl(aff) ? aff : "",
      platform: detectPlatform(isUrl(url) ? url : aff),
      price: parsePrice(csvValue(r, "price")) ?? null,
      originalPrice: parsePrice(csvValue(r, "originalPrice")) ?? null,
      rating: rating > 0 && rating <= 5 ? rating : null,
      sold: parseCount(csvValue(r, "sold")) ?? null,
      images: isUrl(img) ? [img] : [],
      category: csvValue(r, "category").slice(0, 60),
      notes: csvValue(r, "notes").slice(0, 1500),
      promo: csvValue(r, "promo").slice(0, 200),
      description: csvValue(r, "description").slice(0, 2000),
    });
    added++;
  }
  revalidatePath("/jualan");
  const tail = skipped.length ? ` · ${skipped.length} baris dilewati (nama/link kosong: baris ${skipped.slice(0, 8).join(", ")}${skipped.length > 8 ? "…" : ""})` : "";
  return { ok: added > 0, message: `${added} produk diimpor${tail}` };
}

/** Pilih produk → AI menulis konten jualan → buka halaman review. */
export async function createSalesContent(_: ActionState, f: FormData): Promise<ActionState> {
  await requireSession();
  const ids = f.getAll("product").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const type = str(f, "type");
  const notes = str(f, "notes", 1000);
  if (!isSalesType(type)) return { ok: false, message: "Pilih jenis konten" };
  const [min, max] = SALES_LIMITS[type as SalesType];
  if (ids.length < min) return { ok: false, message: type === "promo" ? "Centang 1 produk" : `Centang minimal ${min} produk` };
  if (ids.length > max) return { ok: false, message: type === "promo" ? "Promo hanya untuk 1 produk — pakai Rekomendasi untuk beberapa produk" : `Maksimal ${max} produk untuk ${type}` };
  let postId: number;
  try {
    postId = await createSalesPost(ids, type as SalesType, notes || undefined);
  } catch (e) {
    return { ok: false, message: `Gagal menulis: ${(e as Error).message}. Detail di halaman Log.` };
  }
  try {
    await renderPost(postId);
  } catch {
    /* Designer akan mencoba lagi */
  }
  revalidatePath("/review");
  redirect(`/review/${postId}`);
}

export async function saveSalesSettings(_: ActionState, f: FormData): Promise<ActionState> {
  await assertAdmin();
  await saveSettings({ salesDisclosure: str(f, "salesDisclosure", 400), salesCta: str(f, "salesCta", 200) || "Link produk ada di bio." });
  revalidatePath("/jualan");
  return { ok: true, message: "Disimpan" };
}
