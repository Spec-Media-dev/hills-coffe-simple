"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminSignInAction,
  forgotPasswordAction,
  resendVerificationAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/actions/auth";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  fieldErrorsOf,
  idleActionState,
  isIdle,
  settled,
  type ActionFormState,
  type ActionResult,
} from "@/lib/actions";

type Labels = Record<string, string>;
type AuthAction = (
  state: ActionFormState,
  data: FormData,
) => Promise<ActionResult>;

const translated = (
  t: ReturnType<typeof useTranslations<"auth.responses">>,
  key: string,
) => t(key as Parameters<typeof t>[0]);

function StateMessage({
  state,
  locale,
}: {
  state: ActionFormState;
  locale: Locale;
}) {
  const t = useTranslations("auth.responses");
  const result = settled(state);
  if (!result?.messageKey) return null;
  return (
    <div
      role={result.ok ? "status" : "alert"}
      className={`rounded-xl p-3 text-sm ${result.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}
    >
      <p>{translated(t, result.messageKey)}</p>
      {!result.ok && result.code === "ADMIN_PORTAL_REQUIRED" ? (
        <Link
          href="/dashboard-admin"
          locale={locale}
          className="mt-2 inline-flex min-h-11 items-center font-bold underline underline-offset-4"
        >
          {t("adminPortalLink")}
        </Link>
      ) : null}
    </div>
  );
}

function Submit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  error,
  dir,
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string[];
  dir?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const t = useTranslations("auth.responses");
  const id = `auth-${name}`;
  // Password fields get a visibility toggle. Only the input's `type` changes,
  // so the typed value is preserved by the DOM across toggles; the value is
  // never copied into state, a URL, storage, or a log.
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);
  const inputType = isPassword && revealed ? "text" : type;

  // The toggle deliberately sits outside the <label> element: a <button>
  // inside a label re-dispatches the click to the labelled control in some
  // browsers.
  return (
    <div className="grid gap-2 text-sm font-bold text-foreground">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={inputType}
          required={required}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          dir={dir}
          aria-invalid={Boolean(error?.length)}
          aria-describedby={error?.length ? `${id}-error` : undefined}
          className={`h-12 w-full rounded-xl border border-input bg-card text-base font-normal text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 ${
            isPassword ? "ps-4 pe-12" : "px-4"
          }`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? t("hidePassword") : t("showPassword")}
            aria-pressed={revealed}
            aria-controls={id}
            className="absolute inset-y-0 end-0 grid w-12 place-items-center rounded-e-xl text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {revealed ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {error?.length ? (
        <span
          id={`${id}-error`}
          className="text-xs font-medium text-destructive"
        >
          {translated(t, error[0])}
        </span>
      ) : null}
    </div>
  );
}

function useAuthAction(action: AuthAction) {
  const result = useActionState(action, idleActionState);
  const [state] = result;
  const t = useTranslations("auth.responses");
  useEffect(() => {
    const outcome = settled(state);
    if (!outcome?.messageKey) return;
    (outcome.ok ? toast.success : toast.error)(
      translated(t, outcome.messageKey),
    );
  }, [state, t]);
  return result;
}

function SignInFormBase({
  locale,
  labels,
  next,
  actionHandler,
}: {
  locale: Locale;
  labels: Labels;
  next?: string;
  actionHandler: AuthAction;
}) {
  const [state, action, pending] = useAuthAction(actionHandler);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field
        label={labels.email}
        name="email"
        type="email"
        autoComplete="email"
        error={errors?.email}
      />
      <Field
        label={labels.password}
        name="password"
        type="password"
        autoComplete="current-password"
        error={errors?.password}
      />
      <StateMessage state={state} locale={locale} />
      <Submit label={labels.submit} pending={pending} />
    </form>
  );
}

export function SignInForm(props: {
  locale: Locale;
  labels: Labels;
  next?: string;
}) {
  return <SignInFormBase {...props} actionHandler={signInAction} />;
}

export function AdminSignInForm(props: { locale: Locale; labels: Labels }) {
  return <SignInFormBase {...props} actionHandler={adminSignInAction} />;
}

export function SignUpForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Labels;
}) {
  const [state, action, pending] = useAuthAction(signUpAction);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input
        tabIndex={-1}
        aria-hidden="true"
        className="absolute -start-[9999px]"
        name="website"
        autoComplete="off"
      />
      <Field
        label={labels.fullName}
        name="fullName"
        autoComplete="name"
        error={errors?.fullName}
      />
      <Field
        label={labels.email}
        name="email"
        type="email"
        autoComplete="email"
        error={errors?.email}
      />
      <Field
        label={labels.phone}
        name="phone"
        type="tel"
        autoComplete="tel"
        dir="ltr"
        error={errors?.phone}
      />
      <Field
        label={labels.companyName}
        name="companyName"
        autoComplete="organization"
        error={errors?.companyName}
        required={false}
      />
      <Field
        label={labels.password}
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors?.password}
      />
      <Field
        label={labels.confirmPassword}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={errors?.confirmPassword}
      />
      <StateMessage state={state} locale={locale} />
      <Submit label={labels.submit} pending={pending} />
    </form>
  );
}

export function EmailActionForm({
  locale,
  labels,
  email,
  mode,
}: {
  locale: Locale;
  labels: Labels;
  email?: string;
  mode: "forgot" | "resend";
}) {
  const [state, action, pending] = useAuthAction(
    mode === "forgot" ? forgotPasswordAction : resendVerificationAction,
  );
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <Field
        label={labels.email}
        name="email"
        type="email"
        defaultValue={email}
        autoComplete="email"
        error={errors?.email}
      />
      <StateMessage state={state} locale={locale} />
      <Submit label={labels.submit} pending={pending} />
    </form>
  );
}

export function ResetPasswordForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Labels;
}) {
  const [state, action, pending] = useAuthAction(updatePasswordAction);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <Field
        label={labels.password}
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors?.password}
      />
      <Field
        label={labels.confirmPassword}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={errors?.confirmPassword}
      />
      <StateMessage state={state} locale={locale} />
      <Submit label={labels.submit} pending={pending} />
    </form>
  );
}

export function isInitialAuthState(state: ActionFormState) {
  return isIdle(state);
}
