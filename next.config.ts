import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // font untuk renderer PNG dibaca dari disk saat runtime
  outputFileTracingIncludes: { "/**": ["./src/lib/render/fonts/**"] },
  serverExternalPackages: ["sharp"],
};
export default nextConfig;
