import { NextResponse } from "next/server";
import { getProductByShortCode, recordProductClick } from "@/lib/products";
import { isBotOrPrefetch, publicBase } from "@/lib/public-url";

export const dynamic = "force-dynamic";

/** Link produk: /p/:code?c=<kanal>&post=<id> → link affiliate, klik dicatat per kanal. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = await getProductByShortCode(code);
  const target = p?.affiliateUrl || p?.url;
  if (!p || !target) return NextResponse.redirect(`${publicBase(req)}/baca`, 302);
  const q = new URL(req.url).searchParams;
  const channel = (q.get("c") ?? "").replace(/[^\w-]/g, "").slice(0, 20) || null;
  const postId = Number(q.get("post"));
  if (!isBotOrPrefetch(req)) {
    try {
      await recordProductClick(p.id, { channel, postId: Number.isInteger(postId) && postId > 0 ? postId : null, referrer: req.headers.get("referer") });
    } catch {
      // post sudah dihapus dll — tetap catat tanpa post
      await recordProductClick(p.id, { channel, referrer: req.headers.get("referer") }).catch(() => {});
    }
  }
  return NextResponse.redirect(target, 302);
}
