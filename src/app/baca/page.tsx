import type { Metadata } from "next";
import { SlidePreview } from "@/components/slide-preview";
import { basePath, brand } from "@/lib/config";
import { getPublishedPosts } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Baca · ${brand.handle}`,
  robots: { index: true, follow: true },
};

export default async function BacaPage() {
  const posts = await getPublishedPosts();
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
              Klik postingan yang kamu lihat di Instagram untuk baca artikel lengkapnya di media aslinya.
            </p>
          </div>
        </header>
        <div className="mt-5 grid grid-cols-3 gap-1">
          {posts.map((p) => (
            // <a> biasa, bukan <Link>: Link mem-prefetch rute /s/ dan bikin klik palsu
            <a key={p.id} href={`${basePath}/s/${p.shortCode}`} className="relative block">
              {p.renderCount > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${basePath}/m/${p.shortCode}/1.jpg?v=${p.renderHash ?? ""}`} alt={p.headline} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <SlidePreview post={p} slide={p.slides[0]} className="!rounded-none" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 px-1 pt-3 pb-0.5 text-[9px] font-semibold text-white">
                {p.sourceName}
              </span>
            </a>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] leading-relaxed text-black/50">
          Konten di {brand.handle} merangkum berita dari media lain dengan sudut pandang sendiri.
          <br />
          Artikel lengkap dan liputan aslinya ada di situs media sumber.
        </p>
      </div>
    </main>
  );
}
