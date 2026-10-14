import { timezone } from "./config";

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const future = diff < 0;
  const m = Math.round(Math.abs(diff) / 60_000);
  let s: string;
  if (m < 1) s = "baru saja";
  else if (m < 60) s = `${m} mnt`;
  else if (m < 60 * 24) s = `${Math.round(m / 60)} jam`;
  else s = `${Math.round(m / 1440)} hari`;
  if (s === "baru saja") return s;
  return future ? `${s} lagi` : `${s} lalu`;
}

export function formatWIB(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    ...opts,
  }).format(new Date(iso));
}

/** Nilai untuk <input type="datetime-local"> dalam WIB. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: timezone }).format(new Date()));
  if (h < 4) return "Selamat malam";
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export const usd = (n: number) => `$${n.toFixed(3)}`;
