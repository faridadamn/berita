import "server-only";
import { randomBytes } from "node:crypto";
import { count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AiError, completeJson } from "../ai";
import { brand } from "../config";
import { TEMPLATE_ROTATION, isContentType, type ContentType, type Slide } from "../content";
import { getSettings } from "../settings";
import { fetchSource, type SourceContent } from "../sources/fetch-source";
import { Usage, audience, brainFor, logRun } from "./common";

type Topic = typeof schema.topics.$inferSelect;

type Common = {
  kicker: string;
  headline: string;
  alternatives: string[];
  subline: string;
  caption: string;
  hashtags: string[];
  threads: string;
  x: string;
  linkedin: string;
};
type Pair = { headline: string; body: string };
type Draft = Common & {
  slides?: Pair[]; // berita, opini
  prerequisites?: string; // tutorial
  steps?: (Pair & { code?: string; lang?: string })[];
  overview?: Pair; // review
  features?: string[];
  install?: { code: string; lang?: string };
  rating?: number;
  pros?: string[];
  cons?: string[];
  verdict?: string;
  tips?: Pair[]; // tips
};

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const shortCode = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 6);
export const isRealUrl = (u: string) => /^https?:\/\//.test(u);

/* ───────────── Spesifikasi per jenis konten ───────────── */

const FORMAT: Record<ContentType, { rules: string; shape: string; check: (d: Draft) => string | null }> = {
  berita: {
    rules:
      `Ubah berita jadi carousel yang merangkum dengan sudut pandang sendiri.\n` +
      `- slides: 2-4 slide isi, tiap slide {headline maks 6 kata, body maks 35 kata}`,
    shape: `"slides":[{"headline":"","body":""}]`,
    check: (d) => (arr(d.slides).length ? null : "slides kosong"),
  },
  opini: {
    rules:
      `Tulis satu argumen/insight yang kuat berdasarkan sumber, dengan 3-4 poin pendukung.\n` +
      `- slides: 3-4 poin, tiap {headline maks 7 kata berupa klaim, body maks 35 kata alasan/bukti dari sumber}`,
    shape: `"slides":[{"headline":"","body":""}]`,
    check: (d) => (arr(d.slides).length ? null : "slides kosong"),
  },
  tutorial: {
    rules:
      `Buat TUTORIAL langkah demi langkah yang bisa langsung dipraktikkan, HANYA berdasarkan sumber.\n` +
      `- prerequisites: 1 kalimat yang perlu disiapkan (boleh kosong)\n` +
      `- steps: 3-6 langkah berurutan, tiap {headline maks 6 kata kata kerja, body maks 30 kata, code: perintah/kode singkat maks 8 baris kalau relevan (kosongkan kalau tidak ada di sumber), lang: bahasa kode}\n` +
      `- JANGAN mengarang perintah, nama flag, atau versi yang tidak ada di sumber`,
    shape: `"prerequisites":"","steps":[{"headline":"","body":"","code":"","lang":"bash"}]`,
    check: (d) => (arr(d.steps).length >= 2 ? null : "steps kurang dari 2"),
  },
  review: {
    rules:
      `Buat REVIEW jujur untuk repo/tool/produk di sumber (bukan iklan).\n` +
      `- overview: {headline "Apa itu <nama>?" atau sejenis, body maks 40 kata: apa & untuk siapa}\n` +
      `- features: 3-5 fitur utama (maks 8 kata per poin)\n` +
      `- install: {code: cara install/pakai paling singkat (maks 6 baris) HANYA kalau ada di sumber, lang} — kosongkan kalau tidak ada\n` +
      `- pros: 2-4 kelebihan, cons: 1-3 kekurangan/catatan (jujur, berdasarkan sumber/akal sehat)\n` +
      `- rating: angka 0-10 (boleh .5), verdict: 1 kalimat kesimpulan untuk siapa ini cocok`,
    shape: `"overview":{"headline":"","body":""},"features":[""],"install":{"code":"","lang":"bash"},"pros":[""],"cons":[""],"rating":8,"verdict":""`,
    check: (d) => (d.overview?.headline && arr(d.features).length ? null : "overview/features kosong"),
  },
  tips: {
    rules:
      `Buat LISTICLE / tips praktis berdasarkan sumber.\n` +
      `- tips: 4-7 tips, tiap {headline maks 7 kata, body maks 28 kata cara melakukannya}`,
    shape: `"tips":[{"headline":"","body":""}]`,
    check: (d) => (arr(d.tips).length >= 3 ? null : "tips kurang dari 3"),
  },
};

