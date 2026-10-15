"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { agentStyle } from "@/components/agent-badge";
import { ActButton, ActionForm, Field } from "@/components/forms";
import { deleteBrainNote, saveBrainNote } from "@/app/actions/admin";
import type { AgentKey, BrainNote } from "@/lib/types";

const agents: AgentKey[] = ["analis", "copywriter", "designer", "scout"];

function NoteForm({ note, onDone }: { note?: BrainNote; onDone: () => void }) {
  return (
    <ActionForm
      action={async (s, f) => {
        const r = await saveBrainNote(s, f);
        if (r.ok) onDone();
        return r;
      }}
      className="space-y-3"
    >
      {note && <input type="hidden" name="id" value={note.id} />}
      <Field label="Judul"><input name="title" defaultValue={note?.title} required className="input" /></Field>
      <Field label="Isi pedoman"><textarea name="content" defaultValue={note?.content} rows={5} required className="input" /></Field>
      <div>
        <p className="eyebrow mb-1.5 !text-[9px]">Berlaku untuk</p>
        <div className="flex flex-wrap gap-3 text-[12px]">
          {agents.map((a) => (
            <label key={a} className="flex items-center gap-1.5">
              <input type="checkbox" name="appliesTo" value={a} defaultChecked={note ? note.appliesTo.includes(a) : a === "copywriter"} className="accent-[var(--color-accent)]" />
              <span className={agentStyle[a].text}>{agentStyle[a].label}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-dim">Tidak dicentang semua = berlaku untuk semua agen.</p>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary">Simpan</button>
        <button type="button" className="btn" onClick={onDone}>Batal</button>
      </div>
    </ActionForm>
  );
}

export function BrainEditor({ notes, canEdit }: { notes: BrainNote[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {notes.map((n) => (
          <article key={n.id} className="card p-4">
            {editing === n.id ? (
              <NoteForm note={n} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold">{n.title}</h2>
                  <div className="flex shrink-0 items-center gap-1">
                    {(n.appliesTo.length ? n.appliesTo : (["semua"] as const)).map((a) => (
                      <span key={a} className={`rounded px-1.5 py-0.5 text-[10px] ${a === "semua" ? "bg-panel-2 text-muted" : `${agentStyle[a].bg} ${agentStyle[a].text}`}`}>
                        {a === "semua" ? "Semua" : agentStyle[a].label}
                      </span>
                    ))}
                    {canEdit && (
                      <>
                        <button className="p-1 text-dim hover:text-fg" onClick={() => setEditing(n.id)} aria-label="Edit"><Pencil size={13} /></button>
                        <ActButton run={() => deleteBrainNote(n.id)} confirm={`Hapus "${n.title}"?`} className="p-1 text-dim hover:text-danger">
                          <Trash2 size={13} />
                        </ActButton>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-muted">{n.content}</p>
              </>
            )}
          </article>
        ))}
        {editing === "new" && (
          <article className="card p-4">
            <NoteForm onDone={() => setEditing(null)} />
          </article>
        )}
      </div>
      {canEdit && editing !== "new" && (
        <button className="btn mt-3" onClick={() => setEditing("new")}><Plus size={13} /> Tambah pedoman</button>
      )}
    </>
  );
}
