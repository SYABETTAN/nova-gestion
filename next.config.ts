import type { NextConfig } from "next";

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  compress: true,
  poweredByHeader: false,
};

export default withBundleAnalyzer(nextConfig);
