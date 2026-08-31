import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  archiveAdminRecordAction,
  createCmsSectionAction,
  updateCmsSectionAction,
  upsertPageTranslationAction,
  upsertSectionTranslationAction,
} from "@/actions/admin-operations";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "CMS editor",
  robots: { index: false, follow: false },
};
export default async function ContentEditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ops = await getTranslations("admin.ops");
  const db = await createSupabaseServerClient();
  const [pageQ, translationsQ, sectionsQ] = await Promise.all([
    db.from("site_pages").select("*").eq("id", id).maybeSingle(),
    db.from("site_page_translations").select("*").eq("page_id", id),
    db
      .from("site_page_sections")
      .select("*")
      .eq("page_id", id)
      .order("sort_order"),
  ]);
  if (!pageQ.data) notFound();
  const sections = sectionsQ.data ?? [];
  const sectionTranslationsQ = sections.length
    ? await db
        .from("site_page_section_translations")
        .select("*")
        .in(
          "section_id",
          sections.map((section) => section.id),
        )
    : { data: [], error: null };
  const pageTranslations = new Map(
    (translationsQ.data ?? []).map((row) => [row.locale, row]),
  );
  const sectionTranslations = sectionTranslationsQ.data ?? [];
  const text =
    locale === "ar"
      ? {
          content: "محرر المحتوى",
          save: "حفظ",
          add: "إضافة قسم",
          visible: "ظاهر",
          hidden: "مخفي",
        }
      : {
          content: "Content editor",
          save: "Save",
          add: "Add section",
          visible: "Visible",
          hidden: "Hidden",
        };
  return (
    <div className="p-5 md:p-8">
      <p className="eyebrow">{text.content}</p>
      <h1 className="mt-4 text-5xl">{pageQ.data.page_key}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {pageQ.data.route_path} · {pageQ.data.status} · {pageQ.data.template}
      </p>
      <div className="mt-9 grid gap-6 xl:grid-cols-2">
        {(["en", "ar"] as const).map((lang) => (
          <PageTranslationForm
            key={lang}
            pageId={id}
            lang={lang}
            row={pageTranslations.get(lang)}
            save={text.save}
          />
        ))}
      </div>
      <section className="mt-10">
        <h2 className="text-3xl">Sections</h2>
        <AdminActionForm
          action={createCmsSectionAction}
          submitLabel={text.add}
          className="mt-5 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_1fr_.5fr_auto]"
        >
          <input type="hidden" name="pageId" value={id} />
          <input
            name="sectionKey"
            required
            placeholder="section-key"
            className="h-11 rounded-lg border border-input bg-background px-3"
          />
          <select
            name="sectionType"
            className="h-11 rounded-lg border border-input bg-background px-3"
          >
            <option>HERO</option>
            <option>RICH_TEXT</option>
            <option>CTA</option>
            <option>ENTITY_LIST</option>
            <option>WAREHOUSES</option>
            <option>MEDIA_TEXT</option>
          </select>
          <input
            name="sortOrder"
            type="number"
            min="0"
            defaultValue={sections.length}
            className="h-11 rounded-lg border border-input bg-background px-3"
          />
        </AdminActionForm>
        <div className="mt-6 grid gap-6">
          {sections.map((section) => (
            <article
              key={section.id}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong>{section.section_key}</strong>
                  <p className="text-xs text-muted-foreground">
                    {section.section_type}
                  </p>
                </div>
                <AdminActionForm
                  action={updateCmsSectionAction}
                  submitLabel={text.save}
                  className="flex flex-wrap gap-2"
                >
                  <input type="hidden" name="id" value={section.id} />
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    defaultValue={section.sort_order}
                    aria-label="Sort order"
                    className="h-9 w-20 rounded-lg border border-input bg-background px-2"
                  />
                  <select
                    name="isVisible"
                    defaultValue={String(section.is_visible)}
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  >
                    <option value="true">{text.visible}</option>
                    <option value="false">{text.hidden}</option>
                  </select>
                  <input
                    name="ctaHref"
                    defaultValue={section.cta_href ?? ""}
                    placeholder="CTA path"
                    className="h-9 rounded-lg border border-input bg-background px-2"
                  />
                </AdminActionForm>
                <AdminActionForm
                  action={archiveAdminRecordAction}
                  submitLabel={ops("hideSection")}
                  danger
                >
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="entity" value="sections" />
                </AdminActionForm>
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                {(["en", "ar"] as const).map((lang) => (
                  <SectionTranslationForm
                    key={lang}
                    sectionId={section.id}
                    lang={lang}
                    row={sectionTranslations.find(
                      (row) =>
                        row.section_id === section.id && row.locale === lang,
                    )}
                    save={text.save}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
function PageTranslationForm({
  pageId,
  lang,
  row,
  save,
}: {
  pageId: string;
  lang: "en" | "ar";
  row?: {
    title: string;
    h1: string | null;
    summary: string | null;
    body_markdown: string | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  save: string;
}) {
  return (
    <AdminActionForm
      action={upsertPageTranslationAction}
      submitLabel={save}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="grid gap-3 rounded-2xl border border-border bg-card p-6"
    >
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="locale" value={lang} />
      <strong className="uppercase">{lang}</strong>
      <CmsInput name="title" label="Title" value={row?.title} required />
      <CmsInput name="h1" label="H1" value={row?.h1} />
      <CmsTextarea
        name="summary"
        label="Summary"
        value={row?.summary}
        rows={3}
      />
      <CmsTextarea
        name="bodyMarkdown"
        label="Body Markdown"
        value={row?.body_markdown}
        rows={8}
      />
      <CmsInput name="seoTitle" label="SEO title" value={row?.seo_title} />
      <CmsTextarea
        name="seoDescription"
        label="SEO description"
        value={row?.seo_description}
        rows={3}
      />
    </AdminActionForm>
  );
}
function SectionTranslationForm({
  sectionId,
  lang,
  row,
  save,
}: {
  sectionId: string;
  lang: "en" | "ar";
  row?: {
    heading: string | null;
    subheading: string | null;
    body_markdown: string | null;
    cta_label: string | null;
  };
  save: string;
}) {
  return (
    <AdminActionForm
      action={upsertSectionTranslationAction}
      submitLabel={save}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="grid gap-3 rounded-xl bg-page p-5"
    >
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="locale" value={lang} />
      <strong className="uppercase">{lang}</strong>
      <CmsInput name="heading" label="Heading" value={row?.heading} />
      <CmsInput name="subheading" label="Subheading" value={row?.subheading} />
      <CmsTextarea
        name="bodyMarkdown"
        label="Body Markdown"
        value={row?.body_markdown}
        rows={6}
      />
      <CmsInput name="ctaLabel" label="CTA label" value={row?.cta_label} />
    </AdminActionForm>
  );
}
function CmsInput({
  name,
  label,
  value,
  required,
}: {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold">
      {label}
      <input
        name={name}
        defaultValue={value ?? ""}
        required={required}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
      />
    </label>
  );
}
function CmsTextarea({
  name,
  label,
  value,
  rows,
}: {
  name: string;
  label: string;
  value?: string | null;
  rows: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold">
      {label}
      <textarea
        name={name}
        defaultValue={value ?? ""}
        rows={rows}
        className="rounded-lg border border-input bg-background p-3 text-sm font-normal"
      />
    </label>
  );
}
