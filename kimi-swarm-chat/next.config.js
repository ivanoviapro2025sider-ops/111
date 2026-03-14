/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10gb",
    },
  },
};

module.exports = nextConfig;
