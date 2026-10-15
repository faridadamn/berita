"use client";
import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type ThemePref = "light" | "dark" | "system";

const opts: { key: ThemePref; label: string; Icon: typeof Sun }[] = [
  { key: "light", label: "Terang", Icon: Sun },
  { key: "dark", label: "Gelap", Icon: Moon },
  { key: "system", label: "Ikuti sistem", Icon: Monitor },
];

/** Simpan pilihan tema di cookie (dibaca server → tidak ada kedip saat load) dan terapkan langsung. */
export function ThemeToggle({ initial, compact }: { initial: ThemePref; compact?: boolean }) {
  const [pref, setPref] = useState<ThemePref>(initial);
  const apply = (p: ThemePref) => {
    setPref(p);
    document.cookie = `theme=${p}; path=/; max-age=31536000; samesite=lax`;
    const el = document.documentElement;
    if (p === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", p);
  };
  return (
    <div className={`inline-flex rounded-lg border border-line bg-panel-2 p-0.5 ${compact ? "" : "w-full"}`} role="radiogroup" aria-label="Tema">
      {opts.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={pref === key}
          title={label}
          onClick={() => apply(key)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] ${
            pref === key ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"
          }`}
        >
          <Icon size={13} />
          {!compact && <span>{label.split(" ")[0]}</span>}
        </button>
      ))}
    </div>
  );
}
