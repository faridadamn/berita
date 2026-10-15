import "server-only";
import { db, schema } from "@/db";

export type Mode = "semi" | "manual" | "off";

export type Settings = {
  /** semi = agen jalan otomatis sesuai jadwal; manual = hanya saat tombol ditekan; off = mati total */
  mode: Mode;
  workStart: number; // jam WIB
  workEnd: number;
  threshold: number; // skor minimal lolos Analis
  analyzeBatch: number; // topik dinilai per putaran
  draftsPerRun: number; // draft ditulis Copywriter per putaran
  maxTopicAgeHours: number; // topik lebih tua dari ini diabaikan Scout
  language: string;
  /** mode jualan: kalimat pengungkapan link affiliate (ditambahkan ke caption post jualan) */
  salesDisclosure: string;
  /** mode jualan: arahan CTA (mis. "cek keranjang kuning", "link di bio") */
  salesCta: string;
};

export const defaultSettings: Settings = {
  mode: "semi",
  workStart: 7,
  workEnd: 22,
  threshold: 70,
  analyzeBatch: 10,
  draftsPerRun: 3,
  maxTopicAgeHours: 48,
  language: "Bahasa Indonesia santai",
  salesDisclosure: "Post ini berisi link affiliate — aku dapat komisi kecil kalau kamu beli lewat link ini, harga tetap sama. #ad",
  salesCta: "Link produk ada di bio (pilih post ini) atau di komentar.",
};

export async function getSettings(): Promise<Settings> {
  const rows = await db().select().from(schema.settings);
  const s = { ...defaultSettings } as Record<string, unknown>;
  for (const r of rows) if (r.key in s) s[r.key] = r.value;
  return s as Settings;
}

export async function saveSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await db()
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  }
}

/** Jam sekarang di WIB (0-23). */
export function hourWIB(d = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(d)) % 24;
}

export function inWorkHours(s: Settings, d = new Date()) {
  const h = hourWIB(d);
  return s.workStart <= s.workEnd ? h >= s.workStart && h < s.workEnd : h >= s.workStart || h < s.workEnd;
}
