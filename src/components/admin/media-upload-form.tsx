"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { uploadMediaAction, type UploadedMedia } from "@/actions/admin-media";
import {
  fieldErrorsOf,
  idleActionState,
  settled,
  type ActionFormState,
  type FieldErrors,
} from "@/lib/actions";

/**
 * The Media Library's own upload form.
 *
 * Same action as the picker's inline upload, so there is one ingest path. The
 * validation quality established in Phase 6 applies: errors appear under the
 * field that caused them, values the Admin typed survive a rejection, and no
 * native browser bubble is the final word.
 */
/** The inline error for one field, rendered directly beneath it. */
function FieldError({
  name,
  errors,
  copy,
}: {
  name: string;
  errors: FieldErrors | undefined;
  copy: (key?: string) => string;
}) {
  if (!errors?.[name]?.length) return null;
  return (
    <span
      id={`media-${name}-error`}
      className="flex items-start gap-1.5 text-xs font-medium text-destructive"
    >
      <span aria-hidden="true">⚠</span>
      {copy(errors[name]![0])}
    </span>
  );
}

export function MediaUploadForm() {
  const t = useTranslations("admin.media");
  const responses = useTranslations("admin.responses");
  const [alt, setAlt] = useState({ en: "", ar: "" });
  const [state, action, pending] = useActionState(
    uploadMediaAction,
    idleActionState as ActionFormState<UploadedMedia>,
  );
  const outcome = settled(state);
  const errors = fieldErrorsOf(state);
  const copy = (key?: string) =>
    key ? responses(key as Parameters<typeof responses>[0]) : "";

  return (
    <form
      action={action}
      noValidate
      className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-2"
    >
      <h2 className="text-xl md:col-span-2">{t("uploadTitle")}</h2>

      {/* Label, control, hint and error are siblings, not children of the
          label: text inside a label becomes part of the control's accessible
          *name*, so an inline error would rename the field rather than
          describe it. `aria-describedby` is what carries it. */}
      <div className="grid gap-1.5 md:col-span-2">
        <label htmlFor="media-file" className="text-sm font-bold">
          {t("file")}
        </label>
        <input
          id="media-file"
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={Boolean(errors?.file?.length) || undefined}
          aria-describedby={`media-file-hint${
            errors?.file?.length ? " media-file-error" : ""
          }`}
          className="rounded-lg border border-input bg-background p-2 font-normal"
        />
        <span
          id="media-file-hint"
          className="text-xs font-normal text-muted-foreground"
        >
          {t("fileHint")}
        </span>
        <FieldError name="file" errors={errors} copy={copy} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="media-altEn" className="text-sm font-bold">
          {t("altEn")}
        </label>
        <input
          id="media-altEn"
          name="altEn"
          dir="ltr"
          value={alt.en}
          onChange={(event) =>
            setAlt((current) => ({ ...current, en: event.target.value }))
          }
          aria-invalid={Boolean(errors?.altEn?.length) || undefined}
          aria-describedby={
            errors?.altEn?.length ? "media-altEn-error" : undefined
          }
          className="h-11 rounded-lg border border-input bg-background px-3 font-normal"
        />
        <FieldError name="altEn" errors={errors} copy={copy} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="media-altAr" className="text-sm font-bold">
          {t("altAr")}
        </label>
        <input
          id="media-altAr"
          name="altAr"
          dir="rtl"
          value={alt.ar}
          onChange={(event) =>
            setAlt((current) => ({ ...current, ar: event.target.value }))
          }
          className="h-11 rounded-lg border border-input bg-background px-3 font-normal"
        />
      </div>

      <p className="text-xs text-muted-foreground md:col-span-2">
        {t("altHint")}
      </p>

      {outcome && !outcome.ok && !errors ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive md:col-span-2"
        >
          {copy(outcome.messageKey)}
        </p>
      ) : null}
      {outcome?.ok ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 md:col-span-2 dark:text-emerald-300"
        >
          {copy(outcome.messageKey)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="h-11 min-h-11 justify-self-start rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {t("upload")}
      </button>
    </form>
  );
}
