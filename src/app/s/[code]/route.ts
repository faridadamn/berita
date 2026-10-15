import { NextResponse } from "next/server";
import { appUrl } from "@/lib/channels";
import { getPostByShortCode, recordClick } from "@/lib/data";

/** Asal publik (bukan host internal di belakang reverse proxy). */
function publicBase(req: Request) {
  const fromEnv = appUrl();
  if (fromEnv) return fromEnv;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}` : new URL(req.url).origin;
}

const BOT = /bot|crawl|spider|preview|facebookexternalhit|slurp|whatsapp|telegram|discord|skype|embedly|vkshare|quora link/i;

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const post = await getPostByShortCode(code);
  if (!post || !/^https?:\/\//.test(post.sourceUrl)) return NextResponse.redirect(`${publicBase(req)}/baca`, 302);
  // jangan hitung bot / preview link (WhatsApp, Telegram, crawler) dan prefetch browser
  const ua = req.headers.get("user-agent") ?? "";
  const prefetch = req.headers.get("purpose") === "prefetch" || req.headers.get("sec-purpose")?.includes("prefetch") || req.headers.has("next-router-prefetch");
  if (!BOT.test(ua) && !prefetch) await recordClick(post.id, req.headers.get("referer"));
  return NextResponse.redirect(post.sourceUrl, 302);
}
