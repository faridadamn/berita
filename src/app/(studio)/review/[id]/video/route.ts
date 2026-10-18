import { getActiveSession } from "@/lib/auth";
import { videoResponse } from "@/lib/video";

export const dynamic = "force-dynamic";

/** Putar / unduh video post (?download=1). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getActiveSession())) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const dl = new URL(req.url).searchParams.has("download");
  return videoResponse(Number(id), req, { download: dl ? `post-${id}.mp4` : undefined });
}
