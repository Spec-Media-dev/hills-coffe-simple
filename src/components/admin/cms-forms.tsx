"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  savePageAction,
  savePageTranslationAction,
  saveSectionAction,
  saveSectionTranslationAction,
} from "@/actions/admin-cms";
import {
  AdminField,
  AdminForm,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-form";
import { MediaPicker, type PickerItem } from "@/components/admin/media-picker";
import { SECTION_REGISTRY, isSectionType } from "@/lib/cms/sections";
import type { AdminSectionTranslation } from "@/lib/data/admin-content";

/**
 * CMS editor forms, built on the Phase 6 `AdminForm` family so validation
 * behaves the same way everywhere in the Admin: an error appears under the
 * field that caused it, typed values survive a rejection, and the message is
 * resolved from a key in the active locale.
 *
 * Each translation is its own form with its own `locale`, which is what makes
 * "editing Arabic never overwrites English" true by construction rather than
 * by care (§14).
 */

export function CreatePageForm({
  templates,
  labels,
}: {
  templates: string[];
  labels: {
    title: string;
    pageKey: string;
    pageKeyHint: string;
    routePath: string;
    routePathHint: string;
    template: string;
    sortOrder: string;
    submit: string;
    pending: string;
    choose: string;
  };
  locale: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl">{labels.title}</h2>
      <AdminForm
        action={savePageAction}
        submitLabel={labels.submit}
        pendingLabel={labels.pending}
        className="mt-5 grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-2"
      >
        <AdminField
          name="pageKey"
          label={labels.pageKey}
          hint={labels.pageKeyHint}
          dir="ltr"
        />
        <AdminField
          name="routePath"
          label={labels.routePath}
          hint={labels.routePathHint}
          dir="ltr"
        />
        <AdminSelect
          name="template"
          label={labels.template}
          placeholder={labels.choose}
          options={templates.map((id) => ({ id, label: id }))}
        />
        <AdminField
          name="sortOrder"
          label={labels.sortOrder}
          type="number"
          min="0"
          defaultValue={0}
        />
      </AdminForm>
    </section>
  );
}

export function PageSettingsForm({
  page,
  templates,
  labels,
}: {
  page: {
    id: string;
    pageKey: string;
    routePath: string | null;
    template: string;
    sortOrder: number;
  };
  templates: string[];
  labels: {
    pageKey: string;
    routePath: string;
    template: string;
    sortOrder: string;
    submit: string;
    pending: string;
    choose: string;
  };
}) {
  return (
    <AdminForm
      action={savePageAction}
      submitLabel={labels.submit}
      pendingLabel={labels.pending}
      className="grid gap-4 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={page.id} />
      <AdminField
        name="pageKey"
        label={labels.pageKey}
        defaultValue={page.pageKey}
        dir="ltr"
      />
      <AdminField
        name="routePath"
        label={labels.routePath}
        defaultValue={page.routePath}
        dir="ltr"
      />
      <AdminSelect
        name="template"
        label={labels.template}
        placeholder={labels.choose}
        defaultValue={page.template}
        options={templates.map((id) => ({ id, label: id }))}
      />
      <AdminField
        name="sortOrder"
        label={labels.sortOrder}
        type="number"
        min="0"
        defaultValue={page.sortOrder}
      />
    </AdminForm>
  );
}

export function PageTranslationForm({
  pageId,
  locale,
  value,
  labels,
}: {
  pageId: string;
  locale: "en" | "ar";
  value: {
    title: string;
    h1: string | null;
    summary: string | null;
    bodyMarkdown: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  } | null;
  labels: {
    title: string;
    h1: string;
    summary: string;
    body: string;
    seoTitle: string;
    seoDescription: string;
    submit: string;
    pending: string;
  };
}) {
  // Arabic fields read right-to-left even while the Admin itself is English,
  // so an editor sees the text as a reader will.
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <AdminForm
      action={savePageTranslationAction}
      submitLabel={labels.submit}
      pendingLabel={labels.pending}
      className="grid gap-4"
    >
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="locale" value={locale} />
      <AdminField
        name="title"
        label={labels.title}
        defaultValue={value?.title ?? ""}
        dir={dir}
      />
      <AdminField
        name="h1"
        label={labels.h1}
        defaultValue={value?.h1 ?? ""}
        dir={dir}
      />
      <AdminTextarea
        name="summary"
        label={labels.summary}
        defaultValue={value?.summary ?? ""}
        dir={dir}
        rows={3}
      />
      <AdminTextarea
        name="bodyMarkdown"
        label={labels.body}
        defaultValue={value?.bodyMarkdown ?? ""}
        dir={dir}
        rows={8}
      />
      <AdminField
        name="seoTitle"
        label={labels.seoTitle}
        defaultValue={value?.seoTitle ?? ""}
        dir={dir}
      />
      <AdminTextarea
        name="seoDescription"
        label={labels.seoDescription}
        defaultValue={value?.seoDescription ?? ""}
        dir={dir}
        rows={2}
      />
    </AdminForm>
  );
}

