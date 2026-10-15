"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ActionForm, Field } from "@/components/forms";
import { addSource, type SourcePreset } from "@/app/actions/admin";
import { CONTENT_TYPES } from "@/lib/content";

const presets: { key: SourcePreset; label: string; hint: string; placeholder?: string; category: string; format?: string }[] = [
  { key: "rss", label: "RSS / Atom", hint: "Feed situs berita / blog apa saja", placeholder: "https://contoh.com/feed", category: "AI" },
  { key: "reddit", label: "Reddit", hint: "Post teratas subreddit per hari", placeholder: "marketing  (atau r/socialmedia)", category: "SOSMED" },
  { key: "youtube", label: "YouTube", hint: "Video baru dari channel", placeholder: "@namachannel · URL channel · UC…", category: "VIDEO" },
  { key: "github", label: "GitHub naik daun", hint: "Repo baru yang cepat dapat bintang — cocok untuk review", category: "REPO", format: "review" },
  { key: "hn", label: "Hacker News", hint: "Front page dengan minimal poin tertentu", placeholder: "150", category: "TECH" },
  { key: "producthunt", label: "Product Hunt", hint: "Produk baru tiap hari — cocok untuk review", category: "PRODUK", format: "review" },
  { key: "bluesky", label: "Bluesky", hint: "Post dari akun Bluesky", placeholder: "nama.bsky.social", category: "SOSMED" },
  { key: "mastodon", label: "Mastodon", hint: "Post dari akun Mastodon", placeholder: "@user@mastodon.social", category: "SOSMED" },
  { key: "telegram", label: "Telegram", hint: "Kanal publik (yang bisa dibuka di t.me/s/…)", placeholder: "@namakanal", category: "SOSMED" },
  { key: "rsshub", label: "X / Instagram / TikTok (RSSHub)", hint: "Lewat RSSHub — pakai instance sendiri supaya stabil", placeholder: "/twitter/user/openai", category: "SOSMED" },
];

export function AddSourceForm() {
  const [key, setKey] = useState<SourcePreset>("rss");
  const p = presets.find((x) => x.key === key)!;
  return (
    <ActionForm key={key} action={addSource} resetOnSuccess className="card mt-4 space-y-4 p-4">
      <p className="text-sm font-semibold">Tambah sumber</p>
      <input type="hidden" name="preset" value={key} />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((x) => (
          <button key={x.key} type="button" onClick={() => setKey(x.key)} className={`rounded-full border px-2.5 py-1 text-[12px] ${key === x.key ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg"}`}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-muted">{p.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {key === "github" ? (
          <>
            <Field label="Bahasa (opsional)"><input name="language" className="input" placeholder="TypeScript, Python, Go…" /></Field>
            <Field label="Topik (opsional)"><input name="topic" className="input" placeholder="ai, llm, nextjs…" /></Field>
            <Field label="Minimal bintang"><input name="minStars" type="number" defaultValue={50} min={1} className="input" /></Field>
            <Field label="Repo dibuat dalam (hari)"><input name="days" type="number" defaultValue={7} min={1} max={60} className="input" /></Field>
          </>
        ) : key !== "producthunt" ? (
          <Field label={key === "rsshub" ? "Rute RSSHub" : key === "hn" ? "Minimal poin" : "Alamat / nama"} className="sm:col-span-2">
            <input name="value" required className="input font-mono text-[13px]" placeholder={p.placeholder} />
          </Field>
        ) : null}
        {key === "rsshub" && (
          <Field label="Instance RSSHub" hint="Instance publik sering dibatasi; idealnya host sendiri (docker).">
            <input name="instance" className="input font-mono text-[13px]" defaultValue="https://rsshub.app" />
          </Field>
        )}
        <Field label="Nama (opsional)"><input name="name" className="input" placeholder="otomatis" /></Field>
        <Field label="Kategori"><input name="category" className="input" defaultValue={p.category} /></Field>
        <Field label="Jenis konten bawaan" hint="Topik dari sumber ini ditulis sebagai…">
          <select name="defaultFormat" defaultValue={p.format ?? ""} className="input">
            <option value="">Otomatis (Analis yang pilih)</option>
            {CONTENT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <button className="btn btn-primary"><Plus size={13} /> Tambah & tes</button>
    </ActionForm>
  );
}
