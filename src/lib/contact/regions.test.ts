import { describe, expect, it } from "vitest";
import {
  CONTACT_REGIONS,
  contactRegion,
  mapEmbedSrc,
  resolveEmail,
  SOCIAL_PROFILES,
  whatsAppUrl,
} from "./regions";

describe("contact region configuration", () => {
  it("publishes exactly the two owner-provided regions", () => {
    expect(CONTACT_REGIONS.map((region) => region.id)).toEqual([
      "uae",
      "egypt",
    ]);
  });

  it("keeps every dial string in a form a dialler accepts", () => {
    for (const region of CONTACT_REGIONS)
      for (const phone of region.phones) {
        expect(phone.dial, `${region.id} dial`).toMatch(/^\+[0-9]{8,15}$/);
        expect(phone.display.trim(), `${region.id} display`).not.toBe("");
      }
  });

  it("links out only over https", () => {
    const urls = [
      ...CONTACT_REGIONS.map((region) => region.mapsUrl),
      ...SOCIAL_PROFILES.map((profile) => profile.url),
    ];
    for (const url of urls) expect(url).toMatch(/^https:\/\//);
  });

  it("carries no analytics parameters into the canonical social profiles", () => {
    // These reach structured data as `sameAs`, where the profile address is
    // the claim being made — not the app the owner copied the link from.
    for (const profile of SOCIAL_PROFILES)
      expect(profile.url, profile.network).not.toMatch(/[?&](igsh|mibextid)=/);
  });
});

describe("e-mail configuration", () => {
  it("publishes the owner-confirmed address for both regions", () => {
    for (const region of CONTACT_REGIONS)
      expect(region.email, `${region.id} e-mail`).toBe(
        "hillscoffe732@gmail.com",
      );
  });

  /*
   * The guard that made the pending state correct still has to hold. A
   * half-finished edit to either constant must degrade to "not configured" —
   * a disabled chip — rather than render a `mailto:` that opens an empty
   * compose window.
   */
  it("still refuses anything that is not a plausible address", () => {
    expect(resolveEmail("REPLACE_WITH_UAE_EMAIL")).toBeNull();
    expect(resolveEmail("   ")).toBeNull();
    expect(resolveEmail("not-an-address")).toBeNull();
    expect(resolveEmail("sales@")).toBeNull();
  });

  it("trims a pasted address", () => {
    expect(resolveEmail("  dubai@hillscoffees.com ")).toBe(
      "dubai@hillscoffees.com",
    );
  });
});

describe("WhatsApp-capable lines", () => {
  /*
   * Owner-confirmed: both mobiles take WhatsApp, the UAE landline does not.
   * Offering a WhatsApp button beside a landline would point buyers at a chat
   * nobody can read, so the flag is asserted per number.
   */
  it("marks exactly the confirmed mobiles", () => {
    const capable = CONTACT_REGIONS.flatMap((region) =>
      region.phones.filter((phone) => phone.whatsapp).map((p) => p.dial),
    );
    expect(capable).toEqual(["+971523618866", "+201117993300"]);
  });

  it("never marks the UAE landline", () => {
    const landline = contactRegion("uae").phones.find(
      (phone) => phone.dial === "+97143230662",
    );
    expect(landline, "landline missing").toBeTruthy();
    expect(landline!.whatsapp).toBe(false);
    // The published form stays the local one the owner uses.
    expect(landline!.display).toBe("04 323 0662");
  });

  it("builds an https wa.me link per capable line, never a tel: URI", () => {
    for (const region of CONTACT_REGIONS)
      for (const phone of region.phones) {
        if (!phone.whatsapp) continue;
        const url = whatsAppUrl(phone.dial)!;
        expect(url).toMatch(/^https:\/\/wa\.me\/[0-9]+$/);
        expect(url).not.toContain("tel:");
      }
  });
});

describe("whatsAppUrl", () => {
  it("builds a wa.me link from digits only", () => {
    expect(whatsAppUrl("+971 52 361 8866")).toBe("https://wa.me/971523618866");
  });

  it("renders nothing when no destination is configured", () => {
    expect(whatsAppUrl(null)).toBeNull();
    expect(whatsAppUrl("")).toBeNull();
  });
});

describe("mapEmbedSrc", () => {
  const uae = contactRegion("uae");
  const egypt = contactRegion("egypt");

  it("needs no API key by default", () => {
    const src = mapEmbedSrc({ region: uae, locale: "en" });
    expect(src).toContain("output=embed");
    expect(src).not.toContain("key=");
  });

  it("points each region at its own location", () => {
    const first = mapEmbedSrc({ region: uae, locale: "en" });
    const second = mapEmbedSrc({ region: egypt, locale: "en" });
    expect(first).not.toBe(second);
    expect(decodeURIComponent(first)).toContain("Dubai");
    expect(decodeURIComponent(second)).toContain("Cairo");
  });

  it("switches to the supported Embed API when a key is configured", () => {
    const src = mapEmbedSrc({ region: uae, locale: "ar", apiKey: "test-key" });
    expect(src).toContain("/maps/embed/v1/place");
    expect(src).toContain("key=test-key");
    expect(src).toContain("language=ar");
  });
});
