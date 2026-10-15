import { NextResponse } from "next/server";
import { getPostByShortCode, recordClick } from "@/lib/data";
import { getProductsByIds } from "@/lib/products";
import { isBotOrPrefetch, publicBase } from "@/lib/public-url";

export const dynamic = "force-dynamic";

/**
 * Shortlink post. Berita → artikel asli. Post jualan: 1 produk → link affiliate (lewat /p/ supaya
 * klik produk tercatat), beberapa produk → halaman daftar /baca/:code.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const base = publicBase(req);
  const post = await getPostByShortCode(code);
  if (!post) return NextResponse.redirect(`${base}/baca`, 302);
  const channel = (new URL(req.url).searchParams.get("c") ?? "link").replace(/[^\w-]/g, "").slice(0, 20) || "link";

  if (post.productIds.length) {
    if (!isBotOrPrefetch(req)) await recordClick(post.id, req.headers.get("referer"));
    if (post.productIds.length === 1) {
      const [p] = await getProductsByIds(post.productIds);
      if (p) return NextResponse.redirect(`${base}/p/${p.shortCode}?c=${channel}&post=${post.id}`, 302);
    }
    return NextResponse.redirect(`${base}/baca/${post.shortCode}?c=${channel}`, 302);
  }

  if (!/^https?:\/\//.test(post.sourceUrl)) return NextResponse.redirect(`${base}/baca`, 302);
  if (!isBotOrPrefetch(req)) await recordClick(post.id, req.headers.get("referer"));
  return NextResponse.redirect(post.sourceUrl, 302);
}
