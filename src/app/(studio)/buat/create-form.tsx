"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Lightbulb, Link2, Sparkles } from "lucide-react";
import { ActionForm } from "@/components/forms";
import { createContent } from "@/app/actions/create";
import { CONTENT_TYPES } from "@/lib/content";

/** Tombol submit anti double-klik: langsung mati + tampil status saat AI menulis. */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
      <Sparkles size={13} /> {pending ? "Menulis draft\u2026" : "Tulis draft"}
    </button>
  );
}

export function CreateForm() {
  const [mode, setMode] = useState<"link" | "idea">("link");
  const [format, setFormat] = useState("auto");
  // Kunci unik per bukaan form: 1x submit = 1x draft (server menolak duplikat).
  const [idemKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  return (
    <ActionForm action={createContent} className="space-y-5">
      <input type="hidden" name="idempotencyKey" value={idemKey} />
      <div className="flex rounded-lg border border-line bg-panel-2 p-0.5 text-[13px]">
        {([["link", "Dari link", Link2], ["idea", "Dari ide", Lightbulb]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 ${mode === k ? "bg-panel text-fg shadow-sm" : "text-muted"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {mode === "link" ? (
        <label className="block space-y-1.5">
          <span className="eyebrow !text-[9px]">Link</span>
          <input name="url" type="url" required className="input" placeholder="https://github.com/user/repo · artikel · video YouTube" />
          <span className="block text-[11px] text-dim">Repo GitHub otomatis membaca README, bintang, bahasa, lisensi. YouTube membaca judul & deskripsi.</span>
        </label>
      ) : (
        <label className="block space-y-1.5">
          <span className="eyebrow !text-[9px]">Ide / topik</span>
          <input name="idea" required className="input" placeholder="mis. Cara bikin konten carousel yang di-save orang" />
          <span className="block text-[11px] text-copy">Tanpa sumber, AI menulis dari pengetahuan umum — wajib cek fakta sebelum posting.</span>
        </label>
      )}

      <div>
        <p className="eyebrow mb-2 !text-[9px]">Jenis konten</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[{ key: "auto", label: "Otomatis", desc: "AI pilih dari isi sumber (repo → review)" }, ...CONTENT_TYPES].map((c) => (
            <label key={c.key} className={`cursor-pointer rounded-lg border p-3 ${format === c.key ? "border-accent bg-accent/5" : "border-line hover:border-line-2"}`}>
              <input type="radio" name="format" value={c.key} checked={format === c.key} onChange={() => setFormat(c.key)} className="sr-only" />
              <p className="text-[13px] font-semibold">{c.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{c.desc}</p>
            </label>
          ))}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="eyebrow !text-[9px]">Arahan untuk AI (opsional)</span>
        <textarea name="notes" rows={3} className="input" placeholder="mis. fokus ke cara install di Windows; target pemula; bandingkan dengan tool X" />
      </label>

      <SubmitButton />
      <p className="text-[11px] text-dim">Butuh ±20–60 detik. Setelah selesai kamu langsung dibawa ke halaman review.</p>
    </ActionForm>
  );
}
