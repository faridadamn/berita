"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ActionForm } from "@/components/forms";
import { rewriteAs } from "@/app/actions/create";
import { CONTENT_TYPES, isSalesType, type ContentType } from "@/lib/content";

/** Tulis ulang draft dengan format lain (mis. berita → tutorial) atau arahan baru. */
export function RewritePanel({ postId, current, sales }: { postId: number; current: ContentType; sales?: boolean }) {
  const types = CONTENT_TYPES.filter((c) => isSalesType(c.key) === !!sales);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn w-full justify-center" onClick={() => setOpen(true)}>
        <RefreshCw size={13} /> Tulis ulang dengan AI (ganti format / arahan)
      </button>
    );
  return (
    <ActionForm action={rewriteAs.bind(null, postId)} className="card space-y-3 p-4">
      <p className="text-sm font-semibold">Tulis ulang dengan AI</p>
      <select name="format" defaultValue={current} className="input">
        {types.map((c) => <option key={c.key} value={c.key}>{c.label} — {c.desc}</option>)}
      </select>
      <textarea name="notes" rows={2} className="input" placeholder="Arahan tambahan (opsional), mis. lebih santai, fokus pemula" />
      <p className="text-[11px] text-copy">Semua slide, caption, dan teks platform diganti. Gambar di pustaka tetap.</p>
      <div className="flex gap-2">
        <button className="btn btn-primary"><RefreshCw size={13} /> Tulis ulang</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Batal</button>
      </div>
    </ActionForm>
  );
}
