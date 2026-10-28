import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl } from "@/lib/channels";
import { getPost, getPostByShortCode } from "@/lib/data";
import type { Slide } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * Bahan satu post untuk alat lain (mis. Mesin Konten): judul & link artikel asli, nama media,
 * ringkasan dari Scout, dan teks yang sudah ditulis Studio.
 *
 *   GET /api/sumber/:id         (id angka atau kode shortlink)
 *   Authorization: Bearer <SUMBER_TOKEN>
 *
 * Token sengaja terpisah dari CRON_SECRET: yang memegang token ini hanya bisa membaca bahan,
 * tidak bisa memicu agen. Hanya-baca, tidak mencatat klik.
 */
function authorized(req: Request) {
  const token = process.env.SUMBER_TOKEN ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token);
  const b = Buffer.from(got);
  return token.length >= 16 && a.length === b.length && timingSafeEqual(a, b);
}

function slideText(s: Slide) {
  return [s.headline, s.body, ...(s.items ?? []), ...(s.cons ?? [])]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.SUMBER_TOKEN) return NextResponse.json({ error: "SUMBER_TOKEN belum diisi di server Studio" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = /^\d+$/.test(id) ? await getPost(Number(id)) : await getPostByShortCode(id);
  if (!post) return NextResponse.json({ error: `post ${id} tidak ditemukan` }, { status: 404 });

  const raw = post.topicId ? await getTopicRow(post.topicId) : null;
  const url = /^https?:\/\//.test(post.sourceUrl) ? post.sourceUrl : null;
  const base = appUrl();

  return NextResponse.json({
    id: post.id,
    kode: post.shortCode,
    jenis: post.contentType,
    jualan: post.productIds.length > 0,
    status: post.status,
    sumber: {
      judul: raw?.title ?? post.headline,
      url,
      media: post.sourceName,
      kategori: post.category || null,
      terbit: raw?.publishedAt?.toISOString() ?? null,
      /** ringkasan asli dari feed/artikel (bukan tulisan AI) */
      ringkasan: raw?.summary ?? "",
    },
    shortlink: base ? `${base}/s/${post.shortCode}` : null,
    /** tulisan Studio (sudah diolah AI) — untuk konteks, bukan sumber fakta */
    studio: {
      headline: post.headline,
      caption: post.caption,
      slides: post.slides.map(slideText).filter(Boolean),
      threads: post.platformText.threads ?? null,
      linkedin: post.platformText.linkedin ?? null,
    },
  });
}

async function getTopicRow(topicId: number) {
  const [t] = await db().select().from(schema.topics).where(eq(schema.topics.id, topicId));
  return t ?? null;
}
