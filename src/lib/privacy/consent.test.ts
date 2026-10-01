import { describe, expect, it } from "vitest";
import { CONSENT_MAX_AGE, parseConsent } from "./consent";

describe("privacy consent", () => {
  const now = 2_000_000_000_000;
  it.each([true, false])(
    "preserves an explicit analytics decision: %s",
    (analytics) => {
      expect(
        parseConsent(
          JSON.stringify({ version: 1, analytics, updatedAt: now }),
          now,
        )?.analytics,
      ).toBe(analytics);
    },
  );
  it.each([
    null,
    "invalid",
    "{}",
    "null",
    '{"version":2}',
    '{"version":1,"analytics":"true"}',
  ])("fails closed for invalid storage: %s", (raw) => {
    expect(parseConsent(raw, now)).toBeNull();
  });
  it("rejects expired and future decisions", () => {
    for (const updatedAt of [now - CONSENT_MAX_AGE, now + 1]) {
      expect(
        parseConsent(
          JSON.stringify({ version: 1, analytics: true, updatedAt }),
          now,
        ),
      ).toBeNull();
    }
  });
});
