import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/anton";
import "@fontsource/dm-serif-display";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { brand } from "@/lib/config";

export const metadata: Metadata = {
  title: `${brand.name} Studio`,
  description: `Studio konten ${brand.handle}`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
