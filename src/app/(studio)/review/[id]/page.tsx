import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Link2, Trash2, Wand2, XCircle } from "lucide-react";
import { getPost, getPublications } from "@/lib/data";
import { requireSession } from "@/lib/auth";
import { appUrl, getChannelViews } from "@/lib/channels";
import { loadPostForRender, mainImageOf, renderHashOf } from "@/lib/render";
import { formatWIB, toLocalInput } from "@/lib/format";
import { removePost, setPostStatus } from "@/app/actions/studio";
import { PostEditor } from "./post-editor";
import { RewritePanel } from "./rewrite-panel";
import { ActButton } from "@/components/forms";
import { SlideViewer } from "./slide-viewer";
import { PublishPanel } from "./publish-panel";
import { CopyPanel } from "./copy-panel";
import { getProducts } from "@/lib/products";
import { gerakStatus, getVideo, videoSourceHash } from "@/lib/video";
import { VideoPanel } from "./video-panel";

const statusLabel: Record<string, string> = {
  review: "Perlu review", approved: "Disetujui", scheduled: "Terjadwal", posting: "Sedang posting",
  posted: "Terposting", failed: "Gagal posting", rejected: "Ditolak",
};

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const post = await getPost(Number(id));
  if (!post) notFound();
  const [pubs, channels, raw, products, video] = await Promise.all([getPublications(post.id), getChannelViews(), loadPostForRender(post.id), getProducts(), getVideo(post.id)]);
  const gerak = gerakStatus();
  // katalog untuk editor slide produk: produk aktif + produk yang sudah dipakai post ini
  const catalog = products
    .filter((p) => p.active || post.productIds.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, price: p.price, currency: p.currency, image: p.images[0] ?? null, active: p.active }));
  const stale = post.renderCount > 0 && !!raw && raw.renderHash !== renderHashOf(raw);
  const base = appUrl();
  const link = `${base ?? ""}/s/${post.shortCode}`;
  // default jadwal: jadwal yang ada, atau 1 jam lagi dibulatkan
  const next = new Date(Math.ceil((Date.now() + 3600_000) / 900_000) * 900_000).toISOString();

  const approve = setPostStatus.bind(null, post.id, "approved");
  const reject = setPostStatus.bind(null, post.id, "rejected");
  const del = removePost.bind(null, post.id);

  return (
    <>
      <Link href="/review" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Antrian review
      </Link>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <div className="card p-4">
            <SlideViewer post={post} stale={stale} />
          </div>
          <VideoPanel
            postId={post.id}
            gerak={{ ok: gerak.ok, reason: gerak.reason }}
            products={products.filter((p) => post.productIds.includes(p.id)).map((p) => ({ id: p.id, name: p.name }))}
            publicUrl={base && video?.hasData ? `${base}/m/${post.shortCode}/video.mp4` : null}
            video={
              video
                ? {
                    status: video.status,
                    progress: video.progress,
                    script: video.script,
                    options: video.options,
                    hasData: video.hasData,
                    seconds: video.seconds,
                    sizeBytes: video.sizeBytes,
                    error: video.error,
                    renderedAt: video.renderedAt?.toISOString() ?? null,
                    stale: !!raw && !!video.sourceHash && video.sourceHash !== videoSourceHash(raw, video.script, video.options),
                  }
                : null
            }
          />
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

          <RewritePanel postId={post.id} current={post.contentType} sales={post.productIds.length > 0} />
          <PostEditor key={post.renderHash ?? "0"} post={post} mainImage={raw ? mainImageOf(raw) : null} catalog={catalog} />
        </div>
      </div>
    </>
  );
}
