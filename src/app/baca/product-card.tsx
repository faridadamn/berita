import { basePath } from "@/lib/config";
import { discountOf, formatCount, formatPrice, platformOf } from "@/lib/content";

type P = { id: number; name: string; platform: string; price: number | null; originalPrice: number | null; currency: string; rating: number | null; sold: number | null; images: string[]; shortCode: string };

/** Kartu produk publik. <a> biasa (bukan <Link>) supaya tidak di-prefetch & tidak bikin klik palsu. */
export function ProductCard({ p, channel, postId, n }: { p: P; channel: string; postId?: number; n?: number }) {
  const disc = discountOf(p.price, p.originalPrice);
  const plat = platformOf(p.platform);
  return (
    <a href={`${basePath}/p/${p.shortCode}?c=${channel}${postId ? `&post=${postId}` : ""}`} rel="nofollow sponsored" className="flex gap-3 rounded-xl border border-black/10 bg-white p-2.5 transition hover:border-black/40">
      <span className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${basePath}/baca/img/${p.id}`} alt={p.name} loading="lazy" className="size-full object-contain" />
        ) : null}
        {n ? <span className="absolute top-1 left-1 grid size-6 place-items-center rounded-full bg-black text-[11px] font-bold text-white">{n}</span> : null}
        {disc > 0 && <span className="absolute right-1 bottom-1 rounded bg-rose-600 px-1 text-[10px] font-bold text-white">-{disc}%</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{p.name}</span>
        <span className="mt-1 text-[14px] font-bold">
          {formatPrice(p.price, p.currency)}
          {disc > 0 && <span className="ml-1.5 text-[11px] font-normal text-black/40 line-through">{formatPrice(p.originalPrice, p.currency)}</span>}
        </span>
        <span className="text-[11px] text-black/55">
          {[p.rating ? `★ ${p.rating}` : "", p.sold ? `${formatCount(p.sold)}+ terjual` : ""].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-auto flex items-center justify-between pt-1">
          <span className="rounded px-1.5 text-[10px] font-bold text-white" style={{ background: plat.color }}>{plat.label}</span>
          <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white">Lihat produk ›</span>
        </span>
      </span>
    </a>
  );
}
