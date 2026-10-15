import "server-only";
import { appUrl } from "./channels";

/** Asal publik (bukan host internal di belakang reverse proxy), termasuk basePath. */
export function publicBase(req: Request) {
  const fromEnv = appUrl();
  if (fromEnv) return fromEnv;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}` : new URL(req.url).origin;
}

const BOT = /bot|crawl|spider|preview|facebookexternalhit|slurp|whatsapp|telegram|discord|skype|embedly|vkshare|quora link/i;

/** Bot / preview link / prefetch browser → jangan dihitung sebagai klik. */
export function isBotOrPrefetch(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  const prefetch =
    req.headers.get("purpose") === "prefetch" || !!req.headers.get("sec-purpose")?.includes("prefetch") || req.headers.has("next-router-prefetch");
  return BOT.test(ua) || prefetch;
}
