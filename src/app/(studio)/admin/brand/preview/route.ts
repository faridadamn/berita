import { getActiveSession } from "@/lib/auth";
import { normalizeKit } from "@/lib/brand";
import { getBrandKit } from "@/lib/brand-kit";
import { isTemplate } from "@/lib/content";
import { renderSlides } from "@/lib/render";
import { samplePost } from "@/lib/render/sample";

export const dynamic = "force-dynamic";

/** Preview Brand Kit (draft belum disimpan): ?k=<base64url JSON kit>&t=<template>&s=<indeks slide>&w=<lebar> */
export async function GET(req: Request) {
  if (!(await getActiveSession())) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const saved = await getBrandKit();
  let kit = saved;
  const k = url.searchParams.get("k");
  if (k) {
    try {
      kit = normalizeKit(JSON.parse(Buffer.from(k, "base64url").toString("utf8")), saved);
    } catch {
      return new Response("kit tidak valid", { status: 400 });
    }
  }
  const t = url.searchParams.get("t");
  const idx = Math.max(0, Number(url.searchParams.get("s")) || 0);
  const w = Math.min(1080, Math.max(120, Number(url.searchParams.get("w")) || 360));
  try {
    const p = await samplePost(kit);
    const [img] = await renderSlides(p, { only: [Math.min(idx, p.slides.length - 1)], template: isTemplate(t) ? t : "brand", width: w, quality: 82, kit });
    return new Response(new Uint8Array(img), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=300" } });
  } catch (e) {
    return new Response(`Render gagal: ${(e as Error).message}`, { status: 500 });
  }
}
