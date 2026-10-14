import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { getPostCounts, getPosts, reviewTabs } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import type { PostStatus } from "@/lib/types";
import { ReviewGrid } from "./review-grid";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const current = (reviewTabs.find((t) => t.key === tab)?.key ?? "review") as PostStatus;
  const [counts, posts] = await Promise.all([getPostCounts(), getPosts(current)]);
  const ago = Object.fromEntries(posts.map((p) => [p.id, timeAgo(p.postedAt ?? p.createdAt)]));

  return (
    <>
      <PageHead eyebrow="Meja editor" title="Antrian Review">
        Cek fakta, edit kalau perlu, lalu setujui dan jadwalkan. Tidak ada yang terposting tanpa persetujuan tim.
      </PageHead>
      <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0">
        {reviewTabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "review" ? "/review" : `/review?tab=${t.key}`}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] ${
              t.key === current ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label} <span className="ml-1 text-[11px] text-dim">{counts[t.key] ?? 0}</span>
          </Link>
        ))}
      </nav>
      <ReviewGrid key={current} posts={posts} ago={ago} />
    </>
  );
}
