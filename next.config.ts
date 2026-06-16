import type { NextConfig } from "next";

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

// Mode bêta : ignore lint/TS au build pour débloquer les hotfix Vercel.
// À réactiver avant production stable — voir docs/DEPLOY-BETA.md
const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/favicon.svg",
        permanent: false,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
