"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  submitPublicRfq,
  submitPublicSampleRequest,
} from "@/actions/public-inquiries";
import { Link } from "@/i18n/navigation";
import {
  fieldErrorsOf,
  idleActionState,
  settled,
  type ActionFormState,
  type FieldErrors,
} from "@/lib/actions";

/**
 * The two anonymous submission forms.
 *
 * Both live here rather than in two files because they are the same form
 * with a different field set and a different action — splitting them would
 * duplicate the field primitives, the error plumbing and the success panel
 * for no benefit. The signed-in `RequestQuoteForm` is untouched and still
 * owns the authenticated path; these are what a visitor with no session
 * sees instead.
 *
 * Everything the visitor reads resolves through the message catalogue, and
 * every value is controlled so a rejected submission keeps what was typed.
 */

type Created = { requestCode: string };

const inputClass =
  "h-12 w-full rounded-xl border border-input bg-background px-4 font-normal text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20";

/** One labelled field, with its error bound to it for assistive technology. */
function Field({
  id,
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  hint,
  dir,
  inputRef,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  dir?: "ltr" | "rtl";
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="grid gap-2 text-sm font-bold">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        ref={inputRef}
        name={name}
        type={type}
        dir={dir}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={`${inputClass} ${error ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
      />
      {hint ? (
        <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          {/* A glyph as well as colour, so the error never relies on colour alone. */}
          <span aria-hidden="true">⚠</span>
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** The hidden field a person never fills in and a script usually does. */
function Honeypot() {
  return (
    <input
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="absolute -start-[9999px]"
    />
  );
}

/** What the visitor sees once the database has confirmed the write. */
function SuccessPanel({
  message,
  requestCode,
}: {
  message: string;
  requestCode?: string;
}) {
  const t = useTranslations("publicInquiry");
  return (
    <div
      role="status"
      className="grid gap-4 rounded-[1.5rem] border border-border bg-card p-7"
    >
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        {t("successTitle")}
      </p>
      <p className="text-sm text-muted-foreground">{message}</p>
      {requestCode ? (
        <p className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("referenceLabel")}
          </span>
          {/* A request code is an identifier: it stays LTR inside RTL. */}
          <span dir="ltr" className="font-mono text-xl font-bold">
            {requestCode}
          </span>
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t("keepReference")}</p>
      <p className="text-xs text-muted-foreground">
        {t("signedInHint")}{" "}
        <Link
          href="/sign-in"
          className="font-bold underline underline-offset-2 hover:text-foreground"
        >
          {t("signedInCta")}
        </Link>
      </p>
    </div>
  );
}

type Values = Record<string, string>;

function useFormPlumbing(initial: Values) {
  const [values, setValues] = useState<Values>(initial);
  const bind = (field: string) => ({
    value: values[field] ?? "",
    onChange: (next: string) =>
      setValues((current) => ({ ...current, [field]: next })),
  });
  return { values, bind };
}

/**
 * Moves focus to the first field the server rejected.
 *
 * The same courtesy the Admin forms already extend — a rejection three
 * fields down is easy to miss otherwise, particularly on a phone.
 */
function useFocusFirstInvalid(
  errors: FieldErrors | undefined,
  order: string[],
  formRef: React.RefObject<HTMLFormElement | null>,
) {
  useEffect(() => {
    if (!errors) return;
    const first = order.find((field) => errors[field]?.length);
    if (!first) return;
    formRef.current
      ?.querySelector<HTMLInputElement>(`[name="${first}"]`)
      ?.focus();
  }, [errors, order, formRef]);
}

// ================================================== GENERAL RFQ

export function PublicRfqForm() {
  const t = useTranslations("publicInquiry");
  const responses = useTranslations("account.responses");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    submitPublicRfq,
    idleActionState as ActionFormState<Created>,
  );
  const outcome = settled(state);
  const errors = fieldErrorsOf(state);
  const { bind } = useFormPlumbing({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    subject: "",
    message: "",
  });

  useFocusFirstInvalid(
    errors,
    ["fullName", "email", "phone", "companyName", "subject", "message"],
    formRef,
  );

  const copy = (key?: string) =>
    key ? responses(key as Parameters<typeof responses>[0]) : "";
  const fieldError = (name: string) =>
    errors?.[name]?.length ? copy(errors[name]![0]) : undefined;

  if (outcome?.ok)
    return (
      <SuccessPanel
        message={copy(outcome.messageKey)}
        requestCode={outcome.data?.requestCode}
      />
    );

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="grid gap-5 rounded-[1.5rem] border border-border bg-card p-7"
    >
      <Honeypot />
      <Field
        id="rfq-full-name"
        label={t("fullName")}
        name="fullName"
        autoComplete="name"
        error={fieldError("fullName")}
        {...bind("fullName")}
      />
      <Field
        id="rfq-email"
        label={t("email")}
        name="email"
        type="email"
        dir="ltr"
        autoComplete="email"
        error={fieldError("email")}
        {...bind("email")}
      />
      <Field
        id="rfq-phone"
        label={t("phone")}
        name="phone"
        type="tel"
        dir="ltr"
        autoComplete="tel"
        error={fieldError("phone")}
        {...bind("phone")}
      />
      <Field
        id="rfq-company"
        label={t("companyOptional")}
        name="companyName"
        autoComplete="organization"
        error={fieldError("companyName")}
        {...bind("companyName")}
      />
      <Field
        id="rfq-subject"
        label={t("subject")}
        name="subject"
        error={fieldError("subject")}
        {...bind("subject")}
      />

      <div className="grid gap-2 text-sm font-bold">
        <label htmlFor="rfq-message">{t("message")}</label>
        <textarea
          id="rfq-message"
          name="message"
          rows={6}
          value={bind("message").value}
          onChange={(event) => bind("message").onChange(event.target.value)}
          aria-invalid={Boolean(fieldError("message")) || undefined}
          aria-describedby={
            [
              fieldError("message") ? "rfq-message-error" : null,
              "rfq-message-hint",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={`rounded-xl border border-input bg-background p-4 font-normal text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 ${fieldError("message") ? "border-destructive" : ""}`}
        />
        <span
          id="rfq-message-hint"
          className="text-xs font-normal text-muted-foreground"
        >
          {t("messageHint")}
        </span>
        {fieldError("message") ? (
          <span
            id="rfq-message-error"
            className="flex items-start gap-1.5 text-xs font-medium text-destructive"
          >
            <span aria-hidden="true">⚠</span>
            {fieldError("message")}
          </span>
        ) : null}
      </div>

      {outcome && !outcome.ok ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {copy(outcome.messageKey)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-12 min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}

// ================================================== SAMPLE REQUEST

export function PublicSampleRequestForm({ offerId }: { offerId: string }) {
  const t = useTranslations("publicInquiry");
  const responses = useTranslations("account.responses");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    submitPublicSampleRequest,
    idleActionState as ActionFormState<Created>,
  );
  const outcome = settled(state);
  const errors = fieldErrorsOf(state);
  const { bind } = useFormPlumbing({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    address: "",
    countryCode: "",
    message: "",
  });

  useFocusFirstInvalid(
    errors,
    ["fullName", "email", "phone", "address", "countryCode", "message"],
    formRef,
  );

  const copy = (key?: string) =>
    key ? responses(key as Parameters<typeof responses>[0]) : "";
  const fieldError = (name: string) =>
    errors?.[name]?.length ? copy(errors[name]![0]) : undefined;

  if (outcome?.ok)
    return (
      <SuccessPanel
        message={copy(outcome.messageKey)}
        requestCode={outcome.data?.requestCode}
      />
    );

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-4">
      <Honeypot />
      <input type="hidden" name="offerId" value={offerId} />
      <ol className="grid gap-2 rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground">
        {[t("sampleStep1"), t("sampleStep2"), t("sampleStep3")].map(
          (step, index) => (
            <li key={step} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="font-mono font-bold text-highlight"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="leading-5">{step}</span>
            </li>
          ),
        )}
      </ol>
      <Field
        id="sample-full-name"
        label={t("fullName")}
        name="fullName"
        autoComplete="name"
        error={fieldError("fullName")}
        {...bind("fullName")}
      />
      <Field
        id="sample-email"
        label={t("email")}
        name="email"
        type="email"
        dir="ltr"
        autoComplete="email"
        error={fieldError("email")}
        {...bind("email")}
      />
      <Field
        id="sample-phone"
        label={t("phone")}
        name="phone"
        type="tel"
        dir="ltr"
        autoComplete="tel"
        error={fieldError("phone")}
        {...bind("phone")}
      />
      <Field
        id="sample-company"
        label={t("companyOptional")}
        name="companyName"
        autoComplete="organization"
        error={fieldError("companyName")}
        {...bind("companyName")}
      />
      <Field
        id="sample-address"
        label={t("address")}
        name="address"
        autoComplete="street-address"
        error={fieldError("address")}
        {...bind("address")}
      />
      <Field
        id="sample-country"
        label={t("country")}
        name="countryCode"
        dir="ltr"
        autoComplete="country"
        hint={t("countryHint")}
        error={fieldError("countryCode")}
        {...bind("countryCode")}
      />

      <div className="grid gap-2 text-sm font-bold">
        <label htmlFor="sample-message">{t("message")}</label>
        <textarea
          id="sample-message"
          name="message"
          rows={4}
          value={bind("message").value}
          onChange={(event) => bind("message").onChange(event.target.value)}
          aria-invalid={Boolean(fieldError("message")) || undefined}
          aria-describedby={
            fieldError("message") ? "sample-message-error" : undefined
          }
          className={`rounded-xl border border-input bg-background p-4 font-normal text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 ${fieldError("message") ? "border-destructive" : ""}`}
        />
        {fieldError("message") ? (
          <span
            id="sample-message-error"
            className="flex items-start gap-1.5 text-xs font-medium text-destructive"
          >
            <span aria-hidden="true">⚠</span>
            {fieldError("message")}
          </span>
        ) : null}
      </div>

      {outcome && !outcome.ok ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {copy(outcome.messageKey)}
          {outcome.conflict?.requestCode ? (
            <>
              {" "}
              <span dir="ltr" className="font-mono font-bold">
                {outcome.conflict.requestCode}
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-12 min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
