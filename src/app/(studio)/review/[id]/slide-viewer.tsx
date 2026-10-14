"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, Check } from "lucide-react";
import { SlidePreview } from "@/components/slide-preview";
import type { Post } from "@/lib/types";

export function SlideViewer({ post }: { post: Post }) {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const n = post.slides.length;
  const copy = async () => {
    await navigator.clipboard.writeText(`${post.caption}\n\n${post.hashtags.join(" ")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div className="relative mx-auto max-w-md">
        <SlidePreview post={post} slide={post.slides[i]} index={i} />
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
      <div className="mx-auto mt-3 flex max-w-md gap-2">
        {post.slides.map((s, k) => (
          <button
            key={k}
            onClick={() => setI(k)}
            className={`w-14 overflow-hidden rounded-md border-2 ${k === i ? "border-accent" : "border-transparent opacity-60"}`}
          >
            <SlidePreview post={post} slide={s} index={k} className="!rounded-none" />
          </button>
        ))}
      </div>
      <div className="mx-auto mt-4 flex max-w-md flex-wrap gap-2">
        <button className="btn btn-primary" disabled title="Aktif di tahap 3 (renderer gambar)">
          <Download size={13} /> Download semua ({n})
        </button>
        <button className="btn" disabled title="Aktif di tahap 3">
          <Download size={13} /> Slide {i + 1}
        </button>
        <button className="btn" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Tersalin" : "Copy caption + hashtag"}
        </button>
      </div>
    </div>
  );
}
