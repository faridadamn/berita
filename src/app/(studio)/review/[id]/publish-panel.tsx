"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarClock, CheckCircle2, ExternalLink, Loader2, RotateCcw, Send, XCircle, X as XIcon, Clock } from "lucide-react";
import { ActButton, ActionForm } from "@/components/forms";
import { removePublication, retryPublication, schedulePublish, unschedule } from "@/app/actions/publish";
import type { ChannelView, Platform, Post, Publication } from "@/lib/types";

const label: Record<Platform, string> = { instagram: "Instagram", threads: "Threads", x: "X", linkedin: "LinkedIn" };

function StatusIcon({ s }: { s: Publication["status"] }) {
  if (s === "published") return <CheckCircle2 size={14} className="text-ok" />;
  if (s === "failed") return <XCircle size={14} className="text-danger" />;
  if (s === "publishing") return <Loader2 size={14} className="animate-spin text-accent" />;
  return <Clock size={14} className="text-muted" />;
}
const statusText = { pending: "Menunggu jadwal", publishing: "Sedang diposting…", published: "Terposting", failed: "Gagal" };

export function PublishPanel({
  post, channels, pubs, defaultWhen, isAdmin,
}: {
  post: Post;
  channels: ChannelView[];
  pubs: Publication[];
  defaultWhen: string;
  isAdmin: boolean;
}) {
  const done = new Set(pubs.filter((p) => p.status === "published" || p.status === "publishing").map((p) => p.platform));
  const chosen = new Set(pubs.filter((p) => p.status === "pending" || p.status === "failed").map((p) => p.platform));
  const firstTime = !pubs.length;
  const [sel, setSel] = useState<Set<Platform>>(
    new Set(channels.filter((c) => c.enabled && !done.has(c.platform) && (firstTime || chosen.has(c.platform))).map((c) => c.platform)),
  );
  const open = channels.filter((c) => !done.has(c.platform));
  const canPublish = post.status !== "rejected";

  return (
    <div className="space-y-4">
      {pubs.length > 0 && (
        <ul className="space-y-1.5">
          {pubs.map((p) => (
            <li key={p.id} className="rounded-lg border border-line px-3 py-2 text-[12px]">
              <div className="flex flex-wrap items-center gap-2">
                <StatusIcon s={p.status} />
                <b className="font-semibold">{label[p.platform]}</b>
                <span className="text-muted">
                  {statusText[p.status]}
                  {p.manual && " (manual)"}
                </span>
                {p.permalink && (
                  <a href={p.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-fg underline">
                    Lihat <ExternalLink size={10} />
                  </a>
                )}
                {Object.keys(p.metrics).length > 0 && (
                  <span className="text-dim">
                    {Object.entries(p.metrics).filter(([k]) => ["views", "reach", "likes", "replies", "reposts", "shares", "saved"].includes(k)).map(([k, v]) => `${k} ${v}`).join(" · ")}
                  </span>
                )}
                <span className="ml-auto flex gap-1">
                  {p.status === "failed" && !p.manual && (
                    <ActButton run={() => retryPublication(p.id)} className="btn !px-2 !py-0.5 text-[11px]" confirm={p.attempts > 0 && p.error?.includes("berhenti") ? "Pastikan belum terposting di platform. Lanjut?" : undefined}>
                      <RotateCcw size={11} /> Coba lagi
                    </ActButton>
                  )}
                  {p.status !== "publishing" && (
                    <ActButton run={() => removePublication(p.id)} className="p-1 text-dim hover:text-danger" title="Hapus dari daftar" confirm={p.status === "published" ? "Hapus catatan ini? Post di platform tidak ikut terhapus." : undefined}>
                      <XIcon size={12} />
                    </ActButton>
                  )}
                </span>
              </div>
              {p.error && <p className="mt-1 break-words text-danger">{p.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {canPublish && open.length > 0 && (
        <ActionForm action={schedulePublish.bind(null, post.id)} className="space-y-3">
          <div>
            <p className="eyebrow mb-1.5 !text-[9px]">Posting otomatis ke</p>
            <div className="flex flex-wrap gap-2">
              {open.map((c) => (
                <label
                  key={c.platform}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] ${
                    !c.enabled ? "border-line text-dim" : sel.has(c.platform) ? "border-accent/60 text-fg" : "border-line text-muted"
                  }`}
                  title={c.enabled ? `@${c.accountName ?? ""}` : "Kanal belum aktif"}
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={c.platform}
                    disabled={!c.enabled}
                    checked={sel.has(c.platform)}
                    onChange={(e) => {
                      const n = new Set(sel);
                      if (e.target.checked) n.add(c.platform);
                      else n.delete(c.platform);
                      setSel(n);
                    }}
                    className="accent-[var(--color-accent)]"
                  />
                  {c.label}
                  {c.enabled && c.accountName && <span className="text-dim">@{c.accountName}</span>}
                  {!c.enabled && <span className="text-[10px]">nonaktif</span>}
                </label>
              ))}
            </div>
            {channels.every((c) => !c.enabled) && (
              <p className="mt-1.5 text-[11px] text-dim">
                Belum ada kanal aktif{isAdmin ? <> — sambungkan di <Link href="/admin/kanal" className="underline">Admin → Kanal</Link></> : ""}. Kamu tetap bisa posting manual lewat panel salin.
              </p>
            )}
          </div>
          <div>
            <p className="eyebrow mb-1.5 !text-[9px]">Jadwal posting (WIB)</p>
            <div className="flex flex-wrap gap-2">
              <input type="datetime-local" name="scheduledAt" defaultValue={defaultWhen} className="input !w-auto flex-1" />
              <button name="intent" value="schedule" className="btn">
                <CalendarClock size={13} /> Jadwalkan
              </button>
              <button
                name="intent"
                value="now"
                className="btn btn-primary"
                disabled={!sel.size}
                onClick={(e) => {
                  if (!window.confirm(`Posting sekarang ke ${[...sel].map((p) => label[p]).join(", ")}?`)) e.preventDefault();
                }}
              >
                <Send size={13} /> Posting sekarang
              </button>
            </div>
          </div>
        </ActionForm>
      )}

      {post.status === "scheduled" && (
        <ActButton run={() => unschedule(post.id)} className="text-[12px] text-muted underline hover:text-fg">
          Batalkan jadwal
        </ActButton>
      )}
    </div>
  );
}
