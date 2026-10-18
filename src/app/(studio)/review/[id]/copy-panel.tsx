"use client";
import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { ActionForm } from "@/components/forms";
import { markManual } from "@/app/actions/publish";
import { LIMITS, composeInstagram, composeLinkedIn, composeThreads, composeTikTok, composeWa, composeX, xLength } from "@/lib/publish/text";
import type { Platform, Post, Publication } from "@/lib/types";

type Tab = Platform | "tiktok" | "wa";
const tabs: { key: Tab; label: string; hint: string; extra?: boolean }[] = [
  { key: "instagram", label: "Instagram", hint: "Caption + hashtag. Upload semua slide sebagai carousel; link artikel lewat link di bio (/baca)." },
  { key: "threads", label: "Threads", hint: "Semua slide kecuali slide CTA. Link artikel sudah ada di teks." },
  { key: "linkedin", label: "LinkedIn", hint: "Unggah PDF sebagai dokumen (carousel bisa digeser) lewat 'Tambah dokumen'. Link artikel sudah ada di teks." },
  { key: "x", label: "X", hint: "Maks 4 gambar: cover + slide isi. Link artikel sudah ada di teks (dihitung 23 karakter)." },
  { key: "tiktok", label: "TikTok / Shopee Video", hint: "Caption untuk TikTok, Shopee Video, atau Reels — pasangkan dengan MP4 dari panel Video (atau slide sebagai photo mode). Tautkan produk lewat keranjang kuning / fitur tag produk di aplikasinya.", extra: true },
  { key: "wa", label: "WA / Telegram", hint: "Pesan broadcast / grup / channel. Link produk sudah di dalam teks dan kliknya tercatat sebagai kanal 'wa'.", extra: true },
];

/** Panel posting manual: teks final per platform + tombol salin + tandai sudah diposting. */
export function CopyPanel({ post, link, pubs }: { post: Post; link: string; pubs: Publication[] }) {
  const [tab, setTab] = useState<Tab>("instagram");
  const sales = post.productIds.length > 0;
  const shown = tabs.filter((t) => !t.extra || sales || (t.key === "tiktok" ? post.platformText.tiktok : post.platformText.wa));
  const [copied, setCopied] = useState(false);
  const src = { headline: post.headline, caption: post.caption, hashtags: post.hashtags, platformText: post.platformText };
  const text =
    tab === "instagram" ? composeInstagram(src)
    : tab === "threads" ? composeThreads(src, link)
    : tab === "linkedin" ? composeLinkedIn(src, link)
    : tab === "tiktok" ? composeTikTok(src)
    : tab === "wa" ? composeWa(src, link)
    : composeX(src, link);
  const len = tab === "x" ? xLength(text) : [...text].length;
  const limit = LIMITS[tab];
  const extra = tab === "tiktok" || tab === "wa";
  const done = extra || pubs.find((p) => p.platform === tab && p.status === "published");
  const imgCount = tab === "instagram" || tab === "linkedin" || extra ? post.renderCount : tab === "x" ? Math.min(4, post.slides.filter((s) => s.kind !== "cta").length) : post.slides.filter((s) => s.kind !== "cta").length;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {shown.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setCopied(false); }}
            className={`-mb-px shrink-0 border-b-2 px-3 py-1.5 text-[12px] ${tab === t.key ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {t.label}
            {pubs.some((p) => p.platform === t.key && p.status === "published") && <Check size={11} className="ml-1 inline text-ok" />}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-dim">{tabs.find((t) => t.key === tab)!.hint}</p>
      <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-panel-2 p-3 font-sans text-[12px] leading-relaxed whitespace-pre-wrap">{text}</pre>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-primary"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Tersalin" : `Salin teks ${tabs.find((t) => t.key === tab)!.label}`}
        </button>
        {post.renderCount > 0 && tab === "linkedin" ? (
          <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/review/${post.id}/pdf`} className="btn" download>
            <Download size={13} /> PDF carousel
          </a>
        ) : post.renderCount > 0 ? (
          <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/review/${post.id}/download`} className="btn" download>
            <Download size={13} /> Gambar (pakai {imgCount})
          </a>
        ) : null}
        <span className={`ml-auto text-[11px] ${len > limit ? "text-danger" : "text-dim"}`}>
          {len}/{limit}
        </span>
      </div>
      {!done && (
        <ActionForm key={tab} action={markManual.bind(null, post.id, tab as Platform)} className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
          <input name="permalink" placeholder={`Link post ${tabs.find((t) => t.key === tab)!.label} (opsional)`} className="input !w-auto min-w-0 flex-1 !py-1.5 text-[12px]" />
          <button className="btn !py-1.5 text-[12px]">Tandai sudah diposting manual</button>
        </ActionForm>
      )}
    </div>
  );
}
