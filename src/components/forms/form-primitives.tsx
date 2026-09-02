"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import {
  fieldErrorsOf,
  idleActionState,
  settled,
  type ActionFormState,
  type ActionResult,
} from "@/lib/actions";

/**
 * Account forms resolve `messageKey` values against `account.responses` in the
 * active locale. The server never sends prose, so an English page renders
 * English and an Arabic page renders Arabic with no branching in action code.
 */
const useAccountCopy = () => useTranslations("account.responses");
const translated = (t: ReturnType<typeof useAccountCopy>, key: string) =>
  t(key as Parameters<typeof t>[0]);

export function FormField({
  label,
  name,
  type = "text",
  autoComplete,
  error,
  dir,
  defaultValue,
  required,
  maxLength,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string[];
  dir?: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  const t = useAccountCopy();
  const id = `account-${name}`;
  // Password inputs get the same visibility control as the Auth forms. Only
  // the input's `type` changes, so the DOM keeps the typed value; it is never
  // copied into state, a URL, storage, or a log.
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);
  const inputType = isPassword && revealed ? "text" : type;

  // React resets a <form> once its action settles, so an uncontrolled input
  // snapped back to `defaultValue` and threw away everything the person had
  // typed the moment the server rejected it. Holding the value in state keeps
  // it across that reset. A password is deliberately excluded: it stays in the
  // DOM only, exactly as the comment above says.
  const [value, setValue] = useState(defaultValue ?? "");
  const [seenDefault, setSeenDefault] = useState(defaultValue);
  if (defaultValue !== seenDefault) {
    // A saved profile re-renders with new defaults; adopt them.
    setSeenDefault(defaultValue);
    setValue(defaultValue ?? "");
  }
  const describedBy =
    [error?.length ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="grid gap-2 text-sm font-bold text-foreground">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={inputType}
          {...(isPassword
            ? { defaultValue }
            : {
                value,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  setValue(event.target.value),
              })}
          autoComplete={autoComplete}
          dir={dir}
          required={required}
          maxLength={maxLength}
          aria-invalid={Boolean(error?.length)}
          aria-describedby={describedBy}
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
      {hint ? (
        <span
          id={`${id}-hint`}
          className="text-xs font-normal text-muted-foreground"
        >
          {hint}
        </span>
      ) : null}
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

export function FormStatus({ state }: { state: ActionFormState }) {
  const t = useAccountCopy();
  const result = settled(state);
  if (!result?.messageKey) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      aria-live="polite"
      className={`rounded-xl p-3 text-sm ${
        result.ok
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {translated(t, result.messageKey)}
    </p>
  );
}

export function SubmitButton({
  label,
  pending,
  variant = "primary",
}: {
  label: string;
  pending: boolean;
  variant?: "primary" | "outline";
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex h-12 min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition disabled:opacity-60 ${
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-forest-light"
          : "border border-border bg-card text-foreground hover:border-gold"
      }`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

/**
 * Wires a server action to React's form state.
 *
 * This used to also raise a Sonner toast carrying the same message that
 * `FormStatus` already renders. Sonner publishes its toasts through a live
 * region of its own, so every success and every failure was announced twice.
 * The inline status is the one kept: it sits with the form that produced it,
 * it stays on screen instead of dismissing itself, and it is what a field
 * error is read alongside.
 */
export function useFormAction(
  action: (state: ActionFormState, data: FormData) => Promise<ActionResult>,
) {
  return useActionState(action, idleActionState);
}

export function fieldErrors(state: ActionFormState) {
  return fieldErrorsOf(state);
}
