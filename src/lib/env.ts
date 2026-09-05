import "server-only";

import { z } from "zod";

const siteUrlSchema = z.url();

export function resolveSiteUrl(
  configured = process.env.NEXT_PUBLIC_SITE_URL,
  isProduction = process.env.NODE_ENV === "production",
) {
  if (!configured) {
    if (isProduction) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is required in production and must be a valid absolute URL.",
      );
    }
    return "http://localhost:3000";
  }

  const parsed = siteUrlSchema.safeParse(configured);
  if (!parsed.success) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
  }
  return parsed.data.replace(/\/$/, "");
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: siteUrlSchema,
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  /**
   * Optional. The Contact page's maps work without it — the embed uses the
   * keyless `output=embed` form — so nothing requires this to be set. It
   * exists only so the owner can switch to Google's supported Embed API later
   * without a code change. It is a browser-safe Maps key, restricted by HTTP
   * referrer; no server credential belongs here.
   */
  NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY: z.string().min(1).optional(),
});

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: resolveSiteUrl(),
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY:
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || undefined,
});

export const canonicalUrl = new URL(env.NEXT_PUBLIC_SITE_URL);
