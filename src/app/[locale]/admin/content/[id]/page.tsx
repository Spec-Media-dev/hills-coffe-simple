import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  PageSettingsForm,
  PageTranslationForm,
  SectionSettingsForm,
  SectionTranslationForm,
} from "@/components/admin/cms-forms";
import {
  PageStatusControls,
  SectionRemove,
} from "@/components/admin/cms-controls";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { ENTITY_REFS, PAGE_TEMPLATES, SECTION_TYPES } from "@/lib/cms/sections";
import { getAdminPage } from "@/lib/data/admin-content";
import { listPickableMedia } from "@/lib/data/media-library";

export const metadata: Metadata = {
  title: "CMS editor",
  robots: { index: false, follow: false },
};

/**
 * The CMS page editor.
 *
 * English and Arabic are edited side by side, each in its own form posting its
 * own locale, so saving one language cannot touch the other. A language with
 * no row yet says so plainly rather than pre-filling with the other one's text
 * — a missing translation must stay visible (§14).
 */
export default async function AdminContentEditorPage({
  params,
}: PageProps<"/[locale]/admin/content/[id]">) {
  const { id, locale } = (await params) as { id: string; locale: Locale };
  const t = await getTranslations("admin.cms");

  const [page, media] = await Promise.all([
    getAdminPage(id),
    listPickableMedia(),
  ]);
  if (!page) notFound();

  const pickerItems = media.map((item) => ({
    id: item.id,
    url: item.url,
    width: item.width,
    height: item.height,
    altEn: item.altEn,
    altAr: item.altAr,
    storagePath: item.storagePath,
  }));

  const typeOptions = SECTION_TYPES.map((value) => ({
    id: value,
    label: t(`type${value}` as Parameters<typeof t>[0]),
  }));
  const entityOptions = ENTITY_REFS.map((value) => ({
    id: value,
    label: t(`ref${value}` as Parameters<typeof t>[0]),
  }));

  const translationLabels = {
    title: t("fieldTitle"),
    h1: t("fieldH1"),
    summary: t("fieldSummary"),
    body: t("fieldBody"),
    seoTitle: t("fieldSeoTitle"),
    seoDescription: t("fieldSeoDescription"),
    submit: t("save"),
    pending: t("saving"),
  };
  const sectionLabels = {
    sectionKey: t("sectionKey"),
    sectionKeyHint: t("sectionKeyHint"),
    sectionType: t("sectionType"),
    sortOrder: t("sortOrder"),
    visibility: t("visibility"),
    visible: t("sectionVisible"),
    hidden: t("sectionHidden"),
    media: t("media"),
    ctaHref: t("ctaHref"),
    entityRef: t("entityRef"),
    entityLimit: t("entityLimit"),
    submit: t("save"),
    pending: t("saving"),
    choose: t("choose"),
  };
  const sectionTranslationLabels = {
    heading: t("heading"),
    subheading: t("subheading"),
    body: t("body"),
    ctaLabel: t("ctaLabel"),
    submit: t("save"),
    pending: t("saving"),
  };

  return (
    <div className="p-5 md:p-8">
      <Link
        href="/admin/content"
        className="inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("back")}
      </Link>

      <h1 className="mt-4 text-4xl md:text-5xl" dir="ltr">
        {page.pageKey}
      </h1>
      <p className="mt-3 text-muted-foreground" dir="ltr">
        {page.routePath ?? "/"} · {page.template} ·{" "}
        {t(`status${page.status}` as Parameters<typeof t>[0])}
      </p>

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl">{t("settingsTitle")}</h2>
          <div className="mt-4">
            <PageSettingsForm
              page={page}
              templates={[...PAGE_TEMPLATES]}
              labels={{
                pageKey: t("pageKey"),
                routePath: t("routePath"),
                template: t("template"),
                sortOrder: t("sortOrder"),
                submit: t("save"),
                pending: t("saving"),
                choose: t("choose"),
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl">{t("publishTitle")}</h2>
          <div className="mt-4">
            <PageStatusControls
              pageId={page.id}
              status={page.status}
              labels={{
                publish: t("publish"),
                unpublish: t("unpublish"),
                archive: t("archive"),
              }}
            />
            {page.status === "PUBLISHED" && page.routePath ? (
              <a
                href={
                  locale === "en"
                    ? page.routePath
                    : `/${locale}${page.routePath}`
                }
                className="mt-4 inline-flex h-11 min-h-11 items-center rounded-full border border-border px-5 text-sm font-bold transition hover:border-gold"
              >
                {t("viewPublic")}
              </a>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-2xl">{t("translationsTitle")}</h2>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {(["en", "ar"] as const).map((lang) => (
            <div
              key={lang}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-bold">
                  {lang === "en" ? t("english") : t("arabic")}
                </h3>
                {!page.translations[lang] ? (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                    {t("missingTranslation", {
                      language: lang === "en" ? t("english") : t("arabic"),
                    })}
                  </span>
                ) : null}
              </div>
              <div className="mt-4">
                <PageTranslationForm
                  pageId={page.id}
                  locale={lang}
                  value={page.translations[lang]}
                  labels={translationLabels}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">{t("sectionsTitle")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("sectionsIntro")}
        </p>

        {page.sections.length ? (
          <div className="mt-6 grid gap-6">
            {page.sections.map((section) => (
              <article
                key={section.id}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold" dir="ltr">
                      {section.sectionKey}
                    </h3>
                    <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                      {t(
                        `type${section.sectionType}` as Parameters<typeof t>[0],
                      )}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                        section.isVisible
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-border bg-transparent text-muted-foreground"
                      }`}
                    >
                      {section.isVisible
                        ? t("sectionVisible")
                        : t("sectionHidden")}
                    </span>
                  </div>
                  <SectionRemove
                    sectionId={section.id}
                    label={t("removeSection")}
                  />
                </div>

                <div className="mt-5 grid gap-5">
                  <div>
                    <h4 className="text-sm font-bold text-muted-foreground">
                      {t("sectionSettings")}
                    </h4>
                    <div className="mt-3">
                      <SectionSettingsForm
                        pageId={page.id}
                        section={section}
                        media={pickerItems}
                        labels={sectionLabels}
                        typeOptions={typeOptions}
                        entityOptions={entityOptions}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-muted-foreground">
                      {t("sectionContent")}
                    </h4>
                    <div className="mt-3 grid gap-5 xl:grid-cols-2">
                      {(["en", "ar"] as const).map((lang) => (
                        <div
                          key={lang}
                          className="rounded-xl border border-border p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-sm font-bold">
                              {lang === "en" ? t("english") : t("arabic")}
                            </h5>
                            {!section.translations[lang] ? (
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                {t("missingTranslation", {
                                  language:
                                    lang === "en" ? t("english") : t("arabic"),
                                })}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3">
                            <SectionTranslationForm
                              sectionId={section.id}
                              sectionType={section.sectionType}
                              locale={lang}
                              value={section.translations[lang]}
                              labels={sectionTranslationLabels}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {t("sectionsEmpty")}
          </p>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h3 className="text-lg font-bold">{t("addSection")}</h3>
          <div className="mt-4">
            <SectionSettingsForm
              pageId={page.id}
              media={pickerItems}
              labels={sectionLabels}
              typeOptions={typeOptions}
              entityOptions={entityOptions}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
