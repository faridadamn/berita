import Link from "next/link";
import { RotateCcw, PenLine } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { ActButton } from "@/components/forms";
import { requeueTopic } from "@/app/actions/studio";
import { getTopicCounts, getTopics } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { timeAgo } from "@/lib/format";
import type { Topic } from "@/lib/types";

const statusText: Record<Topic["status"], string> = {
  new: "Menunggu dinilai",
  passed: "Lolos · antre ditulis",
  rejected: "Tidak lolos",
  drafted: "Sudah jadi draft",
  failed: "Gagal ditulis",
};
const tabs: { key?: Topic["status"]; label: string }[] = [
  { label: "Semua" },
  { key: "new", label: "Menunggu" },
  { key: "passed", label: "Lolos" },
  { key: "drafted", label: "Jadi draft" },
  { key: "rejected", label: "Tidak lolos" },
  { key: "failed", label: "Gagal" },
];

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s: sp } = await searchParams;
  const current = tabs.find((t) => t.key === sp)?.key;
  const [topics, counts, settings] = await Promise.all([getTopics(current), getTopicCounts(), getSettings()]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <PageHead eyebrow="Hasil Scout" title="Radar Topik">
        Semua topik dari sumber RSS. Skor ≥ {settings.threshold} lanjut ke Copywriter. Topik yang ditolak tapi menurutmu layak bisa
        dipaksa masuk antrian tulis.
      </PageHead>
      <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/radar?s=${t.key}` : "/radar"}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] ${
              t.key === current ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label} <span className="ml-1 text-[11px] text-dim">{t.key ? counts[t.key] ?? 0 : total}</span>
          </Link>
        ))}
      </nav>
      {topics.length ? (
        <div className="card divide-y divide-line/60">
          {topics.map((t) => {
            const pass = (t.score ?? 0) >= settings.threshold;
            return (
              <div key={t.id} className="flex items-start gap-4 px-4 py-3">
                <span
                  className={`display grid size-11 shrink-0 place-items-center rounded-lg text-xl ${
                    t.score === null ? "bg-panel-2 text-dim" : pass ? "bg-accent/10 text-accent" : "bg-panel-2 text-muted"
                  }`}
                >
                  {t.score ?? "–"}
                </span>
                <div className="min-w-0 flex-1">
                  <a href={t.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium hover:underline">
                    {t.title}
                  </a>
                  <p className="mt-0.5 text-[11px] text-dim">
                    {t.sourceName} · {t.category} · {timeAgo(t.fetchedAt)} · <span className="text-muted">{statusText[t.status]}</span>
                  </p>
                  {t.scoreReason && (
                    <p className={`mt-1 text-[12px] ${t.status === "failed" ? "text-danger" : "text-muted"}`}>
                      {t.scoreReason}
                      {t.status === "failed" && (
                        <>
                          {" "}
                          <Link href="/log?e=1&a=copywriter" className="text-muted underline">detail di Log</Link>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {(t.status === "rejected" || t.status === "failed") && (
                    <ActButton run={requeueTopic.bind(null, t.id, "passed")} className="btn !px-2 !py-1 text-[11px]" title="Paksa tulis jadi draft">
                      <PenLine size={12} /> Tulis
                    </ActButton>
                  )}
                  {t.status === "failed" && (
                    <ActButton run={requeueTopic.bind(null, t.id, "new")} className="btn !px-2 !py-1 text-[11px]" title="Nilai ulang">
                      <RotateCcw size={12} />
                    </ActButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-10 text-center text-sm text-muted">Belum ada topik di sini.</div>
      )}
    </>
  );
}
