"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, ImageIcon, Eye, Wand2, AlertTriangle } from "lucide-react";
import { SlidePreview } from "@/components/slide-preview";
import { Msg } from "@/components/forms";
import { renderNow } from "@/app/actions/publish";
import type { Post } from "@/lib/types";

export function SlideViewer({ post, stale }: { post: Post; stale: boolean }) {
  const [i, setI] = useState(0);
  const hasRender = post.renderCount > 0;
  const [mode, setMode] = useState<"render" | "preview">(hasRender ? "render" : "preview");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; message?: string } | null>(null);
  const n = post.slides.length;
  const v = post.renderHash ?? post.renderedAt ?? "0";
  const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const src = (k: number) => `${bp}/m/${post.shortCode}/${k + 1}.jpg?v=${v}`;
  const showRender = mode === "render" && hasRender && i < post.renderCount;

  return (
    <div>
      <div className="mx-auto mb-3 flex max-w-md rounded-lg border border-line bg-panel-2 p-0.5 text-[12px]">
        {(["render", "preview"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${mode === m ? "bg-panel text-fg" : "text-muted"}`}
          >
            {m === "render" ? <ImageIcon size={12} /> : <Eye size={12} />}
            {m === "render" ? "Hasil render" : "Preview langsung"}
          </button>
        ))}
      </div>

      {(stale || post.renderError) && (
        <p className="mx-auto mb-2 flex max-w-md items-center gap-1.5 text-[11px] text-copy">
          <AlertTriangle size={12} /> {post.renderError ? `Render gagal: ${post.renderError}` : "Isi berubah sejak render terakhir — render ulang sebelum posting."}
        </p>
      )}

      <div className="relative mx-auto max-w-md">
        {showRender ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src(i)} alt={`Slide ${i + 1}`} className="aspect-[4/5] w-full rounded-lg bg-panel-2 object-cover" />
        ) : mode === "render" && !hasRender ? (
          <div className="grid aspect-[4/5] w-full place-items-center rounded-lg border border-dashed border-line-2 text-center text-[13px] text-muted">
            <div className="space-y-3 px-6">
              <p>Belum dirender.</p>
              <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => setMsg(await renderNow(post.id)))}>
                <Wand2 size={13} /> {pending ? "Merender…" : "Render sekarang"}
              </button>
            </div>
          </div>
        ) : (
          <SlidePreview post={post} slide={post.slides[i]} index={i} />
        )}
        {i > 0 && (
          <button onClick={() => setI(i - 1)} className="absolute top-1/2 left-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/70" aria-label="Sebelumnya">
            <ChevronLeft size={16} />
          </button>
        )}
        {i < n - 1 && (
          <button onClick={() => setI(i + 1)} className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/70" aria-label="Berikutnya">
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className="mx-auto mt-3 flex max-w-md gap-2 overflow-x-auto">
        {post.slides.map((s, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            className={`w-14 shrink-0 overflow-hidden rounded-md border-2 ${k === i ? "border-accent" : "border-transparent opacity-60"}`}
          >
            {mode === "render" && hasRender && k < post.renderCount ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src(k)} alt="" className="aspect-[4/5] w-full object-cover" />
            ) : (
              <SlidePreview post={post} slide={s} index={k} className="!rounded-none" />
            )}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-4 flex max-w-md flex-wrap gap-2">
        {hasRender ? (
          <>
            <Link href={`/review/${post.id}/download`} className="btn btn-primary">
              <Download size={13} /> Download semua ({post.renderCount})
            </Link>
            <a href={src(i)} download={`slide-${i + 1}.jpg`} className="btn">
              <Download size={13} /> Slide {i + 1}
            </a>
          </>
        ) : null}
        <button className="btn" disabled={pending} onClick={() => start(async () => { setMsg(await renderNow(post.id)); setMode("render"); })}>
          <Wand2 size={13} /> {pending ? "Merender…" : hasRender ? "Render ulang" : "Render"}
        </button>
      </div>
      {msg?.message && <div className="mx-auto mt-2 max-w-md"><Msg ok={msg.ok} text={msg.message} /></div>}
    </div>
  );
}
