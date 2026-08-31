import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeRedirect } from "./auth/redirects";
import { signUpSchema } from "./validation/auth";

describe("authentication boundaries", () => {
  it("rejects external and protocol-relative post-auth redirects", () => {
    expect(assertSafeRedirect("https://example.com", "en")).toBe("/account");
    expect(assertSafeRedirect("//example.com", "ar")).toBe("/ar/account");
    expect(assertSafeRedirect("/admin/users", "ar")).toBe("/ar/admin/users");
  });
  it("requires matching strong passwords and the exact signup identity fields", () => {
    expect(
      signUpSchema.safeParse({
        fullName: "Hills Buyer",
        email: "buyer@example.com",
        phone: "+20 100 000 0000",
        password: "coffee12345",
        confirmPassword: "coffee12345",
        locale: "en",
        website: "",
      }).success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({
        fullName: "Hills Buyer",
        email: "buyer@example.com",
        phone: "+20 100 000 0000",
        password: "coffee12345",
        confirmPassword: "different1",
        locale: "en",
        website: "",
      }).success,
    ).toBe(false);
  });
});

describe("data leak invariants", () => {
  it("keeps the protected price table behind the dedicated server module", () => {
    const catalog = readFileSync(resolve("src/lib/data/catalog.ts"), "utf8");
    const pricing = readFileSync(resolve("src/lib/data/pricing.ts"), "utf8");
    expect(catalog).not.toContain("offer_price_tiers");
    expect(pricing).toContain("offer_price_tiers");
    expect(pricing).toContain("requireVerifiedUser");
  });
  it("does not reintroduce the forbidden inquiry quantity field", () => {
    const inquiryAction = readFileSync(
      resolve("src/actions/inquiries.ts"),
      "utf8",
    );
    expect(inquiryAction).not.toContain(["quantity", "bags"].join("_"));
  });
});
