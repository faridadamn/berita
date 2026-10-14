import { PageHead } from "@/components/page-head";
import { getTopics } from "@/lib/data";
import { scoreThreshold } from "@/lib/config";
import { timeAgo } from "@/lib/format";

const statusText = { new: "Menunggu dinilai", scored: "Dinilai", passed: "Lolos · antre ditulis", rejected: "Tidak lolos", drafted: "Sudah jadi draft" };

export default async function RadarPage() {
  const topics = await getTopics();
  return (
    <>
      <PageHead eyebrow="Hasil Scout" title="Radar Topik">
        Semua topik yang ditemukan dari sumber. Topik dengan skor ≥ {scoreThreshold} lanjut ke Copywriter.
      </PageHead>
      <div className="card divide-y divide-line/60">
        {topics.map((t) => {
          const pass = (t.score ?? 0) >= scoreThreshold;
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
                <a href={t.url} target="_blank" className="text-[13px] font-medium hover:underline">{t.title}</a>
                <p className="mt-0.5 text-[11px] text-dim">
                  {t.sourceName} · {t.category} · {timeAgo(t.fetchedAt)}
                </p>
                {t.scoreReason && <p className="mt-1 text-[12px] text-muted">{t.scoreReason}</p>}
              </div>
              <span className="hidden shrink-0 text-[11px] text-muted sm:block">{statusText[t.status]}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
