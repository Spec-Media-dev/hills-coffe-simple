import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArticleForm,
  ArticleStatusControls,
} from "@/components/admin/article-forms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  getAdminArticle,
  listArticleCategories,
} from "@/lib/data/admin-content";
import { listPickableMedia } from "@/lib/data/media-library";

export const metadata: Metadata = {
  title: "Article editor",
  robots: { index: false, follow: false },
};

export default async function AdminArticleEditorPage({
  params,
}: PageProps<"/[locale]/admin/articles/[id]">) {
  const { id, locale } = (await params) as { id: string; locale: Locale };
  const t = await getTranslations("admin.articles");

  const [article, categories, media] = await Promise.all([
    getAdminArticle(id),
    listArticleCategories(locale === "ar" ? "ar" : "en"),
    listPickableMedia(),
  ]);
  if (!article) notFound();

  const pickerItems = media.map((item) => ({
    id: item.id,
    url: item.url,
    width: item.width,
    height: item.height,
    altEn: item.altEn,
    altAr: item.altAr,
    storagePath: item.storagePath,
  }));

  const title = article.translations.en?.title ?? t("untitled");
  const publicSlug = article.translations[locale === "ar" ? "ar" : "en"]?.slug;

  return (
    <div className="p-5 md:p-8">
      <Link
        href="/admin/articles"
        className="inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("back")}
      </Link>

      <h1 className="mt-4 text-4xl md:text-5xl">{title}</h1>
      <p className="mt-3 text-muted-foreground">
        {t(`status${article.status}` as Parameters<typeof t>[0])}
      </p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl">{t("status")}</h2>
        <div className="mt-4">
          <ArticleStatusControls
            articleId={article.id}
            status={article.status}
            labels={{
              publish: t("publish"),
              unpublish: t("unpublish"),
              archive: t("archive"),
            }}
          />
          {article.status === "PUBLISHED" && publicSlug ? (
            <a
              href={
                locale === "en"
                  ? `/knowledge/${publicSlug}`
                  : `/${locale}/knowledge/${publicSlug}`
              }
              className="mt-4 inline-flex h-11 min-h-11 items-center rounded-full border border-border px-5 text-sm font-bold transition hover:border-gold"
            >
              {t("viewPublic")}
            </a>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <ArticleForm
          article={article}
          categories={categories.map((option) => ({
            id: option.value,
            label: option.label,
          }))}
          media={pickerItems}
          labels={{
            english: t("english"),
            arabic: t("arabic"),
            slug: t("slug"),
            title: t("articleTitle"),
            excerpt: t("excerpt"),
            body: t("body"),
            category: t("category"),
            chooseCategory: t("chooseCategory"),
            noCategories: t("noCategories"),
            featuredMedia: t("featuredMedia"),
            status: t("status"),
            isFeatured: t("isFeatured"),
            yes: t("yes"),
            no: t("no"),
            choose: t("choose"),
            statusDraft: t("statusDRAFT"),
            statusPublished: t("statusPUBLISHED"),
            statusArchived: t("statusARCHIVED"),
            submit: t("save"),
            pending: t("saving"),
          }}
        />
      </section>
    </div>
  );
}
