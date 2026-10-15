"use client";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, ImagePlus, Link2, Plus, Search, Trash2, Upload, Wand2, X } from "lucide-react";
import { ActButton, ActionForm, Msg } from "@/components/forms";
import {
  addImageUrl, addStockImage, removeImage, savePost, scrapeArticleImages, searchStockImages, uploadImage,
  type ActionState, type PostEdit,
} from "@/app/actions/studio";
import { CONTENT_TYPES, SLIDE_KINDS, TEMPLATES, formatPrice, imageSrc, type Slide, type SlideKind } from "@/lib/content";
import type { Post } from "@/lib/types";

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const lines = (a?: string[]) => (a ?? []).join("\n");
const unlines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export type CatalogItem = { id: number; name: string; price: number | null; currency: string; image: string | null; active: boolean };

function blank(kind: SlideKind, n: number, catalog: CatalogItem[] = []): Slide {
  switch (kind) {
    case "product":
      return { kind, headline: "Produk pilihan", body: "", productId: catalog[0]?.id };
    case "compare":
      return { kind, headline: "Mana yang cocok buat kamu?", productIds: catalog.slice(0, 2).map((c) => c.id), items: ["", ""], pick: 1 };
    case "step":
      return { kind, step: n, headline: `Langkah ${n}`, body: "" };
    case "list":
      return { kind, headline: "Poin penting", items: ["", "", ""] };
    case "code":
      return { kind, headline: "Contoh kode", code: "", lang: "bash" };
    case "verdict":
      return { kind, headline: "Verdict", rating: 8, items: [""], cons: [""] };
    case "cta":
      return { kind, headline: "Baca lengkapnya di link bio", body: "" };
    default:
      return { kind, headline: "Judul slide", body: "" };
  }
}

