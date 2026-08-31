import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CmsPageView } from "@/components/content/cms-page";
import type { Locale } from "@/i18n/routing";
import { getSitePage } from "@/lib/data/site-content";
import { cmsMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const page = await getSitePage("about", locale as Locale);
  return page ? cmsMetadata(page, locale as Locale, "/about") : {};
}

export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const page = await getSitePage("about", locale as Locale);
  if (!page) notFound();
  return <CmsPageView page={page} />;
}
