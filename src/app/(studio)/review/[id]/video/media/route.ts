import type { ReadableStream as WebStream } from "node:stream/web";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getActiveSession } from "@/lib/auth";
import type { VideoOptions } from "@/lib/content";
import { getVideo, saveScript } from "@/lib/video";
import { removeMedia, saveUpload } from "@/lib/video/media";

export const dynamic = "force-dynamic";
// upload besar: route ini dikecualikan dari middleware (lihat src/middleware.ts), jadi cek sesi di sini
export const maxDuration = 300;

async function guard(params: Promise<{ id: string }>, req: Request) {
  if (!(await getActiveSession())) return { error: new Response("unauthorized", { status: 401 }) };
  const { id } = await params;
  const postId = Number(id);
  const [p] = await db().select({ id: schema.posts.id }).from(schema.posts).where(eq(schema.posts.id, postId));
  if (!p) return { error: new Response("post tidak ditemukan", { status: 404 }) };
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "vo" && kind !== "cam") return { error: new Response("kind harus vo atau cam", { status: 400 }) };
  return { postId, kind: kind as "vo" | "cam" };
}

/** Upload voice over / video sendiri: body = isi file mentah, ?kind=vo|cam&name=<nama file> */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params, req);
  if ("error" in g) return g.error;
  if (!req.body) return Response.json({ ok: false, message: "File kosong" }, { status: 400 });
  const name = new URL(req.url).searchParams.get("name") ?? g.kind;
  try {
    const m = await saveUpload(g.postId, g.kind, req.body as unknown as WebStream<Uint8Array>, name);
    const v = await getVideo(g.postId);
    const old = v?.options?.[g.kind];
    const options: VideoOptions = { ...(v?.options ?? {}) };
    if (g.kind === "vo") options.vo = { file: m.file, name: m.name, seconds: m.seconds };
    else {
      options.cam = { file: m.file, name: m.name, seconds: m.seconds, useAudio: m.hasAudio };
      options.layout = options.layout && options.layout !== "full" ? options.layout : "pip";
    }
    await saveScript(g.postId, v?.script ?? [], options);
    if (old?.file && old.file !== m.file) await removeMedia(old.file);
    return Response.json({ ok: true, message: `${g.kind === "vo" ? "Voice over" : "Video"} ${m.seconds} dtk diunggah`, media: m });
  } catch (e) {
    return Response.json({ ok: false, message: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params, req);
  if ("error" in g) return g.error;
  const v = await getVideo(g.postId);
  if (!v) return Response.json({ ok: true });
  const options: VideoOptions = { ...v.options };
  await removeMedia(options[g.kind]?.file);
  options[g.kind] = null;
  if (g.kind === "cam") options.layout = "full";
  await saveScript(g.postId, v.script, options);
  return Response.json({ ok: true, message: "Dihapus" });
}
