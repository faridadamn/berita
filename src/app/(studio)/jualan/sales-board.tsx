"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Eye, EyeOff, MousePointerClick, Search, Sparkles, Star } from "lucide-react";
import { ActButton, ActionForm } from "@/components/forms";
import { createSalesContent, toggleProduct } from "@/app/actions/products";
import { CONTENT_TYPES, discountOf, formatCount, formatPrice, imageSrc, platformOf } from "@/lib/content";
import type { ProductRow } from "@/lib/types";

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SALES = CONTENT_TYPES.filter((c) => ["promo", "rekomendasi", "perbandingan"].includes(c.key));
const RANGE: Record<string, [number, number]> = { promo: [1, 1], rekomendasi: [2, 7], perbandingan: [2, 3] };

export function SalesBoard({ products, base }: { products: ProductRow[]; base: string }) {
  const [q, setQ] = useState("");
  const [showOff, setShowOff] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [type, setType] = useState("promo");
  const [copied, setCopied] = useState<number | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => (showOff || p.active) && (!s || `${p.name} ${p.category} ${p.platform}`.toLowerCase().includes(s)));
  }, [products, q, showOff]);

  const toggle = (id: number) => {
    const next = sel.includes(id) ? sel.filter((y) => y !== id) : [...sel, id];
    setSel(next);
    // tebak jenis konten dari jumlah produk (masih bisa diganti manual)
    if (next.length === 1) setType("promo");
    else if (next.length > 1 && type === "promo") setType(next.length <= 3 ? "perbandingan" : "rekomendasi");
    else if (next.length > 3 && type === "perbandingan") setType("rekomendasi");
  };
  const [min, max] = RANGE[type];
  const valid = sel.length >= min && sel.length <= max;

  if (!products.length)
    return (
      <div className="card grid place-items-center gap-2 p-10 text-center">
        <p className="text-sm font-semibold">Katalog masih kosong</p>
        <p className="max-w-sm text-[13px] text-muted">Tambah produk dari link (Shopee, Tokopedia, TikTok Shop, …) atau impor CSV di samping. Setelah itu centang produk dan biarkan AI menulis kontennya.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <ActionForm action={createSalesContent} className="card z-10 space-y-3 p-4 shadow-lg lg:sticky lg:top-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            <Sparkles size={14} className="mr-1 inline text-accent" /> Buat konten jualan
            <span className="ml-2 text-[12px] font-normal text-muted">{sel.length ? `${sel.length} produk dipilih` : "centang produk di bawah"}</span>
          </p>
          {sel.length > 0 && <button type="button" className="text-[11px] text-muted hover:text-fg" onClick={() => setSel([])}>kosongkan</button>}
        </div>
        {sel.map((id) => <input key={id} type="hidden" name="product" value={id} />)}
        <div className="grid grid-cols-3 gap-2">
          {SALES.map((c) => (
            <label key={c.key} className={`cursor-pointer rounded-lg border p-2.5 text-[12px] ${type === c.key ? "border-accent bg-accent/5" : "border-line hover:border-line-2"}`}>
              <input type="radio" name="type" value={c.key} checked={type === c.key} onChange={() => setType(c.key)} className="sr-only" />
              <b className="block">{c.label.replace("Jualan: ", "")}</b>
              <span className="hidden text-[11px] text-muted sm:block">{c.desc}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input name="notes" className="input min-w-0 flex-1 !py-1.5 text-[12px]" placeholder="Arahan (opsional): mis. target anak kos, momen gajian, tonjolkan voucher" />
          <button className="btn btn-primary" disabled={!valid}>
            <Sparkles size={13} /> Tulis dengan AI
          </button>
        </div>
        {!valid && sel.length > 0 && (
          <p className="text-[11px] text-copy">{type === "promo" ? "Promo untuk 1 produk." : `${type === "perbandingan" ? "Perbandingan" : "Rekomendasi"}: pilih ${min}–${max} produk.`}</p>
        )}
      </ActionForm>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk…" className="input !py-1.5 !pl-8 text-[12px]" />
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> tampilkan nonaktif
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {list.map((p) => {
          const disc = discountOf(p.price, p.originalPrice);
          const plat = platformOf(p.platform);
          const on = sel.includes(p.id);
          const link = `${base}/p/${p.shortCode}?c=bio`;
          return (
            <div key={p.id} className={`card flex gap-3 p-3 ${on ? "!border-accent" : ""} ${p.active ? "" : "opacity-60"}`}>
              <button type="button" onClick={() => toggle(p.id)} className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-white" aria-label="Pilih">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageSrc(p.images[0], bp) ?? ""} alt="" loading="lazy" className="size-full object-contain" />
                ) : (
                  <span className="grid size-full place-items-center bg-panel-2 text-[10px] text-dim">tanpa foto</span>
                )}
                <span className={`absolute top-1 left-1 grid size-5 place-items-center rounded border-2 ${on ? "border-accent bg-accent text-accent-ink" : "border-white bg-black/30"}`}>
                  {on && <Check size={12} />}
                </span>
                {disc > 0 && <span className="absolute right-1 bottom-1 rounded bg-rose-600 px-1 text-[10px] font-bold text-white">-{disc}%</span>}
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded px-1.5 text-[10px] font-bold text-white" style={{ background: plat.color }}>{plat.label}</span>
                  {p.category && <span className="truncate text-[10px] text-dim">{p.category}</span>}
                </div>
                <Link href={`/jualan/${p.id}`} className="line-clamp-2 text-[13px] leading-snug font-semibold hover:underline">{p.name}</Link>
                <p className="text-[13px]">
                  <b>{p.price ? formatPrice(p.price, p.currency) : <span className="text-copy">harga belum diisi</span>}</b>
                  {disc > 0 && <span className="ml-1.5 text-[11px] text-dim line-through">{formatPrice(p.originalPrice, p.currency)}</span>}
                </p>
                <p className="flex flex-wrap items-center gap-x-2.5 text-[11px] text-muted">
                  {p.rating ? <span><Star size={10} className="inline fill-amber-400 text-amber-400" /> {p.rating}</span> : null}
                  {p.sold ? <span>{formatCount(p.sold)}+ terjual</span> : null}
                  <span title="klik 7 hari / total"><MousePointerClick size={10} className="inline" /> {p.clicks7d} / {p.clicks}</span>
                  <span>{p.posts} post</span>
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    className="btn !px-2 !py-0.5 text-[11px]"
                    title={link}
                    onClick={async () => {
                      await navigator.clipboard.writeText(link);
                      setCopied(p.id);
                      setTimeout(() => setCopied(null), 1200);
                    }}
                  >
                    {copied === p.id ? <Check size={11} /> : <Copy size={11} />} link
                  </button>
                  <ActButton run={() => toggleProduct(p.id)} className="btn !px-2 !py-0.5 text-[11px]" title={p.active ? "Nonaktifkan" : "Aktifkan"}>
                    {p.active ? <EyeOff size={11} /> : <Eye size={11} />}
                  </ActButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!list.length && <p className="text-center text-[13px] text-muted">Tidak ada produk yang cocok.</p>}
    </div>
  );
}
