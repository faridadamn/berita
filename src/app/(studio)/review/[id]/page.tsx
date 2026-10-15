import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, Link2, Trash2, XCircle, Check, Wand2 } from "lucide-react";
import { getPost } from "@/lib/data";
import { formatWIB, toLocalInput } from "@/lib/format";
import { removePost, savePostText, schedulePost, setPostStatus, applyAlternative } from "@/app/actions/studio";
import { ActButton } from "@/components/forms";
import { SlideViewer } from "./slide-viewer";

const statusLabel: Record<string, string> = {
  review: "Perlu review", approved: "Disetujui", scheduled: "Terjadwal", posting: "Sedang posting",
  posted: "Posted", failed: "Gagal posting", rejected: "Ditolak",
};

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(Number(id));
  if (!post) notFound();
  const host = (await headers()).get("host") ?? "localhost:3000";

  const approve = setPostStatus.bind(null, post.id, "approved");
  const reject = setPostStatus.bind(null, post.id, "rejected");
  const schedule = schedulePost.bind(null, post.id);
  const save = savePostText.bind(null, post.id);
  const del = removePost.bind(null, post.id);

  return (
    <>
      <Link href="/review" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Antrian review
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="card p-4">
          <SlideViewer post={post} />
        </div>

        <div className="space-y-4">
          <section className="card space-y-4 p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Status: {statusLabel[post.status]}</p>
              <span className="text-[11px] text-dim">skor {post.score}</span>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              <Link2 size={12} /> Link sumber
              <a href={`/s/${post.shortCode}`} className="font-mono text-fg underline" target="_blank">
                {host}/s/{post.shortCode}
              </a>
              · {post.clicks} klik ·
              <a href={post.sourceUrl} target="_blank" className="hover:text-fg">
                {post.sourceName} <ExternalLink size={10} className="inline" />
              </a>
            </p>

            {post.status === "posted" && (
              <p className="flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/5 px-3 py-2 text-[12px] text-ok">
                <CheckCircle2 size={14} /> Sudah terposting {formatWIB(post.postedAt)}
                {post.igPermalink && (
                  <a href={post.igPermalink} target="_blank" className="underline">
                    Lihat di Instagram
                  </a>
                )}
              </p>
            )}
            {post.status === "scheduled" && (
              <p className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-[12px] text-accent">
                <CalendarClock size={14} /> Terjadwal {formatWIB(post.scheduledAt)} WIB
              </p>
            )}

            <form action={schedule} className="space-y-1.5">
              <p className="eyebrow !text-[9px]">Jadwal posting (WIB)</p>
              <div className="flex gap-2">
                <input type="datetime-local" name="scheduledAt" defaultValue={toLocalInput(post.scheduledAt)} className="input" required />
                <button className="btn">
                  <CalendarClock size={13} /> Jadwalkan
                </button>
              </div>
            </form>

            <div className="flex flex-wrap gap-2">
              {post.status === "review" && (
                <form action={approve}>
                  <button className="btn btn-primary"><Check size={13} /> Setujui</button>
                </form>
              )}
              {post.status !== "rejected" && post.status !== "posted" && (
                <form action={reject}>
                  <button className="btn btn-danger"><XCircle size={13} /> Tolak</button>
                </form>
              )}
              <form action={del}>
                <button className="btn btn-danger"><Trash2 size={13} /> Hapus</button>
              </form>
            </div>
          </section>

          <form key={post.headline} action={save} className="card space-y-4 p-4">
            <p className="text-sm font-semibold">Slide 1 · Cover</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="eyebrow !text-[9px]">Kicker</span>
                <input name="kicker" defaultValue={post.kicker} className="input" />
              </label>
              <label className="space-y-1.5">
                <span className="eyebrow !text-[9px]">Template</span>
                <select name="template" defaultValue={post.template} className="input">
                  <option value="stabilo">Stabilo</option>
                  <option value="putih">Putih editorial</option>
                  <option value="foto">Foto penuh</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="eyebrow !text-[9px]">Headline di gambar</span>
              <textarea name="headline" defaultValue={post.headline} rows={2} className="input" />
            </label>
            {post.headlineAlternatives.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-dim">Alternatif dari Copywriter (klik untuk pakai):</p>
                {post.headlineAlternatives.map((h) => (
                  <ActButton
                    key={h}
                    run={applyAlternative.bind(null, post.id, h)}
                    className="w-full rounded-md border border-line px-2.5 py-1.5 text-left text-[12px] text-muted hover:border-line-2 hover:text-fg"
                  >
                    {h}
                  </ActButton>
                ))}
              </div>
            )}
            <label className="block space-y-1.5">
              <span className="eyebrow !text-[9px]">Caption</span>
              <textarea name="caption" defaultValue={post.caption} rows={7} className="input" />
            </label>
            <label className="block space-y-1.5">
              <span className="eyebrow !text-[9px]">Hashtag</span>
              <input name="hashtags" defaultValue={post.hashtags.join(" ")} className="input" />
            </label>
            <p className="text-[11px] text-dim">
              Format carousel: slide isi tetap disimpan; pembaca diarahkan ke artikel asli lewat halaman <b>/baca</b>.
            </p>
            <div className="flex flex-wrap gap-2">
              <button name="intent" value="render" className="btn btn-primary"><Wand2 size={13} /> Simpan & render ulang</button>
              <button name="intent" value="text" className="btn">Simpan teks saja</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
