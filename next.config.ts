import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  // font untuk renderer PNG dibaca dari disk saat runtime
  outputFileTracingIncludes: { "/**": ["./src/lib/render/fonts/**"] },
  serverExternalPackages: ["sharp"],
};
export default nextConfig;
