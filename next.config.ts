import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { webpack, isServer, nextRuntime }) => {
    // Suppress __dirname and node API errors in Edge Runtime
    if (nextRuntime === "edge") {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      config.plugins.push(
        new webpack.DefinePlugin({
          __dirname: JSON.stringify("/"),
          __filename: JSON.stringify("/"),
        })
      );
    }
    return config;
  },
};

export default nextConfig;
