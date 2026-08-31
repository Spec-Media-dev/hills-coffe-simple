import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getArticles } from "@/lib/data/editorial";
import { localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/knowledge">): Promise<Metadata> {
  const { locale } = await params;
  const meta = await getTranslations({ locale, namespace: "seo" });
  return localizedMetadata({
    locale: locale as Locale,
    path: "/knowledge",
    title: meta("knowledgeTitle"),
    description:
      locale === "ar"
        ? "اقرأ مقالات هيلز كوفي المنشورة عن القهوة الخضراء."
        : "Read published Hills Coffee articles about green coffee.",
  });
}

export default async function KnowledgePage({
  params,
}: PageProps<"/[locale]/knowledge">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const articles = await getArticles(locale as Locale);
  const text =
    locale === "ar"
      ? {
          eyebrow: "المعرفة",
          title: "ملاحظات عملية للقهوة الخضراء.",
          empty: "لا توجد مقالات منشورة حالياً.",
        }
      : {
          eyebrow: "Knowledge",
          title: "Practical thinking for green coffee.",
          empty: "No articles are published yet.",
        };
  return (
    <>
      <section className="section-space bg-primary text-primary-foreground">
        <div className="site-container">
          <p className="eyebrow !text-gold-contrast">{text.eyebrow}</p>
          <h1 className="display-xl mt-6 max-w-5xl">{text.title}</h1>
        </div>
      </section>
      <section className="section-space">
        <div className="site-container">
          {articles.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/knowledge/${article.slug}`}
                  className="rounded-[1.5rem] border border-border bg-card p-7 transition hover:border-highlight"
                >
                  <BookOpen className="size-6 text-highlight" />
                  <h2 lang={article.lang} className="mt-12 text-3xl">
                    {article.title}
                  </h2>
                  {article.excerpt ? (
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {article.excerpt}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              {text.empty}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
