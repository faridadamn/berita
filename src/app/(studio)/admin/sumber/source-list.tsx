"use client";
import { Trash2 } from "lucide-react";
import { ActButton } from "@/components/forms";
import { deleteSource, setSourceFormat, toggleSource } from "@/app/actions/admin";
import { CONTENT_TYPES } from "@/lib/content";
import type { Source } from "@/lib/types";

export function SourceRows({ sources, ago }: { sources: Source[]; ago: Record<number, string> }) {
  return (
    <tbody>
      {sources.map((s) => (
        <tr key={s.id} className="border-b border-line/50 align-top last:border-0">
          <td className="px-4 py-2.5">
            <p className="font-medium">
              {s.name}
              <span className="ml-1.5 rounded bg-panel-2 px-1.5 py-0.5 text-[9px] font-normal uppercase tracking-wider text-muted">{s.kind}</span>
            </p>
            <p className="max-w-xs truncate font-mono text-[10px] text-dim">{s.feedUrl}</p>
            {s.lastError && <p className="mt-0.5 text-[11px] text-danger">⚠ {s.lastError}</p>}
          </td>
          <td className="px-2 py-2.5">
            <p>{s.category}</p>
            <select
              defaultValue={s.defaultFormat ?? ""}
              onChange={(e) => setSourceFormat(s.id, e.target.value)}
              className="mt-1 rounded border border-line bg-panel-2 px-1 py-0.5 text-[10px] text-muted"
              title="Jenis konten bawaan"
            >
              <option value="">format: otomatis</option>
              {CONTENT_TYPES.map((c) => <option key={c.key} value={c.key}>format: {c.label}</option>)}
            </select>
          </td>
          <td className="px-2 py-2.5 text-right font-mono">{s.topics24h}</td>
          <td className="px-2 py-2.5 text-muted">{ago[s.id]}</td>
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <ActButton
                run={() => toggleSource(s.id, !s.active)}
                className={`rounded-full px-2 py-0.5 text-[10px] ${s.active ? "bg-ok/10 text-ok" : "bg-panel-2 text-dim"}`}
                title="Klik untuk ubah"
              >
                {s.active ? "Aktif" : "Nonaktif"}
              </ActButton>
              <ActButton run={() => deleteSource(s.id)} confirm={`Hapus sumber ${s.name}?`} className="p-1 text-dim hover:text-danger" title="Hapus">
                <Trash2 size={13} />
              </ActButton>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}
