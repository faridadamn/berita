"use client";
import { useState } from "react";
import { Plug, Unplug } from "lucide-react";
import { ActButton, ActionForm, Field } from "@/components/forms";
import { disconnectChannel, saveChannelAction, testChannel, toggleChannel } from "@/app/actions/publish";
import type { ChannelView } from "@/lib/types";

type FieldDef = { key: string; label: string; secret?: boolean; hint?: string; placeholder?: string; options?: string[] };

const fields: Record<ChannelView["platform"], FieldDef[]> = {
  instagram: [
    { key: "host", label: "Jenis login", options: ["graph.instagram.com", "graph.facebook.com"], hint: "graph.instagram.com = Instagram Login (token 60 hari, diperpanjang otomatis). graph.facebook.com = lewat Facebook Page." },
    { key: "userId", label: "Instagram User ID", placeholder: "1784…" },
    { key: "accessToken", label: "Access token (long-lived)", secret: true },
    { key: "version", label: "Versi Graph API", placeholder: "v23.0" },
  ],
  threads: [
    { key: "userId", label: "Threads User ID", placeholder: "me", hint: "Boleh 'me'." },
    { key: "accessToken", label: "Access token (long-lived)", secret: true, hint: "Scope: threads_basic, threads_content_publish, threads_manage_insights. Diperpanjang otomatis." },
  ],
  x: [
    { key: "apiKey", label: "API Key (Consumer Key)", secret: true },
    { key: "apiSecret", label: "API Key Secret", secret: true },
    { key: "accessToken", label: "Access Token", secret: true, hint: "Buat dengan izin Read and Write." },
    { key: "accessSecret", label: "Access Token Secret", secret: true },
  ],
};

export function ChannelCard({ c, guide }: { c: ChannelView; guide: React.ReactNode }) {
  const [editing, setEditing] = useState(!c.configured);
  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {c.label}{" "}
            {c.configured && (
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] ${c.enabled ? "bg-ok/10 text-ok" : "bg-panel-2 text-dim"}`}>
                {c.enabled ? "Aktif" : "Nonaktif"}
              </span>
            )}
          </p>
          <p className="text-[12px] text-muted">
            {c.accountName ? `@${c.accountName}` : c.configured ? "Belum terverifikasi" : "Belum tersambung"}
            {c.tokenRefreshedAt && c.platform !== "x" && ` · token diperbarui ${new Date(c.tokenRefreshedAt).toLocaleDateString("id-ID")}`}
          </p>
        </div>
        {c.configured && (
          <div className="flex flex-wrap items-start gap-1.5">
            <ActButton run={() => testChannel(c.platform)} className="btn !px-2 !py-1 text-[11px]"><Plug size={12} /> Tes</ActButton>
            <ActButton run={() => toggleChannel(c.platform, !c.enabled)} className="btn !px-2 !py-1 text-[11px]">{c.enabled ? "Matikan" : "Aktifkan"}</ActButton>
            <button className="btn !px-2 !py-1 text-[11px]" onClick={() => setEditing(!editing)}>{editing ? "Tutup" : "Ubah"}</button>
            <ActButton run={() => disconnectChannel(c.platform)} confirm={`Putuskan ${c.label}? Kredensial dihapus.`} className="btn btn-danger !px-2 !py-1 text-[11px]">
              <Unplug size={12} />
            </ActButton>
          </div>
        )}
      </div>
      {c.lastError && <p className="text-[12px] text-danger">⚠ {c.lastError}</p>}
      {editing && (
        <>
          <div className="rounded-lg border border-line bg-panel-2 p-3 text-[12px] leading-relaxed text-muted">{guide}</div>
          <ActionForm action={saveChannelAction.bind(null, c.platform)} className="grid gap-3 sm:grid-cols-2">
            {fields[c.platform].map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} className={f.secret && c.platform !== "x" ? "sm:col-span-2" : ""}>
                {f.options ? (
                  <select name={f.key} defaultValue={c.publicFields[f.key] || f.options[0]} className="input">
                    {f.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    name={f.key}
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    defaultValue={f.secret ? "" : c.publicFields[f.key] ?? ""}
                    placeholder={f.secret && c.secretMasks[f.key] ? `Tersimpan: ${c.secretMasks[f.key]} (kosongkan = tidak diubah)` : f.placeholder}
                    className="input font-mono text-[12px]"
                  />
                )}
              </Field>
            ))}
            <details className="sm:col-span-2 text-[12px] text-dim">
              <summary className="cursor-pointer">Lanjutan</summary>
              <Field label="API base (opsional, untuk proxy)" className="mt-2">
                <input name="apiBase" defaultValue={c.publicFields.apiBase ?? ""} className="input font-mono text-[12px]" placeholder="kosongkan" />
              </Field>
            </details>
            <div className="sm:col-span-2">
              <button className="btn btn-primary">Simpan & tes koneksi</button>
            </div>
          </ActionForm>
        </>
      )}
    </section>
  );
}
