"use client";
import { useRef, useState } from "react";
import { Check, Loader2, Mic, Square, Trash2, Upload, Video } from "lucide-react";
import { Msg } from "@/components/forms";
import { VIDEO_STYLES, type VideoOptions } from "@/lib/content";

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Upload file mentah ke route media (dengan progres). */
function upload(postId: number, kind: "vo" | "cam", file: Blob, name: string, onProgress: (p: number) => void) {
  return new Promise<{ ok: boolean; message: string }>((resolve) => {
    const x = new XMLHttpRequest();
    x.open("PUT", `${bp}/review/${postId}/video/media?kind=${kind}&name=${encodeURIComponent(name)}`);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      try {
        resolve(JSON.parse(x.responseText));
      } catch {
        resolve({ ok: false, message: x.status === 413 ? "File terlalu besar untuk server (cek client_max_body_size Nginx)" : `Gagal (${x.status})` });
      }
    };
    x.onerror = () => resolve({ ok: false, message: "Koneksi terputus saat upload" });
    x.send(file);
  });
}

export function StylePicker({ value, onChange }: { value?: string; onChange: (v: VideoOptions["style"]) => void }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {VIDEO_STYLES.map((s) => (
        <button
          key={s.key}
          type="button"
          title={s.desc}
          onClick={() => onChange(s.key)}
          className={`w-[84px] shrink-0 overflow-hidden rounded-lg border-2 text-left ${value === s.key ? "border-accent" : "border-transparent opacity-80 hover:opacity-100"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${bp}/video-styles/${s.key}.jpg`} alt="" loading="lazy" className="aspect-[9/16] w-full bg-panel-2 object-cover" />
          <p className="truncate bg-panel-2 px-1.5 py-1 text-[10px]">{s.label}</p>
        </button>
      ))}
    </div>
  );
}

