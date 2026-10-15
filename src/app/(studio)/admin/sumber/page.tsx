import { Plus } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { ActionForm, Field } from "@/components/forms";
import { addSource } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { getSources } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { SourceRows } from "./source-list";

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

      <ActionForm action={addSource} resetOnSuccess className="card mt-4 grid gap-3 p-4 sm:grid-cols-2">
        <p className="text-sm font-semibold sm:col-span-2">Tambah sumber</p>
        <Field label="Nama media"><input name="name" required className="input" placeholder="mis. Kompas Tekno" /></Field>
        <Field label="Kategori" hint="Bebas, mis. AI, MARKETING, SOSMED">
          <input name="category" className="input" defaultValue="AI" />
        </Field>
        <Field label="URL feed RSS / Atom" className="sm:col-span-2">
          <input name="feedUrl" type="url" required className="input font-mono" placeholder="https://contoh.com/feed" />
        </Field>
        <div className="sm:col-span-2">
          <button className="btn btn-primary"><Plus size={13} /> Tambah</button>
        </div>
      </ActionForm>
    </>
  );
}
