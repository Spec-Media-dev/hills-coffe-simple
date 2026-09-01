import { describe, expect, it } from "vitest";
import { fail, fieldErrorsOf, idleActionState, ok, settled } from "./actions";

describe("ActionResult contract", () => {
  it("uses the closed success shape", () => {
    expect(ok("verificationEmailSent", { redirectTo: "/account" })).toEqual({
      ok: true,
      code: "OK",
      data: { redirectTo: "/account" },
      messageKey: "verificationEmailSent",
    });
  });

  it("uses message keys and structured field errors for failures", () => {
    const result = fail("VALIDATION", "validation", {
      fieldErrors: { email: ["invalidEmail"] },
    });
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION",
      messageKey: "validation",
      fieldErrors: { email: ["invalidEmail"] },
    });
    expect(JSON.stringify(result)).not.toMatch(/supabase|postgres|policy/i);
  });

  it("keeps idle UI state outside the domain-code set", () => {
    expect(settled(idleActionState)).toBeNull();
    expect(fieldErrorsOf(idleActionState)).toBeUndefined();
  });
});
