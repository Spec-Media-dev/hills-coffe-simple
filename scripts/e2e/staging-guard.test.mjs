import { describe, expect, it } from "vitest";
import {
  assertNotProtectedAccount,
  assertStagingTarget,
  isProtectedAccount,
  isStagingTarget,
  maskRef,
  projectRefOf,
  PROTECTED_ACCOUNT_EMAILS,
  StagingGuardError,
} from "./staging-guard.mjs";

/**
 * P12-T01's required target-project guard test.
 *
 * The contract is "must fail closed if the target project is not explicitly
 * staging", so almost every case here is a refusal: each removes exactly one
 * condition from an otherwise-valid configuration and proves the guard still
 * says no. A guard tested only on its happy path is a guard nobody has tested.
 */

const APPROVED_REF = "approvedstagingref";
const OTHER_REF = "someotherprojectr";

/** A configuration that satisfies every condition. */
const approved = () => ({
  NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED_REF}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-real-key",
  HILLS_E2E_ENVIRONMENT: "staging",
  HILLS_E2E_ALLOWED_PROJECT_REF: APPROVED_REF,
  HILLS_E2E_ALLOW_MUTATION: "true",
});

describe("projectRefOf", () => {
  it("extracts the ref from a Supabase URL", () => {
    expect(projectRefOf("https://abcd1234efgh.supabase.co")).toBe(
      "abcd1234efgh",
    );
  });
  it("returns null for anything else", () => {
    for (const value of [
      "",
      null,
      undefined,
      "http://localhost:54321",
      "https://example.com",
    ])
      expect(projectRefOf(value)).toBeNull();
  });
});

describe("maskRef", () => {
  it("never returns the whole ref", () => {
    expect(maskRef("abcdefghijklmnop")).toBe("abcd…mnop");
    expect(maskRef("abcdefghijklmnop")).not.toContain("efghijkl");
  });
});

describe("assertStagingTarget — accepts only the approved staging target", () => {
  it("accepts a configuration that satisfies every condition", () => {
    const result = assertStagingTarget(approved());
    expect(result.environment).toBe("staging");
    expect(result.ref).toBe(APPROVED_REF);
    expect(result.maskedRef).not.toBe(APPROVED_REF);
  });

  it("is fail-closed on a completely empty environment", () => {
    expect(() => assertStagingTarget({})).toThrow(StagingGuardError);
    expect(isStagingTarget({})).toBe(false);
  });
});

describe("assertStagingTarget — refuses each missing condition individually", () => {
  const cases = [
    [
      "the staging marker is unset",
      { HILLS_E2E_ENVIRONMENT: undefined },
      /HILLS_E2E_ENVIRONMENT must be exactly "staging"/,
    ],
    [
      "the marker claims production",
      { HILLS_E2E_ENVIRONMENT: "production" },
      /must be exactly "staging"/,
    ],
    [
      "the marker is only nearly right",
      { HILLS_E2E_ENVIRONMENT: "Staging" },
      /must be exactly "staging"/,
    ],
    [
      "the Supabase URL is missing",
      { NEXT_PUBLIC_SUPABASE_URL: undefined },
      /NEXT_PUBLIC_SUPABASE_URL is not set/,
    ],
    [
      "the Supabase URL is not a project URL",
      { NEXT_PUBLIC_SUPABASE_URL: "https://example.com" },
      /not a recognisable Supabase project URL/,
    ],
    [
      "the approved ref is not declared",
      { HILLS_E2E_ALLOWED_PROJECT_REF: undefined },
      /HILLS_E2E_ALLOWED_PROJECT_REF is not set/,
    ],
    [
      "the service-role key is missing",
      { SUPABASE_SERVICE_ROLE_KEY: undefined },
      /SUPABASE_SERVICE_ROLE_KEY is not set/,
    ],
    [
      "mutation is not authorised",
      { HILLS_E2E_ALLOW_MUTATION: undefined },
      /HILLS_E2E_ALLOW_MUTATION must be exactly "true"/,
    ],
    [
      "mutation authorisation is not exactly true",
      { HILLS_E2E_ALLOW_MUTATION: "yes" },
      /HILLS_E2E_ALLOW_MUTATION must be exactly "true"/,
    ],
  ];

  for (const [name, override, pattern] of cases)
    it(`refuses when ${name}`, () => {
      const env = { ...approved(), ...override };
      expect(() => assertStagingTarget(env)).toThrow(pattern);
      expect(isStagingTarget(env)).toBe(false);
    });
});

