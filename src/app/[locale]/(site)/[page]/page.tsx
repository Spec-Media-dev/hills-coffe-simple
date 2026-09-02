import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPageView } from "@/components/content/cms-page";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import type { Locale } from "@/i18n/routing";
import { getSitePage } from "@/lib/data/site-content";
import { cmsMetadata } from "@/lib/seo/metadata";

/**
 * Any CMS page an Administrator publishes is served here.
 *
 * This used to be a hardcoded allow-list of eleven page keys, so a page
 * created in the Admin returned 404 until someone edited this file — which
 * made "manage the website without editing code" untrue (finding N60).
 *
 * Nothing is loosened by removing it. `getSitePage` still requires the page to
 * be PUBLISHED, active, not soft-deleted, past its publication date, and to
 * have a translation in the requested locale; anything else is a 404. And a
 * static route always wins this dynamic segment, so a page key can never
 * shadow `/about`, `/contact` or the catalog.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[page]">): Promise<Metadata> {
  const { locale, page: key } = await params;
  const page = await getSitePage(key, locale as Locale);
  return page ? cmsMetadata(page, locale as Locale, `/${key}`) : {};
}
export default async function CmsRoutePage({
  params,
}: PageProps<"/[locale]/[page]">) {
  const { locale, page: key } = await params;
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
