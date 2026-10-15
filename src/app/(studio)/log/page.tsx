import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { getErrorCount, getLogs } from "@/lib/data";
import { formatWIB, timeAgo, usd } from "@/lib/format";

const agents = [
  { key: "", label: "Semua agen" },
  { key: "scout", label: "Scout" },
  { key: "analis", label: "Analis" },
  { key: "copywriter", label: "Copywriter" },
  { key: "designer", label: "Designer" },
  { key: "publisher", label: "Publisher" },
  { key: "system", label: "Sistem" },
];
const agentColor: Record<string, string> = {
  scout: "text-scout", analis: "text-analis", copywriter: "text-copy", designer: "text-design", publisher: "text-ok", system: "text-danger",
};

/** Saran perbaikan dari pola pesan error yang umum. */
function hint(text: string) {
  const t = text.toLowerCase();
  if (/headline kosong|caption kosong|bukan objek|tidak ada array/.test(t))
    return "Model menjawab tapi isinya bukan draft (sering karena menolak / ngobrol). Cek 'Jawaban mentah AI' di bawah; coba model lain atau tulis ulang lewat tombol Tulis di Radar.";
  if (/json|terpotong|expected ',' or '\}'|unexpected token/.test(t))
    return "Model mengirim JSON rusak/terpotong. Sistem sudah memperbaiki & mengulang otomatis; kalau masih sering, pakai model yang lebih kuat atau naikkan urutan provider lain di Pengaturan.";
  if (/429|rate|quota|exhausted|limit/.test(t)) return "Kena limit/kuota provider. Tambah provider cadangan di Pengaturan (fallback otomatis) atau kurangi topik per putaran.";
  if (/401|403|invalid.*(key|token)|unauthori[sz]ed|permission/.test(t)) return "Kunci/token tidak valid atau kurang izin. Cek & tes ulang di Pengaturan (AI) atau Kanal (posting).";
  if (/timeout|timed out|koneksi gagal|fetch failed|enotfound|econn/.test(t)) return "Gagal terhubung / terlalu lama. Biasanya sementara; kalau terus, cek URL atau naikkan AI_TIMEOUT_MS.";
  if (/app_url/.test(t)) return "Isi APP_URL dengan domain https publik.";
  if (/media|image|fetch/.test(t) && /instagram|threads/.test(t)) return "Platform gagal mengambil gambar. Pastikan /m/… bisa dibuka publik dari luar (tanpa login/proxy yang memblokir).";
  return null;
}

