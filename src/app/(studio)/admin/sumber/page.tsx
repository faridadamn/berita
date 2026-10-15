import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/auth";
import { getSources } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { SourceRows } from "./source-list";
import { AddSourceForm } from "./add-source";

export default async function SumberPage() {
  await requireAdmin();
  const sources = await getSources();
  const ago = Object.fromEntries(sources.map((s) => [s.id, timeAgo(s.lastFetchedAt)]));
  return (
    <>
      <PageHead eyebrow="Admin" title="Sumber Topik">Feed RSS / Atom yang dipantau Scout tiap ±15 menit di jam kerja.</PageHead>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[620px] text-[12px]">
          <thead className="text-left text-[10px] tracking-wider text-dim uppercase">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-medium">Media</th>
              <th className="px-2 font-medium">Kategori</th>
              <th className="px-2 text-right font-medium">Topik 24j</th>
              <th className="px-2 font-medium">Terakhir dicek</th>
              <th className="px-4 font-medium">Status</th>
            </tr>
          </thead>
          <SourceRows sources={sources} ago={ago} />
        </table>
        {!sources.length && <p className="px-4 py-8 text-center text-[13px] text-muted">Belum ada sumber. Tambahkan di bawah atau jalankan <code>npm run db:seed</code>.</p>}
      </div>

      <AddSourceForm />
    </>
  );
}