export function MediaEditor({
  postId, opts, onChange, onUploaded,
}: {
  postId: number;
  opts: VideoOptions;
  onChange: (o: VideoOptions) => void;
  onUploaded: () => void;
}) {
  const [busy, setBusy] = useState<null | { kind: "vo" | "cam"; p: number }>(null);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [rec, setRec] = useState<{ r: MediaRecorder; t0: number } | null>(null);
  const [recSec, setRecSec] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const voIn = useRef<HTMLInputElement>(null);
  const camIn = useRef<HTMLInputElement>(null);

  async function send(kind: "vo" | "cam", file: Blob, name: string) {
    setBusy({ kind, p: 0 });
    setMsg(null);
    const r = await upload(postId, kind, file, name, (p) => setBusy({ kind, p }));
    setBusy(null);
    setMsg(r);
    if (r.ok) onUploaded();
  }
  async function remove(kind: "vo" | "cam") {
    if (!confirm(kind === "vo" ? "Hapus voice over?" : "Hapus video kamu?")) return;
    const r = await fetch(`${bp}/review/${postId}/video/media?kind=${kind}`, { method: "DELETE" }).then((x) => x.json()).catch(() => ({ ok: false, message: "Gagal" }));
    setMsg(r);
    onUploaded();
  }
  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        void send("vo", blob, `rekaman-${new Date().toLocaleTimeString("id-ID")}.webm`);
      };
      r.start(500);
      const t0 = Date.now();
      setRec({ r, t0 });
      const iv = setInterval(() => {
        const s = Math.round((Date.now() - t0) / 1000);
        setRecSec(s);
        if (s >= 180 || r.state !== "recording") clearInterval(iv);
        if (s >= 180) r.stop();
      }, 250);
    } catch {
      setMsg({ ok: false, message: "Mikrofon tidak bisa dipakai (izin ditolak atau tidak ada)" });
    }
  }
  function stopRec() {
    rec?.r.stop();
    setRec(null);
  }

  const cam = opts.cam;
  const vo = opts.vo;
  const set = (patch: Partial<VideoOptions>) => onChange({ ...opts, ...patch });

  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      {/* voice over */}
      <div className="space-y-1.5">
        <p className="text-[12px] font-semibold"><Mic size={12} className="mr-1 inline" /> Voice over</p>
        {vo ? (
          <p className="flex items-center gap-2 text-[12px] text-muted">
            <Check size={12} className="text-ok" /> {vo.name} · {vo.seconds} dtk
            <button type="button" className="ml-auto text-danger" onClick={() => remove("vo")} title="Hapus"><Trash2 size={12} /></button>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {rec ? (
            <button type="button" className="btn btn-danger !py-1 text-[12px]" onClick={stopRec}>
              <Square size={11} /> Stop ({recSec} dtk)
            </button>
          ) : (
            <button type="button" className="btn !py-1 text-[12px]" disabled={!!busy} onClick={startRec}>
              <Mic size={11} /> Rekam
            </button>
          )}
          <input ref={voIn} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && send("vo", e.target.files[0], e.target.files[0].name)} />
          <button type="button" className="btn !py-1 text-[12px]" disabled={!!busy || !!rec} onClick={() => voIn.current?.click()}>
            <Upload size={11} /> Upload audio
          </button>
          <span className="text-[11px] text-dim">maks 3 menit · video otomatis diperpanjang mengikuti VO</span>
        </div>
      </div>

      {/* video sendiri */}
      <div className="space-y-1.5 border-t border-line pt-3">
        <p className="text-[12px] font-semibold"><Video size={12} className="mr-1 inline" /> Video kamu (talking head)</p>
        {cam ? (
          <>
            <p className="flex items-center gap-2 text-[12px] text-muted">
              <Check size={12} className="text-ok" /> {cam.name} · {cam.seconds} dtk
              <button type="button" className="ml-auto text-danger" onClick={() => remove("cam")} title="Hapus"><Trash2 size={12} /></button>
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["pip", "PIP (pojok)"],
                  ["split-top", "Atas-bawah: kamu di atas"],
                  ["split-bottom", "Atas-bawah: kamu di bawah"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" onClick={() => set({ layout: k })} className={`rounded-md border px-2 py-1.5 text-[11px] ${opts.layout === k ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg"}`}>
                  <LayoutIcon kind={k} corner={opts.pipCorner} shape={opts.pipShape} />
                  {label}
                </button>
              ))}
            </div>
            {opts.layout === "pip" && (
              <div className="flex flex-wrap gap-2">
                <select className="input !w-auto !py-1 text-[12px]" value={opts.pipCorner ?? "kanan-bawah"} onChange={(e) => set({ pipCorner: e.target.value as VideoOptions["pipCorner"] })}>
                  <option value="kanan-bawah">kanan bawah</option>
                  <option value="kiri-bawah">kiri bawah</option>
                  <option value="kanan-atas">kanan atas</option>
                  <option value="kiri-atas">kiri atas</option>
                </select>
                <select className="input !w-auto !py-1 text-[12px]" value={opts.pipShape ?? "bulat"} onChange={(e) => set({ pipShape: e.target.value as VideoOptions["pipShape"] })}>
                  <option value="bulat">bulat</option>
                  <option value="kotak">kotak</option>
                </select>
              </div>
            )}
            <label className="flex items-center gap-1.5 text-[12px] text-muted">
              <input type="checkbox" checked={cam.useAudio !== false} onChange={(e) => set({ cam: { ...cam, useAudio: e.target.checked } })} /> pakai suara dari video ini {vo ? "(VO tetap diutamakan)" : ""}
            </label>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <input ref={camIn} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && send("cam", e.target.files[0], e.target.files[0].name)} />
          <button type="button" className="btn !py-1 text-[12px]" disabled={!!busy} onClick={() => camIn.current?.click()}>
            <Upload size={11} /> {cam ? "Ganti video" : "Upload video"}
          </button>
          <span className="text-[11px] text-dim">MP4/MOV, maks 3 menit · split membuat template jadi kotak di atas/bawah</span>
        </div>
      </div>

      {busy && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> {busy.p < 1 ? "Mengunggah…" : "Memproses di server…"}</span>
            <b>{Math.round(busy.p * 100)}%</b>
          </div>
          <div className="h-1 rounded-full bg-panel-2"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, busy.p * 100)}%` }} /></div>
        </div>
      )}
      {msg?.message && <Msg ok={msg.ok} text={msg.message} />}
    </div>
  );
}

/** Ikon kecil tata letak. */
function LayoutIcon({ kind, corner = "kanan-bawah", shape = "bulat" }: { kind: string; corner?: string; shape?: string }) {
  const right = corner.startsWith("kanan");
  const bottom = corner.endsWith("bawah");
  return (
    <svg viewBox="0 0 18 32" className="mx-auto mb-1 h-8 w-[18px]">
      <rect x="0.5" y="0.5" width="17" height="31" rx="2" fill="none" stroke="currentColor" opacity="0.5" />
      {kind === "pip" ? (
        shape === "bulat" ? <circle cx={right ? 13 : 5} cy={bottom ? 22 : 7} r="3.2" fill="currentColor" /> : <rect x={right ? 10 : 2} y={bottom ? 18.5 : 3.5} width="6" height="7.5" rx="1" fill="currentColor" />
      ) : kind === "split-top" ? (
        <rect x="1" y="1" width="16" height="14" fill="currentColor" />
      ) : (
        <rect x="1" y="17" width="16" height="14" fill="currentColor" />
      )}
    </svg>
  );
}
