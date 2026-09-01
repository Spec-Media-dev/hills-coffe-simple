"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { createProductInquiry } from "@/actions/inquiries";
import { Link } from "@/i18n/navigation";
import {
  fieldErrorsOf,
  idleActionState,
  settled,
  type ActionFormState,
} from "@/lib/actions";

type Created = { requestCode: string };

/**
 * Standalone product-inquiry form on the request-a-quote page.
 *
 * Shares the action, and therefore the authorization, profile-completeness and
 * trusted-offer rules, with the coffee-detail dialog. Copy is resolved from
 * the message catalogue rather than a `locale === "ar"` table, so a new string
 * cannot be added in one language only.
 */
export function RequestQuoteForm({
  offers,
}: {
  offers: { id: string; label: string }[];
}) {
  const t = useTranslations("account.responses");
  const quote = useTranslations("quote");
  const requests = useTranslations("account.requests");
  // Controlled, so a rejected submission does not wipe the form. See the note
  // in `inquiry-panel.tsx`.
  const [values, setValues] = useState({
    offerId: "",
    subject: "",
    message: "",
  });
  const bind = (field: keyof typeof values) => ({
    value: values[field],
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => setValues((current) => ({ ...current, [field]: event.target.value })),
  });
  const [state, action, pending] = useActionState(
    createProductInquiry,
    idleActionState as ActionFormState<Created>,
  );

  const outcome = settled(state);
  const errors = fieldErrorsOf(state);
  const copy = (key?: string) => (key ? t(key as Parameters<typeof t>[0]) : "");
  const requestCode = outcome?.ok ? outcome.data?.requestCode : undefined;

  const fieldError = (name: string) =>
    errors?.[name]?.length ? (
      <span className="flex items-start gap-1.5 text-xs font-medium text-destructive">
        <span aria-hidden="true">⚠</span>
        {copy(errors[name]![0])}
      </span>
    ) : null;

  return (
    <form
      action={action}
      noValidate
      className="grid gap-5 rounded-[1.5rem] border border-border bg-card p-7"
    >
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -start-[9999px]"
      />

      <label className="grid gap-2 text-sm font-bold">
        {quote("offer")}
        <select
          name="offerId"
          {...bind("offerId")}
          aria-invalid={Boolean(errors?.offerId?.length) || undefined}
          className="h-12 rounded-xl border border-input bg-background px-4 font-normal"
        >
          <option value="">{quote("choose")}</option>
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.label}
            </option>
          ))}
        </select>
        {fieldError("offerId")}
      </label>

      <label className="grid gap-2 text-sm font-bold">
        {quote("subject")}
        <input
          name="subject"
          {...bind("subject")}
          maxLength={160}
          className="h-12 rounded-xl border border-input bg-background px-4 font-normal"
        />
        {fieldError("subject")}
      </label>

      <label className="grid gap-2 text-sm font-bold">
        {quote("message")}
        <textarea
          name="message"
          {...bind("message")}
          rows={6}
          aria-invalid={Boolean(errors?.message?.length) || undefined}
          className="rounded-xl border border-input bg-background p-4 font-normal"
        />
        {fieldError("message")}
      </label>

      {outcome && !outcome.ok ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {copy(outcome.messageKey)}
          {errors?.phone || errors?.address || errors?.country ? (
            <>
              {" "}
              <Link
                href="/account/settings"
                className="font-bold underline underline-offset-2"
              >
                {requests("completeProfile")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {outcome?.ok ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {copy(outcome.messageKey)}{" "}
          {/* Request codes are identifiers and stay LTR inside RTL. */}
          <span dir="ltr" className="font-bold">
            {requestCode}
          </span>{" "}
          <Link
            href={`/account/requests/${requestCode}`}
            className="font-bold underline underline-offset-2"
          >
            {requests("viewRequest")}
          </Link>
        </p>
      ) : null}

      {outcome?.ok ? null : (
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="h-12 min-h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground disabled:opacity-60"
        >
          {quote("send")}
        </button>
      )}
    </form>
  );
}
