import "server-only";
import { XMLParser } from "fast-xml-parser";
import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "../settings";
import { UA, logRun, stripHtml } from "./common";

type FeedItem = { title: string; url: string; summary: string; imageUrl: string | null; publishedAt: Date | null };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  processEntities: true,
});

const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** Ambil teks dari node XML yang bisa berupa string / {#text} / {#cdata}. */
function text(n: unknown): string {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return text(n[0]);
  const o = n as Record<string, unknown>;
  return text(o["#cdata"] ?? o["#text"] ?? "");
}

function firstImg(html: string) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function imageOf(it: Record<string, any>, html: string): string | null {
  const media = [...arr(it["media:content"]), ...arr(it["media:group"]?.["media:content"])];
  for (const m of media) {
    if (m?.["@url"] && (!m["@medium"] || m["@medium"] === "image") && !/\.(mp4|mp3)(\?|$)/i.test(m["@url"])) return m["@url"];
  }
  const thumb = arr(it["media:thumbnail"])[0];
  if (thumb?.["@url"]) return thumb["@url"];
  for (const e of arr(it.enclosure)) if (e?.["@url"] && String(e["@type"] ?? "").startsWith("image")) return e["@url"];
  return firstImg(html);
}

export function parseFeed(xml: string): FeedItem[] {
  const j = parser.parse(xml);
  const out: FeedItem[] = [];

  // RSS 2.0 / RDF
  const channel = j.rss?.channel ?? j["rdf:RDF"];
  if (channel) {
    for (const it of arr<Record<string, any>>(channel.item ?? j["rdf:RDF"]?.item)) {
      const html = text(it["content:encoded"]) || text(it.description);
      const url = text(it.link) || text(it.guid);
      if (!url) continue;
      const date = text(it.pubDate) || text(it["dc:date"]);
      out.push({
        title: stripHtml(text(it.title)),
        url: url.trim(),
        summary: stripHtml(html).slice(0, 1500),
        imageUrl: imageOf(it, html),
        publishedAt: date ? new Date(date) : null,
      });
    }
    return out;
  }

  // Atom
  for (const e of arr<Record<string, any>>(j.feed?.entry)) {
    const links = arr<Record<string, any>>(e.link);
    const link = links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0];
    const url = link?.["@href"] ?? text(e.id);
    if (!url) continue;
    const html = text(e.content) || text(e.summary);
    const date = text(e.published) || text(e.updated);
    out.push({
      title: stripHtml(text(e.title)),
      url: String(url).trim(),
      summary: stripHtml(html).slice(0, 1500),
      imageUrl: imageOf(e, html),
      publishedAt: date ? new Date(date) : null,
    });
  }
  return out;
}

/** Ambil semua feed aktif, simpan topik baru. */
export async function runScout() {
  const s = await getSettings();
  const list = await db().select().from(schema.sources).where(eq(schema.sources.active, true));
  if (!list.length) {
    await logRun("scout", "Belum ada sumber aktif — tambahkan di Admin → Sumber Topik", { ok: false });
    return { found: 0 };
  }
  const minDate = new Date(Date.now() - s.maxTopicAgeHours * 3600_000);
  let found = 0;
  const errors: string[] = [];

  await Promise.all(
    list.map(async (src) => {
      try {
        const res = await fetch(src.feedUrl, {
          headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = parseFeed(await res.text()).filter(
          (i) => i.title && /^https?:\/\//.test(i.url) && (!i.publishedAt || isNaN(+i.publishedAt) || i.publishedAt >= minDate),
        );
        if (items.length) {
          const inserted = await db()
            .insert(schema.topics)
            .values(
              items.slice(0, 30).map((i) => ({
                sourceId: src.id,
                title: i.title.slice(0, 500),
                url: i.url,
                summary: i.summary || null,
                imageUrl: i.imageUrl,
                category: src.category,
                publishedAt: i.publishedAt && !isNaN(+i.publishedAt) ? i.publishedAt : null,
              })),
            )
            .onConflictDoNothing({ target: schema.topics.url })
            .returning({ id: schema.topics.id });
          found += inserted.length;
        }
        await db().update(schema.sources).set({ lastFetchedAt: new Date(), lastError: null }).where(eq(schema.sources.id, src.id));
      } catch (e) {
        const msg = (e as Error).name === "TimeoutError" ? "Timeout" : (e as Error).message;
        errors.push(`${src.name}: ${msg}`);
        await db().update(schema.sources).set({ lastFetchedAt: new Date(), lastError: msg.slice(0, 300) }).where(eq(schema.sources.id, src.id));
      }
    }),
  );

  // topik lama yang tidak sempat dinilai → kedaluwarsa
  await db()
    .update(schema.topics)
    .set({ status: "rejected", scoreReason: "Kedaluwarsa sebelum dinilai" })
    .where(and(eq(schema.topics.status, "new"), lt(schema.topics.fetchedAt, minDate)));

  const msg = found ? `Menemukan ${found} topik baru` : "Belum ada topik baru";
  await logRun("scout", errors.length ? `${msg} · ${errors.length} sumber gagal (${errors.join("; ")})` : msg, {
    ok: errors.length < list.length,
  });
  return { found, errors };
}
