import type { Locale } from "@/i18n/routing";

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
