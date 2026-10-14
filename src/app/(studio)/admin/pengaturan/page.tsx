import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/auth";
import { aiWorkHours, brand, scoreThreshold } from "@/lib/config";

const Row = ({ k, v, note }: { k: string; v: string; note?: string }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
    <div>
      <p className="text-[13px]">{k}</p>
      {note && <p className="text-[11px] text-dim">{note}</p>}
    </div>
    <span className="font-mono text-[12px] text-muted">{v}</span>
  </div>
);

export default async function PengaturanPage() {
  await requireAdmin();
  return (
    <>
      <PageHead eyebrow="Admin" title="Pengaturan">Nilai dari src/lib/config.ts dan .env. Edit lewat UI menyusul di tahap 2.</PageHead>
      <div className="card divide-y divide-line/60">
        <Row k="Nama brand" v={brand.name} note="NEXT_PUBLIC_BRAND_NAME" />
        <Row k="Handle Instagram" v={brand.handle} note="NEXT_PUBLIC_BRAND_HANDLE" />
        <Row k="Mode" v="Semi-otomatis" note="AI menyiapkan draft, tim yang approve" />
        <Row k="Jam kerja AI" v={`${aiWorkHours.start}.00–${aiWorkHours.end}.00 WIB`} />
        <Row k="Ambang skor Analis" v={String(scoreThreshold)} />
        <Row k="Database" v={process.env.DATABASE_URL ? "Postgres tersambung" : "Data dummy"} />
        <Row k="Instagram" v="Belum tersambung" note="Tahap 3 — Instagram Graph API" />
      </div>
    </>
  );
}
