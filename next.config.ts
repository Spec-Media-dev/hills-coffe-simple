import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
    serverActions: { bodySizeLimit: "11mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async redirects() {
    return [
      {
        source: "/products/",
        destination: "/green-coffee-offer-list/",
        permanent: true,
      },
      {
        source: "/products/:slug/",
        destination: "/green-coffee-offer-list/:slug/",
        permanent: true,
      },
      {
        source: "/en/products/",
        destination: "/green-coffee-offer-list/",
        permanent: true,
      },
      {
        source: "/en/products/:slug/",
        destination: "/green-coffee-offer-list/:slug/",
        permanent: true,
      },
      {
        source: "/full-offer-list/",
        destination: "/green-coffee-offer-list/",
        permanent: true,
      },
      {
        source: "/spot-offerings/",
        destination: "/green-coffee-offer-list/",
        permanent: true,
      },
      { source: "/origins/", destination: "/coffee-origins/", permanent: true },
      {
        source: "/en/origins/",
        destination: "/coffee-origins/",
        permanent: true,
      },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];
    const privateHeaders = [
      ...securityHeaders,
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/account/:path*", headers: privateHeaders },
      { source: "/ar/account/:path*", headers: privateHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
      { source: "/ar/admin/:path*", headers: privateHeaders },
      { source: "/green-coffee-offer-list/:path*", headers: privateHeaders },
      { source: "/ar/green-coffee-offer-list/:path*", headers: privateHeaders },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