function ctaFor(format: ContentType, source: string, kind: SourceContent["kind"] | "idea"): Slide {
  if (kind === "idea") return { kind: "cta", headline: `Follow ${brand.handle}`, body: "Simpan post ini biar nggak lupa, dan share ke teman yang butuh." };
  if (kind === "github") return { kind: "cta", headline: "Link repo ada di bio", body: `Klik link di bio ${brand.handle}, pilih post ini, langsung ke repo-nya. Simpan & share ke teman dev kamu.` };
  if (format === "tutorial") return { kind: "cta", headline: "Simpan biar nggak lupa", body: `Panduan lengkapnya dari ${source} ada di link bio. Coba praktikkan, ceritakan hasilnya di komentar.` };
  if (format === "tips") return { kind: "cta", headline: "Mana yang paling berguna?", body: `Tulis di komentar. Sumber lengkapnya (${source}) ada di link bio ${brand.handle}.` };
  if (format === "opini") return { kind: "cta", headline: "Kamu setuju?", body: `Tulis pendapatmu di komentar. Artikel lengkap dari ${source} ada di link bio.` };
  return { kind: "cta", headline: "Baca lengkapnya di link bio", body: `Buka profil ${brand.handle}, klik link di bio, lalu pilih postingan ini. Kamu langsung diarahkan ke artikel aslinya di ${source}.` };
}

/** Susun slide dari jawaban AI sesuai format. */
function buildSlides(format: ContentType, d: Draft, headline: string, cta: Slide): Slide[] {
  const cover: Slide = { kind: "cover", headline, body: clean(d.subline, 200) };
  const pairs = (v: unknown, n: number) =>
    arr<Pair>(v)
      .slice(0, n)
      .map((x) => ({ headline: clean(x?.headline, 90), body: clean(x?.body, 320) }))
      .filter((x) => x.headline || x.body);
  let mid: Slide[] = [];
  if (format === "tutorial") {
    const pre = clean(d.prerequisites, 240);
    mid = [
      ...(pre ? [{ kind: "body" as const, headline: "Yang perlu disiapkan", body: pre }] : []),
      ...arr<Pair & { code?: string; lang?: string }>(d.steps)
        .slice(0, 6)
        .map((x, i): Slide => ({
          kind: "step",
          step: i + 1,
          headline: clean(x?.headline, 90),
          body: clean(x?.body, 300),
          ...(String(x?.code ?? "").trim() ? { code: String(x.code).replace(/\r/g, "").trim().split("\n").slice(0, 10).join("\n"), lang: clean(x.lang, 16) || undefined } : {}),
        })),
    ];
  } else if (format === "review") {
    mid = [
      { kind: "body", headline: clean(d.overview?.headline, 90) || "Apa ini?", body: clean(d.overview?.body, 320) },
      { kind: "list", headline: "Fitur utama", items: arr<string>(d.features).map((x) => clean(x, 90)).filter(Boolean).slice(0, 5) },
      ...(String(d.install?.code ?? "").trim()
        ? [{ kind: "code" as const, headline: "Cara mulai", code: String(d.install!.code).trim().split("\n").slice(0, 8).join("\n"), lang: clean(d.install?.lang, 16) || "bash" }]
        : []),
      {
        kind: "verdict",
        headline: clean(d.verdict, 120) || "Verdict",
        items: arr<string>(d.pros).map((x) => clean(x, 90)).filter(Boolean).slice(0, 4),
        cons: arr<string>(d.cons).map((x) => clean(x, 90)).filter(Boolean).slice(0, 3),
        ...(Number.isFinite(Number(d.rating)) ? { rating: Math.max(0, Math.min(10, Math.round(Number(d.rating) * 2) / 2)) } : {}),
      },
    ];
  } else if (format === "tips") {
    mid = pairs(d.tips, 7).map((x, i) => ({ kind: "step", label: "Tips", step: i + 1, ...x }));
  } else {
    mid = pairs(d.slides, format === "opini" ? 4 : 4).map((x) => ({ kind: "body", ...x }));
  }
  return [cover, ...mid, cta];
}

