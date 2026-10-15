import { getActiveSession } from "@/lib/auth";
import { isTemplate } from "@/lib/content";
import { loadPostForRender, renderSlides } from "@/lib/render";

export const dynamic = "force-dynamic";

/**
 * Preview slide dirender langsung dari isi terbaru (belum disimpan ke tabel renders).
 * ?t=<template> untuk mencoba template lain, ?w=<lebar> untuk thumbnail.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  if (!(await getActiveSession())) return new Response("unauthorized", { status: 401 });
  const { id, n } = await params;
  const url = new URL(req.url);
  const p = await loadPostForRender(Number(id));
  const idx = parseInt(n, 10) - 1;
  if (!p || !(idx >= 0 && idx < p.slides.length)) return new Response("not found", { status: 404 });
  const t = url.searchParams.get("t");
  const w = Math.min(1080, Math.max(120, Number(url.searchParams.get("w")) || 1080));
  try {
    const [img] = await renderSlides(p, { only: [idx], template: isTemplate(t) ? t : undefined, width: w, quality: w < 600 ? 80 : 88 });
    return new Response(new Uint8Array(img), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=60" } });
  } catch (e) {
    return new Response(`Render gagal: ${(e as Error).message}`, { status: 500 });
  }
}
