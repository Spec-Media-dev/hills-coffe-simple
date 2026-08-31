import { describe, expect, it, vi } from "vitest";

// `server-only` is a Next.js build-time guard with no Node resolution.
vi.mock("server-only", () => ({}));

const { resolveSiteUrl } = await import("@/lib/env");

/**
 * §60 CANONICAL HOST: NEXT_PUBLIC_SITE_URL is authoritative. localhost is fine
 * in development; in production a missing or invalid value must fail clearly
 * rather than silently shipping a wrong hardcoded production hostname.
 */
describe("canonical host resolution", () => {
  it("falls back to localhost in development when unset", () => {
    expect(resolveSiteUrl(undefined, false)).toBe("http://localhost:3000");
  });

  it("throws in production when unset", () => {
    expect(() => resolveSiteUrl(undefined, true)).toThrow(
      /NEXT_PUBLIC_SITE_URL is required in production/,
    );
  });

  it("throws on an invalid URL in production", () => {
    expect(() => resolveSiteUrl("not-a-url", true)).toThrow(
      /must be a valid absolute URL/,
    );
  });

  it("throws on an invalid URL in development too", () => {
    expect(() => resolveSiteUrl("not-a-url", false)).toThrow(
      /must be a valid absolute URL/,
    );
  });

  it("normalises a valid production URL by trimming the trailing slash", () => {
    expect(resolveSiteUrl("https://www.hillscoffees.com/", true)).toBe(
      "https://www.hillscoffees.com",
    );
  });

  it("never invents a production hostname of its own", () => {
    // Guards against reintroducing a silent hardcoded default such as the
    // previously shipped https://hillscoffee.co fallback.
    expect(resolveSiteUrl(undefined, false)).not.toMatch(/hillscoffee/);
  });
});
