/**
 * Server-rendered structured data. JSON-LD is data for crawlers, not a client
 * script, so it deliberately uses a normal script element rather than Next's
 * script loader. Locale changes use document navigation, keeping this out of
 * client-side reconciliation.
 */
export function JsonLd({ id, data }: { id: string; data: unknown }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