export default async function LogPage({ searchParams }: { searchParams: Promise<{ e?: string; a?: string; before?: string }> }) {
  const sp = await searchParams;
  const errorsOnly = sp.e === "1";
  const agent = agents.some((x) => x.key === sp.a) ? sp.a : "";
  const before = Number(sp.before) || undefined;
  const [rows, errors24] = await Promise.all([getLogs({ errorsOnly, agent, before, limit: 50 }), getErrorCount(24)]);
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { e: errorsOnly ? "1" : undefined, a: agent || undefined, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/log?${s}` : "/log";
  };

  return (
    <>
      <PageHead eyebrow="Diagnostik" title="Log">
        Semua aktivitas agen, posting, dan error sistem. Klik baris untuk melihat detail (jawaban mentah AI, provider, topik terkait).
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={qs({ e: undefined, before: undefined })} className={`btn !py-1.5 text-[12px] ${!errorsOnly ? "!border-accent/60" : ""}`}>Semua</Link>
        <Link href={qs({ e: "1", before: undefined })} className={`btn !py-1.5 text-[12px] ${errorsOnly ? "!border-danger/60 text-danger" : ""}`}>
          <AlertTriangle size={12} /> Error saja {errors24 > 0 && <span className="rounded-full bg-danger px-1.5 text-[10px] text-white">{errors24} / 24j</span>}
        </Link>
        <span className="mx-1 h-5 w-px bg-line" />
        {agents.map((a) => (
          <Link
            key={a.key}
            href={qs({ a: a.key || undefined, before: undefined })}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${agent === a.key ? "border-fg text-fg" : "border-line text-muted hover:text-fg"}`}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {rows.length ? (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {rows.map((r) => {
            const d = r.detail;
            const tip = !r.ok ? hint(`${r.message} ${d?.error ?? ""} ${d?.items?.map((i) => i.error).join(" ") ?? ""}`) : null;
            const hasDetail = !!(d || r.provider || r.tokensIn);
            return (
              <details key={r.id} className="group">
                <summary className={`flex cursor-pointer list-none items-start gap-3 px-4 py-2.5 text-[13px] ${hasDetail ? "" : "cursor-default"} ${r.ok ? "" : "bg-danger/5"}`}>
                  {r.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-dim" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />}
                  <span className={`w-20 shrink-0 font-medium capitalize ${agentColor[r.agent] ?? "text-muted"}`}>{r.agent === "system" ? "Sistem" : r.agent}</span>
                  <span className={`min-w-0 flex-1 break-words ${r.ok ? "" : "text-danger"}`}>{r.message}</span>
                  <span className="shrink-0 text-right text-[11px] text-dim" title={formatWIB(r.at, { year: "numeric" })}>{timeAgo(r.at)}</span>
                  {hasDetail && <ChevronDown size={14} className="mt-0.5 shrink-0 text-dim transition-transform group-open:rotate-180" />}
                </summary>
                {hasDetail && (
                  <div className="space-y-3 border-t border-line/60 bg-panel-2/60 px-4 py-3 text-[12px]">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted">
                      <span>{formatWIB(r.at, { year: "numeric", second: "2-digit" })} WIB</span>
                      {r.provider && <span>Provider: <b className="text-fg">{r.provider}</b>{r.model && ` · ${r.model}`}</span>}
                      {(r.tokensIn > 0 || r.tokensOut > 0) && <span>Token: {r.tokensIn.toLocaleString("id-ID")} masuk · {r.tokensOut.toLocaleString("id-ID")} keluar</span>}
                      {r.costUsd > 0 && <span>Biaya: {usd(r.costUsd)}</span>}
                      {d?.attempts ? <span>Panggilan AI: {d.attempts}</span> : null}
                    </div>
                    {tip && <p className="rounded-lg border border-copy/30 bg-copy/5 px-3 py-2 text-fg">💡 {tip}</p>}
                    {d?.error && <Block title="Error" body={d.error} danger />}
                    {d?.items?.map((it, i) => (
                      <div key={i} className="space-y-1.5 rounded-lg border border-line p-2.5">
                        <p className="font-medium">{it.label}</p>
                        <p className="text-danger">{it.error}</p>
                        {it.raw && <Block title="Jawaban mentah AI" body={it.raw} />}
                      </div>
                    ))}
                    {d?.raw && <Block title="Jawaban mentah AI" body={d.raw} />}
                    {d?.topicIds?.length ? (
                      <p className="text-muted">Topik: {d.topicIds.map((t) => `#${t}`).join(", ")} — <Link href="/radar?s=failed" className="underline">lihat di Radar</Link></p>
                    ) : null}
                    {d?.postIds?.length ? (
                      <p className="text-muted">Post: {d.postIds.map((p) => <Link key={p} href={`/review/${p}`} className="mr-2 underline">#{p}</Link>)}</p>
                    ) : null}
                    {d?.stack && <Block title="Stack trace" body={d.stack} />}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      ) : (
        <div className="card p-10 text-center text-sm text-muted">{errorsOnly ? "Tidak ada error. 🎉" : "Belum ada log."}</div>
      )}

      {rows.length === 50 && (
        <div className="mt-4 text-center">
          <Link href={qs({ before: String(rows[rows.length - 1].id) })} className="btn">Lebih lama →</Link>
        </div>
      )}
    </>
  );
}

function Block({ title, body, danger }: { title: string; body: string; danger?: boolean }) {
  return (
    <div>
      <p className="eyebrow mb-1 !text-[9px]">{title}</p>
      <pre className={`max-h-72 overflow-auto rounded-lg border border-line bg-bg p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words ${danger ? "text-danger" : "text-fg"}`}>{body}</pre>
    </div>
  );
}
