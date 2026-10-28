import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    cpus: 2,
  },
  reactCompiler: true,
};

export default nextConfig;
