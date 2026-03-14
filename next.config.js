/** @type {import("next").NextConfig} */
const nextConfig = {
  typedRoutes: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["sharp", "mammoth", "xlsx", "pdf-parse"],
};

module.exports = nextConfig;
