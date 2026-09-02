"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import {
  archiveMediaAction,
  deleteMediaAction,
  restoreMediaAction,
  updateMediaTranslationsAction,
} from "@/actions/admin-media";
import type { MediaReference } from "@/lib/data/media-library";
import {
  fieldErrorsOf,
  idleActionState,
  settled,
  type ActionResult,
} from "@/lib/actions";

/**
 * Archive, restore, delete and alt-text editing for one media item.
 *
 * The archive control is the reason this component exists (FR-048). Archiving
 * is a soft delete, so no foreign key protects the content that depends on the
 * image: the first attempt on a referenced item is refused by the server and
 * the Admin is shown exactly what would be affected before confirming.
 *
 * The confirmation is deliberately a second, differently-labelled button
 * rather than a checkbox that could be left ticked from a previous item.
 */
/** One settled result, rendered as the right kind of live region. */
function Outcome({
  result,
  copy,
}: {
  result: ActionResult | null;
  copy: (key?: string) => string;
}) {
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={`rounded-xl p-3 text-sm ${
        result.ok
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {copy(result.messageKey)}
    </p>
  );
}

export function MediaActions({
  mediaId,
  archived,
  references,
  altEn,
  altAr,
  captionEn,
  captionAr,
}: {
  mediaId: string;
  archived: boolean;
  references: MediaReference[];
  altEn: string | null;
  altAr: string | null;
  captionEn: string | null;
  captionAr: string | null;
}) {
  const t = useTranslations("admin.media");
  const responses = useTranslations("admin.responses");
  const copy = (key?: string) =>
    key ? responses(key as Parameters<typeof responses>[0]) : "";

  const [values, setValues] = useState({
    altEn: altEn ?? "",
    altAr: altAr ?? "",
    captionEn: captionEn ?? "",
    captionAr: captionAr ?? "",
  });
  const bind = (field: keyof typeof values) => ({
    value: values[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value })),
  });

  const [altState, altAction, altPending] = useActionState(
    updateMediaTranslationsAction,
    idleActionState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveMediaAction,
    idleActionState,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreMediaAction,
    idleActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteMediaAction,
    idleActionState,
  );

  const altOutcome = settled(altState);
  const altErrors = fieldErrorsOf(altState);
  const archiveOutcome = settled(archiveState);
  // The server refuses the first attempt on a referenced item; the confirming
  // button appears only after that refusal.
  const needsConfirmation =
    archiveOutcome && !archiveOutcome.ok && archiveOutcome.code === "CONFLICT";

  return (
    <div className="grid gap-6">
      {/* ---------------------------------------------------- alt text --- */}
      <form action={altAction} noValidate className="grid gap-4">
        <input type="hidden" name="mediaId" value={mediaId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold">
            {t("altEn")}
            <input
              name="altEn"
              dir="ltr"
              {...bind("altEn")}
              aria-invalid={Boolean(altErrors?.altEn?.length) || undefined}
              aria-describedby={
                altErrors?.altEn?.length ? "alt-en-error" : undefined
              }
              className="h-11 rounded-lg border border-input bg-background px-3 font-normal"
            />
            {altErrors?.altEn?.length ? (
              <span
                id="alt-en-error"
                className="flex items-start gap-1.5 text-xs font-medium text-destructive"
              >
                <span aria-hidden="true">⚠</span>
                {copy(altErrors.altEn[0])}
              </span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            {t("altAr")}
            <input
              name="altAr"
              dir="rtl"
              {...bind("altAr")}
              className="h-11 rounded-lg border border-input bg-background px-3 font-normal"
            />
            {!values.altAr.trim() ? (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {t("missingArabicAlt")}
              </span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            {t("captionEn")}
            <input
              name="captionEn"
              dir="ltr"
              {...bind("captionEn")}
              className="h-11 rounded-lg border border-input bg-background px-3 font-normal"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            {t("captionAr")}
            <input
              name="captionAr"
              dir="rtl"
              {...bind("captionAr")}
              className="h-11 rounded-lg border border-input bg-background px-3 font-normal"
            />
          </label>
        </div>
        <Outcome result={altOutcome} copy={copy} />
        <button
          type="submit"
          disabled={altPending}
          aria-busy={altPending}
          className="h-11 min-h-11 justify-self-start rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {t("saveAlt")}
        </button>
      </form>

      {/* The lifecycle outcomes live here, outside the archived/active
          branch below. Restoring an item removes the very form that
          triggered it, so a message nested inside would disappear at the
          moment it was needed — the same failure as the Lead Inbox's final
          transition (finding N48). */}
      <Outcome result={settled(restoreState)} copy={copy} />
      <Outcome result={settled(deleteState)} copy={copy} />
      {archiveOutcome && !needsConfirmation ? (
        <Outcome result={archiveOutcome} copy={copy} />
      ) : null}

      {/* --------------------------------------------- archive / restore --- */}
      {archived ? (
        <div className="grid gap-3 rounded-2xl border border-border p-5">
          <form action={restoreAction}>
            <input type="hidden" name="mediaId" value={mediaId} />
            <button
              type="submit"
              disabled={restorePending}
              aria-busy={restorePending}
              className="h-11 min-h-11 rounded-full border border-border px-6 text-sm font-bold transition hover:border-gold disabled:opacity-60"
            >
              {t("restore")}
            </button>
          </form>

          <div className="mt-2 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {t("deleteWarning")}
            </p>
            <form action={deleteAction} className="mt-3">
              <input type="hidden" name="mediaId" value={mediaId} />
              <button
                type="submit"
                disabled={deletePending}
                aria-busy={deletePending}
                className="h-11 min-h-11 rounded-full border border-destructive/40 px-6 text-sm font-bold text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
              >
                {t("deleteForever")}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form
          action={archiveAction}
          className="grid gap-3 rounded-2xl border border-border p-5"
        >
          <input type="hidden" name="mediaId" value={mediaId} />
          {/* Set only once the server has already refused and listed what
              depends on this item. */}
          <input
            type="hidden"
            name="confirmed"
            value={needsConfirmation ? "true" : "false"}
          />

          {needsConfirmation ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="flex items-start gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4" aria-hidden="true" />
                {t("archiveWarning")}
              </p>
              <ul className="mt-3 grid gap-1 text-sm text-amber-900 dark:text-amber-200">
                {references.map((reference, index) => (
                  <li key={`${reference.kind}-${index}`}>
                    <strong>
                      {t(
                        `usage${reference.kind[0].toUpperCase()}${reference.kind.slice(1)}` as Parameters<
                          typeof t
                        >[0],
                      )}
                    </strong>
                    {reference.label ? `: ${reference.label}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={archivePending}
            aria-busy={archivePending}
            className={`inline-flex h-11 min-h-11 items-center justify-center gap-2 justify-self-start rounded-full px-6 text-sm font-bold transition disabled:opacity-60 ${
              needsConfirmation
                ? "bg-destructive text-destructive-foreground"
                : "border border-border hover:border-destructive"
            }`}
          >
            {archivePending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {needsConfirmation ? t("archiveConfirm") : t("archive")}
          </button>
        </form>
      )}
    </div>
  );
}
