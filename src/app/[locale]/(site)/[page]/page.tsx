import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPageView } from "@/components/content/cms-page";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import type { Locale } from "@/i18n/routing";
import { getSitePage } from "@/lib/data/site-content";
import { cmsMetadata } from "@/lib/seo/metadata";

const commercialPages = new Set([
  "green-coffee-beans-supplier",
  "coffee-beans-supplier",
  "wholesale-coffee-beans",
  "specialty-coffee-beans",
  "arabica-coffee-beans-wholesale",
  "robusta-coffee-beans-wholesale",
  "raw-coffee-beans-for-roasters",
  "bulk-coffee-beans",
  "coffee-beans-wholesale-price",
  "privacy",
  "terms",
]);
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[page]">): Promise<Metadata> {
  const { locale, page: key } = await params;
  if (!commercialPages.has(key)) return {};
  const page = await getSitePage(key, locale as Locale);
  return page ? cmsMetadata(page, locale as Locale, `/${key}`) : {};
}
export default async function CmsRoutePage({
  params,
}: PageProps<"/[locale]/[page]">) {
  const { locale, page: key } = await params;
  if (!commercialPages.has(key)) notFound();
  const page = await getSitePage(key, locale as Locale);
  if (!page) notFound();
  return (
    <>
      <div className="site-container pt-6">
        <Breadcrumbs
          locale={locale as Locale}
          items={[{ label: page.title }]}
        />
      </div>
      <CmsPageView page={page} />
    </>
  );
}
