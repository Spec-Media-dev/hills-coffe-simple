"use client";

import {
  changeEmailAction,
  changePasswordAction,
  resendEmailChangeAction,
  updateProfileAction,
} from "@/actions/account";
import type { Locale } from "@/i18n/routing";
import {
  FormField,
  FormStatus,
  SubmitButton,
  fieldErrors,
  useFormAction,
} from "@/components/forms/form-primitives";
import { settled } from "@/lib/actions";
import { useState } from "react";

type Labels = Record<string, string>;

export function ProfileForm({
  locale,
  labels,
  defaults,
}: {
  locale: Locale;
  labels: Labels;
  defaults: {
    fullName: string;
    phone: string;
    companyName: string;
    address: string;
    countryCode: string;
  };
}) {
  const [state, action, pending] = useFormAction(updateProfileAction);
  const errors = fieldErrors(state);
  return (
    <form action={action} noValidate className="grid max-w-xl gap-5">
      <input type="hidden" name="locale" value={locale} />
      <FormField
        label={labels.name}
        name="full_name"
        autoComplete="name"
        defaultValue={defaults.fullName}
        error={errors?.full_name}
        required
      />
      <FormField
        label={labels.phone}
        name="phone"
        type="tel"
        dir="ltr"
        autoComplete="tel"
        defaultValue={defaults.phone}
        error={errors?.phone}
      />
      <FormField
        label={labels.company}
        name="company_name"
        autoComplete="organization"
        defaultValue={defaults.companyName}
        error={errors?.company_name}
      />
      <FormField
        label={labels.address}
        name="address"
        autoComplete="street-address"
        defaultValue={defaults.address}
        error={errors?.address}
      />
      <FormField
        label={labels.country}
        name="country_code"
        autoComplete="country"
        maxLength={2}
        dir="ltr"
        defaultValue={defaults.countryCode}
        error={errors?.country_code}
        hint={labels.countryHint}
      />
      <FormStatus state={state} />
      <div>
        <SubmitButton label={labels.save} pending={pending} />
      </div>
    </form>
  );
}

export function ChangeEmailForm({
  locale,
  labels,
  currentEmail,
  pendingEmail,
}: {
  locale: Locale;
  labels: Labels;
  currentEmail: string;
  pendingEmail: string | null;
}) {
  const [state, action, pending] = useFormAction(changeEmailAction);
  const [resendState, resendAction, resending] = useFormAction(
    resendEmailChangeAction,
  );
  const [enteredEmail, setEnteredEmail] = useState("");
  const errors = fieldErrors(state);
  const outcome = settled(state);
  const sentThisVisit =
    outcome?.ok === true && outcome.messageKey === "emailChangeSent";
  const pendingTarget = pendingEmail ?? (sentThisVisit ? enteredEmail : null);
  return (
    <div className="grid max-w-xl gap-5">
      <p className="rounded-xl border border-border bg-page px-4 py-3 text-sm">
        <span className="font-bold">{labels.currentEmail}: </span>
        <span dir="ltr">{currentEmail}</span>
      </p>
      <form action={action} noValidate className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />
        <FormField
          label={labels.newEmail}
          name="email"
          type="email"
          autoComplete="email"
          error={errors?.email}
          hint={labels.emailHint}
          onValueChange={setEnteredEmail}
          required
        />
        {sentThisVisit ? null : <FormStatus state={state} />}
        <div>
          <SubmitButton
            label={labels.updateEmail}
            pending={pending}
            variant="outline"
          />
        </div>
      </form>
      {pendingTarget ? (
        <div className="grid gap-3 rounded-xl border border-gold/35 bg-gold/10 p-4 text-sm">
          <div role="status" aria-live="polite">
            <p className="font-bold">
              {labels.verificationPending.replace("{email}", pendingTarget)}
            </p>
            <p className="mt-1 text-muted-foreground">
              {labels.verificationPendingBody}
            </p>
          </div>
          <form action={resendAction}>
            <input type="hidden" name="locale" value={locale} />
            <SubmitButton
              label={labels.resendEmailVerification}
              pending={resending}
              variant="outline"
            />
            <FormStatus state={resendState} />
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function ChangePasswordForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Labels;
}) {
  const [state, action, pending] = useFormAction(changePasswordAction);
  const errors = fieldErrors(state);
  return (
    <form action={action} noValidate className="grid max-w-xl gap-5">
      <input type="hidden" name="locale" value={locale} />
      <FormField
        label={labels.currentPassword}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={errors?.currentPassword}
        required
      />
      <FormField
        label={labels.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors?.password}
        hint={labels.passwordHint}
        required
      />
      <FormField
        label={labels.confirmPassword}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={errors?.confirmPassword}
        required
      />
      <FormStatus state={state} />
      <div>
        <SubmitButton label={labels.updatePassword} pending={pending} />
      </div>
    </form>
  );
}
