import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SafeMarkdown } from "@/components/content/safe-markdown";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import type { Locale } from "@/i18n/routing";
import { getArticleBySlug } from "@/lib/data/editorial";
import { getSiteSettings } from "@/lib/data/site-content";
import { env } from "@/lib/env";
import { articleJsonLd } from "@/lib/seo/article";
import { localizedMetadata } from "@/lib/seo/metadata";
import { ImageReveal, SectionReveal } from "@/components/motion/primitives";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/knowledge/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getArticleBySlug(slug, locale as Locale);
  return article
    ? localizedMetadata({
        locale: locale as Locale,
        path: `/knowledge/${slug}`,
        title: article.seoTitle || article.title,
        description: article.seoDescription || article.excerpt || undefined,
      })
    : {};
}
export default async function ArticlePage({
  params,
}: PageProps<"/[locale]/knowledge/[slug]">) {
  const { locale, slug } = await params;
  const [article, settings, nav] = await Promise.all([
    getArticleBySlug(slug, locale as Locale),
    getSiteSettings(locale as Locale),
    getTranslations("nav"),
  ]);
  if (!article) notFound();
  const jsonLd = articleJsonLd({
    article,
    locale: locale as Locale,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    organizationName:
      settings?.displayName || settings?.org_brand_name || "Hills Coffee",
  });
  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header className="bg-primary text-primary-foreground">
        <SectionReveal className="site-container grid min-h-[34rem] gap-10 py-14 lg:grid-cols-[1fr_.85fr] lg:items-center lg:py-20">
          <div>
            <Breadcrumbs
              locale={locale as Locale}
              items={[
                { label: nav("knowledge"), href: "/knowledge" },
                { label: article.title },
              ]}
              inverted
            />
            <p className="eyebrow !text-gold-contrast">{nav("knowledge")}</p>
            <h1 lang={article.lang} className="display-lg mt-6">
              {article.title}
            </h1>
            {article.excerpt ? (
              <p className="mt-7 max-w-3xl text-lg text-white/70">
                {article.excerpt}
              </p>
            ) : null}
          </div>
          {article.featuredMedia ? (
            <ImageReveal className="relative min-h-[24rem] lg:min-h-[30rem]">
              <Image
                src={article.featuredMedia.url}
                alt={article.featuredMedia.alt}
                fill
                unoptimized
                sizes="(min-width:1024px) 42vw, 100vw"
                className="object-cover"
                priority
              />
            </ImageReveal>
          ) : null}
        </SectionReveal>
      </header>
      <div className="site-container section-space max-w-4xl">
        {/* Present only when the media row is live and measurable; an archived
            or unreadable image leaves the article intact rather than showing a
            broken frame (§33). */}
        {article.bodyMarkdown ? (
          <SafeMarkdown className="prose-hills article-prose text-lg">
            {article.bodyMarkdown}
          </SafeMarkdown>
        ) : null}
      </div>
    </article>
  );
}
