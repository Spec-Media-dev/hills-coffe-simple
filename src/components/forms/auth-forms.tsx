"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  adminSignInAction,
  forgotPasswordAction,
  resendVerificationAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/actions/auth";
import type { Locale } from "@/i18n/routing";
import { idleActionResult, type ActionResult } from "@/lib/actions";

type Labels = Record<string, string>;
function StateMessage({ state }: { state: ActionResult }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className={`rounded-xl p-3 text-sm ${state.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}
    >
      {state.message}
    </p>
  );
}
function Submit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button
      disabled={pending}
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
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string[];
  dir?: string;
  defaultValue?: string;
}) {
  const id = `auth-${name}`;
  return (
    <label
      htmlFor={id}
      className="grid gap-2 text-sm font-bold text-foreground"
    >
      <span>{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        dir={dir}
        aria-invalid={Boolean(error?.length)}
        aria-describedby={error?.length ? `${id}-error` : undefined}
        className="h-12 rounded-xl border border-input bg-card px-4 text-base font-normal text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      {error?.length ? (
        <span
          id={`${id}-error`}
          className="text-xs font-medium text-destructive"
        >
          {error[0]}
        </span>
      ) : null}
    </label>
  );
}
function useAuthAction(
  action: (_: ActionResult, data: FormData) => Promise<ActionResult>,
) {
  const result = useActionState(action, idleActionResult);
  const [state] = result;
  useEffect(() => {
    if (state.message && (state.ok || state.code !== "idle"))
      (state.ok ? toast.success : toast.error)(state.message);
  }, [state]);
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
  actionHandler: typeof signInAction;
}) {
  const [state, action, pending] = useAuthAction(actionHandler);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field
        label={labels.email}
        name="email"
        type="email"
        autoComplete="email"
        error={state.ok ? undefined : state.fieldErrors?.email}
      />
      <Field
        label={labels.password}
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.ok ? undefined : state.fieldErrors?.password}
      />
      <StateMessage state={state} />
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
  const errors = state.ok ? undefined : state.fieldErrors;
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
      <StateMessage state={state} />
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
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <Field
        label={labels.email}
        name="email"
        type="email"
        defaultValue={email}
        autoComplete="email"
        error={state.ok ? undefined : state.fieldErrors?.email}
      />
      <StateMessage state={state} />
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
  const errors = state.ok ? undefined : state.fieldErrors;
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
      <StateMessage state={state} />
      <Submit label={labels.submit} pending={pending} />
    </form>
  );
}
