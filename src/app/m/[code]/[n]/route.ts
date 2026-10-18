import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getRender } from "@/lib/render";
import { videoResponse } from "@/lib/video";

export const dynamic = "force-dynamic";

/**
 * Gambar render publik: /m/<shortCode>/<n>.jpg
 * Wajib publik karena Instagram & Threads mengambil gambar dari URL saat posting.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string; n: string }> }) {
  const { code, n } = await params;
  // /m/<kode>/video.mp4 — video Reels (diambil Instagram/Threads saat posting)
  if (n === "video.mp4") {
    const [v] = await db().select({ id: schema.posts.id }).from(schema.posts).where(eq(schema.posts.shortCode, code));
    if (!v) return new Response("not found", { status: 404 });
    return videoResponse(v.id, req, { cache: "public, max-age=300" });
  }
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
