import { describe, expect, it } from "vitest";
import { organizationAndWebsiteJsonLd } from "./organization";

describe("organizationAndWebsiteJsonLd", () => {
  it("uses live organization settings and localized translations", () => {
    const [organization, website] = organizationAndWebsiteJsonLd({
      locale: "ar",
      siteUrl: "https://example.test/ar",
      settings: {
        displayName: "هيلز كوفي مصر",
        org_brand_name: "Hills Coffee",
        org_legal_name: "Hills Coffee Egypt LLC",
        org_email: "hello@example.test",
        org_phone: "+20 100 000 0000",
        address: "Cairo, Egypt",
      },
    });

    expect(organization).toMatchObject({
      name: "هيلز كوفي مصر",
      legalName: "Hills Coffee Egypt LLC",
      email: "hello@example.test",
      telephone: "+20 100 000 0000",
      address: { streetAddress: "Cairo, Egypt" },
    });
    expect(website).toMatchObject({
      name: "هيلز كوفي مصر",
      publisher: { "@id": "https://example.test/ar#organization" },
      inLanguage: "ar",
    });
  });

  it("declares the confirmed social profiles as sameAs", () => {
    const [organization] = organizationAndWebsiteJsonLd({
      locale: "en",
      siteUrl: "https://example.test",
      settings: null,
    });
    const sameAs = (organization as { sameAs: string[] }).sameAs;
    expect(sameAs).toHaveLength(3);
    for (const url of sameAs) expect(url).toMatch(/^https:\/\//);
    expect(sameAs.join(" ")).toMatch(/instagram|facebook|linkedin/i);
  });

  it("states both offices as locations without inventing opening hours", () => {
    const [organization] = organizationAndWebsiteJsonLd({
      locale: "en",
      siteUrl: "https://example.test",
      settings: null,
    });
    const locations = (
      organization as {
        location: {
          "@type": string;
          address: { addressLocality: string; addressCountry: string };
          telephone: string;
        }[];
      }
    ).location;

    expect(locations.map((place) => place.address.addressLocality)).toEqual([
      "Dubai",
      "Cairo",
    ]);
    expect(locations.map((place) => place.address.addressCountry)).toEqual([
      "AE",
      "EG",
    ]);
    for (const place of locations) {
      expect(place["@type"]).toBe("Place");
      expect(place.telephone).toMatch(/^\+[0-9]+$/);
    }

    /*
     * The owner supplied daily times but no days of the week. `openingHours`
     * without days is not a fact, it is a guess, so it must stay absent until
     * the days are confirmed.
     */
    expect(JSON.stringify(organization)).not.toContain("openingHours");
  });
});
