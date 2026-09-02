import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArticleForm } from "@/components/admin/article-forms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  listAdminArticles,
  listArticleCategories,
} from "@/lib/data/admin-content";
import { listPickableMedia } from "@/lib/data/media-library";

export const metadata: Metadata = {
  title: "Articles",
  robots: { index: false, follow: false },
};

/**
 * The Articles workspace.
 *
 * The list shows both languages and whether an article carries a featured
 * image, because `featured_media_id` was never writable before Phase 8 and no
 * article could have one (finding N56).
 */
export default async function AdminArticlesPage({
  params,
}: PageProps<"/[locale]/admin/articles">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("admin.articles");

  const [{ rows, configured }, categories, media] = await Promise.all([
    listAdminArticles(),
    listArticleCategories(locale === "ar" ? "ar" : "en"),
    listPickableMedia(),
  ]);

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const pickerItems = media.map((item) => ({
    id: item.id,
    url: item.url,
    width: item.width,
    height: item.height,
    altEn: item.altEn,
    altAr: item.altAr,
    storagePath: item.storagePath,
  }));

  const formLabels = {
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
    submit: t("create"),
    pending: t("saving"),
  };

  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-4 text-4xl md:text-5xl">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("intro")}</p>

      {rows.length ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-start font-bold">{t("colTitle")}</th>
                <th className="p-4 text-start font-bold">{t("colCategory")}</th>
                <th className="p-4 text-start font-bold">{t("colStatus")}</th>
                <th className="p-4 text-start font-bold">
                  {t("featuredMedia")}
                </th>
                <th className="p-4 text-start font-bold">{t("colUpdated")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="p-4 align-top">
                    <Link
                      href={`/admin/articles/${row.id}`}
                      className="font-bold underline-offset-4 hover:underline"
                    >
                      {row.titleEn || t("untitled")}
                    </Link>
                    {row.titleAr ? (
                      <span
                        className="mt-1 block text-muted-foreground"
                        dir="rtl"
                      >
                        {row.titleAr}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-4 align-top">{row.categoryName ?? "—"}</td>
                  <td className="p-4 align-top">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
                        row.status === "PUBLISHED"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : row.status === "ARCHIVED"
                            ? "border-border bg-transparent text-muted-foreground"
                            : "border-gold/30 bg-gold/10 text-gold-deep dark:text-gold"
                      }`}
                    >
                      {t(`status${row.status}` as Parameters<typeof t>[0])}
                    </span>
                  </td>
                  <td className="p-4 align-top">
                    {row.hasFeaturedMedia ? "✓" : "—"}
                  </td>
                  <td className="p-4 align-top whitespace-nowrap">
                    {dateFormat.format(new Date(row.updatedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm font-bold">
            {configured ? t("empty") : t("notConfigured")}
          </p>
          {configured ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("emptyCta")}
            </p>
          ) : null}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-2xl">{t("createTitle")}</h2>
        <div className="mt-5 rounded-2xl border border-border bg-card p-6">
          <ArticleForm
            categories={categories.map((option) => ({
              id: option.value,
              label: option.label,
            }))}
            media={pickerItems}
            labels={formLabels}
          />
        </div>
      </section>
    </div>
  );
}
