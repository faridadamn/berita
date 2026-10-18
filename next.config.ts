import type { NextConfig } from "next";

// Deploy di subpath (mis. domain.com/berita): isi BASE_PATH=/berita saat build.
const basePath = (process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  // samakan nilai untuk kode browser (dipakai di <img>/<a> yang tidak lewat next/link)
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // font untuk renderer PNG dibaca dari disk saat runtime
  outputFileTracingIncludes: { "/**": ["./src/lib/render/fonts/**", "./scripts/video/**"] },
  serverExternalPackages: ["sharp"],
};
export default nextConfig;
