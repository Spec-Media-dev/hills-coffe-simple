import type { Locale } from "@/i18n/routing";
import { env } from "@/lib/env";

/**
 * Structured data for the pages that present a *set* of things.
 *
 * The owner's SEO specification asks for a connected graph rather than
 * free-floating nodes: a `CollectionPage` that is part of the site's `WebSite`,
 * published by the site's `Organization`, and whose `mainEntity` is the list
 * actually rendered. The stable `@id` patterns here (`#webpage`, `#itemlist`,
 * `#origin`) match the ones the Organization/WebSite/Article helpers already
 * use, so every node on a page can reference the others by id instead of
 * repeating the entity.
 *
 * Two rules constrain everything below.
 *
 * **Only what is visible.** `ItemList` mirrors the cards the page actually
 * renders, in the order it renders them. A list padded with entries the reader
 * cannot see is exactly the hidden SEO-only markup the specification forbids.
 *
 * **Never a price.** These helpers accept names and URLs. There is deliberately
 * no parameter through which a price could reach public structured data, so an
 * offer's protected pricing cannot leak here even by mistake — the same
 * structural separation `queryCatalog` enforces for the rendered page.
 */

type ListItem = { name: string; url: string };

const site = () => env.NEXT_PUBLIC_SITE_URL;

export function collectionPageJsonLd({
  locale,
  canonical,
  name,
  description,
  items,
}: {
  locale: Locale;
  /** The page's own canonical URL — the graph is anchored to it. */
  canonical: string;
  name: string;
  description?: string;
  /** Exactly the entries rendered on the page, in rendered order. */
  items: ListItem[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name,
    ...(description ? { description } : {}),
    inLanguage: locale,
    isPartOf: { "@id": `${site()}#website` },
    publisher: { "@id": `${site()}#organization` },
    mainEntity: {
      "@type": "ItemList",
      "@id": `${canonical}#itemlist`,
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

/**
 * An origin's country entity, for `/coffee-origins/{slug}`.
 *
 * `Place` carries only the origin's name and, where the record has one, the
 * continent it sits in. No coordinates, population, certifications or
 * production claims: none of those are in this schema, and inventing them
 * would be exactly the fabricated business data the brief rules out.
 */
export function originPlaceJsonLd({
  locale,
  canonical,
  name,
  description,
  continent,
}: {
  locale: Locale;
  canonical: string;
  name: string;
  description?: string | null;
  continent?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name,
    ...(description ? { description } : {}),
    inLanguage: locale,
    isPartOf: { "@id": `${site()}#website` },
    publisher: { "@id": `${site()}#organization` },
    mainEntity: {
      "@type": "Place",
      "@id": `${canonical}#origin`,
      name,
      ...(continent
        ? { containedInPlace: { "@type": "Place", name: continent } }
        : {}),
    },
  };
}

/**
 * The contact surface. `ContactPage` plus a reference to the one Organization
 * node — the contact details themselves live on that node, so they are stated
 * once and cannot drift between pages.
 */
export function contactPageJsonLd({
  locale,
  canonical,
  name,
  description,
}: {
  locale: Locale;
  canonical: string;
  name: string;
  description?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name,
    ...(description ? { description } : {}),
    inLanguage: locale,
    isPartOf: { "@id": `${site()}#website` },
    about: { "@id": `${site()}#organization` },
  };
}

/** Serializes a node for a `<script type="application/ld+json">` tag. */
export const jsonLdScript = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");
