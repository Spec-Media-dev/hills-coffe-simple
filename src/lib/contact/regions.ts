/**
 * Hills Coffee regional business contact data.
 *
 * One module owns every machine-readable contact value the site publishes:
 * dial strings, the owner's Google Maps links, the company's social profiles,
 * the WhatsApp destination and the postal parts that reach structured data.
 * Display copy — region names, address wording, working hours — lives in
 * `messages/{en,ar}.json` under `contact.regions.*`, because those must be
 * localized and a translation catalogue is the only place bilingual UI text
 * belongs.
 *
 * The split is deliberate. Proper nouns ("DMCC Coffee Centre", "Instagram")
 * stay here rather than in the catalogue: they are not translated, and putting
 * them in `messages` would ask a translator to invent an Arabic form for a
 * registered name.
 */

export type ContactRegionId = "uae" | "egypt";

export type SocialNetwork = "instagram" | "facebook" | "linkedin";

export type SocialProfile = {
  network: SocialNetwork;
  /** Proper noun — shown as-is in both locales, never translated. */
  label: string;
  url: string;
};

export type ContactPhone = {
  /** `tel:` target. `+` and digits only, so a dialler always accepts it. */
  dial: string;
  /** Grouped for reading. Always rendered left-to-right, Arabic included. */
  display: string;
  /**
   * Whether this exact line receives WhatsApp, confirmed by the owner.
   *
   * A per-line flag rather than a per-region one: the UAE office answers on a
   * mobile that takes WhatsApp and on a landline that cannot. Offering a
   * WhatsApp button beside a landline would send buyers to a chat nobody can
   * ever read, so the two are distinguished at the number, not the office.
   */
  whatsapp: boolean;
};

export type ContactRegion = {
  id: ContactRegionId;
  /** Resolved e-mail, or `null` while the owner placeholder is unreplaced. */
  email: string | null;
  phones: ContactPhone[];
  /** The owner's own Maps link — the fallback that works with no JavaScript. */
  mapsUrl: string;
  /** Free-text query the embedded map resolves. */
  mapQuery: string;
  /** Registered facility name, where the region has one. Not translated. */
  facility: string | null;
  social: readonly SocialProfile[];
  /**
   * Locale-neutral postal parts, used only for schema.org. Kept separate from
   * the displayed address so structured data does not change per language.
   */
  postal: {
    streetAddress: string;
    addressLocality: string;
    addressCountry: string;
  };
};

/* ──────────────────────────────────────────────────────────────────────────
 * E-MAIL ADDRESSES — owner-confirmed
 *
 * Both offices are reached at the same address today. They are kept as two
 * constants rather than one so giving a region its own inbox later is a
 * one-line edit here and nowhere else.
 *
 * To change either, replace the string. `resolveEmail` rejects anything that
 * is not a plausible address, so a half-finished edit degrades to a disabled
 * "coming soon" chip instead of rendering a `mailto:` that opens an empty
 * compose window.
 * ────────────────────────────────────────────────────────────────────────── */
const UAE_EMAIL = "hillscoffe732@gmail.com";
const EGYPT_EMAIL = "hillscoffe732@gmail.com";

/* ──────────────────────────────────────────────────────────────────────────
 * WHATSAPP DESTINATION — owner-confirmed
 *
 * The UAE mobile, confirmed by the owner to take both calls and WhatsApp. This
 * is what the floating control opens, as an https `wa.me` link — never `tel:`.
 *
 * Set it to `null` to remove the floating control from the site entirely.
 * ────────────────────────────────────────────────────────────────────────── */
export const WHATSAPP_NUMBER: string | null = "971523618866";

/**
 * Shared company social profiles.
 *
 * The owner listed the same three accounts under both regions, so they are
 * stated once and referenced by each. Analytics parameters (`igsh`,
 * `mibextid`) are stripped: they identify the app the owner copied the link
 * from, they are not part of the profile address, and `sameAs` in structured
 * data should carry the canonical profile URL.
 */
export const SOCIAL_PROFILES: readonly SocialProfile[] = [
  {
    network: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/hillscoffee.global",
  },
  {
    network: "facebook",
    label: "Facebook",
    url: "https://www.facebook.com/share/14j8j2ftLg9/",
  },
  {
    network: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/hills-coffee-trading-llc/",
  },
] as const;

/** Anything that is not a plausible address resolves to "not configured yet". */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function resolveEmail(value: string): string | null {
  const trimmed = value.trim();
  return EMAIL_SHAPE.test(trimmed) ? trimmed : null;
}

export const CONTACT_REGIONS: readonly ContactRegion[] = [
  {
    id: "uae",
    email: resolveEmail(UAE_EMAIL),
    phones: [
      { dial: "+971523618866", display: "+971 52 361 8866", whatsapp: true },
      /*
       * The office landline. Dialled in full international form so the link
       * works from anywhere, while the card keeps the local form the owner
       * publishes. Calls only — a landline cannot receive WhatsApp.
       */
      { dial: "+97143230662", display: "04 323 0662", whatsapp: false },
    ],
    mapsUrl: "https://maps.app.goo.gl/7mh3nYbk4BSytV167?g_st=ic",
    mapQuery:
      "DAMAC Smart Heights, TECOM, Dubai Internet City, Dubai, United Arab Emirates",
    facility: "DMCC Coffee Centre",
    social: SOCIAL_PROFILES,
    postal: {
      streetAddress:
        "Office No. 2013, DAMAC Smart Heights, TECOM, Dubai Internet City",
      addressLocality: "Dubai",
      addressCountry: "AE",
    },
  },
  {
    id: "egypt",
    email: resolveEmail(EGYPT_EMAIL),
    phones: [
      { dial: "+201117993300", display: "+20 111 799 3300", whatsapp: true },
    ],
    mapsUrl: "https://maps.app.goo.gl/oEAXKwMMRqFqBchJ8?g_st=ic",
    mapQuery: "Sheraton Residences, Zone 1, Heliopolis, Cairo, Egypt",
    facility: null,
    social: SOCIAL_PROFILES,
    postal: {
      streetAddress: "Sheraton Residences, Zone 1, Building 2",
      addressLocality: "Cairo",
      addressCountry: "EG",
    },
  },
] as const;

export const contactRegion = (id: ContactRegionId): ContactRegion =>
  CONTACT_REGIONS.find((region) => region.id === id)!;

/** `wa.me` deep link, or `null` when no WhatsApp destination is configured. */
export function whatsAppUrl(number = WHATSAPP_NUMBER): string | null {
  const digits = number?.replace(/\D/g, "") ?? "";
  return digits ? `https://wa.me/${digits}` : null;
}

/**
 * Source for an embedded Google map.
 *
 * The keyless `output=embed` form is the default and needs no credential of
 * any kind, which is why no Maps key is provisioned for this project. If the
 * owner later wants the supported Embed API instead, setting
 * `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` switches this over with no code change.
 */
export function mapEmbedSrc({
  region,
  locale,
  apiKey,
}: {
  region: ContactRegion;
  locale: string;
  apiKey?: string;
}): string {
  const query = encodeURIComponent(region.mapQuery);
  if (apiKey)
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${query}&language=${locale}&zoom=16`;
  return `https://www.google.com/maps?q=${query}&hl=${locale}&z=16&output=embed`;
}
