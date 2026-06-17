import type { NextConfig } from "next";

const appConsoleOrigin = process.env.APP_CONSOLE_ORIGIN ?? "https://router.flatkey.ai";
const siteOrigin = process.env.SITE_ORIGIN ?? "https://flatkey.ai";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  async redirects() {
    return [
      {
        source: "/keys",
        destination: "/",
        statusCode: 301,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_CONSOLE_ORIGIN: appConsoleOrigin,
    NEXT_PUBLIC_SITE_ORIGIN: siteOrigin,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
