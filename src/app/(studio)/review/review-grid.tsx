"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckSquare, X, Check } from "lucide-react";
import { SlidePreview } from "@/components/slide-preview";
import { bulkSetStatus } from "@/app/actions/studio";
import type { Post } from "@/lib/types";

export function ReviewGrid({ posts, ago }: { posts: Post[]; ago: Record<number, string> }) {
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const act = (status: "approved" | "rejected") =>
    start(async () => {
      await bulkSetStatus(sel, status);
      setSel([]);
      setSelecting(false);
    });

  if (!posts.length) {
    return <div className="card p-10 text-center text-sm text-muted">Belum ada post di tab ini.</div>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => { setSelecting(!selecting); setSel([]); }}>
          <CheckSquare size={13} /> {selecting ? "Batal pilih" : "Pilih beberapa"}
        </button>
        {selecting && sel.length > 0 && (
          <>
            <span className="text-xs text-muted">{sel.length} dipilih</span>
            <button className="btn btn-primary" disabled={pending} onClick={() => act("approved")}>
              <Check size={13} /> Setujui
            </button>
            <button className="btn btn-danger" disabled={pending} onClick={() => act("rejected")}>
              <X size={13} /> Tolak
            </button>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {posts.map((p) => {
          const picked = sel.includes(p.id);
          const body = (
            <>
              <div className="relative">
                {p.renderCount > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/m/${p.shortCode}/1.jpg?v=${p.renderHash ?? ""}`} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-t-xl object-cover" />
                ) : (
                  <SlidePreview post={p} slide={p.slides[0]} className="!rounded-none !rounded-t-xl" />
                )}
                <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 text-[10px] font-semibold text-white">
                  1/{p.slides.length}
                </span>
                <span className="display absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-lg text-accent on-dark">
                  {p.score}
                </span>
                {selecting && (
                  <span
                    className={`absolute top-2 right-2 grid size-6 place-items-center rounded-full border ${
                      picked ? "border-accent bg-accent text-accent-ink" : "border-white/60 bg-black/50 text-white"
                    }`}
                  >
                    {picked && <Check size={13} />}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-[13px] leading-snug font-medium">{p.headline}</p>
                <p className="mt-1 text-[11px] text-dim">
                  {p.sourceName} · {ago[p.id]}
                </p>
              </div>
            </>
          );
          const cls = `card block overflow-hidden text-left transition-colors hover:border-line-2 ${picked ? "!border-accent" : ""}`;
          return selecting ? (
            <button key={p.id} className={cls} onClick={() => toggle(p.id)}>
              {body}
            </button>
          ) : (
            <Link key={p.id} href={`/review/${p.id}`} className={cls}>
              {body}
            </Link>
          );
        })}
      </div>
    </>
  );
}
