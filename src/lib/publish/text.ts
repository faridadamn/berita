/**
 * Menyusun teks final per platform. Dipakai publisher (server) dan panel copy manual (browser),
 * jadi tidak boleh import modul server.
 */
export type TextSource = {
  headline: string;
  caption: string;
  hashtags: string[];
  platformText: { threads?: string; x?: string; linkedin?: string };
};

export const LIMITS = { instagram: 2200, threads: 500, x: 280, linkedin: 3000 } as const;

/** Panjang ala X: URL = 23, karakter di luar Latin/umum (emoji, CJK) = 2. */
export function xLength(s: string) {
  let n = 0;
  const withoutUrls = s.replace(/https?:\/\/\S+/g, () => {
    n += 23;
    return "";
  });
  for (const ch of withoutUrls) n += /[\u0000-ჿ -‍‐-‟′-‷]/.test(ch) ? 1 : 2;
  return n;
}

const cut = (s: string, max: number) => {
  const chars = [...s];
  if (chars.length <= max) return s;
  return chars.slice(0, Math.max(0, max - 1)).join("").replace(/\s+\S*$/, "") + "…";
};

export function firstParagraph(caption: string) {
  return caption.split(/\n\s*\n/)[0]?.trim() ?? "";
}

/** Default kalau Copywriter belum membuat teks khusus. */
export function defaultThreads(src: TextSource) {
  return src.platformText.threads?.trim() || `${src.headline}\n\n${firstParagraph(src.caption)}`.trim();
}
export function defaultX(src: TextSource) {
  return src.platformText.x?.trim() || src.headline;
}

export function composeInstagram(src: TextSource) {
  const tags = src.hashtags.join(" ");
  return cut(tags ? `${src.caption.trim()}\n\n${tags}` : src.caption.trim(), LIMITS.instagram);
}

/** LinkedIn: teks khusus (atau caption), hashtag di akhir, link artikel di bawah. */
export function composeLinkedIn(src: TextSource, link: string | null) {
  const base = (src.platformText.linkedin?.trim() || src.caption.trim()).replace(/\n*(link (ada )?di bio|klik link di bio)[^\n]*$/i, "");
  const hasTags = /(^|\s)#\w/.test(base);
  const tags = hasTags ? "" : src.hashtags.slice(0, 4).join(" ");
  const tail = [link ? `🔗 ${link}` : "", tags].filter(Boolean).join("\n\n");
  return cut(base, LIMITS.linkedin - [...tail].length - 4) + (tail ? `\n\n${tail}` : "");
}

export function composeThreads(src: TextSource, link: string | null) {
  const tail = link ? `\n\n${link}` : "";
  return cut(defaultThreads(src), LIMITS.threads - [...tail].length) + tail;
}

export function composeX(src: TextSource, link: string | null) {
  const tail = link ? `\n\n${link}` : "";
  let body = defaultX(src);
  const budget = LIMITS.x - (link ? 25 : 0);
  while (xLength(body) > budget && body.length > 1) body = cut(body, [...body].length - 5);
  return body + tail;
}
