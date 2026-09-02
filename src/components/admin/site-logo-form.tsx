"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { setSiteLogoAction } from "@/actions/admin-branding";
import { MediaPicker, type PickerItem } from "@/components/admin/media-picker";
import { fieldErrorsOf, idleActionState, settled } from "@/lib/actions";

/**
 * Choosing the project logo (P8-T02).
 *
 * The picker is the same one every other consumer uses, and clearing the
 * selection is a first-class action rather than an afterthought: it is how an
 * Administrator recovers when a chosen logo turns out to be wrong, and it is
 * what puts the official Hills Coffee artwork back.
 */
export function SiteLogoForm({
  media,
  currentMediaId,
  currentPreviewUrl,
}: {
  media: PickerItem[];
  currentMediaId: string | null;
  currentPreviewUrl: string | null;
}) {
  const t = useTranslations("admin.branding");
  const responses = useTranslations("admin.responses");
  const [state, action, pending] = useActionState(
    setSiteLogoAction,
    idleActionState,
  );
  const outcome = settled(state);
  const errors = fieldErrorsOf(state);

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl">{t("logoTitle")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {t("logoIntro")}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <span className="text-sm font-bold">{t("logoCurrent")}</span>
        <span className="inline-flex items-center rounded-xl bg-[#eee4d1] px-3 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- a stored
              object can be missing; the optimizer would turn that into its own
              error response. */}
          <img
            src={currentPreviewUrl ?? "/images/logo-mark.png"}
            alt=""
            className="h-9 w-auto"
          />
        </span>
        {!currentMediaId ? (
          <span className="text-sm text-muted-foreground">
            {t("logoOfficial")}
          </span>
        ) : null}
      </div>

      <form action={action} noValidate className="mt-6 grid gap-4">
        <MediaPicker
          name="mediaId"
          items={media}
          defaultValue={currentMediaId}
          invalid={Boolean(errors?.mediaId?.length)}
          describedBy={errors?.mediaId?.length ? "logo-error" : undefined}
        />
        {errors?.mediaId?.length ? (
          <span
            id="logo-error"
            className="flex items-start gap-1.5 text-xs font-medium text-destructive"
          >
            <span aria-hidden="true">⚠</span>
            {responses(errors.mediaId[0] as Parameters<typeof responses>[0])}
          </span>
        ) : null}

        {outcome && !errors ? (
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

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="h-11 min-h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {t("logoSave")}
          </button>
          {/* A distinct submitter, not an empty `mediaId`: the picker already
              contributes a `mediaId` field earlier in the form, and FormData
              would hand the action that one instead of this button's. */}
          <button
            type="submit"
            name="clearLogo"
            value="true"
            disabled={pending}
            className="h-11 min-h-11 rounded-full border border-border px-6 text-sm font-bold transition hover:border-gold disabled:opacity-60"
          >
            {t("logoClear")}
          </button>
        </div>
      </form>
    </section>
  );
}