/** Bagikan gambar berbeda ke slide isi (gambar ke-2, ke-3, … dari pustaka). */
function assignImages(slides: Slide[], pool: string[], main: string | null): Slide[] {
  const extra = pool.filter((p) => p !== main);
  if (!extra.length) return slides;
  let k = 0;
  return slides.map((s) => {
    const wants = (s.kind === "body" || (s.kind === "step" && !s.code)) && s.image === undefined;
    if (!wants || k >= extra.length * 2) return s;
    return { ...s, image: extra[k++ % extra.length] };
  });
}

export type WriteResult = { values: Omit<typeof schema.posts.$inferInsert, "shortCode" | "template"> & { template?: string }; topicPatch: Partial<Topic> };

/**
 * Tulis satu draft untuk satu topik. Tidak menyimpan apa-apa — pemanggil yang menyimpan.
 * format/notes bisa dipaksa (dari "Buat konten" atau "Tulis ulang sebagai …").
 */
export async function writeDraft(t: Topic, opts: { sourceName?: string | null; format?: ContentType; notes?: string; usage: Usage }) {
  const s = await getSettings();
  const real = isRealUrl(t.url);
  // post medsos (Telegram dll) sering menautkan artikel asli → baca artikelnya
  const linked = typeof t.meta?.link === "string" && isRealUrl(t.meta.link) ? t.meta.link : null;
  const fetched: SourceContent | null = real ? await fetchSource(linked ?? t.url) : null;
  const sourceKind: SourceContent["kind"] | "idea" = fetched?.kind ?? "idea";
  const format: ContentType =
    opts.format ?? (isContentType(t.format) ? t.format : sourceKind === "github" ? "review" : "berita");
  const source = opts.sourceName ?? (real ? new URL(t.url).hostname.replace(/^www\./, "") : brand.name);
  const notes = (opts.notes ?? String(t.meta?.notes ?? "")).trim();
  const spec = FORMAT[format];

  const system =
    `Kamu adalah Copywriter di redaksi konten. ${audience()}\n` +
    `Tulis dalam ${s.language}. ${spec.rules}\n` +
    (real
      ? `JANGAN menyalin kalimat sumber, JANGAN menambah fakta/angka/nama yang tidak ada di sumber, dan selalu atribusikan ke ${source}.\n`
      : `TIDAK ADA artikel sumber — tulis dari pengetahuan umum yang kamu YAKIN benar dan masih berlaku. Hindari angka, harga, versi, dan klaim spesifik yang mungkin salah. Kalau ragu, tulis lebih umum.\n`) +
    `Aturan umum:\n- headline: maks 9 kata, tajam, bikin penasaran tapi jujur (bukan clickbait menipu)\n` +
    `- alternatives: 2 headline alternatif\n- kicker: 1 kata kategori (mis. AI, Marketing, Tutorial, Review, Tips)\n` +
    `- subline: 1 kalimat pendek opini/konteks di bawah headline cover\n` +
    `- caption: 2-4 paragraf pendek untuk Instagram` +
    (real ? `, akhiri dengan ajakan buka link di bio ${brand.handle} dan sebut sumber ${source}\n` : `\n`) +
    `- hashtags: 3-6 hashtag relevan\n` +
    `- linkedin: versi LinkedIn 600-1200 karakter: buka dengan 1 kalimat hook, paragraf pendek dipisah baris kosong, poin-poin pakai "→", profesional tapi hangat, tutup dengan pertanyaan diskusi, 3 hashtag di baris terakhir. Jangan tulis "link di bio" (link ditambahkan otomatis)\n` +
    `- threads: versi Threads 2-3 kalimat (maks 400 karakter), gaya ngobrol, tanpa hashtag, tanpa "link di bio"\n` +
    `- x: versi X/Twitter 1-2 kalimat padat (maks 200 karakter), tanpa hashtag, tanpa "link di bio"\n` +
    `- Jangan pakai emoji di headline/slide (tidak ter-render di gambar); di caption/linkedin/threads/x boleh secukupnya` +
    (await brainFor("copywriter")) +
    `\n\nJawab HANYA JSON: {"kicker":"","headline":"","alternatives":["",""],"subline":"",${spec.shape},"caption":"","hashtags":[""],"linkedin":"","threads":"","x":""}`;

  const prompt =
    `JENIS KONTEN: ${format.toUpperCase()}\n` +
    (notes ? `ARAHAN DARI TIM (wajib diikuti): ${notes}\n` : "") +
    (real ? `SUMBER: ${source}\nJUDUL: ${t.title.startsWith("http") ? fetched?.title ?? t.title : t.title}\nURL: ${linked ?? t.url}\n\nRINGKASAN:\n${(t.summary ?? "").slice(0, 1200)}\n\n` : `TOPIK / IDE: ${t.title}\n\n`) +
    (fetched?.text ? `ISI SUMBER (potongan):\n${fetched.text}` : real ? "(isi sumber tidak bisa diambil — tulis hanya dari judul & ringkasan, jangan mengarang detail)" : "");

  const { value: d } = await completeJson<Draft>(
    { system, prompt, temperature: 0.75, maxTokens: format === "berita" ? 3000 : 3800 },
    {
      onAttempt: (r) => opts.usage.add(r),
      validate: (v) =>
        !v || typeof v !== "object" ? "bukan objek" : !String(v.headline ?? "").trim() ? "headline kosong" : !String(v.caption ?? "").trim() ? "caption kosong" : spec.check(v),
    },
  );

  const headline = clean(d.headline, 140);
  const main = t.imageUrl ?? fetched?.images[0] ?? null;
  const pool = [...new Set([main, ...(t.images ?? []), ...(fetched?.images ?? [])].filter((x): x is string => !!x))].slice(0, 12);
  const slides = assignImages(buildSlides(format, d, headline, ctaFor(format, source, sourceKind)), pool, main);
  const hashtags = arr<string>(d.hashtags)
    .map((h) => "#" + String(h).replace(/^#+/, "").replace(/\s+/g, ""))
    .filter((h) => h.length > 1)
    .slice(0, 8);

  const values = {
    topicId: t.id,
    contentType: format,
    kicker: clean(d.kicker, 20) || (format === "berita" ? t.category : format) || "Info",
    headline,
    headlineAlternatives: arr<string>(d.alternatives).map((a) => clean(a, 140)).filter(Boolean).slice(0, 3),
    caption: String(d.caption ?? "").trim().slice(0, 2100),
    hashtags,
    platformText: {
      threads: String(d.threads ?? "").trim().slice(0, 480),
      x: String(d.x ?? "").trim().slice(0, 250),
      linkedin: String(d.linkedin ?? "").trim().slice(0, 2800),
    },
    format: "carousel",
    slides,
    images: pool,
  };
  const topicPatch: Partial<Topic> = {
    status: "drafted",
    format,
    ...(main && !t.imageUrl ? { imageUrl: main } : {}),
    ...(fetched?.meta && Object.keys(fetched.meta).length ? { meta: { ...(t.meta ?? {}), ...fetched.meta } } : {}),
    ...(fetched?.title && !real ? {} : {}),
  };
  return { values, topicPatch, format };
}

async function pickTemplate(format: ContentType, offset: number) {
  const [{ n }] = await db().select({ n: count() }).from(schema.posts);
  const rot = TEMPLATE_ROTATION[format];
  return rot[(Number(n) + offset) % rot.length];
}

async function insertPost(values: WriteResult["values"], template: string) {
  for (let attempts = 0; ; attempts++) {
    try {
      const [p] = await db()
        .insert(schema.posts)
        .values({ ...values, template, shortCode: shortCode(), status: "review" } as typeof schema.posts.$inferInsert)
        .returning({ id: schema.posts.id });
      return p.id;
    } catch (e) {
      if (attempts >= 3 || !/short_code/.test(String((e as Error).message))) throw e;
    }
  }
}

/** Satu topik → satu draft baru (dipakai halaman "Buat konten"). Mengembalikan id post. */
export async function draftTopic(topicId: number, opts: { format?: ContentType; notes?: string } = {}) {
  const [row] = await db()
    .select({ t: schema.topics, sourceName: schema.sources.name })
    .from(schema.topics)
    .leftJoin(schema.sources, eq(schema.topics.sourceId, schema.sources.id))
    .where(eq(schema.topics.id, topicId));
  if (!row) throw new Error("Topik tidak ditemukan");
  const usage = new Usage();
  try {
    const r = await writeDraft(row.t, { sourceName: row.sourceName, usage, ...opts });
    const id = await insertPost(r.values, await pickTemplate(r.format, 0));
    await db().update(schema.topics).set(r.topicPatch).where(eq(schema.topics.id, topicId));
    await logRun("copywriter", `Menulis ${r.format} dari "${row.t.title.slice(0, 80)}" (post #${id})`, { usage, detail: { postIds: [id], topicIds: [topicId] } });
    return id;
  } catch (e) {
    await logRun("copywriter", `Gagal menulis "${row.t.title.slice(0, 80)}": ${(e as Error).message}`, {
      ok: false,
      usage,
      detail: { error: (e as Error).message, raw: e instanceof AiError ? e.raw : undefined, topicIds: [topicId] },
    });
    throw e;
  }
}

/** Tulis ulang post yang ada (mis. "jadikan tutorial"). Gambar render lama otomatis dianggap kedaluwarsa. */
export async function rewritePost(postId: number, opts: { format?: ContentType; notes?: string }) {
  const [row] = await db()
    .select({ p: schema.posts, t: schema.topics, sourceName: schema.sources.name })
    .from(schema.posts)
    .innerJoin(schema.topics, eq(schema.posts.topicId, schema.topics.id))
    .leftJoin(schema.sources, eq(schema.topics.sourceId, schema.sources.id))
    .where(eq(schema.posts.id, postId));
  if (!row) throw new Error("Post ini tidak punya topik sumber");
  const usage = new Usage();
  try {
    const r = await writeDraft(row.t, { sourceName: row.sourceName, usage, ...opts });
    const keepImages = [...new Set([...(r.values.images ?? []), ...(row.p.images ?? [])])].slice(0, 30);
    const { topicId: _t, ...rest } = r.values;
    await db()
      .update(schema.posts)
      .set({ ...rest, images: keepImages, template: (await pickTemplate(r.format, 0)) as string, updatedAt: new Date() })
      .where(eq(schema.posts.id, postId));
    await db().update(schema.topics).set({ format: r.format }).where(eq(schema.topics.id, row.t.id));
    await logRun("copywriter", `Menulis ulang post #${postId} sebagai ${r.format}`, { usage, detail: { postIds: [postId] } });
  } catch (e) {
    await logRun("copywriter", `Gagal menulis ulang post #${postId}: ${(e as Error).message}`, {
      ok: false,
      usage,
      detail: { error: (e as Error).message, raw: e instanceof AiError ? e.raw : undefined, postIds: [postId] },
    });
    throw e;
  }
}

/** Tulis draft untuk topik yang lolos Analis (skor tertinggi dulu). */
export async function runCopywriter() {
  const s = await getSettings();
  const queue = await db()
    .select({ t: schema.topics, sourceName: schema.sources.name, defaultFormat: schema.sources.defaultFormat })
    .from(schema.topics)
    .leftJoin(schema.sources, eq(schema.topics.sourceId, schema.sources.id))
    .where(eq(schema.topics.status, "passed"))
    .orderBy(desc(schema.topics.score), desc(schema.topics.fetchedAt))
    .limit(s.draftsPerRun);
  if (!queue.length) return { drafted: 0 };

  const usage = new Usage();
  let drafted = 0;
  const failed: string[] = [];
  const items: { label: string; error: string; raw?: string }[] = [];
  const formats: string[] = [];

  for (const [i, { t, sourceName, defaultFormat }] of queue.entries()) {
    try {
      const format = isContentType(t.format) ? t.format : isContentType(defaultFormat) ? defaultFormat : undefined;
      const r = await writeDraft(t, { sourceName, usage, format });
      await insertPost(r.values, await pickTemplate(r.format, i));
      await db().update(schema.topics).set(r.topicPatch).where(eq(schema.topics.id, t.id));
      formats.push(r.format);
      drafted++;
    } catch (e) {
      failed.push(`#${t.id}: ${(e as Error).message}`);
      items.push({ label: `Topik #${t.id} — ${t.title.slice(0, 80)}`, error: (e as Error).message, raw: e instanceof AiError ? e.raw : undefined });
      await db().update(schema.topics).set({ status: "failed", scoreReason: `Gagal ditulis: ${(e as Error).message}`.slice(0, 500) }).where(eq(schema.topics.id, t.id));
    }
  }

  const kinds = [...new Set(formats)];
  const msg =
    `Menulis ${drafted} draft` + (kinds.length ? ` (${kinds.join(", ")})` : "") + (failed.length ? ` · ${failed.length} gagal (${failed.join("; ")})` : "");
  await logRun("copywriter", msg, {
    ok: !failed.length,
    usage,
    detail: items.length ? { items, topicIds: queue.map((q) => q.t.id), attempts: usage.calls } : undefined,
  });
  return { drafted, failed };
}
