import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CreatePageForm } from "@/components/admin/cms-forms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PAGE_TEMPLATES } from "@/lib/cms/sections";
import { listAdminPages } from "@/lib/data/admin-content";

export const metadata: Metadata = {
  title: "Pages",
  robots: { index: false, follow: false },
};

/**
 * The CMS page list.
 *
 * The translation columns are the point of this table: every one of the 18
 * live pages had zero translation rows when Phase 8 began, which is why none
 * of them could be published — `getSitePage` requires one. Showing EN/AR
 * presence per page makes that state visible instead of mysterious.
 */
export default async function AdminContentPage({
  params,
}: PageProps<"/[locale]/admin/content">) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations("admin.cms");
  const { rows, configured } = await listAdminPages();

  const statusLabel = (status: string) =>
    t(`status${status}` as Parameters<typeof t>[0]);

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
                <th className="p-4 text-start font-bold">{t("colPage")}</th>
                <th className="p-4 text-start font-bold">{t("colRoute")}</th>
                <th className="p-4 text-start font-bold">{t("colTemplate")}</th>
                <th className="p-4 text-start font-bold">{t("colStatus")}</th>
                <th className="p-4 text-start font-bold">{t("colSections")}</th>
                <th className="p-4 text-start font-bold">
                  {t("colTranslations")}
                </th>
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
                      href={`/admin/content/${row.id}`}
                      className="font-bold underline-offset-4 hover:underline"
                    >
                      {row.pageKey}
                    </Link>
                  </td>
                  <td className="p-4 align-top" dir="ltr">
                    {row.routePath ?? "/"}
                  </td>
                  <td className="p-4 align-top" dir="ltr">
                    {row.template}
                  </td>
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
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="p-4 align-top">{row.sectionCount}</td>
                  <td className="p-4 align-top">
                    <span className="flex flex-wrap gap-1.5">
                      <TranslationPill
                        present={row.hasEnglish}
                        label={t("english")}
                      />
                      <TranslationPill
                        present={row.hasArabic}
                        label={t("arabic")}
                      />
                    </span>
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

      <CreatePageForm
        templates={[...PAGE_TEMPLATES]}
        labels={{
          title: t("createTitle"),
          pageKey: t("pageKey"),
          pageKeyHint: t("pageKeyHint"),
          routePath: t("routePath"),
          routePathHint: t("routePathHint"),
          template: t("template"),
          sortOrder: t("sortOrder"),
          submit: t("create"),
          pending: t("saving"),
          choose: t("choose"),
        }}
        locale={locale}
      />
    </div>
  );
}

/** Presence, stated. A missing translation is never shown as English text. */
function TranslationPill({
  present,
  label,
}: {
  present: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        present
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      }`}
    >
      {present ? label : `${label} ✗`}
    </span>
  );
}
