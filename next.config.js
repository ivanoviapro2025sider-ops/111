/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["sharp", "mammoth", "xlsx", "pdf-parse"],
};

module.exports = nextConfig;
