import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/auth";
import { getTeam } from "@/lib/data";
import { timeAgo } from "@/lib/format";

export default async function TimPage() {
  await requireAdmin();
  const team = await getTeam();
  return (
    <>
      <PageHead eyebrow="Admin" title="Tim & Akses">
        Tidak ada pendaftaran publik — akun hanya dibuat admin. Editor bisa review & jadwalkan, admin bisa semuanya.
      </PageHead>
      <div className="card divide-y divide-line/60">
        {team.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-panel-2 text-sm font-bold">{m.name[0]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{m.name}</p>
              <p className="truncate text-[11px] text-dim">{m.email}</p>
            </div>
            <span className="text-[11px] capitalize text-muted">{m.role}</span>
            <span className="hidden w-24 text-right text-[11px] text-dim sm:block">
              {m.active ? timeAgo(m.lastSeenAt) : "nonaktif"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-dim">Form tambah akun aktif setelah database tersambung (tahap 2).</p>
    </>
  );
}
