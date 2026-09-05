import type { Locale } from "@/i18n/routing";
import { CONTACT_REGIONS, SOCIAL_PROFILES } from "@/lib/contact/regions";

/**
 * The company's confirmed offices, as schema.org `Place` nodes.
 *
 * These sit under `location` rather than being folded into the Organization's
 * own `address`/`telephone`. Those two stay CMS-driven and single-valued;
 * collapsing two real offices into them would either drop one or state a
 * headquarters the owner has not nominated. `location` is the property that
 * exists precisely for an organization operating from more than one place, so
 * both offices are stated without either being asserted as the primary one.
 *
 * Deliberately absent: `openingHours`. The owner supplied daily times but no
 * days of the week, and `openingHours` is meaningless without them — writing
 * "Mo-Fr" here would be inventing a business fact.
 */
const officeNodes = (organizationName: string) =>
  CONTACT_REGIONS.map((region) => ({
    "@type": "Place",
    name: `${organizationName} — ${region.postal.addressLocality}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: region.postal.streetAddress,
      addressLocality: region.postal.addressLocality,
      addressCountry: region.postal.addressCountry,
    },
    telephone: region.phones[0].dial,
  }));

type OrganizationSettings = {
  displayName?: string | null;
  org_brand_name?: string | null;
  org_legal_name?: string | null;
  org_email?: string | null;
  org_phone?: string | null;
  address?: string | null;
};

export function organizationAndWebsiteJsonLd({
  locale,
  siteUrl,
  settings,
}: {
  locale: Locale;
  siteUrl: string;
  settings: OrganizationSettings | null;
}) {
  const name =
    settings?.displayName || settings?.org_brand_name || "Hills Coffee";
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}#organization`,
    name,
    ...(settings?.org_legal_name ? { legalName: settings.org_legal_name } : {}),
    url: siteUrl,
    ...(settings?.org_email ? { email: settings.org_email } : {}),
    ...(settings?.org_phone ? { telephone: settings.org_phone } : {}),
    ...(settings?.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.address,
          },
        }
      : {}),
    // Confirmed company profiles. `sameAs` is the one place a crawler looks to
    // tie this Organization to the accounts it already knows about.
    sameAs: SOCIAL_PROFILES.map((profile) => profile.url),
    location: officeNodes(name),
  };

  return [
    organization,
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      name,
      url: siteUrl,
      publisher: { "@id": `${siteUrl}#organization` },
      inLanguage: locale,
    },
  ];
}
