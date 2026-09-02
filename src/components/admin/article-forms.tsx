"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import {
  saveArticleAction,
  setArticleStatusAction,
} from "@/actions/admin-articles";
import {
  AdminField,
  AdminForm,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-form";
import { MediaPicker, type PickerItem } from "@/components/admin/media-picker";
import { idleActionState, settled } from "@/lib/actions";
import { useTranslations } from "next-intl";

/**
 * The article editor.
 *
 * Both languages sit in one form because `article_translations` makes `slug`
 * and `title` NOT NULL per locale — an article cannot exist in one language
 * only, so splitting them would just produce a form that always fails.
 *
 * The featured image comes from the shared media picker, never from a pasted
 * URL: `articles.featured_media_id` is the relation the schema provides, and
 * an image outside the library could not be archived, alt-texted or audited.
 */
export function ArticleForm({
  article,
  categories,
  media,
  labels,
}: {
  article?: {
    id: string;
    categoryId: string | null;
    featuredMediaId: string | null;
    status: string;
    isFeatured: boolean;
    translations: Record<
      "en" | "ar",
      {
        slug: string;
        title: string;
        excerpt: string | null;
        bodyMarkdown: string | null;
      } | null
    >;
  };
  categories: { id: string; label: string }[];
  media: PickerItem[];
  labels: {
    english: string;
    arabic: string;
    slug: string;
    title: string;
    excerpt: string;
    body: string;
    category: string;
    chooseCategory: string;
    choose: string;
    noCategories: string;
    featuredMedia: string;
    status: string;
    isFeatured: string;
    yes: string;
    no: string;
    statusDraft: string;
    statusPublished: string;
    statusArchived: string;
    submit: string;
    pending: string;
  };
}) {
  const en = article?.translations.en ?? null;
  const ar = article?.translations.ar ?? null;

  return (
    <AdminForm
      action={saveArticleAction}
      submitLabel={labels.submit}
      pendingLabel={labels.pending}
      className="grid gap-6"
    >
      {article ? <input type="hidden" name="id" value={article.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <AdminSelect
          name="categoryId"
          label={labels.category}
          placeholder={labels.chooseCategory}
          defaultValue={article?.categoryId ?? null}
          options={categories}
          optional
          emptyMessage={labels.noCategories}
        />
        <AdminSelect
          name="status"
          label={labels.status}
          placeholder={labels.choose}
          defaultValue={article?.status ?? "DRAFT"}
          options={[
            { id: "DRAFT", label: labels.statusDraft },
            { id: "PUBLISHED", label: labels.statusPublished },
            { id: "ARCHIVED", label: labels.statusArchived },
          ]}
        />
        <AdminSelect
          name="isFeatured"
          label={labels.isFeatured}
          placeholder={labels.choose}
          defaultValue={article ? String(article.isFeatured) : "false"}
          options={[
            { id: "false", label: labels.no },
            { id: "true", label: labels.yes },
          ]}
        />
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-bold">{labels.featuredMedia}</span>
        <MediaPicker
          name="featuredMediaId"
          items={media}
          defaultValue={article?.featuredMediaId ?? null}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <fieldset className="grid gap-4 rounded-2xl border border-border p-5">
          <legend className="px-2 text-sm font-bold">{labels.english}</legend>
          <AdminField
            name="slugEn"
            label={labels.slug}
            defaultValue={en?.slug ?? ""}
            dir="ltr"
          />
          <AdminField
            name="titleEn"
            label={labels.title}
            defaultValue={en?.title ?? ""}
            dir="ltr"
          />
          <AdminTextarea
            name="excerptEn"
            label={labels.excerpt}
            defaultValue={en?.excerpt ?? ""}
            dir="ltr"
            rows={3}
          />
          <AdminTextarea
            name="bodyEn"
            label={labels.body}
            defaultValue={en?.bodyMarkdown ?? ""}
            dir="ltr"
            rows={12}
          />
        </fieldset>

        <fieldset className="grid gap-4 rounded-2xl border border-border p-5">
          <legend className="px-2 text-sm font-bold">{labels.arabic}</legend>
          <AdminField
            name="slugAr"
            label={labels.slug}
            defaultValue={ar?.slug ?? ""}
            dir="ltr"
          />
          <AdminField
            name="titleAr"
            label={labels.title}
            defaultValue={ar?.title ?? ""}
            dir="rtl"
          />
          <AdminTextarea
            name="excerptAr"
            label={labels.excerpt}
            defaultValue={ar?.excerpt ?? ""}
            dir="rtl"
            rows={3}
          />
          <AdminTextarea
            name="bodyAr"
            label={labels.body}
            defaultValue={ar?.bodyMarkdown ?? ""}
            dir="rtl"
            rows={12}
          />
        </fieldset>
      </div>
    </AdminForm>
  );
}

/** Publish, unpublish and archive, offering only what the state allows. */
export function ArticleStatusControls({
  articleId,
  status,
  labels,
}: {
  articleId: string;
  status: string;
  labels: { publish: string; unpublish: string; archive: string };
}) {
  const responses = useTranslations("admin.responses");
  const [state, action, pending] = useActionState(
    setArticleStatusAction,
    idleActionState,
  );
  const outcome = settled(state);

  const options =
    status === "PUBLISHED"
      ? [
          { value: "DRAFT", label: labels.unpublish, primary: false },
          { value: "ARCHIVED", label: labels.archive, primary: false },
        ]
      : status === "ARCHIVED"
        ? [{ value: "DRAFT", label: labels.unpublish, primary: true }]
        : [
            { value: "PUBLISHED", label: labels.publish, primary: true },
            { value: "ARCHIVED", label: labels.archive, primary: false },
          ];

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={articleId} />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="submit"
            name="status"
            value={option.value}
            disabled={pending}
            aria-busy={pending}
            className={`inline-flex h-11 min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition disabled:opacity-60 ${
              option.primary
                ? "bg-primary text-primary-foreground hover:bg-forest-light"
                : "border border-border hover:border-gold"
            }`}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {option.label}
          </button>
        ))}
      </div>
      {outcome ? (
        <p
          role={outcome.ok ? "status" : "alert"}
          className={`rounded-xl p-3 text-sm ${
            outcome.ok
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {responses(outcome.messageKey as Parameters<typeof responses>[0])}
        </p>
      ) : null}
    </form>
  );
}
