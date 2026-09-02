import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getArticles } from "@/lib/data/editorial";
import { localizedMetadata } from "@/lib/seo/metadata";
import { ImageReveal, SectionReveal } from "@/components/motion/primitives";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/knowledge">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "seo" });
  return localizedMetadata({
    locale: locale as Locale,
    path: "/knowledge",
    title: meta("knowledgeTitle"),
    description: meta("knowledgeDescription"),
  });
}

export default async function KnowledgePage({
  params,
}: PageProps<"/[locale]/knowledge">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const articles = await getArticles(locale as Locale);
  const text = await getTranslations("knowledge");
  return (
    <>
      <section className="section-space bg-primary text-primary-foreground">
        <SectionReveal className="site-container">
          <p className="eyebrow !text-gold-contrast">{text("eyebrow")}</p>
          <h1 className="display-xl mt-6 max-w-5xl">{text("title")}</h1>
        </SectionReveal>
      </section>
      <section className="section-space">
        <div className="site-container">
          {articles.length ? (
            <>
              <Link
                href={`/knowledge/${articles[0].slug}`}
                className="group grid overflow-hidden bg-gold text-[#17251c] lg:grid-cols-2"
              >
                <ImageReveal className="relative min-h-[24rem] bg-primary">
                  {articles[0].featuredMedia ? (
                    <Image
                      src={articles[0].featuredMedia.url}
                      alt={articles[0].featuredMedia.alt}
                      fill
                      priority
                      unoptimized
                      sizes="(min-width:1024px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <BookOpen className="absolute inset-0 m-auto size-10 text-gold-bright" />
                  )}
                </ImageReveal>
                <SectionReveal className="flex min-h-[24rem] flex-col justify-center p-8 md:p-12">
                  <p className="eyebrow !text-[#3b260f]">{text("eyebrow")}</p>
                  <h2
                    lang={articles[0].lang}
                    className="mt-6 font-heading text-4xl font-bold leading-tight md:text-5xl"
                  >
                    {articles[0].title}
                  </h2>
                  {articles[0].excerpt ? (
                    <p className="mt-6 max-w-xl leading-7 text-[#33483f]">
                      {articles[0].excerpt}
                    </p>
                  ) : null}
                </SectionReveal>
              </Link>
              <div className="mt-12 grid border-s border-t border-border md:grid-cols-2 xl:grid-cols-3">
                {articles.slice(1).map((article) => (
                  <Link
                    key={article.id}
                    href={`/knowledge/${article.slug}`}
                    className="border-e border-b border-border bg-card p-7 transition-colors hover:bg-page"
                  >
                    {article.featuredMedia ? (
                      <Image
                        src={article.featuredMedia.url}
                        alt={article.featuredMedia.alt}
                        width={article.featuredMedia.width}
                        height={article.featuredMedia.height}
                        unoptimized
                        className="mb-6 aspect-[16/10] w-full rounded-[1rem] object-cover"
                        sizes="(min-width:1280px) 24rem, (min-width:768px) 44vw, 90vw"
                      />
                    ) : (
                      <BookOpen className="size-6 text-highlight" />
                    )}
                    <h2
                      lang={article.lang}
                      className={`text-3xl ${article.featuredMedia ? "" : "mt-12"}`}
                    >
                      {article.title}
                    </h2>
                    {article.excerpt ? (
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {article.excerpt}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              {text("empty")}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
