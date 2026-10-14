import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { getPosts } from "@/lib/data";
import { timezone } from "@/lib/config";

const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(iso));

export default async function KalenderPage() {
  const all = await getPosts();
  const items = all.filter((p) => p.scheduledAt || p.postedAt);
  const today = new Date();
  const start = new Date(today.getTime() - 6 * 86400_000);
  const days = Array.from({ length: 14 }, (_, i) => new Date(start.getTime() + i * 86400_000));
  const todayKey = dayKey(today.toISOString());

  return (
    <>
      <PageHead eyebrow="Jadwal" title="Kalender">
        Seminggu ke belakang dan seminggu ke depan. Hijau = sudah posting, kuning = terjadwal.
      </PageHead>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d.toISOString());
          const list = items.filter((p) => dayKey((p.postedAt ?? p.scheduledAt)!) === k);
          return (
            <div key={k} className={`card min-h-32 p-2.5 ${k === todayKey ? "!border-accent/50" : ""}`}>
              <p className="text-[11px] text-muted">
                {new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: timezone }).format(d)}
              </p>
              <div className="mt-2 space-y-1">
                {list.map((p) => (
                  <Link
                    key={p.id}
                    href={`/review/${p.id}`}
                    className={`block truncate rounded px-1.5 py-1 text-[11px] ${
                      p.status === "posted" ? "bg-ok/10 text-ok" : "bg-accent/10 text-accent"
                    }`}
                  >
                    {p.headline}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
