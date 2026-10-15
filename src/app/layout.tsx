import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/anton";
import "@fontsource/dm-serif-display";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { brand } from "@/lib/config";
import { getThemePref } from "@/lib/theme";

export const metadata: Metadata = {
  title: `${brand.name} Studio`,
  description: `Studio konten ${brand.handle}`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getThemePref();
  return (
    <html lang="id" data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
