"use server";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { assertAdmin } from "@/lib/auth";
import { normalizeKit, type BrandKit } from "@/lib/brand";
import { getBrandKit, saveBrandKit } from "@/lib/brand-kit";
import type { ActionState } from "./studio";

export async function saveBrandKitAction(json: string): Promise<ActionState & { kit?: BrandKit }> {
  await assertAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: "Data tidak valid" };
  }
  const current = await getBrandKit();
  const kit = await saveBrandKit(normalizeKit(raw, current));
  revalidatePath("/", "layout");
  return { ok: true, message: "Brand Kit disimpan. Post yang terdampak ditandai perlu render ulang.", kit };
}

/** Upload logo (PNG/SVG/JPG → PNG transparan maks 800px). */
export async function uploadLogo(form: FormData): Promise<ActionState & { ref?: string }> {
  const s = await assertAdmin();
  const f = form.get("file");
  if (!(f instanceof File) || !f.size) return { ok: false, message: "Pilih file logo" };
  if (f.size > 5 * 1024 * 1024) return { ok: false, message: "Logo maksimal 5 MB" };
  try {
    const data = await sharp(Buffer.from(await f.arrayBuffer()), { density: 300 })
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    const [a] = await db()
      .insert(schema.assets)
      .values({ data: data.data, mime: "image/png", width: data.info.width, height: data.info.height, name: `logo: ${f.name}`.slice(0, 120), uploadedBy: Number(s.userId) })
      .returning({ id: schema.assets.id });
    return { ok: true, message: "Logo diunggah — klik Simpan untuk memakai", ref: `asset:${a.id}` };
  } catch {
    return { ok: false, message: "File bukan gambar yang valid (pakai PNG transparan atau SVG)" };
  }
}

/** Upload font sendiri (TTF / OTF / WOFF — bukan WOFF2). */
export async function uploadFont(form: FormData): Promise<ActionState & { font?: { id: number; name: string } }> {
  const s = await assertAdmin();
  const f = form.get("file");
  if (!(f instanceof File) || !f.size) return { ok: false, message: "Pilih file font" };
  if (f.size > 3 * 1024 * 1024) return { ok: false, message: "Font maksimal 3 MB" };
  const buf = Buffer.from(await f.arrayBuffer());
  const sig = buf.subarray(0, 4).toString("latin1");
  const hex = buf.subarray(0, 4).toString("hex");
  if (sig === "wOF2") return { ok: false, message: "WOFF2 belum didukung renderer — pakai file .ttf, .otf, atau .woff" };
  const mime = sig === "wOFF" ? "font/woff" : sig === "OTTO" ? "font/otf" : hex === "00010000" || sig === "true" ? "font/ttf" : null;
  if (!mime) return { ok: false, message: "Bukan file font yang dikenali (.ttf / .otf / .woff)" };
  const name = f.name.replace(/\.(ttf|otf|woff)$/i, "").replace(/[-_]+/g, " ").slice(0, 40) || "Font";
  const [a] = await db()
    .insert(schema.assets)
    .values({ data: buf, mime, name: `font: ${name}`, uploadedBy: Number(s.userId) })
    .returning({ id: schema.assets.id });
  return { ok: true, message: `Font "${name}" diunggah — pilih di daftar font lalu Simpan`, font: { id: a.id, name } };
}
