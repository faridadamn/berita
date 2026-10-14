import { RefreshCw } from "lucide-react";
import { AgentIcon, agentStyle } from "@/components/agent-badge";
import { PageHead, StatCard } from "@/components/page-head";
import { runScoutNow } from "@/app/actions/studio";
import { requireSession } from "@/lib/auth";
import { aiWorkHours, scoreThreshold } from "@/lib/config";
import { getActivity, getAgents, getOverview } from "@/lib/data";
import { greeting, timeAgo } from "@/lib/format";

export default async function Overview() {
  const session = await requireSession();
  const [o, agents, activity] = await Promise.all([getOverview(), getAgents(), getActivity(10)]);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <>
      <PageHead
        eyebrow={`${greeting()}, ${session.name}`}
        title="Ruang Redaksi"
        actions={
          <form action={runScoutNow}>
            <button className="btn">
              <RefreshCw size={13} /> Cari topik sekarang
            </button>
          </form>
        }
      >
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-line px-2 py-0.5">Mode: Semi-otomatis</span>
          <span className="rounded-full border border-ok/40 px-2 py-0.5 text-ok">
            AI aktif · jam kerja {pad(aiWorkHours.start)}.00–{pad(aiWorkHours.end)}.00 WIB
          </span>
        </div>
      </PageHead>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Topik masuk 24 jam" value={o.topicsIn24h} sub={`${o.topicsUnscored} menunggu dinilai`} />
        <StatCard label="Lolos analis 24 jam" value={o.passed24h} sub={`${o.passedQueuedForWriting} antre ditulis`} />
        <StatCard label="Siap direview" value={o.reviewCount} sub="Butuh approval tim" highlight />
        <StatCard label="Terjadwal" value={o.scheduledCount} sub={`${o.postedThisWeek} sudah posting minggu ini`} />
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {agents.map((a) => (
          <div key={a.key} className="card p-4">
            <div className="flex items-center gap-3">
              <AgentIcon agent={a.key} />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {a.name}
                  <span className={`size-1.5 rounded-full ${a.status === "running" ? "bg-ok" : "bg-dim"}`} />
                </p>
                <p className="text-[11px] text-muted">{a.role}</p>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-muted">
              <span className="capitalize">{a.status}</span> · aktif {timeAgo(a.lastActiveAt)}
            </p>
          </div>
        ))}
      </section>

      <section className="card mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="size-1.5 rounded-full bg-ok" /> Aktivitas Redaksi
          </p>
          <span className="text-[11px] text-dim">ambang skor {scoreThreshold}</span>
        </div>
        <ul>
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-4 border-b border-line/60 px-4 py-2.5 text-[13px] last:border-0">
              <span className={`w-24 shrink-0 font-medium ${agentStyle[a.agent].text}`}>• {agentStyle[a.agent].label}</span>
              <span className="flex-1">{a.message}</span>
              <span className="shrink-0 text-[11px] text-dim">{timeAgo(a.at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
