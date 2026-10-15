"use client";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plug, Plus, Trash2, List, X } from "lucide-react";
import { ActButton, ActionForm, Field, Msg } from "@/components/forms";
import {
  deleteProvider, fetchModels, moveProvider, saveProvider, setProviderModel, testProvider, toggleProvider,
} from "@/app/actions/admin";
import type { ProviderView } from "@/lib/types";

type Preset = { label: string; kind: ProviderView["kind"]; baseUrl: string; model: string };

const kindLabel = { openai: "OpenAI-compatible", gemini: "Gemini", anthropic: "Claude" };

function ProviderForm({ presets, initial, onDone }: { presets: Preset[]; initial?: ProviderView; onDone?: () => void }) {
  const [kind, setKind] = useState<ProviderView["kind"]>(initial?.kind ?? presets[0].kind);
  const [name, setName] = useState(initial?.name ?? presets[0].label);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? presets[0].baseUrl);
  const [model, setModel] = useState(initial?.model ?? presets[0].model);

  return (
    <ActionForm
      action={async (s, f) => {
        const r = await saveProvider(s, f);
        if (r.ok) onDone?.();
        return r;
      }}
      resetOnSuccess={!initial}
      className="grid gap-3 sm:grid-cols-2"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {!initial && (
        <Field label="Preset" className="sm:col-span-2">
          <select
            className="input"
            onChange={(e) => {
              const p = presets[Number(e.target.value)];
              setKind(p.kind);
              setName(p.label);
              setBaseUrl(p.baseUrl);
              setModel(p.model);
            }}
          >
            {presets.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Nama"><input name="name" value={name} onChange={(e) => setName(e.target.value)} required className="input" /></Field>
      <Field label="Jenis API">
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as ProviderView["kind"])} className="input">
          <option value="openai">OpenAI-compatible</option>
          <option value="gemini">Gemini</option>
          <option value="anthropic">Claude (Anthropic)</option>
        </select>
      </Field>
      <Field label="Model"><input name="model" value={model} onChange={(e) => setModel(e.target.value)} required className="input font-mono" /></Field>
      <Field label="Base URL" hint={kind === "openai" ? "Kosong = api.openai.com" : "Kosongkan untuk default"}>
        <input name="baseUrl" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="input font-mono" placeholder="https://…" />
      </Field>
      <Field label="API key" hint={initial ? `Tersimpan: ${initial.keyMasked}. Kosongkan kalau tidak diganti.` : "Disimpan terenkripsi di database."} className="sm:col-span-2">
        <input name="apiKey" type="password" autoComplete="off" className="input font-mono" placeholder={initial ? "(tidak diubah)" : ""} />
      </Field>
      <Field label="Harga input (USD / 1jt token)" hint="Opsional, untuk menghitung biaya. Lihat halaman harga provider.">
        <input name="priceIn" inputMode="decimal" defaultValue={initial?.priceIn || ""} className="input font-mono" placeholder="0" />
      </Field>
      <Field label="Harga output (USD / 1jt token)">
        <input name="priceOut" inputMode="decimal" defaultValue={initial?.priceOut || ""} className="input font-mono" placeholder="0" />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn btn-primary">{initial ? "Simpan" : <><Plus size={13} /> Tambah provider</>}</button>
        {onDone && initial && (
          <button type="button" className="btn" onClick={onDone}>Batal</button>
        )}
      </div>
    </ActionForm>
  );
}

