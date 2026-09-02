"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { resendVerificationAction } from "@/actions/auth";
import type { Locale } from "@/i18n/routing";
import { fieldErrorsOf, idleActionState, settled } from "@/lib/actions";

const COOLDOWN_SECONDS = 60;
const WAITING_SECONDS = 3 * 60;

/**
 * Resend form with a client-side cooldown so a verification email cannot be
 * requested repeatedly. The server remains the authority on delivery.
 */
export function VerifyEmailForm({
  locale,
  email,
}: {
  locale: Locale;
  email?: string;
}) {
  const t = useTranslations("auth.verify");
  const responses = useTranslations("auth.responses");
  const [state, action, pending] = useActionState(
    resendVerificationAction,
    idleActionState,
  );
  const [cooldown, setCooldown] = useState(0);
  const [waiting, setWaiting] = useState(WAITING_SECONDS);
  const waitingUntil = useRef<number | null>(null);
  const [seenState, setSeenState] = useState(state);

  // Adjusting state during render (rather than in an effect) is the
  // recommended way to react to a new action result without an extra pass.
  if (state !== seenState) {
    setSeenState(state);
    if (state.ok) setCooldown(COOLDOWN_SECONDS);
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    waitingUntil.current = Date.now() + WAITING_SECONDS * 1000;
    const update = () =>
      setWaiting(
        Math.max(
          0,
          Math.ceil(((waitingUntil.current ?? Date.now()) - Date.now()) / 1000),
        ),
      );
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const blocked = pending || cooldown > 0;
  const errors = fieldErrorsOf(state);
  const result = settled(state);
  const minutes = Math.floor(waiting / 60);
  const seconds = String(waiting % 60).padStart(2, "0");
  return (
    <form action={action} noValidate className="grid max-w-md gap-5">
      <input type="hidden" name="locale" value={locale} />
      <label className="grid gap-2 text-sm font-bold text-foreground">
        <span>{t("emailLabel")}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          defaultValue={email}
          required
          aria-invalid={Boolean(errors?.email?.length)}
          className="h-12 rounded-xl border border-input bg-card px-4 text-base font-normal text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        {errors?.email?.[0] ? (
          <span className="text-xs font-medium text-destructive">
            {responses(errors.email[0] as "invalidEmail")}
          </span>
        ) : null}
      </label>

      {/* The live region covers the heading only. It used to wrap the whole
          box, digits included, so every tick of the countdown re-announced the
          entire panel once a second. The heading changes exactly once — when
          the wait elapses — which is the only part worth interrupting for. The
          digits stay readable on demand, just not announced. */}
      <div className="rounded-xl border border-border bg-page p-4">
        <p className="text-sm font-bold" aria-live="polite">
          {waiting > 0 ? t("waitingTitle") : t("stillWaitingTitle")}
        </p>
        {waiting > 0 ? (
          <>
            <p className="mt-1 font-mono text-2xl" dir="ltr">
              {minutes}:{seconds}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("waitingBody")}
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("stillWaitingBody")}
          </p>
        )}
      </div>

      {result?.messageKey ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={`rounded-xl p-3 text-sm ${result.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}
        >
          {responses(result.messageKey as "verificationEmailSent")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={blocked}
          aria-busy={pending}
          className="inline-flex h-12 min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light disabled:opacity-60"
        >
          {cooldown > 0 ? t("wait", { s: cooldown }) : t("resend")}
        </button>
        {cooldown > 0 ? (
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {t("cooldown")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
