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
});
