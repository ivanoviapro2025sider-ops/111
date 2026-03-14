import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "mammoth", "pdf-parse"]
};

export default nextConfig;
