"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Save, Type, Undo2, X } from "lucide-react";
import { FONT_CHOICES, type BrandKit } from "@/lib/brand";
import { TEMPLATES, imageSrc } from "@/lib/content";
import { saveBrandKitAction, uploadFont, uploadLogo } from "@/app/actions/brand";
import { Field, Msg } from "@/components/forms";

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const PALETTES: { name: string; colors: BrandKit["colors"] }[] = [
  { name: "Lime gelap", colors: { primary: "#d6f43c", secondary: "#f06bb7", background: "#0f1114", text: "#f4f4f2" } },
  { name: "Racun pink", colors: { primary: "#ff3d7f", secondary: "#ffd23f", background: "#fff7f0", text: "#1d1d1f" } },
  { name: "Oranye toko", colors: { primary: "#ee4d2d", secondary: "#ffb800", background: "#ffffff", text: "#1f1f1f" } },
  { name: "Hijau segar", colors: { primary: "#0f9d58", secondary: "#c6f432", background: "#f3f7f1", text: "#11281a" } },
  { name: "Navy profesional", colors: { primary: "#3b82f6", secondary: "#22d3ee", background: "#0b1530", text: "#eef2ff" } },
  { name: "Krem elegan", colors: { primary: "#8b5e34", secondary: "#c9a227", background: "#f6efe4", text: "#2a2118" } },
  { name: "Ungu kreator", colors: { primary: "#7c5cff", secondary: "#ff9bd2", background: "#15111f", text: "#f5f3ff" } },
];

const PREVIEW_SLIDES = [
  { i: 0, label: "Cover" },
  { i: 1, label: "Daftar" },
  { i: 2, label: "Langkah" },
  { i: 3, label: "Produk" },
  { i: 4, label: "Bandingkan" },
  { i: 5, label: "Penutup" },
];

