import "server-only";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { BrandKit } from "../brand";
import type { ProductView, Slide } from "../content";
import { loadProductViews, type PostForRender } from ".";

/** Slide contoh untuk preview Brand Kit (pakai foto topik & produk katalog terbaru kalau ada). */
export const SAMPLE_SLIDES: Slide[] = [
  { kind: "cover", headline: "5 cara bikin konten konsisten tiap minggu", body: "Tanpa harus begadang tiap malam. Geser buat lihat caranya." },
  { kind: "list", headline: "Yang perlu kamu siapkan", items: ["Satu pilar konten utama", "Template visual tetap", "Jadwal posting realistis", "Bank ide di catatan"] },
  { kind: "step", step: 1, headline: "Tentukan pilar konten", body: "Pilih 3 topik yang paling dekat dengan audiensmu, lalu rotasi tiap minggu." },
  { kind: "product", productId: -1, step: 1, headline: "Tripod yang aku pakai tiap hari", body: "Kokoh, ringan, dan muat di tas." },
  { kind: "compare", productIds: [-1, -2], pick: 1, headline: "Mana yang cocok buat kamu?", items: ["Kreator yang sering jalan", "Studio di rumah"] },
  { kind: "cta", headline: "Simpan & share", body: "Follow untuk tips konten tiap hari, dan cek link di bio." },
];

const FAKE: ProductView[] = [
  { id: -1, name: "Tripod Ringan 170cm + Holder HP & Remote Bluetooth", platform: "shopee", price: 129000, originalPrice: 199000, currency: "IDR", rating: 4.8, sold: 8200, image: null },
  { id: -2, name: "Ring Light 26cm dengan Stand 2 Meter", platform: "tokopedia", price: 159000, originalPrice: null, currency: "IDR", rating: 4.7, sold: 3100, image: null },
];

export async function samplePost(kit: BrandKit): Promise<PostForRender> {
  const [topic] = await db()
    .select({ imageUrl: schema.topics.imageUrl })
    .from(schema.topics)
    .where(isNotNull(schema.topics.imageUrl))
    .orderBy(desc(schema.topics.fetchedAt))
    .limit(1);
  const real = await db()
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.active, true))
    .orderBy(desc(schema.products.updatedAt))
    .limit(2);
  const views = await loadProductViews(real.map((r) => r.id));
  const list = real.map((r) => views[r.id]).filter(Boolean);
  // produk asli dari katalog (kalau ada) menggantikan contoh, id tetap -1/-2
  const products: Record<number, ProductView> = {
    [-1]: list[0] ? { ...list[0], id: -1 } : FAKE[0],
    [-2]: list[1] ? { ...list[1], id: -2 } : FAKE[1],
  };
  const now = new Date();
  return {
    id: 7,
    topicId: null,
    contentType: "tips",
    kicker: "Tips",
    headline: SAMPLE_SLIDES[0].headline,
    headlineAlternatives: [],
    caption: "",
    hashtags: [],
    template: "brand",
    format: "carousel",
    slides: SAMPLE_SLIDES,
    images: [],
    platformText: {},
    productIds: [],
    renderedAt: null,
    renderHash: null,
    idempotencyKey: null,
    renderError: null,
    status: "review",
    shortCode: "contoh",
    scheduledAt: null,
    postedAt: null,
    igPermalink: null,
    views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0,
    reviewedBy: null,
    createdAt: now,
    updatedAt: now,
    imageUrl: topic?.imageUrl ?? null,
    sourceName: "",
    kit,
    products,
  };
}
