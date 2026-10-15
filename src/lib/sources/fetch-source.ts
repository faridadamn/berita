import "server-only";
import { UA, stripHtml } from "../agents/common";
import { extractImages } from "../images";
import { githubOgImage } from "../content";

export type SourceContent = {
  title: string | null;
  text: string;
  images: string[];
  meta: Record<string, string | number>;
  /** jenis sumber yang terdeteksi */
  kind: "article" | "github" | "youtube";
};

const metaTag = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i"))?.[1] ??
  null;

const decode = (s: string | null) => (s ? stripHtml(s) : null);

/** Repo GitHub: info repo + README lewat API resmi (tanpa key: 60 request/jam; isi GITHUB_TOKEN untuk lebih). */
async function fetchGithub(owner: string, repo: string): Promise<SourceContent | null> {
  const h: Record<string, string> = { "user-agent": UA, accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const base = (process.env.GITHUB_API_BASE ?? "https://api.github.com").replace(/\/+$/, "");
  try {
    const r = await fetch(`${base}/repos/${owner}/${repo}`, { headers: h, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return null;
    const j = await r.json();
    let readme = "";
    const rr = await fetch(`${base}/repos/${owner}/${repo}/readme`, { headers: { ...h, accept: "application/vnd.github.raw" }, signal: AbortSignal.timeout(12_000) });
    if (rr.ok) readme = await rr.text();
    // buang badge, gambar, html, tabel panjang
    const clean = readme
      .replace(/<[^>]+>/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
      .replace(/^\s*\|.*\|\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const imgs = [...readme.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+\.(?:png|jpe?g|webp))\)/gi)].map((m) => m[1]).filter((u) => !/badge|shields\.io|img\.shields/i.test(u));
    return {
      kind: "github",
      title: `${j.full_name}${j.description ? ` — ${j.description}` : ""}`,
      text:
        `REPO: ${j.full_name}\nDESKRIPSI: ${j.description ?? "-"}\nBINTANG: ${j.stargazers_count} · FORK: ${j.forks_count} · BAHASA: ${j.language ?? "-"} · LISENSI: ${j.license?.spdx_id ?? "-"}\n` +
        `TOPIK: ${(j.topics ?? []).join(", ") || "-"}\nHOMEPAGE: ${j.homepage || "-"}\nUPDATE TERAKHIR: ${j.pushed_at}\n\nREADME:\n${clean.slice(0, 7000)}`,
      images: [githubOgImage(`https://github.com/${owner}/${repo}`)!, ...imgs].slice(0, 8),
      meta: { stars: j.stargazers_count, language: j.language ?? "", license: j.license?.spdx_id ?? "", repo: j.full_name },
    };
  } catch {
    return null;
  }
}

/** Ambil isi sumber (artikel / repo GitHub / video YouTube) untuk Copywriter. Best effort. */
export async function fetchSource(url: string): Promise<SourceContent> {
  const gh = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/i.exec(url);
  if (gh && !["orgs", "topics", "trending", "collections", "sponsors"].includes(gh[1])) {
    const r = await fetchGithub(gh[1], gh[2]);
    if (r) return r;
  }
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html", "accept-language": "id,en;q=0.8" }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
    if (!res.ok) return { kind: "article", title: null, text: "", images: githubOgImage(url) ? [githubOgImage(url)!] : [], meta: {} };
    const html = (await res.text()).slice(0, 2_000_000);
    const title = decode(metaTag(html, "og:title")) ?? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null);
    const yt = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
    if (yt) {
      const desc = decode(metaTag(html, "og:description")) ?? "";
      const longDesc = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
      return {
        kind: "youtube",
        title,
        text: `VIDEO YOUTUBE: ${title ?? ""}\nKANAL: ${decode(metaTag(html, "og:site_name")) ?? ""}\nDESKRIPSI:\n${longDesc ? JSON.parse(`"${longDesc}"`) : desc}`.slice(0, 6000),
        images: [`https://i.ytimg.com/vi/${yt[1]}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`],
        meta: { video: yt[1] },
      };
    }
    const scope = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
    const blocks = [...scope.matchAll(/<(p|h2|h3|li|pre)[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((m) => (m[1].toLowerCase() === "pre" ? "```\n" + stripHtml(m[2]) + "\n```" : (m[1].startsWith("h") ? "## " : m[1] === "li" ? "- " : "") + stripHtml(m[2])))
      .filter((p) => p.length > 25 || p.startsWith("```") || p.startsWith("## "));
    const desc = decode(metaTag(html, "og:description") ?? metaTag(html, "description"));
    return {
      kind: "article",
      title,
      text: (blocks.join("\n") || desc || "").slice(0, 7000),
      images: extractImages(html, url),
      meta: {},
    };
  } catch {
    return { kind: "article", title: null, text: "", images: githubOgImage(url) ? [githubOgImage(url)!] : [], meta: {} };
  }
}
