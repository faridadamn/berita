import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import { ActButton, ActionForm, Field } from "@/components/forms";
import {
  addProductImages, createSalesContent, deleteProduct, removeProductImage, rescrapeProduct, saveProduct, setMainProductImage,
} from "@/app/actions/products";
import { requireSession } from "@/lib/auth";
import { appUrl } from "@/lib/channels";
import { PLATFORMS, imageSrc } from "@/lib/content";
import { getProduct } from "@/lib/products";
import { CopyLink } from "./copy-link";

export const dynamic = "force-dynamic";
const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ baru?: string }> }) {
  await requireSession();
  const { id } = await params;
  const { baru } = await searchParams;
  const p = await getProduct(Number(id));
  if (!p) notFound();
  const base = appUrl() ?? "";
  const link = (c: string) => `${base}/p/${p.shortCode}?c=${c}`;

  return (
    <>
      <Link href="/jualan" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Jualan
      </Link>
      {baru === "0" && (
        <p className="mb-4 rounded-lg border border-copy/40 bg-copy/5 px-3 py-2 text-[12px] text-copy">
          Toko ini tidak mengizinkan data diambil otomatis (umum di Shopee & TikTok Shop). Isi nama, harga, dan upload foto produk secara manual ya.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ActionForm action={saveProduct.bind(null, p.id)} className="card grid grid-cols-2 gap-3 p-4">
          <div className="col-span-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Data produk</p>
            <label className="flex items-center gap-1.5 text-[12px]">
              <input type="checkbox" name="active" defaultChecked={p.active} /> aktif
            </label>
          </div>
          <Field label="Nama produk" className="col-span-2"><input name="name" defaultValue={p.name} className="input" required /></Field>
          <Field label="Link produk" className="col-span-2"><input name="url" defaultValue={p.url} className="input" placeholder="https://…" /></Field>
          <Field label="Link affiliate" className="col-span-2" hint="Tujuan klik. Kosong = link produk.">
            <input name="affiliateUrl" defaultValue={p.affiliateUrl} className="input" placeholder="https://…" />
          </Field>
          <Field label="Toko">
            <select name="platform" defaultValue={p.platform} className="input">
              {PLATFORMS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Kategori"><input name="category" defaultValue={p.category} className="input" placeholder="Dapur, Gadget, Skincare…" /></Field>
          <Field label="Harga"><input name="price" defaultValue={p.price ?? ""} className="input" inputMode="numeric" placeholder="89000" /></Field>
          <Field label="Harga coret (sebelum diskon)"><input name="originalPrice" defaultValue={p.originalPrice ?? ""} className="input" inputMode="numeric" /></Field>
          <Field label="Rating (0–5)"><input name="rating" defaultValue={p.rating ?? ""} className="input" inputMode="decimal" placeholder="4.8" /></Field>
          <Field label="Terjual" hint="boleh 12rb, 1,2jt"><input name="sold" defaultValue={p.sold ?? ""} className="input" /></Field>
          <Field label="Mata uang"><input name="currency" defaultValue={p.currency} className="input" maxLength={3} /></Field>
          <Field label="Promo / voucher"><input name="promo" defaultValue={p.promo} className="input" placeholder="Kode HEMAT20, gratis ongkir" /></Field>
          <Field label="Catatan untuk AI" className="col-span-2" hint="Kelebihan yang kamu rasakan sendiri, cocok untuk siapa, hal yang wajib/dilarang disebut. AI tidak akan mengarang di luar data ini.">
            <textarea name="notes" defaultValue={p.notes} rows={3} className="input" />
          </Field>
          <Field label="Deskripsi produk" className="col-span-2"><textarea name="description" defaultValue={p.description} rows={4} className="input text-[13px]" /></Field>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button className="btn btn-primary">Simpan produk</button>
            {(p.url || p.affiliateUrl) && (
              <a href={p.affiliateUrl || p.url} target="_blank" rel="noreferrer" className="btn"><ExternalLink size={13} /> Buka di toko</a>
            )}
          </div>
        </ActionForm>

        <div className="space-y-4">
          <section className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Foto ({p.images.length})</p>
              {p.url && (
                <ActButton run={rescrapeProduct.bind(null, p.id)} className="btn !py-1 text-[11px]"><RefreshCw size={12} /> Ambil ulang dari toko</ActButton>
              )}
            </div>
            {p.images.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {p.images.map((ref, i) => (
                  <div key={ref} className="group relative size-24 overflow-hidden rounded-md bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(ref, bp) ?? ""} alt="" className="size-full object-contain" loading="lazy" />
                    {i === 0 ? (
                      <span className="absolute bottom-0 left-0 bg-black/70 px-1 text-[9px] text-white">utama</span>
                    ) : (
                      <ActButton run={setMainProductImage.bind(null, p.id, ref)} className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-white opacity-0 group-hover:opacity-100">
                        jadikan utama
                      </ActButton>
                    )}
                    <ActButton run={removeProductImage.bind(null, p.id, ref)} className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 group-hover:opacity-100" title="Hapus">
                      <X size={11} />
                    </ActButton>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-copy">Belum ada foto — slide produk akan memakai warna polos. Upload foto produk (latar putih paling bagus).</p>
            )}
            <ActionForm action={addProductImages.bind(null, p.id)} resetOnSuccess className="space-y-2">
              <input name="imageUrl" className="input !py-1.5 text-[12px]" placeholder="Tempel URL gambar…" />
              <div className="flex items-center gap-1.5">
                <input type="file" name="file" accept="image/*" multiple className="min-w-0 flex-1 text-[11px] file:mr-2 file:rounded-md file:border file:border-line-2 file:bg-panel-2 file:px-2 file:py-1 file:text-[11px] file:text-fg" />
                <button className="btn !py-1.5"><Upload size={12} /> Tambah</button>
              </div>
            </ActionForm>
          </section>

          <section className="card space-y-2 p-4">
            <p className="text-sm font-semibold">Link pendek per kanal</p>
            <p className="text-[11px] text-dim">Semua menuju link affiliate; klik dicatat per kanal. {p.clicks} klik total · dipakai di {p.posts} post.</p>
            {!base && <p className="text-[11px] text-copy">Isi APP_URL supaya link lengkap dengan domain.</p>}
            <CopyLink label="Link di bio" url={link("bio")} />
            <CopyLink label="Story / IG" url={link("instagram")} />
            <CopyLink label="TikTok" url={link("tiktok")} />
            <CopyLink label="WhatsApp" url={link("wa")} />
            <CopyLink label="Telegram" url={link("telegram")} />
            <CopyLink label="Komentar" url={link("komentar")} />
          </section>

          <ActionForm action={createSalesContent} className="card space-y-2 p-4">
            <p className="text-sm font-semibold">Buat konten promo produk ini</p>
            <input type="hidden" name="product" value={p.id} />
            <input type="hidden" name="type" value="promo" />
            <input name="notes" className="input !py-1.5 text-[12px]" placeholder="Arahan (opsional)" />
            <button className="btn btn-primary"><Sparkles size={13} /> Tulis promo dengan AI</button>
            <p className="text-[11px] text-dim">Untuk rekomendasi / perbandingan beberapa produk, centang produknya di halaman Jualan.</p>
          </ActionForm>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-dim">
              <Star size={10} className="inline" /> Data dipakai apa adanya di slide — pastikan harga masih berlaku sebelum posting.
            </span>
            <ActButton run={deleteProduct.bind(null, p.id)} confirm="Hapus produk ini? Slide yang memakainya akan kosong." className="btn btn-danger !py-1 text-[11px]">
              <Trash2 size={12} /> Hapus
            </ActButton>
          </div>
        </div>
      </div>
    </>
  );
}
