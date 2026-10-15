import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

/** Foto utama produk aktif untuk halaman publik /baca (asset upload tidak publik di /a/). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p] = await db().select({ images: schema.products.images, active: schema.products.active }).from(schema.products).where(eq(schema.products.id, Number(id)));
  const ref = p?.active ? p.images[0] : null;
  if (!ref) return new Response("not found", { status: 404 });
  const m = /^asset:(\d+)$/.exec(ref);
  if (!m) return Response.redirect(ref, 302);
  const [a] = await db().select({ data: schema.assets.data }).from(schema.assets).where(eq(schema.assets.id, Number(m[1])));
  if (!a) return new Response("not found", { status: 404 });
  const jpg = await sharp(a.data).resize(600, 600, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" } });
}
