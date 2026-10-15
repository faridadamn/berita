import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { basePath } from "@/lib/config";
import { getBrand } from "@/lib/brand-kit";
import { getPostByShortCode } from "@/lib/data";
import { getProductsByIds } from "@/lib/products";
import { getSettings } from "@/lib/settings";
import { ProductCard } from "../product-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const post = await getPostByShortCode(code);
  return { title: post?.headline ?? "Produk", robots: { index: false } };
}

/** Daftar produk dari satu post jualan (tujuan link di bio untuk post rekomendasi / perbandingan). */
export default async function PostProducts({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ c?: string }> }) {
  const { code } = await params;
  const { c } = await searchParams;
  const post = await getPostByShortCode(code);
  if (!post || !post.productIds.length) notFound();
  const [products, brand, settings] = await Promise.all([getProductsByIds(post.productIds), getBrand(), getSettings()]);
  const channel = (c ?? "bio").replace(/[^\w-]/g, "").slice(0, 20) || "bio";
  return (
    <main className="min-h-dvh bg-[#f6f5f1] text-black">
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <a href={`${basePath}/baca`} className="text-[12px] text-black/50">‹ {brand.handle}</a>
        {post.renderCount > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${basePath}/m/${post.shortCode}/1.jpg?v=${post.renderHash ?? ""}`} alt="" className="w-full rounded-xl" />
        )}
        <h1 className="text-xl leading-tight font-bold">{post.headline}</h1>
        <div className="space-y-2">
          {products.map((p, i) => (
            <ProductCard key={p.id} p={p} channel={channel} postId={post.id} n={products.length > 1 ? i + 1 : undefined} />
          ))}
        </div>
        {settings.salesDisclosure && <p className="text-center text-[11px] leading-relaxed text-black/50">{settings.salesDisclosure}</p>}
        <p className="text-center text-[11px] text-black/40">Harga & stok bisa berubah — cek di halaman toko.</p>
      </div>
    </main>
  );
}
