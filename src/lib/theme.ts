import { cookies } from "next/headers";
import type { ThemePref } from "@/components/theme-toggle";

/** Default gelap (identitas brand); pengguna bisa pilih terang atau ikut sistem. */
export async function getThemePref(): Promise<ThemePref> {
  const v = (await cookies()).get("theme")?.value;
  return v === "light" || v === "system" ? v : "dark";
}
