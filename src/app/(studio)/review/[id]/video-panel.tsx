"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Clapperboard, Copy, Check, Download, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Msg } from "@/components/forms";
import { generateVideoScript, saveVideo } from "@/app/actions/video";
import type { ActionState } from "@/app/actions/studio";
import { SHOT_KINDS, wordCount, type Shot, type ShotKind, type VideoOptions } from "@/lib/content";

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type VideoView = {
  status: string;
  progress: number;
  script: Shot[];
  options: VideoOptions;
  hasData: boolean;
  seconds: number | null;
  sizeBytes: number | null;
  error: string | null;
  renderedAt: string | null;
  stale: boolean;
};

type Prod = { id: number; name: string };

export function VideoPanel({
  postId, video, gerak, products, publicUrl,
}: {
  postId: number;
  video: VideoView | null;
  gerak: { ok: boolean; reason?: string };
  products: Prod[];
  publicUrl: string | null;
}) {
  const router = useRouter();
  const [shots, setShots] = useState<Shot[]>(video?.script ?? []);
  const [opts, setOpts] = useState<VideoOptions>(video?.options ?? {});
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const busy = video?.status === "queued" || video?.status === "rendering";

  // naskah baru dari server (mis. setelah AI menulis) → sinkronkan kalau editor belum diubah
  const serverScript = JSON.stringify(video?.script ?? []);
  useEffect(() => {
    if (!dirty) setShots(JSON.parse(serverScript));
  }, [serverScript, dirty]);

  // selama render: segarkan tiap 3 detik
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [busy, router]);

  const set = (i: number, patch: Partial<Shot>) => {
    setShots((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setShots((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  };
  const save = (render: boolean) =>
    start(async () => {
      const r = await saveVideo(postId, shots, opts, render);
      setMsg(r);
      if (r.ok) setDirty(false);
      router.refresh();
    });
  const kinds = SHOT_KINDS.filter((k) => products.length >= (k.key === "compare" ? 2 : k.key === "product" ? 1 : 0));

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          <Clapperboard size={14} className="mr-1 inline text-accent" /> Video 9:16 <span className="font-normal text-muted">· Reels, TikTok, Shopee Video, Shorts</span>
        </p>
        {video?.hasData && video.stale && !busy && <span className="text-[11px] text-copy">● isi berubah, perlu render ulang</span>}
      </div>

      {!gerak.ok && <p className="rounded-lg border border-copy/40 bg-copy/5 px-3 py-2 text-[12px] text-copy">{gerak.reason}. Naskah tetap bisa ditulis & disimpan.</p>}

      {video?.hasData && (
        <div className="space-y-2">
          <video
            key={video.renderedAt ?? "v"}
            src={`${bp}/review/${postId}/video?v=${encodeURIComponent(video.renderedAt ?? "")}`}
            controls
            playsInline
            preload="metadata"
            className="mx-auto aspect-[9/16] max-h-[70vh] w-full max-w-[360px] rounded-lg bg-black"
          />
          <div className="flex flex-wrap items-center gap-2">
            <a href={`${bp}/review/${postId}/video?download=1`} className="btn btn-primary" download>
              <Download size={13} /> Unduh MP4
            </a>
            {publicUrl && (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(publicUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} Link publik
              </button>
            )}
            <span className="text-[11px] text-dim">
              {video.seconds ? `${video.seconds.toFixed(1)} dtk` : ""}
              {video.sizeBytes ? ` · ${(video.sizeBytes / 1e6).toFixed(1)} MB` : ""}
            </span>
          </div>
        </div>
      )}

      {busy && (
        <div className="space-y-1">
          <div className="flex justify-between text-[12px]">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> {video!.status === "queued" ? "Menunggu antrean…" : "Merender dengan Gerak…"}
            </span>
            <b>{Math.round(video!.progress * 100)}%</b>
          </div>
          <div className="h-1.5 rounded-full bg-panel-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(3, video!.progress * 100)}%` }} />
          </div>
        </div>
      )}
      {video?.status === "failed" && video.error && (
        <details className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          <summary className="cursor-pointer">Render gagal — klik untuk detail</summary>
          <pre className="mt-2 max-h-40 overflow-auto font-mono text-[11px] whitespace-pre-wrap">{video.error}</pre>
        </details>
      )}

      {!shots.length ? (
        <div className="space-y-2">
          <p className="text-[12px] text-muted">
            AI mengubah isi post jadi naskah shot (maks 5 kata per shot). Gerak lalu menggambar video satu papan bergaya Brand Kit: kamera berpindah antar shot, foto/produk ikut melompat, harga dihitung naik turun, ditutup ajakan + handle.
          </p>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => start(async () => { const r = await generateVideoScript(postId); setMsg(r); setDirty(false); router.refresh(); })}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Tulis naskah video dengan AI
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {shots.map((s, i) => {
            const wc = wordCount(s.text);
            return (
              <div key={i} className="min-w-0 space-y-1.5 rounded-lg border border-line p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-5 text-[11px] text-muted">{i + 1}</span>
                  <select value={s.kind} onChange={(e) => set(i, { kind: e.target.value as ShotKind })} className="input !w-auto !py-1 text-[12px]">
                    {kinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  {s.kind === "step" && (
                    <input type="number" min={1} value={s.n ?? ""} onChange={(e) => set(i, { n: Number(e.target.value) || undefined })} className="input !w-16 !py-1 text-[12px]" placeholder="no." />
                  )}
                  {s.kind === "product" && (
                    <select value={s.productId ?? ""} onChange={(e) => set(i, { productId: Number(e.target.value) || undefined })} className="input !w-auto min-w-0 flex-1 !py-1 text-[12px]">
                      <option value="">— produk —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name.slice(0, 50)}</option>)}
                    </select>
                  )}
                  <span className="ml-auto flex gap-1">
                    <button type="button" className="btn !p-1" onClick={() => move(i, -1)} aria-label="Naik"><ArrowUp size={12} /></button>
                    <button type="button" className="btn !p-1" onClick={() => move(i, 1)} aria-label="Turun"><ArrowDown size={12} /></button>
                    <button type="button" className="btn btn-danger !p-1" onClick={() => { setShots(shots.filter((_, k) => k !== i)); setDirty(true); }} aria-label="Hapus shot"><Trash2 size={12} /></button>
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input value={s.text} onChange={(e) => set(i, { text: e.target.value })} className="input min-w-0 flex-1 !py-1.5 text-[13px] font-semibold" placeholder="Teks besar (maks 5 kata)" />
                  <span className={`self-center text-[10px] ${wc > 5 ? "text-danger" : "text-dim"}`}>{wc}/5</span>
                </div>
                <div className="flex gap-1.5">
                  <input value={s.emph ?? ""} onChange={(e) => set(i, { emph: e.target.value || undefined })} className="input min-w-0 flex-1 !py-1 text-[12px]" placeholder="kata distabilo (opsional)" />
                  <input value={s.label ?? ""} onChange={(e) => set(i, { label: e.target.value || undefined })} className="input min-w-0 flex-1 !py-1 text-[12px]" placeholder="label kecil (opsional)" />
                </div>
                {s.kind === "compare" && (
                  <p className="text-[11px] text-dim">Memakai produk perbandingan dari post ({(s.productIds ?? []).length || products.length} produk) · pilihan: #{s.pick ?? 1}</p>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn !py-1 text-[11px]" onClick={() => { const at = Math.max(0, shots.length - 1); const n = [...shots]; n.splice(at, 0, { kind: "point", text: "" }); setShots(n); setDirty(true); }}>
              <Plus size={11} /> Shot
            </button>
            <button type="button" className="btn !py-1 text-[11px]" disabled={pending} onClick={() => { if (!dirty || confirm("Ganti naskah sekarang dengan tulisan AI baru?")) start(async () => { const r = await generateVideoScript(postId); setMsg(r); setDirty(false); router.refresh(); }); }}>
              <Sparkles size={11} /> Tulis ulang AI
            </button>
            <label className="flex items-center gap-1.5 text-[12px] text-muted">
              <input type="checkbox" checked={!!opts.motionBlur} onChange={(e) => { setOpts({ ...opts, motionBlur: e.target.checked }); setDirty(true); }} /> motion blur (lebih halus, render ±3× lebih lama)
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-muted">
              <input type="checkbox" checked={opts.music !== "none"} onChange={(e) => { setOpts({ ...opts, music: e.target.checked ? "beat" : "none" }); setDirty(true); }} /> musik & SFX
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button type="button" className="btn btn-primary" disabled={pending || busy || !gerak.ok} onClick={() => save(true)}>
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} {video?.hasData ? "Simpan & render ulang" : "Render video"}
            </button>
            <button type="button" className="btn" disabled={pending || !dirty} onClick={() => save(false)}>Simpan naskah</button>
            {dirty && <span className="text-[11px] text-copy">● belum disimpan</span>}
          </div>
        </div>
      )}
      {msg?.message && <Msg ok={msg.ok} text={msg.message} />}
    </section>
  );
}
