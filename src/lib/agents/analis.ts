import "server-only";
import { asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AiError, completeJson } from "../ai";
import { getSettings } from "../settings";
import { isContentType } from "../content";
import { Usage, audience, brainFor, logRun } from "./common";

type Verdict = { id: number; score: number; reason: string; format?: string };

/** Nilai topik baru (status "new") → passed / rejected sesuai ambang skor. */
export async function runAnalis() {
  const s = await getSettings();
  const batch = await db()
    .select({ id: schema.topics.id, title: schema.topics.title, summary: schema.topics.summary, category: schema.topics.category, url: schema.topics.url, format: schema.topics.format })
    .from(schema.topics)
    .where(eq(schema.topics.status, "new"))
    .orderBy(asc(schema.topics.fetchedAt))
    .limit(s.analyzeBatch);
  if (!batch.length) return { scored: 0, passed: 0 };

  // judul post 3 hari terakhir → hindari topik kembar
  const recent = await db()
    .select({ headline: schema.posts.headline })
    .from(schema.posts)
    .where(gte(schema.posts.createdAt, new Date(Date.now() - 3 * 86_400_000)))
    .orderBy(desc(schema.posts.createdAt))
    .limit(30);

  const system =
    `Kamu adalah Analis di redaksi konten. ${await audience()}\n` +
    `Tugasmu: menilai potensi tiap topik berita untuk jadi postingan carousel Instagram yang disimpan & dibagikan.\n` +
    `Skor 0-100. Pertimbangkan: relevansi untuk audiens, dampak praktis, kebaruan, tokoh/brand besar, potensi diskusi.\n` +
    `Beri skor rendah (<40) untuk: topik yang sama/serupa dengan postingan yang sudah ada, topik duplikat dalam daftar ini (pilih satu saja), ` +
    `berita terlalu teknis/niche, rumor tanpa sumber, iklan/promosi, atau konten sensitif (bencana, kriminal, politik praktis).\n` +
    `Sarankan juga format konten paling cocok: "berita" (kabar/rilis), "tutorial" (cara/how-to/langkah), "review" (repo, tool, produk, aplikasi), "tips" (daftar/listicle), atau "opini" (analisis/tren).` +
    (await brainFor("analis")) +
    `\n\nJawab HANYA JSON: {"results":[{"id":<id>,"score":<0-100>,"reason":"<alasan singkat, 1 kalimat Bahasa Indonesia>","format":"berita|tutorial|review|tips|opini"}]}`;

  const prompt =
    (recent.length ? `Postingan yang SUDAH ada (jangan diulang):\n${recent.map((r) => `- ${r.headline}`).join("\n")}\n\n` : "") +
    `Topik untuk dinilai:\n` +
    batch
      .map((t) => `[id ${t.id}] (${t.category ?? "-"} · ${new URL(t.url).hostname}) ${t.title}\n${(t.summary ?? "").slice(0, 400)}`)
      .join("\n\n");

  const usage = new Usage();
  let verdicts: Verdict[];
  try {
    const { value } = await completeJson<{ results: Verdict[] }>(
      { system, prompt, temperature: 0.2, maxTokens: Math.max(3000, 1000 + batch.length * 300) },
      {
        onAttempt: (r) => usage.add(r),
        validate: (v) => (Array.isArray(v?.results) && v.results.length ? null : "tidak ada array results"),
      },
    );
    verdicts = value.results;
  } catch (e) {
    await logRun("analis", `Gagal menilai ${batch.length} topik: ${(e as Error).message}`, {
      ok: false,
      usage,
      detail: { error: (e as Error).message, raw: e instanceof AiError ? e.raw : undefined, topicIds: batch.map((t) => t.id), attempts: usage.calls },
    });
    return { scored: 0, passed: 0, error: (e as Error).message };
  }

  const ids = new Set(batch.map((t) => t.id));
  const formatOf = new Map(batch.map((t) => [t.id, t.format]));
  let passed = 0;
  let scored = 0;
  for (const v of verdicts) {
    const id = Number(v.id);
    if (!ids.has(id)) continue;
    const score = Math.max(0, Math.min(100, Math.round(Number(v.score) || 0)));
    const ok = score >= s.threshold;
    if (ok) passed++;
    scored++;
    ids.delete(id);
    await db()
      .update(schema.topics)
      .set({
        score,
        scoreReason: String(v.reason ?? "").slice(0, 500),
        status: ok ? "passed" : "rejected",
        ...(isContentType(v.format) && !formatOf.get(id) ? { format: v.format } : {}),
      })
      .where(eq(schema.topics.id, id));
  }
  // topik yang tidak dijawab model → tandai supaya tidak macet selamanya
  if (ids.size && scored) {
    await db()
      .update(schema.topics)
      .set({ status: "rejected", scoreReason: "Tidak dinilai oleh model" })
      .where(inArray(schema.topics.id, [...ids]));
  }

  await logRun("analis", `Menilai ${scored} topik, ${passed} lolos ambang skor ${s.threshold}`, { usage });
  return { scored, passed };
}