describe("assertStagingTarget — the wrong project is refused even with a valid marker", () => {
  it("refuses when the approved ref does not match the project in use", () => {
    // The exact accident the exact-ref rule exists for: marker correct,
    // credentials present, mutation authorised — but pointed elsewhere.
    const env = {
      ...approved(),
      NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER_REF}.supabase.co`,
    };
    expect(() => assertStagingTarget(env)).toThrow(
      /does not match the Supabase project in use/,
    );
    expect(isStagingTarget(env)).toBe(false);
  });

  it("refuses when the declared ref is a near-miss of the real one", () => {
    const env = {
      ...approved(),
      HILLS_E2E_ALLOWED_PROJECT_REF: APPROVED_REF.slice(0, -1),
    };
    expect(() => assertStagingTarget(env)).toThrow(/does not match/);
  });

  it("accepts a declared ref that differs only by case or padding", () => {
    // Tolerating whitespace/case is about copy-paste, not about relaxing
    // which project is allowed.
    expect(
      assertStagingTarget({
        ...approved(),
        HILLS_E2E_ALLOWED_PROJECT_REF: `  ${APPROVED_REF.toUpperCase()}  `,
      }).ref,
    ).toBe(APPROVED_REF);
  });
});

describe("assertStagingTarget — never leaks secrets in its errors", () => {
  it("keeps the service-role key and full refs out of the message", () => {
    const secret = "super-secret-service-role-value";
    const env = {
      ...approved(),
      SUPABASE_SERVICE_ROLE_KEY: secret,
      HILLS_E2E_ALLOWED_PROJECT_REF: OTHER_REF,
    };
    try {
      assertStagingTarget(env);
      throw new Error("guard should have refused");
    } catch (error) {
      const text = `${error.message} ${error.detail ?? ""}`;
      expect(text).not.toContain(secret);
      expect(text).not.toContain(APPROVED_REF);
      expect(text).not.toContain(OTHER_REF);
    }
  });
});

describe("protected accounts", () => {
  const protectedEmail = PROTECTED_ACCOUNT_EMAILS[0];

  it("recognises the owner-protected account regardless of case or padding", () => {
    expect(isProtectedAccount(protectedEmail)).toBe(true);
    expect(isProtectedAccount(protectedEmail.toUpperCase())).toBe(true);
    expect(isProtectedAccount(`  ${protectedEmail}  `)).toBe(true);
  });

  it("does not over-match similar addresses", () => {
    expect(isProtectedAccount("shadyshref2002@gmail.com")).toBe(false);
    expect(isProtectedAccount("shadyshref30@gmail.com")).toBe(false);
    expect(isProtectedAccount("")).toBe(false);
    expect(isProtectedAccount(undefined)).toBe(false);
  });

  it("refuses any action against the protected account", () => {
    expect(() => assertNotProtectedAccount(protectedEmail, "block")).toThrow(
      /refusing to block an explicitly protected account/,
    );
    expect(() => assertNotProtectedAccount(protectedEmail, "delete")).toThrow(
      StagingGuardError,
    );
  });

  it("allows action against an ordinary fixture address", () => {
    expect(() =>
      assertNotProtectedAccount("e2e-hills-run1-verified@example.com", "block"),
    ).not.toThrow();
  });
});
