import "server-only";
import { UA } from "./agents/common";
import { githubOgImage } from "./content";

const BAD = /(logo|icon|avatar|sprite|pixel|badge|emoji|spinner|placeholder|tracking|1x1|gravatar|\.svg|\.gif)(\b|$|\?)/i;

/** Semua kandidat gambar dari halaman artikel: og:image, twitter:image, <img> di dalam <article>. */
export function extractImages(html: string, pageUrl: string) {
  const abs = (u: string) => {
    try {
      return new URL(u.replace(/&amp;/g, "&"), pageUrl).toString();
    } catch {
      return null;
    }
  };
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    if (!u) return;
    const a = abs(u.trim());
    if (a && /^https?:/.test(a) && !BAD.test(a) && !out.includes(a)) out.push(a);
  };
  for (const prop of ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "gi");
    for (const m of html.matchAll(re)) push(m[1] ?? m[2]);
  }
  const scope = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  for (const m of scope.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const w = Number(/\bwidth=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    if (w && w < 300) continue;
    const srcset = /\bsrcset=["']([^"']+)["']/i.exec(tag)?.[1];
    const best = srcset
      ?.split(",")
      .map((x) => x.trim().split(/\s+/))
      .sort((a, b) => parseInt(b[1] ?? "0") - parseInt(a[1] ?? "0"))[0]?.[0];
    push(best ?? /\b(?:data-src|src)=["']([^"']+)["']/i.exec(tag)?.[1]);
  }
  push(githubOgImage(pageUrl));
  return out.slice(0, 12);
}

export async function scrapeImages(url: string) {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
    if (!res.ok) return githubOgImage(url) ? [githubOgImage(url)!] : [];
    return extractImages((await res.text()).slice(0, 2_000_000), url);
  } catch {
    return githubOgImage(url) ? [githubOgImage(url)!] : [];
  }
}

/** Cari foto stok gratis (Pexels). Butuh PEXELS_API_KEY. */
export async function searchStock(query: string) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY belum diisi (daftar gratis di pexels.com/api)");
  const r = await fetch(`https://api.pexels.com/v1/search?per_page=18&orientation=portrait&query=${encodeURIComponent(query)}`, {
    headers: { authorization: key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Pexels HTTP ${r.status}`);
  const j = await r.json();
  return (j.photos ?? []).map((p: any) => ({ thumb: p.src.medium as string, url: p.src.large2x as string, credit: `Foto: ${p.photographer} / Pexels` }));
}