export function PostEditor({ post, mainImage, catalog = [] }: { post: Post; mainImage: string | null; catalog?: CatalogItem[] }) {
  const [kicker, setKicker] = useState(post.kicker);
  const [template, setTemplate] = useState(post.template);
  const [contentType, setContentType] = useState(post.contentType);
  const [slides, setSlides] = useState<Slide[]>(post.slides);
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags.join(" "));
  const [pt, setPt] = useState(post.platformText);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [saving, start] = useTransition();
  const touch = () => setDirty(true);
  const v = post.renderHash ?? post.renderedAt ?? "0";

  const pool = post.images;
  const setSlide = (i: number, patch: Partial<Slide>) => {
    setSlides((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    touch();
  };
  const move = (i: number, d: -1 | 1) => {
    setSlides((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    touch();
  };
  const save = (render: boolean) =>
    start(async () => {
      const data: PostEdit = { kicker, template, contentType, slides, caption, hashtags, platformText: pt };
      const r = await savePost(post.id, data, render);
      setMsg(r);
      if (r.ok !== false) setDirty(false);
    });

  return (
    <div className="space-y-4">
      {/* ───── Gaya ───── */}
      <section className="card space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Gaya & format</p>
          {dirty && <span className="text-[11px] text-copy">● belum disimpan</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="eyebrow !text-[9px]">Jenis konten</span>
            <select value={contentType} onChange={(e) => { setContentType(e.target.value as Post["contentType"]); touch(); }} className="input">
              {CONTENT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="eyebrow !text-[9px]">Kicker</span>
            <input value={kicker} onChange={(e) => { setKicker(e.target.value); touch(); }} className="input" maxLength={24} />
          </label>
        </div>
        <div>
          <p className="eyebrow mb-1.5 !text-[9px]">Template</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                title={t.desc}
                onClick={() => { setTemplate(t.key); touch(); }}
                className={`w-[92px] shrink-0 overflow-hidden rounded-lg border-2 text-left ${template === t.key ? "border-accent" : "border-transparent opacity-80 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${bp}/review/${post.id}/slide/1?t=${t.key}&w=200&v=${v}`} alt="" loading="lazy" className="aspect-[4/5] w-full bg-panel-2 object-cover" />
                <p className="truncate bg-panel-2 px-1.5 py-1 text-[10px]">{t.label}</p>
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-dim">Thumbnail memakai isi yang tersimpan; simpan dulu untuk melihat perubahan teks.</p>
        </div>
      </section>

      {/* ───── Pustaka gambar ───── */}
      <ImagePool postId={post.id} pool={pool} mainImage={mainImage} />

      {/* ───── Slide ───── */}
      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold">Slide ({slides.length})</p>
        {slides.map((s, i) => (
          <fieldset key={i} className="min-w-0 space-y-2 rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted">#{i + 1}</span>
              <select
                value={s.kind}
                onChange={(e) => {
                  const k = e.target.value as SlideKind;
                  setSlide(i, { ...blank(k, i, catalog), headline: s.headline, body: s.body, image: s.image, kind: k });
                }}
                className="input !w-auto !py-1 text-[12px]"
              >
                {SLIDE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
              {s.kind === "step" && (
                <label className="flex items-center gap-1 text-[11px] text-muted">
                  no.
                  <input type="number" min={1} value={s.step ?? i} onChange={(e) => setSlide(i, { step: Number(e.target.value) })} className="input !w-16 !py-1 text-[12px]" />
                </label>
              )}
              {s.kind === "verdict" && (
                <label className="flex items-center gap-1 text-[11px] text-muted">
                  nilai
                  <input type="number" min={0} max={10} step={0.5} value={s.rating ?? ""} onChange={(e) => setSlide(i, { rating: e.target.value === "" ? undefined : Number(e.target.value) })} className="input !w-20 !py-1 text-[12px]" />
                  /10
                </label>
              )}
              <span className="ml-auto flex gap-1">
                <button type="button" className="btn !p-1" onClick={() => move(i, -1)} aria-label="Naik"><ArrowUp size={12} /></button>
                <button type="button" className="btn !p-1" onClick={() => move(i, 1)} aria-label="Turun"><ArrowDown size={12} /></button>
                <button
                  type="button"
                  className="btn btn-danger !p-1"
                  onClick={() => { if (slides.length > 1) { setSlides(slides.filter((_, k) => k !== i)); touch(); } }}
                  aria-label="Hapus slide"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
            <textarea value={s.headline} onChange={(e) => setSlide(i, { headline: e.target.value })} rows={s.kind === "cover" ? 2 : 1} className="input" placeholder="Judul slide" />
            <textarea value={s.body ?? ""} onChange={(e) => setSlide(i, { body: e.target.value })} rows={2} className="input text-[13px]" placeholder="Teks kecil (opsional)" />
            {(s.kind === "list" || s.kind === "verdict") && (
              <textarea value={lines(s.items)} onChange={(e) => setSlide(i, { items: e.target.value.split("\n") })} onBlur={(e) => setSlide(i, { items: unlines(e.target.value) })} rows={4} className="input text-[13px]" placeholder={s.kind === "verdict" ? "Kelebihan — satu per baris" : "Poin — satu per baris (maks 6)"} />
            )}
            {s.kind === "verdict" && (
              <textarea value={lines(s.cons)} onChange={(e) => setSlide(i, { cons: e.target.value.split("\n") })} onBlur={(e) => setSlide(i, { cons: unlines(e.target.value) })} rows={2} className="input text-[13px]" placeholder="Kekurangan — satu per baris" />
            )}
            {(s.kind === "code" || s.kind === "step") && (
              <div className="space-y-1.5">
                <textarea value={s.code ?? ""} onChange={(e) => setSlide(i, { code: e.target.value })} rows={s.kind === "code" ? 6 : 3} spellCheck={false} className="input font-mono text-[12px]" placeholder={s.kind === "step" ? "Perintah / kode untuk langkah ini (opsional)" : "Kode (maks ±18 baris)"} />
                <input value={s.lang ?? ""} onChange={(e) => setSlide(i, { lang: e.target.value })} className="input !w-40 !py-1 font-mono text-[12px]" placeholder="bahasa (bash, tsx…)" />
              </div>
            )}
            {s.kind === "product" && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={s.productId ?? ""} onChange={(e) => setSlide(i, { productId: Number(e.target.value) || undefined })} className="input !w-auto min-w-0 flex-1 !py-1.5 text-[12px]">
                  <option value="">— pilih produk katalog —</option>
                  {catalog.map((c) => <option key={c.id} value={c.id}>{c.name.slice(0, 70)}{c.price ? ` · ${formatPrice(c.price, c.currency)}` : ""}{c.active ? "" : " (nonaktif)"}</option>)}
                </select>
                <label className="flex items-center gap-1 text-[11px] text-muted">
                  no.
                  <input type="number" min={0} value={s.step ?? ""} onChange={(e) => setSlide(i, { step: e.target.value === "" || e.target.value === "0" ? undefined : Number(e.target.value) })} className="input !w-16 !py-1 text-[12px]" placeholder="—" />
                </label>
                <p className="w-full text-[11px] text-dim">Harga, diskon, rating, terjual & foto diambil dari katalog — ubah di halaman Jualan.</p>
              </div>
            )}
            {s.kind === "compare" && (
              <CompareEditor slide={s} catalog={catalog} onChange={(patch) => setSlide(i, patch)} />
            )}
            <SlideImagePicker slide={s} pool={pool} mainImage={mainImage} onChange={(image) => setSlide(i, { image })} />
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {SLIDE_KINDS.filter((k) => k.key !== "cover").map((k) => (
            <button
              key={k.key}
              type="button"
              className="btn !py-1 text-[11px]"
              onClick={() => {
                const ctaAt = slides.findIndex((x) => x.kind === "cta");
                const steps = slides.filter((x) => x.kind === "step").length;
                const ns = blank(k.key, steps + 1, catalog);
                const n = [...slides];
                n.splice(ctaAt >= 0 && k.key !== "cta" ? ctaAt : n.length, 0, ns);
                setSlides(n);
                touch();
              }}
            >
              <Plus size={11} /> {k.label}
            </button>
          ))}
        </div>
        {post.headlineAlternatives.length > 0 && (
          <div className="space-y-1 border-t border-line pt-3">
            <p className="text-[11px] text-dim">Alternatif judul cover dari Copywriter (klik untuk pakai):</p>
            {post.headlineAlternatives.map((h) => (
              <button key={h} type="button" onClick={() => setSlide(0, { headline: h })} className="w-full rounded-md border border-line px-2.5 py-1.5 text-left text-[12px] text-muted hover:border-line-2 hover:text-fg">
                {h}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ───── Teks ───── */}
      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold">Teks per platform</p>
        <Field label="Caption Instagram">
          <textarea value={caption} onChange={(e) => { setCaption(e.target.value); touch(); }} rows={7} className="input" />
        </Field>
        <Field label="Hashtag">
          <input value={hashtags} onChange={(e) => { setHashtags(e.target.value); touch(); }} className="input" />
        </Field>
        <Field label="LinkedIn" hint="Kosong = caption. Gaya lebih profesional; shortlink ditambahkan otomatis.">
          <textarea value={pt.linkedin ?? ""} onChange={(e) => { setPt({ ...pt, linkedin: e.target.value }); touch(); }} rows={6} className="input" />
        </Field>
        <Field label="Threads" hint="Kosong = judul + paragraf pertama caption">
          <textarea value={pt.threads ?? ""} onChange={(e) => { setPt({ ...pt, threads: e.target.value }); touch(); }} rows={3} className="input" />
        </Field>
        <Field label="X" hint="Kosong = judul">
          <textarea value={pt.x ?? ""} onChange={(e) => { setPt({ ...pt, x: e.target.value }); touch(); }} rows={2} className="input" />
        </Field>
        {(post.productIds.length > 0 || pt.tiktok || pt.wa) && (
          <>
            <Field label="TikTok / Shopee Video / Reels" hint="Kosong = paragraf pertama caption + hashtag">
              <textarea value={pt.tiktok ?? ""} onChange={(e) => { setPt({ ...pt, tiktok: e.target.value }); touch(); }} rows={3} className="input" />
            </Field>
            <Field label="WhatsApp / Telegram" hint="Link produk /p/… di dalam teks dicatat sebagai klik kanal 'wa'.">
              <textarea value={pt.wa ?? ""} onChange={(e) => { setPt({ ...pt, wa: e.target.value }); touch(); }} rows={6} className="input" />
            </Field>
          </>
        )}
      </section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/95 p-3 shadow-lg backdrop-blur">
        <button type="button" disabled={saving} onClick={() => save(true)} className="btn btn-primary disabled:opacity-60">
          <Wand2 size={13} /> {saving ? "Menyimpan…" : "Simpan & render ulang"}
        </button>
        <button type="button" disabled={saving} onClick={() => save(false)} className="btn disabled:opacity-60">Simpan saja</button>
        {msg?.message && <Msg ok={msg.ok} text={msg.message} />}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="eyebrow !text-[9px]">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-dim">{hint}</span>}
    </label>
  );
}

function Thumb({ src, active, onClick, label }: { src: string | null; active: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border-2 bg-panel-2 text-[10px] text-muted ${active ? "border-accent" : "border-transparent"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : label}
      {active && <Check size={14} className="absolute top-0.5 right-0.5 rounded-full bg-accent text-accent-ink" />}
    </button>
  );
}

function CompareEditor({ slide, catalog, onChange }: { slide: Slide; catalog: CatalogItem[]; onChange: (p: Partial<Slide>) => void }) {
  const ids = slide.productIds ?? [];
  const items = slide.items ?? [];
  return (
    <div className="space-y-2 rounded-md bg-panel-2 p-2">
      <p className="text-[11px] text-dim">Pilih 2–3 produk. Harga & rating dari katalog; isi “cocok untuk” per produk.</p>
      {[0, 1, 2].map((k) => (
        <div key={k} className="flex flex-wrap items-center gap-1.5">
          <span className="w-4 text-[11px] text-muted">{k + 1}</span>
          <select
            value={ids[k] ?? ""}
            onChange={(e) => {
              const n = [...ids];
              const v = Number(e.target.value);
              if (v) n[k] = v;
              else n.splice(k, 1);
              onChange({ productIds: n.filter(Boolean).slice(0, 3) });
            }}
            className="input !w-auto min-w-0 flex-1 !py-1 text-[12px]"
          >
            <option value="">{k < 2 ? "— pilih produk —" : "— (opsional) —"}</option>
            {catalog.map((c) => <option key={c.id} value={c.id}>{c.name.slice(0, 60)}{c.price ? ` · ${formatPrice(c.price, c.currency)}` : ""}</option>)}
          </select>
          <input
            value={items[k] ?? ""}
            onChange={(e) => {
              const n = [...items];
              while (n.length <= k) n.push("");
              n[k] = e.target.value;
              onChange({ items: n });
            }}
            placeholder="cocok untuk…"
            className="input !w-auto min-w-0 flex-1 !py-1 text-[12px]"
          />
          <label className="flex items-center gap-1 text-[11px] text-muted">
            <input type="radio" checked={slide.pick === k + 1} onChange={() => onChange({ pick: k + 1 })} /> pilihan
          </label>
        </div>
      ))}
    </div>
  );
}

function SlideImagePicker({ slide, pool, mainImage, onChange }: { slide: Slide; pool: string[]; mainImage: string | null; onChange: (v: string | null | undefined) => void }) {
  const auto = slide.kind === "cover" ? mainImage : slide.kind === "product" ? "produk" : null;
  const options = useMemo(() => [...new Set([...(mainImage ? [mainImage] : []), ...pool])], [pool, mainImage]);
  if (slide.kind === "compare") return null;
  return (
    <div>
      <p className="mb-1 text-[11px] text-dim">Gambar slide</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Thumb src={null} label={auto === "produk" ? "Foto produk" : auto ? "Otomatis" : "Otomatis (tanpa)"} active={slide.image === undefined} onClick={() => onChange(undefined)} />
        <Thumb src={null} label="Tanpa" active={slide.image === null} onClick={() => onChange(null)} />
        {options.map((ref) => (
          <Thumb key={ref} src={imageSrc(ref, bp)} active={slide.image === ref} onClick={() => onChange(ref)} />
        ))}
      </div>
    </div>
  );
}

function ImagePool({ postId, pool, mainImage }: { postId: number; pool: string[]; mainImage: string | null }) {
  const [url, setUrl] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ thumb: string; url: string; credit: string }[] | null>(null);
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const all = [...new Set([...(mainImage ? [mainImage] : []), ...pool])];

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Pustaka gambar ({all.length})</p>
        <ActButton run={() => scrapeArticleImages(postId)} className="btn !py-1 text-[11px]">
          <ImagePlus size={12} /> Ambil dari artikel
        </ActButton>
      </div>
      <p className="text-[11px] text-dim">Pilih gambar berbeda untuk tiap slide di editor slide di bawah.</p>
      {all.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {all.map((ref) => (
            <div key={ref} className="group relative size-20 overflow-hidden rounded-md bg-panel-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc(ref, bp) ?? ""} alt="" loading="lazy" className="size-full object-cover" />
              {ref === mainImage && <span className="absolute bottom-0 left-0 bg-black/70 px-1 text-[9px] text-white">utama</span>}
              {ref !== mainImage && (
                <ActButton run={() => removeImage(postId, ref)} className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 group-hover:opacity-100" title="Hapus dari pustaka">
                  <X size={11} />
                </ActButton>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex gap-1.5">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Tempel URL gambar…" className="input !py-1.5 text-[12px]" />
          <button
            type="button"
            className="btn !py-1.5"
            disabled={pending || !url}
            onClick={() => start(async () => { const r = await addImageUrl(postId, url); setMsg(r); if (r.ok) setUrl(""); })}
            title="Tambah URL"
          >
            <Link2 size={12} />
          </button>
        </div>
        <ActionForm action={uploadImage.bind(null, postId)} resetOnSuccess className="flex items-center gap-1.5">
          <input type="file" name="file" accept="image/*" multiple className="min-w-0 flex-1 text-[11px] file:mr-2 file:rounded-md file:border file:border-line-2 file:bg-panel-2 file:px-2 file:py-1 file:text-[11px] file:text-fg" />
          <button className="btn !py-1.5" title="Unggah"><Upload size={12} /></button>
        </ActionForm>
      </div>
      <div className="space-y-2">
        <div className="flex gap-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); start(async () => { const r = await searchStockImages(q); setRes(r.results ?? null); setMsg(r.ok ? null : r); }); } }}
            placeholder="Cari foto stok (Pexels), mis. 'laptop coding'"
            className="input !py-1.5 text-[12px]"
          />
          <button type="button" className="btn !py-1.5" disabled={pending || !q} onClick={() => start(async () => { const r = await searchStockImages(q); setRes(r.results ?? null); setMsg(r.ok ? null : r); })}>
            <Search size={12} />
          </button>
        </div>
        {res && (
          <div className="grid grid-cols-6 gap-1.5">
            {res.map((p) => (
              <button
                key={p.url}
                type="button"
                title={p.credit}
                onClick={() => start(async () => setMsg(await addStockImage(postId, p.url)))}
                className="overflow-hidden rounded-md hover:ring-2 hover:ring-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      {msg?.message && <Msg ok={msg.ok} text={msg.message} />}
    </section>
  );
}
