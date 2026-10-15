import { getActiveSession } from "@/lib/auth";
import { getPost } from "@/lib/data";
import { getAllRenders } from "@/lib/render";
import { slidesToPdf } from "@/lib/publish/platforms";

export const dynamic = "force-dynamic";

/** Unduh carousel sebagai PDF (untuk posting dokumen LinkedIn manual). Slide CTA "link di bio" dilewati. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getActiveSession())) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const post = await getPost(Number(id));
  if (!post) return new Response("not found", { status: 404 });
  const renders = await getAllRenders(post.id);
  if (!renders.length) return new Response("Belum dirender", { status: 409 });
  const all = new URL(req.url).searchParams.get("all") === "1";
  const keep = renders.filter((r) => all || post.slides[r.idx - 1]?.kind !== "cta");
  const pdf = await slidesToPdf((keep.length ? keep : renders).map((r) => r.data), post.headline);
  const slug = post.headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `post-${post.id}`;
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${slug}.pdf"` } });
}
