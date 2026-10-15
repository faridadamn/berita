import { PageHead, StatCard } from "@/components/page-head";
import { ActionForm, Field } from "@/components/forms";
import { addProductFromLink, importProductsCsv, saveSalesSettings } from "@/app/actions/products";
import { requireSession } from "@/lib/auth";
import { appUrl } from "@/lib/channels";
import { getProducts, getSalesStats } from "@/lib/products";
import { getSettings } from "@/lib/settings";
import { SalesBoard } from "./sales-board";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  instagram: "Instagram", threads: "Threads", x: "X", linkedin: "LinkedIn", wa: "WhatsApp/Telegram", tiktok: "TikTok", bio: "Link di bio",
  baca: "Halaman /baca", link: "Shortlink", lain: "Tanpa kanal",
};

export default async function JualanPage() {
  const session = await requireSession();
  const [products, stats, settings] = await Promise.all([getProducts(), getSalesStats(30), getSettings()]);
  const active = products.filter((p) => p.active).length;
  const clicks7d = products.reduce((a, p) => a + p.clicks7d, 0);
  const base = appUrl() ?? "";
  const top = stats.byChannel[0];

  return (
    <>
      <PageHead eyebrow="Mode jualan" title="Jualan">
        Katalog produk affiliate → AI bikin konten promo, rekomendasi, atau perbandingan. Setiap produk punya link pendek yang mencatat klik per kanal (IG, TikTok, WA, …).
      </PageHead>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Produk aktif" value={active} sub={`${products.length} di katalog`} />
        <StatCard label="Klik 7 hari" value={clicks7d} highlight />
        <StatCard label="Klik 30 hari" value={stats.total} />
        <StatCard label="Kanal teratas" value={top ? top.n : "—"} sub={top ? CHANNEL_LABEL[top.channel] ?? top.channel : "belum ada klik"} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <SalesBoard products={products} base={base} />

        <aside className="space-y-4">
          <ActionForm action={addProductFromLink} className="card space-y-3 p-4">
            <p className="text-sm font-semibold">Tambah produk dari link</p>
            <Field label="Link produk" hint="Shopee, Tokopedia, TikTok Shop, Lazada, Blibli, Amazon, toko online lain">
              <input name="url" className="input" placeholder="https://…" />
            </Field>
            <Field label="Link affiliate (opsional)" hint="Link komisi dari dashboard affiliate. Kosong = pakai link produk.">
              <input name="affiliateUrl" className="input" placeholder="https://s.shopee.co.id/…" />
            </Field>
            <p className="text-[11px] text-dim">Data (nama, harga, foto) diambil otomatis kalau tokonya mengizinkan — sisanya lengkapi di halaman berikutnya.</p>
            <button className="btn btn-primary">Tambah produk</button>
          </ActionForm>

          <ActionForm action={importProductsCsv} className="card space-y-3 p-4" resetOnSuccess>
            <p className="text-sm font-semibold">Impor CSV</p>
            <p className="text-[12px] text-muted">
              Kolom yang dikenali: <code className="text-[11px]">nama, link, link affiliate, harga, harga coret, rating, terjual, gambar, kategori, catatan, promo</code>. Pemisah koma atau titik koma.
            </p>
            <input type="file" name="file" accept=".csv,text/csv" className="w-full text-[11px] file:mr-2 file:rounded-md file:border file:border-line-2 file:bg-panel-2 file:px-2 file:py-1 file:text-[11px] file:text-fg" />
            <textarea name="csv" rows={3} className="input font-mono text-[11px]" placeholder={"atau tempel di sini:\nnama;link affiliate;harga\nTumbler 1L;https://…;89000"} />
            <button className="btn">Impor</button>
          </ActionForm>

          {stats.byChannel.length > 0 && (
            <section className="card p-4">
              <p className="mb-3 text-sm font-semibold">Klik per kanal · 30 hari</p>
              <div className="space-y-2">
                {stats.byChannel.map((c) => (
                  <div key={c.channel}>
                    <div className="flex justify-between text-[12px]">
                      <span>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                      <b>{c.n}</b>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-panel-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (c.n / stats.total) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {session.role === "admin" && (
            <ActionForm action={saveSalesSettings} className="card space-y-3 p-4">
              <p className="text-sm font-semibold">Aturan konten jualan</p>
              <Field label="Pengungkapan affiliate" hint="Ditambahkan otomatis ke caption IG, TikTok, LinkedIn & WA; Threads/X dapat #ad. Kosongkan untuk mematikan (tidak disarankan).">
                <textarea name="salesDisclosure" rows={3} defaultValue={settings.salesDisclosure} className="input text-[12px]" />
              </Field>
              <Field label="Ajakan (CTA)" hint="Arahan untuk AI di akhir caption">
                <input name="salesCta" defaultValue={settings.salesCta} className="input text-[12px]" />
              </Field>
              <button className="btn">Simpan</button>
            </ActionForm>
          )}
        </aside>
      </div>
    </>
  );
}
