import { describe, expect, it } from "vitest";
import { personaOf, personaSeesPricing, type AuthCandidate } from "./policy";

/**
 * The persona resolver decides what public calls to action say. It grants
 * nothing, but if it mislabels a viewer the site contradicts itself — which is
 * exactly what the owner reported: a verified customer told to sign in, and an
 * Administrator offered a customer account band.
 *
 * The ordering cases matter most. A blocked Administrator and an unverified
 * Administrator both have to resolve away from "verified", and a blocked
 * customer must never fall through to the entitled branch.
 */
const viewer = (overrides: Partial<AuthCandidate> = {}): AuthCandidate => ({
  emailConfirmed: true,
  role: "USER",
  isBlocked: false,
  ...overrides,
});

describe("personaOf", () => {
  it("treats no viewer as anonymous", () => {
    expect(personaOf(null)).toBe("anonymous");
  });

  it("resolves a verified, unblocked customer", () => {
    expect(personaOf(viewer())).toBe("verified");
  });

  it("resolves an unconfirmed customer as unverified", () => {
    expect(personaOf(viewer({ emailConfirmed: false }))).toBe("unverified");
  });

  it("resolves an Administrator as admin, never as a customer", () => {
    expect(personaOf(viewer({ role: "ADMIN" }))).toBe("admin");
  });

  it("puts blocked ahead of every other state", () => {
    // A blocked customer must not read as verified…
    expect(personaOf(viewer({ isBlocked: true }))).toBe("blocked");
    // …and a blocked Administrator must not read as an Administrator either.
    expect(personaOf(viewer({ role: "ADMIN", isBlocked: true }))).toBe(
      "blocked",
    );
    // Blocked outranks unverified too, so the message is about the block.
    expect(personaOf(viewer({ emailConfirmed: false, isBlocked: true }))).toBe(
      "blocked",
    );
  });

  it("resolves an unverified Administrator away from verified", () => {
    expect(personaOf(viewer({ role: "ADMIN", emailConfirmed: false }))).toBe(
      "admin",
    );
  });
});

describe("personaSeesPricing", () => {
  it("grants the pricing presentation to verified customers only", () => {
    expect(personaSeesPricing("verified")).toBe(true);
    for (const persona of [
      "anonymous",
      "unverified",
      "blocked",
      "admin",
    ] as const)
      expect(personaSeesPricing(persona), persona).toBe(false);
  });
});
