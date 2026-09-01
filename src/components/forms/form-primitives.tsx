"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  idleLegacyActionResult,
  type LegacyActionResult as ActionResult,
} from "@/lib/actions";

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
  const id = `account-${name}`;
  const describedBy =
    [error?.length ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;
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
        required={required}
        maxLength={maxLength}
        aria-invalid={Boolean(error?.length)}
        aria-describedby={describedBy}
        className="h-12 rounded-xl border border-input bg-card px-4 text-base font-normal text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
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
          {error[0]}
        </span>
      ) : null}
    </label>
  );
}

export function FormStatus({ state }: { state: ActionResult }) {
  if (!state.message || (!state.ok && state.code === "idle")) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded-xl p-3 text-sm ${
        state.ok
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {state.message}
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
 * Wires a server action to React's form state and mirrors the result into a
 * Sonner toast so every mutation gives visible feedback.
 */
export function useFormAction(
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>,
) {
  const result = useActionState(action, idleLegacyActionResult);
  const [state] = result;
  useEffect(() => {
    if (!state.message || (!state.ok && state.code === "idle")) return;
    (state.ok ? toast.success : toast.error)(state.message);
  }, [state]);
  return result;
}

export function fieldErrors(state: ActionResult) {
  return state.ok ? undefined : state.fieldErrors;
}
