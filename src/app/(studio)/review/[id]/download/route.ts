import { zipSync } from "fflate";
import { getActiveSession } from "@/lib/auth";
import { getPost } from "@/lib/data";
import { getAllRenders } from "@/lib/render";

export const dynamic = "force-dynamic";

/** Unduh semua slide hasil render (+ caption.txt) sebagai ZIP. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getActiveSession())) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const post = await getPost(Number(id));
  if (!post) return new Response("not found", { status: 404 });
  const renders = await getAllRenders(post.id);
  if (!renders.length) return new Response("Belum dirender", { status: 409 });
  const files: Record<string, Uint8Array> = {};
  for (const r of renders) files[`slide-${String(r.idx).padStart(2, "0")}.jpg`] = new Uint8Array(r.data);
  files["caption-instagram.txt"] = new TextEncoder().encode(`${post.caption}\n\n${post.hashtags.join(" ")}`);
  const zip = zipSync(files, { level: 0 });
  const slug = post.headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `post-${post.id}`;
  return new Response(zip, {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${slug}.zip"` },
  });
}
