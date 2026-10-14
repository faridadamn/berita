import { NextResponse } from "next/server";
import { getPostByShortCode, recordClick } from "@/lib/data";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const post = await getPostByShortCode(code);
  if (!post) return NextResponse.redirect(new URL("/baca", req.url));
  await recordClick(post.id);
  return NextResponse.redirect(post.sourceUrl, 302);
}
