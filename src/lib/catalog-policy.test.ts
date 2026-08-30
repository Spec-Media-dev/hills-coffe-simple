import { describe, expect, it } from "vitest";
import { coffees, getOfferById } from "@/data/coffees";
import type { Viewer } from "@/data/types";
import { serializeCatalog } from "./catalog-policy";

const lookup = () => ({ amount: 10.5, currency: "USD" });
const viewer: Viewer = {
  id: "test-user",
  email: "customer@example.com",
  role: "USER",
};

describe("catalog price policy", () => {
  it("never serializes offer price values for anonymous visitors", () => {
    const payload = serializeCatalog(coffees, null, lookup);
    expect(
      payload
        .flatMap((coffee) => coffee.offers)
        .every((offer) => offer.price === null),
    ).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("USD 10.50");
  });
  it("attaches protected values only after a viewer is present", () => {
    const payload = serializeCatalog(coffees, viewer, lookup);
    expect(payload[0].offers[0].price).toBe("USD 10.50 / kg");
  });
});

describe("trusted inquiry relationship", () => {
  it("derives coffee and warehouse from the server-owned offer index", () => {
    const result = getOfferById("off-ham-du");
    expect(result?.coffee.id).toBe("coffee-ethiopia-hambela");
    expect(result?.offer.warehouse).toBe("Dubai");
  });
  it("rejects unknown offer identifiers", () => {
    expect(getOfferById("tampered-offer")).toBeNull();
  });
});
