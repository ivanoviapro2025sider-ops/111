/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['fluent-ffmpeg'],
  },
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'fluent-ffmpeg'];
    return config;
  },
};

module.exports = nextConfig;
