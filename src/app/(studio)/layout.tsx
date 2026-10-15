import { Sparkles } from "lucide-react";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { getBrand } from "@/lib/brand-kit";
import { getAiCost, getErrorCount, getPostCounts } from "@/lib/data";
import { usd } from "@/lib/format";
import { getThemePref } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [counts, cost, errorCount, theme, brand] = await Promise.all([getPostCounts(), getAiCost(), getErrorCount(24), getThemePref(), getBrand()]);
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Nav
        brandName={brand.name}
        handle={brand.handle}
        user={{ name: session.name, role: session.role }}
        reviewCount={counts.review}
        errorCount={errorCount}
        theme={theme}
        isAdmin={session.role === "admin"}
      />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <div className="mb-2 flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[11px] text-muted">
            <Sparkles size={12} className="text-accent" /> AI
            <span>
              Hari ini <b className="text-fg">{usd(cost.todayUsd)}</b>
            </span>
            <span>
              Bulan ini <b className="text-fg">{usd(cost.monthUsd)}</b>
            </span>
          </span>
        </div>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
