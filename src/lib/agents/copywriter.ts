import "server-only";
import { randomBytes } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { complete, parseJson } from "../ai";
import { brand } from "../config";
import { getSettings } from "../settings";
import { UA, Usage, audience, brainFor, logRun, stripHtml } from "./common";

type Draft = {
  kicker: string;
  headline: string;
  alternatives: string[];
  subline: string;
  slides: { headline: string; body: string }[];
  caption: string;
  hashtags: string[];
};

const TEMPLATES = ["stabilo", "putih", "foto"] as const;

/** Ambil teks artikel + og:image (best effort; kalau gagal pakai ringkasan RSS). */
export async function fetchArticle(url: string) {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
    if (!res.ok) return { text: "", image: null as string | null };
    const html = (await res.text()).slice(0, 1_500_000);
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1] ??
      null;
    const scope = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
    const paras = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(m[1]))
      .filter((p) => p.length > 40);
    let image = meta("og:image") ?? meta("twitter:image");
    if (image && image.startsWith("/")) image = new URL(image, url).toString();
    return { text: paras.join("\n").slice(0, 6000), image };
  } catch {
    return { text: "", image: null };
  }
}

function shortCode() {
  return randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 6);
}

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Tulis draft untuk topik yang lolos Analis (skor tertinggi dulu). */
export async function runCopywriter() {
  const s = await getSettings();
  const queue = await db()
    .select({ t: schema.topics, sourceName: schema.sources.name })
    .from(schema.topics)
    .leftJoin(schema.sources, eq(schema.topics.sourceId, schema.sources.id))
    .where(eq(schema.topics.status, "passed"))
    .orderBy(desc(schema.topics.score), desc(schema.topics.fetchedAt))
    .limit(s.draftsPerRun);
  if (!queue.length) return { drafted: 0 };

  const brain = await brainFor("copywriter");
  const [{ n: existing }] = await db().select({ n: count() }).from(schema.posts);
  const usage = new Usage();
  let drafted = 0;
  const failed: string[] = [];

  for (const [i, { t, sourceName }] of queue.entries()) {
    const source = sourceName ?? new URL(t.url).hostname.replace(/^www\./, "");
    const article = await fetchArticle(t.url);
    const system =
      `Kamu adalah Copywriter di redaksi konten. ${audience()}\n` +
      `Tulis dalam ${s.language}. Ubah berita jadi carousel Instagram yang merangkum dengan sudut pandang sendiri — ` +
      `JANGAN menyalin kalimat artikel, JANGAN menambah fakta/angka yang tidak ada di sumber, dan selalu atribusikan ke ${source}.\n` +
      `Aturan:\n- headline: maks 9 kata, tajam, bikin penasaran tapi jujur (bukan clickbait menipu)\n` +
      `- alternatives: 2 headline alternatif\n- kicker: 1 kata kategori (mis. AI, Marketing, Sosmed)\n` +
      `- subline: 1 kalimat pendek opini/konteks di bawah headline cover\n` +
      `- slides: 2-4 slide isi, tiap slide {headline maks 6 kata, body maks 35 kata}\n` +
      `- caption: 2-4 paragraf pendek, akhiri dengan ajakan baca lengkap lewat link di bio ${brand.handle} dan sebut sumber ${source}\n` +
      `- hashtags: 3-6 hashtag relevan` +
      brain +
      `\n\nJawab HANYA JSON: {"kicker":"","headline":"","alternatives":["",""],"subline":"","slides":[{"headline":"","body":""}],"caption":"","hashtags":[""]}`;
    const prompt =
      `SUMBER: ${source}\nJUDUL: ${t.title}\nURL: ${t.url}\n\nRINGKASAN RSS:\n${(t.summary ?? "").slice(0, 1200)}\n\n` +
      (article.text ? `ISI ARTIKEL (potongan):\n${article.text}` : "(isi artikel tidak bisa diambil — tulis hanya dari judul & ringkasan, jangan mengarang detail)");

    try {
      const r = await complete({ system, prompt, json: true, temperature: 0.8, maxTokens: 2000 });
      usage.add(r);
      const d = parseJson<Draft>(r.text);
      const headline = clean(d.headline, 140);
      if (!headline) throw new Error("headline kosong");
      const slides = [
        { kind: "cover" as const, headline, body: clean(d.subline, 200) },
        ...(Array.isArray(d.slides) ? d.slides : [])
          .slice(0, 4)
          .map((x) => ({ kind: "body" as const, headline: clean(x.headline, 80), body: clean(x.body, 320) }))
          .filter((x) => x.headline || x.body),
        {
          kind: "cta" as const,
          headline: "Baca lengkapnya di link bio",
          body: `Buka profil ${brand.handle}, klik link di bio, lalu pilih postingan ini. Kamu langsung diarahkan ke artikel aslinya di ${source}.`,
        },
      ];
      const hashtags = (Array.isArray(d.hashtags) ? d.hashtags : [])
        .map((h) => "#" + String(h).replace(/^#+/, "").replace(/\s+/g, ""))
        .filter((h) => h.length > 1)
        .slice(0, 8);

      let attempts = 0;
      for (;;) {
        try {
          await db().insert(schema.posts).values({
            topicId: t.id,
            kicker: clean(d.kicker, 20) || t.category || "Info",
            headline,
            headlineAlternatives: (Array.isArray(d.alternatives) ? d.alternatives : []).map((a) => clean(a, 140)).filter(Boolean).slice(0, 3),
            caption: String(d.caption ?? "").trim().slice(0, 2100),
            hashtags,
            template: TEMPLATES[(Number(existing) + i) % TEMPLATES.length],
            format: "carousel",
            slides,
            shortCode: shortCode(),
            status: "review",
          });
          break;
        } catch (e) {
          if (++attempts > 3 || !/short_code/.test(String((e as Error).message))) throw e;
        }
      }
      await db()
        .update(schema.topics)
        .set({ status: "drafted", ...(article.image && !t.imageUrl ? { imageUrl: article.image } : {}) })
        .where(eq(schema.topics.id, t.id));
      drafted++;
    } catch (e) {
      failed.push(`#${t.id}: ${(e as Error).message}`);
      await db().update(schema.topics).set({ status: "failed", scoreReason: `Gagal ditulis: ${(e as Error).message}`.slice(0, 500) }).where(eq(schema.topics.id, t.id));
    }
  }

  const msg = `Menulis headline & caption untuk ${drafted} topik` + (failed.length ? ` · ${failed.length} gagal (${failed.join("; ")})` : "");
  await logRun("copywriter", msg, { ok: drafted > 0 || !failed.length, usage });
  return { drafted, failed };
}
