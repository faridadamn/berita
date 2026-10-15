import type { Metadata } from "next";
import { basePath } from "@/lib/config";
import { getBrand } from "@/lib/brand-kit";
import { getPublishedPosts } from "@/lib/data";
import { getProducts } from "@/lib/products";
import { getSettings } from "@/lib/settings";
import { ProductCard } from "./product-card";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return { title: `Baca · ${brand.handle}`, robots: { index: true, follow: true } };
}

export default async function BacaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [posts, products, brand, settings] = await Promise.all([getPublishedPosts(), getProducts({ activeOnly: true }), getBrand(), getSettings()]);
  const shop = products.length > 0 && (tab === "etalase" || !posts.length);
  return (
    <main className="min-h-dvh bg-[#f6f5f1] text-black">
      <div className="mx-auto max-w-lg px-4 py-6">
        <header className="flex items-center gap-3">
          <span className="display grid size-12 shrink-0 place-items-center rounded-full border-2 border-black bg-accent text-xl">
            {brand.handle.replace("@", "")[0]?.toUpperCase()}
          </span>
          <div>
            <h1 className="text-lg font-bold">{brand.handle}</h1>
            <p className="text-[13px] leading-snug text-black/70">
              {shop ? "Produk yang pernah aku review & rekomendasikan." : "Klik postingan yang kamu lihat di Instagram untuk lanjut ke artikel atau produknya."}
            </p>
          </div>
        </header>
        {products.length > 0 && (
          <nav className="mt-5 grid grid-cols-2 rounded-full bg-black/5 p-1 text-center text-[13px] font-semibold">
            <a href={`${basePath}/baca`} className={`rounded-full py-1.5 ${!shop ? "bg-black text-white" : "text-black/60"}`}>Postingan</a>
            <a href={`${basePath}/baca?tab=etalase`} className={`rounded-full py-1.5 ${shop ? "bg-black text-white" : "text-black/60"}`}>Etalase ({products.length})</a>
          </nav>
        )}
        {shop ? (
          <div className="mt-4 space-y-2">
            {products.map((p) => <ProductCard key={p.id} p={p} channel="baca" />)}
            {settings.salesDisclosure && <p className="pt-2 text-center text-[11px] leading-relaxed text-black/50">{settings.salesDisclosure}</p>}
          </div>
        ) : (
        <div className="mt-5 grid grid-cols-3 gap-1">
          {posts.map((p) => (
            // <a> biasa, bukan <Link>: Link mem-prefetch rute /s/ dan bikin klik palsu
            <a key={p.id} href={`${basePath}/s/${p.shortCode}?c=bio`} className="relative block">
              {p.renderCount > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${basePath}/m/${p.shortCode}/1.jpg?v=${p.renderHash ?? ""}`} alt={p.headline} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/5] w-full place-items-center bg-neutral-800 p-2 text-center text-[10px] font-semibold text-white">{p.headline}</div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 px-1 pt-3 pb-0.5 text-[9px] font-semibold text-white">
                {p.productIds.length ? "Lihat produk" : p.sourceName}
              </span>
            </a>
          ))}
        </div>
        )}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-black/50">
          Konten berita di {brand.handle} merangkum media lain dengan sudut pandang sendiri; artikel lengkap ada di situs sumbernya.
          {products.length > 0 && <><br />Beberapa link produk adalah link affiliate.</>}
        </p>
      </div>
    </main>
  );
}
