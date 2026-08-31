"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { resendVerificationAction } from "@/actions/auth";
import type { Locale } from "@/i18n/routing";
import {
  FormField,
  FormStatus,
  SubmitButton,
  fieldErrors,
  useFormAction,
} from "@/components/forms/form-primitives";

const COOLDOWN_SECONDS = 45;

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
  const [state, action, pending] = useFormAction(resendVerificationAction);
  const [cooldown, setCooldown] = useState(0);
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

  const blocked = pending || cooldown > 0;
  return (
    <form action={action} className="grid max-w-md gap-5">
      <input type="hidden" name="locale" value={locale} />
      <FormField
        label={t("emailLabel")}
        name="email"
        type="email"
        autoComplete="email"
        dir="ltr"
        defaultValue={email}
        error={fieldErrors(state)?.email}
        required
      />
      <FormStatus state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          label={cooldown > 0 ? t("wait", { s: cooldown }) : t("resend")}
          pending={blocked}
        />
        {cooldown > 0 ? (
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {t("cooldown")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
