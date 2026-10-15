import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Link2, Trash2, Wand2, XCircle } from "lucide-react";
import { getPost, getPublications } from "@/lib/data";
import { requireSession } from "@/lib/auth";
import { appUrl, getChannelViews } from "@/lib/channels";
import { loadPostForRender, renderHashOf } from "@/lib/render";
import { formatWIB, toLocalInput } from "@/lib/format";
import { applyAlternative, removePost, savePostText, setPostStatus } from "@/app/actions/studio";
import { ActButton } from "@/components/forms";
import { SlideViewer } from "./slide-viewer";
import { PublishPanel } from "./publish-panel";
import { CopyPanel } from "./copy-panel";

const statusLabel: Record<string, string> = {
  review: "Perlu review", approved: "Disetujui", scheduled: "Terjadwal", posting: "Sedang posting",
  posted: "Terposting", failed: "Gagal posting", rejected: "Ditolak",
};

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const post = await getPost(Number(id));
  if (!post) notFound();
  const [pubs, channels, raw] = await Promise.all([getPublications(post.id), getChannelViews(), loadPostForRender(post.id)]);
  const stale = post.renderCount > 0 && !!raw && raw.renderHash !== renderHashOf(raw);
  const base = appUrl();
  const link = `${base ?? ""}/s/${post.shortCode}`;
  // default jadwal: jadwal yang ada, atau 1 jam lagi dibulatkan
  const next = new Date(Math.ceil((Date.now() + 3600_000) / 900_000) * 900_000).toISOString();

  const approve = setPostStatus.bind(null, post.id, "approved");
  const reject = setPostStatus.bind(null, post.id, "rejected");
  const save = savePostText.bind(null, post.id);
  const del = removePost.bind(null, post.id);

  return (
    <>
      <Link href="/review" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Antrian review
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <div className="card p-4">
            <SlideViewer post={post} stale={stale} />
          </div>
          <section className="card p-4">
            <p className="mb-3 text-sm font-semibold">Salin untuk posting manual</p>
            <CopyPanel post={post} link={link} pubs={pubs} />
          </section>
        </div>

        <div className="space-y-4">
          <section className="card space-y-4 p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Status: {statusLabel[post.status]}</p>
              <span className="text-[11px] text-dim">skor {post.score}</span>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              <Link2 size={12} /> Shortlink
              <a href={link} className="font-mono text-fg underline" target="_blank" rel="noreferrer">
                {link.replace(/^https?:\/\//, "")}
              </a>
              · {post.clicks} klik ·
              <a href={post.sourceUrl} target="_blank" rel="noreferrer" className="hover:text-fg">
                {post.sourceName} <ExternalLink size={10} className="inline" />
              </a>
            </p>
            {post.scheduledAt && (post.status === "scheduled" || post.status === "posting") && (
              <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-[12px] text-accent">
                Terjadwal {formatWIB(post.scheduledAt)} WIB
              </p>
            )}
            {post.postedAt && <p className="text-[12px] text-ok">Terposting {formatWIB(post.postedAt)} WIB</p>}
            {!base && (
              <p className="text-[11px] text-copy">APP_URL belum diisi — Instagram & Threads butuh URL publik untuk mengambil gambar.</p>
            )}

            <PublishPanel
              post={post}
              channels={channels}
              pubs={pubs}
              defaultWhen={toLocalInput(post.scheduledAt ?? next)}
              isAdmin={session.role === "admin"}
            />

            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {post.status === "review" && (
                <form action={approve}>
                  <button className="btn"><Check size={13} /> Setujui tanpa jadwal</button>
                </form>
              )}
              {!["rejected", "posted", "posting"].includes(post.status) && (
                <form action={reject}>
                  <button className="btn btn-danger"><XCircle size={13} /> Tolak</button>
                </form>
              )}
              <ActButton run={del} confirm="Hapus post ini? Post yang sudah terposting di platform tidak ikut terhapus." className="btn btn-danger">
                <Trash2 size={13} /> Hapus
              </ActButton>
            </div>
          </section>

          <form key={`${post.headline}|${post.renderHash}`} action={save} className="card space-y-4 p-4">
            <p className="text-sm font-semibold">Edit konten</p>
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

            {post.slides.map((s, i) => (
              <fieldset key={i} className="space-y-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-[11px] text-muted">
                  Slide {i + 1} · {s.kind === "cover" ? "Cover" : s.kind === "cta" ? "Penutup (CTA)" : "Isi"}
                </legend>
                <textarea name={`slide-${i}-headline`} defaultValue={s.headline} rows={s.kind === "cover" ? 2 : 1} className="input" aria-label="Judul slide" />
                <textarea name={`slide-${i}-body`} defaultValue={s.body ?? ""} rows={2} className="input text-[13px]" aria-label="Teks slide" placeholder="Teks kecil (opsional)" />
                {i === 0 && post.headlineAlternatives.length > 0 && (
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
              </fieldset>
            ))}

            <label className="block space-y-1.5">
              <span className="eyebrow !text-[9px]">Caption Instagram</span>
              <textarea name="caption" defaultValue={post.caption} rows={7} className="input" />
            </label>
            <label className="block space-y-1.5">
              <span className="eyebrow !text-[9px]">Hashtag</span>
              <input name="hashtags" defaultValue={post.hashtags.join(" ")} className="input" />
            </label>
            <label className="block space-y-1.5">
              <span className="eyebrow !text-[9px]">Teks Threads</span>
              <textarea name="threads" defaultValue={post.platformText.threads ?? ""} rows={4} className="input" placeholder="Kosong = headline + paragraf pertama caption" />
            </label>
            <label className="block space-y-1.5">
              <span className="eyebrow !text-[9px]">Teks X</span>
              <textarea name="x" defaultValue={post.platformText.x ?? ""} rows={2} className="input" placeholder="Kosong = headline" />
            </label>
            <p className="text-[11px] text-dim">Shortlink artikel ditambahkan otomatis di akhir teks Threads & X.</p>
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