function ModelPicker({ id, current }: { id: number; current: string }) {
  const [models, setModels] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  if (!models)
    return (
      <span className="inline-flex flex-col gap-1">
        <button
          className="btn !px-2 !py-1 text-[11px]"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await fetchModels(id);
              if (r.ok) setModels(r.models ?? []);
              else setErr(r.message ?? "Gagal");
            })
          }
        >
          <List size={12} /> {pending ? "Memuat…" : "Daftar model"}
        </button>
        {err && <Msg text={err} />}
      </span>
    );
  const shown = models.filter((m) => m.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  return (
    <div className="w-full space-y-2 rounded-lg border border-line p-2">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cari di ${models.length} model…`} className="input !py-1.5 text-[12px]" />
        <button className="btn !px-2" onClick={() => setModels(null)} aria-label="Tutup"><X size={12} /></button>
      </div>
      <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
        {shown.map((m) => (
          <button
            key={m}
            disabled={pending}
            onClick={() => start(async () => { await setProviderModel(id, m); setModels(null); })}
            className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${m === current ? "border-accent text-accent" : "border-line text-muted hover:text-fg"}`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ p, index, onEdit }: { p: ProviderView; index: number; onEdit: () => void }) {
  const [test, setTest] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [testing, start] = useTransition();
  const icon = "btn !px-1.5 !py-1";
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <span className={`display grid size-8 shrink-0 place-items-center rounded-lg text-base ${p.enabled ? "bg-accent/10 text-accent" : "bg-panel-2 text-dim"}`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">
            {p.name} <span className="ml-1 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-normal text-muted">{kindLabel[p.kind]}</span>
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
            {p.model} · {p.keyMasked}
            {p.baseUrl && ` · ${p.baseUrl}`}
          </p>
          {(p.priceIn > 0 || p.priceOut > 0) && <p className="text-[11px] text-dim">${p.priceIn} / ${p.priceOut} per 1jt token</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 pl-11">
        <button className="btn !px-2 !py-1 text-[11px]" disabled={testing} onClick={() => start(async () => setTest(await testProvider(p.id)))}>
          <Plug size={12} /> {testing ? "Mengetes…" : "Tes"}
        </button>
        <ActButton run={() => toggleProvider(p.id, !p.enabled)} className="btn !px-2 !py-1 text-[11px]">
          {p.enabled ? "Matikan" : "Aktifkan"}
        </ActButton>
        <ActButton run={() => moveProvider(p.id, -1)} className={icon} title="Naik"><ArrowUp size={12} /></ActButton>
        <ActButton run={() => moveProvider(p.id, 1)} className={icon} title="Turun"><ArrowDown size={12} /></ActButton>
        <button className={icon} onClick={onEdit} title="Edit"><Pencil size={12} /></button>
        <ActButton run={() => deleteProvider(p.id)} confirm={`Hapus provider ${p.name}?`} className={`${icon} btn-danger`} title="Hapus">
          <Trash2 size={12} />
        </ActButton>
      </div>
      <div className="space-y-2 pl-11">
        {test?.message && <Msg ok={test.ok} text={test.message} />}
        <ModelPicker id={p.id} current={p.model} />
      </div>
    </div>
  );
}

export function ProviderManager({ providers, presets, envFallback }: { providers: ProviderView[]; presets: Preset[]; envFallback: string[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(!providers.length);
  const activeCount = providers.filter((p) => p.enabled).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Provider AI</p>
          <p className="text-[12px] text-muted">
            Urutan = rantai fallback. Agen memakai provider teratas yang aktif; kalau error / kena limit, otomatis pindah ke berikutnya.
          </p>
        </div>
        {!adding && (
          <button className="btn" onClick={() => setAdding(true)}><Plus size={13} /> Tambah</button>
        )}
      </div>

      {!providers.length && envFallback.length > 0 && (
        <p className="rounded-lg border border-line px-3 py-2 text-[12px] text-muted">
          Sementara memakai key dari env: <b className="text-fg">{envFallback.join(", ")}</b>. Begitu ada provider di sini, env diabaikan.
        </p>
      )}

      {providers.map((p, i) => (
        <div key={p.id} className={`card p-3 ${p.enabled ? "" : "opacity-60"}`}>
          {editing === p.id ? (
            <ProviderForm presets={presets} initial={p} onDone={() => setEditing(null)} />
          ) : (
            <ProviderCard p={p} index={i} onEdit={() => setEditing(p.id)} />
          )}
        </div>
      ))}

      {providers.length > 0 && activeCount === 0 && <Msg text="Semua provider dimatikan — agen AI tidak bisa jalan." />}

      {adding && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Provider baru</p>
            {providers.length > 0 && <button className="text-dim hover:text-fg" onClick={() => setAdding(false)} aria-label="Tutup"><X size={14} /></button>}
          </div>
          <ProviderForm presets={presets} onDone={() => setAdding(false)} />
        </div>
      )}
    </section>
  );
}
