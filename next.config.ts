import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer, nextRuntime }) => {
    // Suppress __dirname and node API errors in Edge Runtime
    if (nextRuntime === "edge") {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
