import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AgentIcon, agentStyle } from "@/components/agent-badge";
import { PageHead, StatCard } from "@/components/page-head";
import { RunNowButton } from "@/components/run-now";
import { requireSession } from "@/lib/auth";
import { loadChain } from "@/lib/ai";
import { getActivity, getAgents, getOverview, getSources } from "@/lib/data";
import { greeting, timeAgo } from "@/lib/format";
import { inWorkHours } from "@/lib/settings";

const modeLabel = { semi: "Semi-otomatis", manual: "Manual", off: "Mati" };
const statusLabel = { standby: "Standby", running: "Bekerja", off: "Nonaktif" };

export default async function Overview() {
  const session = await requireSession();
  const [o, agents, activity, chain, sources] = await Promise.all([
    getOverview(),
    getAgents(),
    getActivity(12),
    loadChain(),
    getSources(),
  ]);
  const s = o.settings;
  const pad = (n: number) => String(n).padStart(2, "0");
  const working = s.mode === "semi" && inWorkHours(s);
  const isAdmin = session.role === "admin";

  const warnings = [
    !chain.length && { text: "Belum ada provider AI aktif — Analis & Copywriter tidak bisa jalan.", href: "/admin/pengaturan", cta: "Tambah provider" },
    !sources.some((x) => x.active) && { text: "Belum ada sumber topik aktif.", href: "/admin/sumber", cta: "Tambah sumber" },
  ].filter(Boolean) as { text: string; href: string; cta: string }[];

  return (
    <>
      <PageHead eyebrow={`${greeting()}, ${session.name}`} title="Ruang Redaksi" actions={<RunNowButton />}>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-line px-2 py-0.5">Mode: {modeLabel[s.mode]}</span>
          <span className={`rounded-full border px-2 py-0.5 ${working ? "border-ok/40 text-ok" : "border-line text-muted"}`}>
            {working ? "AI aktif" : "AI istirahat"} · jam kerja {pad(s.workStart)}.00–{pad(s.workEnd)}.00 WIB
          </span>
        </div>
      </PageHead>

      {warnings.map((w) => (
        <div key={w.href} className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-copy/30 bg-copy/5 px-4 py-3 text-[13px]">
          <AlertTriangle size={15} className="text-copy" />
          <span className="flex-1">{w.text}</span>
          {isAdmin && <Link href={w.href} className="btn">{w.cta}</Link>}
        </div>
      ))}

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
                  <span className={`size-1.5 rounded-full ${a.status === "running" ? "animate-pulse bg-ok" : a.status === "standby" ? "bg-accent" : "bg-dim"}`} />
                </p>
                <p className="text-[11px] text-muted">{a.role}</p>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-muted">
              {statusLabel[a.status]} · {a.lastActiveAt ? `aktif ${timeAgo(a.lastActiveAt)}` : "belum pernah jalan"}
            </p>
          </div>
        ))}
      </section>

      <section className="card mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="size-1.5 rounded-full bg-ok" /> Aktivitas Redaksi
          </p>
          <Link href="/log" className="text-[11px] text-muted underline hover:text-fg">Lihat semua log →</Link>
        </div>
        {activity.length ? (
          <ul>
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-4 border-b border-line/60 px-4 py-2.5 text-[13px] last:border-0">
                <span className={`w-24 shrink-0 font-medium ${a.agent in agentStyle ? agentStyle[a.agent as keyof typeof agentStyle].text : "text-ok"}`}>
                  • {a.agent in agentStyle ? agentStyle[a.agent as keyof typeof agentStyle].label : a.agent === "publisher" ? "Publisher" : a.agent}
                </span>
                <span className={`min-w-0 flex-1 break-words ${a.ok ? "" : "text-danger"}`}>{a.message}</span>
                <span className="shrink-0 text-[11px] text-dim">{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-[13px] text-muted">
            Belum ada aktivitas. Tekan <b>Cari topik sekarang</b> untuk putaran pertama.
          </p>
        )}
      </section>
    </>
  );
}
