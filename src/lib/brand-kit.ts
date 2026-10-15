import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { brand as envBrand } from "./config";
import { defaultBrandKit, normalizeKit, type BrandKit } from "./brand";

const KEY = "brandKit";
let cached: { at: number; kit: BrandKit } | null = null;

export const baseKit = () => defaultBrandKit(envBrand.name, envBrand.handle);

/** Brand Kit aktif (DB → default dari env). Di-cache sebentar karena dipanggil tiap render. */
export async function getBrandKit(): Promise<BrandKit> {
  if (cached && Date.now() - cached.at < 10_000) return cached.kit;
  let kit = baseKit();
  try {
    const [row] = await db().select().from(schema.settings).where(eq(schema.settings.key, KEY));
    if (row) kit = normalizeKit(row.value, kit);
  } catch {
    /* DB belum siap → default */
  }
  cached = { at: Date.now(), kit };
  return kit;
}

export async function saveBrandKit(kit: BrandKit) {
  const value = { ...kit, version: (kit.version ?? 0) + 1 };
  await db().insert(schema.settings).values({ key: KEY, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  cached = null;
  return value;
}

/** Nama & handle untuk prompt AI dan halaman publik. */
export async function getBrand() {
  const k = await getBrandKit();
  return { name: k.name, handle: k.handle };
}
