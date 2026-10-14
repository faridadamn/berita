import { BarList } from "@/components/bar-list";
import { PageHead, StatCard } from "@/components/page-head";
import { getAnalytics } from "@/lib/data";
import { timeAgo } from "@/lib/format";

export default async function AnalitikPage() {
  const a = await getAnalytics();
  const er = (p: (typeof a.posted)[number]) =>
    p.reach ? (((p.likes + p.comments + p.shares + p.saves) / p.reach) * 100).toFixed(1) + "%" : "–";
  return (
    <>
      <PageHead eyebrow="Performa" title="Analitik">Data contoh. Tahap 3 disinkron dari Instagram Insights.</PageHead>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total views" value={a.totals.views} />
        <StatCard label="Total reach" value={a.totals.reach} />
        <StatCard label="Interaksi" value={a.totals.interactions} />
        <StatCard label="Klik ke media" value={a.totals.clicks} highlight />
      </section>

      <section className="card mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead className="text-left text-[10px] tracking-wider text-dim uppercase">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-medium">Post</th>
              {["Views", "Reach", "Like", "Komen", "Share", "Save", "ER"].map((h) => (
                <th key={h} className="px-2 py-2.5 text-right font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.posted.map((p) => (
              <tr key={p.id} className="border-b border-line/50 last:border-0">
                <td className="px-4 py-2.5">
                  <p className="max-w-xs truncate">{p.headline}</p>
                  <p className="text-[10px] text-dim">{timeAgo(p.postedAt)} · {p.format}</p>
                </td>
                {[p.views, p.reach, p.likes, p.comments, p.shares, p.saves].map((v, i) => (
                  <td key={i} className="px-2 text-right font-mono">{v}</td>
                ))}
                <td className="px-2 pr-4 text-right font-mono">{er(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2 text-[10px] text-dim">ER (engagement rate) = total interaksi ÷ reach.</p>
      </section>

      <section className="mt-3 grid gap-3 md:grid-cols-2">
        <BarList title="Kategori dengan views tertinggi" sub="Rata-rata views per post, per kategori" rows={a.categories} />
        <BarList title="Jam posting terbaik" sub="Rata-rata reach per jam posting (WIB)" rows={a.hours} />
      </section>
      <section className="mt-3">
        <BarList
          title="Pembaca yang dikirim ke media"
          sub="Klik ke artikel asli lewat shortlink di caption dan halaman /baca."
          rows={a.readers}
        />
      </section>
    </>
  );
}
