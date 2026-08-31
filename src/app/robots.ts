import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Private areas and single-use auth utility routes. Paths are written without a
// trailing slash so each rule blocks both the bare route (/account) and
// everything beneath it (/account/profile) — the site serves non-trailing-slash
// URLs, so a "/account/" rule would leave /account itself crawlable.
const privatePaths = [
  "/account",
  "/admin",
  "/dashboard-admin",
  "/sign-in",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths.flatMap((path) => [path, `/ar${path}`]),
      },
    ],
    sitemap: `${env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
    host: env.NEXT_PUBLIC_SITE_URL,
  };
}
