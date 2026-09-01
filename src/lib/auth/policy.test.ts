import { describe, expect, it } from "vitest";
import { adminSignInDecision, customerSignInDecision } from "./policy";

describe("Phase 3 Auth state-machine decisions", () => {
  it.each([
    [false, "USER", false, "VERIFICATION_REQUIRED"],
    [true, "USER", true, "BLOCKED"],
    [true, "ADMIN", false, "ADMIN_PORTAL_REQUIRED"],
    [true, "USER", false, "OK"],
    // A confirmed account with no profile row is a provisioning
    // inconsistency, reported distinctly so the customer is not told their
    // account "cannot access protected customer features". It still grants
    // nothing.
    [true, null, false, "PROFILE_MISSING"],
    // Precedence: an unconfirmed or blocked account is classified on that
    // basis first, even when the profile row is also absent.
    [false, null, false, "VERIFICATION_REQUIRED"],
    [true, null, true, "BLOCKED"],
  ] as const)(
    "customer entry: confirmed=%s role=%s blocked=%s -> %s",
    (emailConfirmed, role, isBlocked, expected) => {
      expect(customerSignInDecision({ emailConfirmed, role, isBlocked })).toBe(
        expected,
      );
    },
  );

  it.each([
    [true, "ADMIN", false, "OK"],
    [false, "ADMIN", false, "FORBIDDEN"],
    [true, "USER", false, "FORBIDDEN"],
    [true, "ADMIN", true, "FORBIDDEN"],
    // The Admin entry deliberately collapses every denial, including a
    // missing profile, so it never discloses why.
    [true, null, false, "FORBIDDEN"],
  ] as const)(
    "Admin entry: confirmed=%s role=%s blocked=%s -> %s",
    (emailConfirmed, role, isBlocked, expected) => {
      expect(adminSignInDecision({ emailConfirmed, role, isBlocked })).toBe(
        expected,
      );
    },
  );
});