const enc = (k: BrandKit) => {
  const bytes = new TextEncoder().encode(JSON.stringify(k));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export function BrandEditor({ initial }: { initial: BrandKit }) {
  const [kit, setKit] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"logo" | "font" | null>(null);
  const dirty = JSON.stringify(kit) !== JSON.stringify(saved);

  // preview diperbarui 600ms setelah berhenti mengubah
  const [previewKey, setPreviewKey] = useState(() => enc(initial));
  useEffect(() => {
    const t = setTimeout(() => setPreviewKey(enc(kit)), 600);
    return () => clearTimeout(t);
  }, [kit]);

  const set = <K extends keyof BrandKit>(k: K, v: BrandKit[K]) => setKit((x) => ({ ...x, [k]: v }));
  const setColor = (k: keyof BrandKit["colors"], v: string) => setKit((x) => ({ ...x, colors: { ...x.colors, [k]: v } }));

  const fontOptions = useMemo(
    () => [
      ...FONT_CHOICES.map((f) => ({ key: f.key, label: f.label })),
      ...kit.customFonts.map((f) => ({ key: `custom:${f.id}`, label: `${f.name} (upload)` })),
    ],
    [kit.customFonts],
  );

  const logoInput = useRef<HTMLInputElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setBusy("logo");
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadLogo(fd);
    setBusy(null);
    setMsg({ ok: r.ok, text: r.message ?? "" });
    if (r.ref) set("logo", r.ref);
  }
  async function onFont(file: File | undefined) {
    if (!file) return;
    setBusy("font");
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadFont(fd);
    setBusy(null);
    setMsg({ ok: r.ok, text: r.message ?? "" });
    if (r.font) setKit((x) => ({ ...x, customFonts: [...x.customFonts, r.font!], headFont: `custom:${r.font!.id}` }));
  }
  function save() {
    start(async () => {
      const r = await saveBrandKitAction(JSON.stringify(kit));
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.kit) {
        setKit(r.kit);
        setSaved(r.kit);
      }
    });
  }

  const others = TEMPLATES.filter((t) => t.key !== "brand");
  const anyAll = kit.applyFontsAll || kit.applyAccentAll || kit.applyLogoAll;
  const src = (t: string, s: number, w = 300) => `${bp}/admin/brand/preview?t=${t}&s=${s}&w=${w}&k=${previewKey}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-20 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="space-y-4">
        <section className="card grid grid-cols-2 gap-3 p-4">
          <p className="col-span-2 text-sm font-semibold">Identitas</p>
          <Field label="Nama brand"><input className="input" value={kit.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Handle"><input className="input" value={kit.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@akunkamu" /></Field>
          <Field label="Tentang akun (untuk AI)" className="col-span-2" hint="Niche, audiens, dan gaya. Contoh: affiliator gadget & perabot rumah untuk ibu muda dan anak kos, harga di bawah 300 ribu.">
            <textarea className="input min-h-20" value={kit.about} onChange={(e) => set("about", e.target.value)} />
          </Field>
        </section>

        <section className="card space-y-3 p-4">
          <p className="text-sm font-semibold">Warna</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["primary", "Utama / aksen"],
                ["secondary", "Kedua"],
                ["background", "Latar"],
                ["text", "Teks"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="block space-y-1.5">
                <span className="eyebrow !text-[9px]">{label}</span>
                <span className="flex items-center gap-2 rounded-lg border border-line-2 bg-panel-2 p-1.5">
                  <input type="color" value={kit.colors[k]} onChange={(e) => setColor(k, e.target.value)} className="size-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
                  <input
                    value={kit.colors[k]}
                    onChange={(e) => setColor(k, e.target.value)}
                    className="w-full min-w-0 bg-transparent font-mono text-[12px] outline-none"
                    maxLength={7}
                  />
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PALETTES.map((p) => (
              <button key={p.name} type="button" onClick={() => set("colors", p.colors)} className="btn !px-2 !py-1 text-[11px]" title={p.name}>
                <span className="flex">
                  {Object.values(p.colors).map((c) => (
                    <span key={c} className="-ml-1 size-3.5 rounded-full border border-black/20 first:ml-0" style={{ background: c }} />
                  ))}
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </section>

        <section className="card grid grid-cols-2 gap-3 p-4">
          <p className="col-span-2 text-sm font-semibold">Font</p>
          <Field label="Judul">
            <select className="input" value={kit.headFont} onChange={(e) => set("headFont", e.target.value)}>
              {fontOptions.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Teks isi">
            <select className="input" value={kit.bodyFont} onChange={(e) => set("bodyFont", e.target.value)}>
              {fontOptions.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={kit.headUpper} onChange={(e) => set("headUpper", e.target.checked)} /> Judul HURUF KAPITAL
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-2">
            <input ref={fontInput} type="file" accept=".ttf,.otf,.woff" className="hidden" onChange={(e) => onFont(e.target.files?.[0])} />
            <button type="button" className="btn" onClick={() => fontInput.current?.click()} disabled={busy === "font"}>
              {busy === "font" ? <Loader2 size={13} className="animate-spin" /> : <Type size={13} />} Upload font sendiri
            </button>
            <span className="text-[11px] text-dim">.ttf / .otf / .woff, maks 3 MB. Pastikan lisensinya boleh dipakai komersial.</span>
          </div>
          {kit.customFonts.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-1.5">
              {kit.customFonts.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px]">
                  {f.name}
                  <button
                    type="button"
                    title="Hapus dari daftar"
                    onClick={() =>
                      setKit((x) => ({
                        ...x,
                        customFonts: x.customFonts.filter((c) => c.id !== f.id),
                        headFont: x.headFont === `custom:${f.id}` ? "plus-jakarta-sans" : x.headFont,
                        bodyFont: x.bodyFont === `custom:${f.id}` ? "inter" : x.bodyFont,
                      }))
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card grid grid-cols-2 gap-3 p-4">
          <p className="col-span-2 text-sm font-semibold">Logo</p>
          <div className="col-span-2 flex flex-wrap items-center gap-3">
            <div className="grid h-16 w-32 place-items-center rounded-lg border border-line-2" style={{ background: kit.colors.background }}>
              {kit.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageSrc(kit.logo, bp) ?? ""} alt="logo" className="max-h-12 max-w-28 object-contain" />
              ) : (
                <span className="text-[11px]" style={{ color: kit.colors.text }}>tanpa logo</span>
              )}
            </div>
            <input ref={logoInput} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
            <button type="button" className="btn" onClick={() => logoInput.current?.click()} disabled={busy === "logo"}>
              {busy === "logo" ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {kit.logo ? "Ganti logo" : "Upload logo"}
            </button>
            {kit.logo && (
              <button type="button" className="btn btn-danger" onClick={() => set("logo", null)}>
                <X size={13} /> Lepas
              </button>
            )}
          </div>
          <Field label="Posisi logo" className="col-span-2" hint="PNG transparan atau SVG paling bagus. Logo tampil di template Brand Kit (dan template lain kalau diaktifkan di bawah).">
            <select className="input" value={kit.logoPlacement} onChange={(e) => set("logoPlacement", e.target.value as BrandKit["logoPlacement"])}>
              <option value="header">Di header (menggantikan teks handle)</option>
              <option value="footer">Di footer</option>
              <option value="none">Hanya di slide penutup</option>
            </select>
          </Field>
        </section>

        <section className="card grid grid-cols-2 gap-3 p-4">
          <p className="col-span-2 text-sm font-semibold">Gaya</p>
          <Field label="Tata letak cover">
            <select className="input" value={kit.cover} onChange={(e) => set("cover", e.target.value as BrandKit["cover"])}>
              <option value="framed">Foto berbingkai di bawah judul</option>
              <option value="full">Foto penuh + gradasi</option>
              <option value="top">Foto di atas, teks di bawah</option>
              <option value="inset">Judul dulu, foto bergaris aksen</option>
            </select>
          </Field>
          <Field label="Ikon poin (daftar)">
            <select className="input" value={kit.bullet} onChange={(e) => set("bullet", e.target.value as BrandKit["bullet"])}>
              <option value="angka">Angka dalam lingkaran</option>
              <option value="centang">Centang</option>
              <option value="titik">Titik</option>
              <option value="panah">Panah</option>
            </select>
          </Field>
          <Field label={`Sudut membulat: ${["siku", "sedikit", "sedang", "bulat", "sangat bulat"][Math.round(kit.radius)]}`} className="col-span-2">
            <input type="range" min={0} max={4} step={1} value={kit.radius} onChange={(e) => set("radius", Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
          </Field>
        </section>

        <section className="card space-y-2 p-4">
          <p className="text-sm font-semibold">Terapkan ke semua template</p>
          <p className="text-[12px] text-muted">Biar 7 template lain (Stabilo, Putih, Foto, …) tetap terasa satu brand. Ikon poin selalu berlaku di semua template.</p>
          {(
            [
              ["applyFontsAll", "Pakai font brand di semua template"],
              ["applyAccentAll", "Pakai warna utama sebagai aksen di semua template"],
              ["applyLogoAll", "Tampilkan logo di semua template"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={kit[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
            </label>
          ))}
        </section>
      </div>

      <div className="space-y-4">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Preview template Brand Kit</p>
            <span className="text-[11px] text-dim">contoh isi · foto & produk diambil dari data kamu kalau ada</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PREVIEW_SLIDES.map((p) => (
              <figure key={p.i} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src("brand", p.i)} alt={p.label} className="aspect-[4/5] w-full rounded-md border border-line bg-panel-2 object-cover" />
                <figcaption className="text-center text-[10px] text-dim">{p.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
        {anyAll && (
          <section className="card p-4">
            <p className="mb-3 text-sm font-semibold">Template lain dengan brand kamu</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {others.map((t) => (
                <figure key={t.key} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(t.key, 1, 240)} alt={t.label} loading="lazy" className="aspect-[4/5] w-full rounded-md border border-line bg-panel-2 object-cover" />
                  <figcaption className="text-center text-[10px] text-dim">{t.label}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
          {msg && <Msg ok={msg.ok} text={msg.text} />}
          {dirty && <span className="text-[12px] text-copy">Ada perubahan belum disimpan</span>}
          <button type="button" className="btn" disabled={!dirty || pending} onClick={() => setKit(saved)}>
            <Undo2 size={13} /> Batal
          </button>
          <button type="button" className="btn btn-primary" disabled={!dirty || pending} onClick={save}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan Brand Kit
          </button>
        </div>
      </div>
    </div>
  );
}
