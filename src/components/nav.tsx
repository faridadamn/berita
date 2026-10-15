"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Inbox, Radar, CalendarDays, BarChart3, Brain, Rss, Users, Settings, LogOut, UserRound,
} from "lucide-react";
import { logout } from "@/app/actions/auth";

type Item = { href: string; label: string; Icon: typeof Inbox; badge?: number };

export function Nav({
  brandName, handle, user, reviewCount, isAdmin,
}: {
  brandName: string;
  handle: string;
  user: { name: string; role: string };
  reviewCount: number;
  isAdmin: boolean;
}) {
  const path = usePathname();
  const main: Item[] = [
    { href: "/", label: "Overview", Icon: LayoutGrid },
    { href: "/review", label: "Antrian Review", Icon: Inbox, badge: reviewCount },
    { href: "/radar", label: "Radar Topik", Icon: Radar },
    { href: "/kalender", label: "Kalender", Icon: CalendarDays },
    { href: "/analitik", label: "Analitik", Icon: BarChart3 },
    { href: "/brain", label: "Brain", Icon: Brain },
  ];
  const admin: Item[] = [
    { href: "/admin/sumber", label: "Sumber Topik", Icon: Rss },
    { href: "/admin/tim", label: "Tim & Akses", Icon: Users },
    { href: "/admin/pengaturan", label: "Pengaturan", Icon: Settings },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const link = (it: Item, compact = false) => (
    <Link
      key={it.href}
      href={it.href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
        active(it.href) ? "bg-accent/10 text-accent" : "text-muted hover:text-fg"
      } ${compact ? "shrink-0" : ""}`}
    >
      <it.Icon size={15} />
      <span>{it.label}</span>
      {!!it.badge && (
        <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] font-bold leading-4 text-accent-ink">
          {it.badge}
        </span>
      )}
    </Link>
  );

  const brandBlock = (
    <div>
      <p className="eyebrow flex items-center gap-1.5 !text-[9px] !text-fg">
        <span className="size-1.5 rounded-full bg-accent" /> {brandName} studio
      </p>
      <p className="display mt-1 text-xl">{handle}</p>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-panel/60 p-4 lg:flex">
        {brandBlock}
        <nav className="mt-6 space-y-0.5">{main.map((i) => link(i))}</nav>
        {isAdmin && (
          <>
            <p className="eyebrow mt-6 mb-2 px-2.5 !text-[9px]">Admin</p>
            <nav className="space-y-0.5">{admin.map((i) => link(i))}</nav>
          </>
        )}
        <div className="card mt-auto flex items-center gap-2.5 p-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-panel-2 text-xs font-bold">
            {user.name[0]}
          </span>
          <Link href="/akun" className="min-w-0 leading-tight hover:opacity-80">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-[11px] capitalize text-dim">{user.role}</p>
          </Link>
          <form action={logout} className="ml-auto">
            <button className="text-muted hover:text-fg" aria-label="Keluar">
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 px-4 pt-4 backdrop-blur lg:hidden">
        <div className="flex items-start justify-between">
          {brandBlock}
          <form action={logout}>
            <button className="btn !p-2" aria-label="Keluar">
              <LogOut size={14} />
            </button>
          </form>
        </div>
        <nav className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-3">
          {[...main, ...(isAdmin ? admin : []), { href: "/akun", label: "Akun", Icon: UserRound }].map((i) => link(i, true))}
        </nav>
      </header>
    </>
  );
}
