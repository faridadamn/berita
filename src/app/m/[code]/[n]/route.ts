import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRender } from "@/lib/render";

export const dynamic = "force-dynamic";

/**
 * Gambar render publik: /m/<shortCode>/<n>.jpg
 * Wajib publik karena Instagram & Threads mengambil gambar dari URL saat posting.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string; n: string }> }) {
  const { code, n } = await params;
  const idx = parseInt(n, 10);
  if (!idx || idx < 1) return new Response("not found", { status: 404 });
  const [p] = await db().select({ id: schema.posts.id }).from(schema.posts).where(eq(schema.posts.shortCode, code));
  if (!p) return new Response("not found", { status: 404 });
  const r = await getRender(p.id, idx);
  if (!r) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(r.data), {
    headers: {
      "content-type": r.mime,
      "content-length": String(r.data.length),
      "cache-control": "public, max-age=300",
      "last-modified": r.createdAt.toUTCString(),
    },
  });
}
