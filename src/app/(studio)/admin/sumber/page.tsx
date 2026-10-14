import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/auth";
import { getSources } from "@/lib/data";
import { timeAgo } from "@/lib/format";

export default async function SumberPage() {
  await requireAdmin();
  const sources = await getSources();
  return (
    <>
      <PageHead eyebrow="Admin" title="Sumber Topik">Feed RSS yang dipantau Scout tiap 15 menit di jam kerja.</PageHead>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12px]">
          <thead className="text-left text-[10px] tracking-wider text-dim uppercase">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-medium">Media</th>
              <th className="px-2 font-medium">Kategori</th>
              <th className="px-2 text-right font-medium">Topik 24j</th>
              <th className="px-2 font-medium">Terakhir dicek</th>
              <th className="px-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-line/50 last:border-0">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{s.name}</p>
                  <p className="max-w-xs truncate font-mono text-[10px] text-dim">{s.feedUrl}</p>
                </td>
                <td className="px-2">{s.category}</td>
                <td className="px-2 text-right font-mono">{s.topics24h}</td>
                <td className="px-2 text-muted">{timeAgo(s.lastFetchedAt)}</td>
                <td className="px-4">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${s.active ? "bg-ok/10 text-ok" : "bg-panel-2 text-dim"}`}>
                    {s.active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
