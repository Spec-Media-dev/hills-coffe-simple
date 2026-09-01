import { describe, expect, it } from "vitest";
import {
  flowSubjectHash,
  signAuthFlowToken,
  verifyAuthFlowToken,
} from "./flow-token";

const secret = "test-only-secret-with-enough-entropy";
const now = 1_700_000_000_000;

describe("signed Auth flow tokens", () => {
  it("binds a recovery intent to a normalized email without exposing it", () => {
    const subject = flowSubjectHash(" Buyer@Example.com ", secret);
    const token = signAuthFlowToken(
      { kind: "recovery-intent", subject, expiresAt: now + 60_000 },
      secret,
    );
    expect(token).not.toContain("buyer@example.com");
    expect(
      verifyAuthFlowToken(token, "recovery-intent", secret, now)?.subject,
    ).toBe(flowSubjectHash("buyer@example.com", secret));
  });

  it("rejects tampering, expiry, and purpose mixing", () => {
    const token = signAuthFlowToken(
      {
        kind: "recovery-session",
        subject: "user-id",
        sessionHash: "session-hash",
        expiresAt: now + 1_000,
      },
      secret,
    );
    expect(
      verifyAuthFlowToken(`${token}x`, "recovery-session", secret, now),
    ).toBeNull();
    expect(
      verifyAuthFlowToken(token, "recovery-session", secret, now + 1_001),
    ).toBeNull();
    expect(
      verifyAuthFlowToken(token, "recovery-intent", secret, now),
    ).toBeNull();
  });
});
