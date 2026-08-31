import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedUrl } from "@/lib/seo/metadata";

export type BreadcrumbItem = { label: string; href?: string };

export async function Breadcrumbs({
  locale,
  items,
  inverted = false,
}: {
  locale: Locale;
  items: BreadcrumbItem[];
  inverted?: boolean;
}) {
  const t = await getTranslations("nav");
  const trail = [{ label: t("home"), href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      // `item` is omitted for the current page (schema.org allows this) and for
      // any crumb without its own href, so a trail never points a child at the
      // home URL by accident.
      ...(item.href ? { item: localizedUrl(locale, item.href) } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <nav
        aria-label={t("breadcrumb")}
        className={`text-sm ${inverted ? "text-white/70" : "text-muted-foreground"}`}
      >
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {trail.map((item, index) => (
            <li
              key={`${item.href ?? "current"}-${item.label}`}
              className="flex items-center gap-2"
            >
              {/* Chevron points along the reading direction in each locale. */}
              {index ? (
                <span aria-hidden="true">{locale === "ar" ? "‹" : "›"}</span>
              ) : null}
              {item.href && index !== trail.length - 1 ? (
                <Link
                  href={item.href}
                  className="font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={index === trail.length - 1 ? "page" : undefined}
                  className="font-medium"
                >
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
