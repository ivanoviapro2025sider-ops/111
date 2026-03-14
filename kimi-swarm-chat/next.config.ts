import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "xlsx", "sharp"],
  experimental: {
    reactCompiler: false,
  },
};

export default nextConfig;