export function SectionSettingsForm({
  pageId,
  section,
  media,
  labels,
  typeOptions,
  entityOptions,
}: {
  pageId: string;
  section?: {
    id: string;
    sectionKey: string;
    sectionType: string;
    sortOrder: number;
    isVisible: boolean;
    mediaId: string | null;
    ctaHref: string | null;
    entityRef: string | null;
    entityLimit: number | null;
  };
  media: PickerItem[];
  labels: {
    sectionKey: string;
    sectionKeyHint: string;
    sectionType: string;
    sortOrder: string;
    visibility: string;
    visible: string;
    hidden: string;
    media: string;
    ctaHref: string;
    entityRef: string;
    entityLimit: string;
    submit: string;
    pending: string;
    choose: string;
  };
  typeOptions: { id: string; label: string }[];
  entityOptions: { id: string; label: string }[];
}) {
  /*
   * Which inputs this type uses, straight from the registry — so the editor
   * cannot offer a field the renderer will ignore.
   *
   * The type is tracked in state rather than read from `section`, because on
   * the "add a section" form the type is chosen in this very form. Deriving it
   * from an existing row meant the add form never showed the type-specific
   * fields at all, so an ENTITY_LIST could not be created with its feed and a
   * MEDIA_SPLIT could not be given its image in one step (finding N63).
   */
  const [sectionType, setSectionType] = useState(section?.sectionType ?? "");
  const definition = isSectionType(sectionType)
    ? SECTION_REGISTRY[sectionType]
    : undefined;
  const showMedia = definition ? definition.editor.media !== "hidden" : false;
  const showCta = definition ? definition.editor.cta !== "hidden" : false;
  const showEntity = definition?.editor.entity === "required";

  return (
    <AdminForm
      action={saveSectionAction}
      submitLabel={labels.submit}
      pendingLabel={labels.pending}
      className="grid gap-4 md:grid-cols-2"
    >
      <input type="hidden" name="pageId" value={pageId} />
      {section ? <input type="hidden" name="id" value={section.id} /> : null}

      <AdminField
        name="sectionKey"
        label={labels.sectionKey}
        hint={labels.sectionKeyHint}
        defaultValue={section?.sectionKey ?? ""}
        dir="ltr"
      />
      <AdminSelect
        name="sectionType"
        label={labels.sectionType}
        placeholder={labels.choose}
        value={sectionType}
        onValueChange={setSectionType}
        options={typeOptions}
      />
      <AdminField
        name="sortOrder"
        label={labels.sortOrder}
        type="number"
        min="0"
        defaultValue={section?.sortOrder ?? 0}
      />
      <AdminSelect
        name="isVisible"
        label={labels.visibility}
        placeholder={labels.choose}
        defaultValue={section ? String(section.isVisible) : "false"}
        options={[
          { id: "true", label: labels.visible },
          { id: "false", label: labels.hidden },
        ]}
      />

      {showMedia ? (
        <div className="grid gap-1.5 md:col-span-2">
          <span className="text-sm font-bold">{labels.media}</span>
          <MediaPicker
            name="mediaId"
            items={media}
            defaultValue={section?.mediaId ?? null}
          />
        </div>
      ) : null}

      {showCta ? (
        <AdminField
          name="ctaHref"
          label={labels.ctaHref}
          defaultValue={section?.ctaHref ?? ""}
          dir="ltr"
        />
      ) : null}

      {showEntity ? (
        <>
          <AdminSelect
            name="entityRef"
            label={labels.entityRef}
            placeholder={labels.choose}
            defaultValue={section?.entityRef ?? null}
            options={entityOptions}
          />
          <AdminField
            name="entityLimit"
            label={labels.entityLimit}
            type="number"
            min="1"
            defaultValue={section?.entityLimit ?? ""}
          />
        </>
      ) : null}
    </AdminForm>
  );
}

export function SectionTranslationForm({
  sectionId,
  sectionType,
  locale,
  value,
  labels,
}: {
  sectionId: string;
  sectionType: string;
  locale: "en" | "ar";
  value: AdminSectionTranslation | null;
  labels: {
    heading: string;
    subheading: string;
    body: string;
    ctaLabel: string;
    submit: string;
    pending: string;
  };
}) {
  const t = useTranslations("admin.cms");
  // An unrecognised type yields no definition, so the editor degrades to its
  // base fields rather than throwing.
  const definition = isSectionType(sectionType)
    ? SECTION_REGISTRY[sectionType]
    : undefined;
  const dir = locale === "ar" ? "rtl" : "ltr";
  // The body convention this type expects, shown where the Admin types it.
  const bodyHint = definition?.bodyHintKey
    ? t(definition.bodyHintKey as Parameters<typeof t>[0])
    : undefined;

  return (
    <AdminForm
      action={saveSectionTranslationAction}
      submitLabel={labels.submit}
      pendingLabel={labels.pending}
      className="grid gap-4"
    >
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="locale" value={locale} />
      <AdminField
        name="heading"
        label={labels.heading}
        defaultValue={value?.heading ?? ""}
        dir={dir}
      />
      <AdminField
        name="subheading"
        label={labels.subheading}
        defaultValue={value?.subheading ?? ""}
        dir={dir}
      />
      {definition?.editor.body !== "hidden" ? (
        <AdminTextarea
          name="bodyMarkdown"
          label={labels.body}
          hint={bodyHint}
          defaultValue={value?.bodyMarkdown ?? ""}
          dir={dir}
          rows={8}
        />
      ) : null}
      {definition?.editor.cta !== "hidden" ? (
        <AdminField
          name="ctaLabel"
          label={labels.ctaLabel}
          defaultValue={value?.ctaLabel ?? ""}
          dir={dir}
        />
      ) : null}
    </AdminForm>
  );
}
