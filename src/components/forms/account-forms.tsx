"use client";

import {
  changeEmailAction,
  changePasswordAction,
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
}: {
  locale: Locale;
  labels: Labels;
  currentEmail: string;
}) {
  const [state, action, pending] = useFormAction(changeEmailAction);
  const errors = fieldErrors(state);
  return (
    <form action={action} noValidate className="grid max-w-xl gap-5">
      <input type="hidden" name="locale" value={locale} />
      <FormField
        label={labels.newEmail}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={currentEmail}
        error={errors?.email}
        hint={labels.emailHint}
        required
      />
      <FormStatus state={state} />
      <div>
        <SubmitButton
          label={labels.updateEmail}
          pending={pending}
          variant="outline"
        />
      </div>
    </form>
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
