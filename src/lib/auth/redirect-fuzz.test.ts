import { describe, expect, it } from "vitest";
import { assertSafeRedirect } from "@/lib/auth/redirects";

const HOSTILE = [
  "https://evil.example.com",
  "http://evil.example.com/x",
  "//evil.example.com",
  "///evil.example.com",
  "/\evil.example.com",
  "\\evil.example.com",
  "javascript:alert(1)",
  "data:text/html,<script>",
  "vbscript:msgbox(1)",
  "%2F%2Fevil.example.com",
  "/%09/evil.example.com",
  "/%0d%0aSet-Cookie:x=1",
  "https:/evil.example.com",
  "https:\\evil.example.com",
  "/account/../../etc",
  "//evil.example.com/account",
  "/\t/evil.example.com",
];

describe("redirect allow-list fuzz", () => {
  for (const value of HOSTILE)
    it(`refuses ${JSON.stringify(value)}`, () => {
      for (const locale of ["en", "ar"] as const) {
        const out = assertSafeRedirect(value, locale);
        expect(out.startsWith("/"), `${value} -> ${out}`).toBe(true);
        expect(out.startsWith("//"), `${value} -> ${out}`).toBe(false);
        expect(/^[a-z]+:/i.test(out), `${value} -> ${out}`).toBe(false);
        expect(out, `${value} -> ${out}`).not.toContain("evil.example.com");
      }
    });
  /*
   * `/admin` and `/dashboard-admin` are intentionally *allowed* internal
   * destinations: an Administrator signing in is redirected to the workspace,
   * and the auth callback sends a confirmed Admin there. This helper guards
   * against leaving the site, not against reaching a privileged route —
   * authorization is enforced at the route by `requireAdmin()`, which the
   * session-isolation suite proves end to end. Asserting otherwise here would
   * be testing the wrong contract.
   */
  it("allows internal admin destinations, which the route then authorizes", () => {
    expect(assertSafeRedirect("/admin", "en")).toBe("/admin");
    expect(assertSafeRedirect("/dashboard-admin", "en")).toBe(
      "/dashboard-admin",
    );
  });

  it("preserves a legitimate internal destination", () => {
    expect(assertSafeRedirect("/account/favorites", "en")).toBe(
      "/account/favorites",
    );
    expect(assertSafeRedirect("/account/favorites", "ar")).toBe(
      "/ar/account/favorites",
    );
  });
});
