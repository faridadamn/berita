import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getActiveSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Gambar yang diunggah tim (hanya untuk anggota tim). Renderer membacanya langsung dari DB. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getActiveSession())) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const [a] = await db().select().from(schema.assets).where(eq(schema.assets.id, parseInt(id, 10) || 0));
  if (!a) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(a.data), { headers: { "content-type": a.mime, "cache-control": "private, max-age=86400, immutable" } });
}
