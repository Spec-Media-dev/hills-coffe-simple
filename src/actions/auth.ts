"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import {
  fail,
  ok,
  type ActionFormState,
  type ActionResult,
  type FieldErrors,
} from "@/lib/actions";
import {
  actionRedirectPath,
  assertSafeRedirect,
  localizedPath,
} from "@/lib/auth/redirects";
import { adminSignInDecision, customerSignInDecision } from "@/lib/auth/policy";
import {
  clearRecoveryContext,
  createRecoveryIntent,
  hasValidRecoveryContext,
} from "@/lib/auth/recovery";
import { env } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  emailSchema,
  localeSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const RESEND_COOKIE = "hills-verification-resend";
const RESEND_COOLDOWN_SECONDS = 60;

const localeFrom = (value: FormDataEntryValue | null): Locale =>
  localeSchema.safeParse(value).data ?? "en";

const fieldMessageKey: Record<string, string> = {
  fullName: "invalidFullName",
  companyName: "invalidCompanyName",
  email: "invalidEmail",
  phone: "invalidPhone",
  password: "invalidPassword",
  confirmPassword: "passwordMismatch",
};

function invalid(result: {
  error: {
    flatten: () => { fieldErrors: Record<string, string[] | undefined> };
  };
}): ActionResult {
  const source = result.error.flatten().fieldErrors;
  const fieldErrors: FieldErrors = {};
  for (const field of Object.keys(source))
    fieldErrors[field] = [fieldMessageKey[field] ?? "validation"];
  return fail("VALIDATION", "validation", { fieldErrors });
}

const isRateLimited = (error: { status?: number; code?: string } | null) =>
  Boolean(
    error &&
    (error.status === 429 ||
      error.code === "over_email_send_rate_limit" ||
      error.code === "over_request_rate_limit"),
  );

const isEmailUnconfirmed = (error: { code?: string } | null) =>
  error?.code === "email_not_confirmed";

async function signOutDeniedSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  await supabase.auth.signOut({ scope: "local" });
}

export async function signInAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale,
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return invalid(parsed);
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    if (isEmailUnconfirmed(error))
      return fail("VERIFICATION_REQUIRED", "verificationRequired");
    return fail("FORBIDDEN", "credentials");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_blocked")
    .eq("id", data.user.id)
    .maybeSingle();
  const decision = customerSignInDecision({
    emailConfirmed: Boolean(data.user.email_confirmed_at),
    role: profile?.role ?? null,
    isBlocked: Boolean(profile?.is_blocked),
  });

  // A failed lookup and a missing row are both provisioning inconsistencies,
  // not authorization refusals. Neither grants capability; both are logged
  // server-side (Auth id only, never DB internals) and reported to the
  // customer as something actionable rather than as "this account cannot
  // access protected customer features".
  if (profileError || decision === "PROFILE_MISSING") {
    await signOutDeniedSession(supabase);
    console.error(
      `[auth] sign-in blocked by profile inconsistency (${
        profileError ? "lookup-failed" : "profile-missing"
      }). userId=${data.user.id}`,
    );
    return fail("UNEXPECTED", "accountSetupIncomplete");
  }

  if (decision !== "OK") {
    await signOutDeniedSession(supabase);
    const messageKey =
      decision === "VERIFICATION_REQUIRED"
        ? "verificationRequired"
        : decision === "BLOCKED"
          ? "blocked"
          : decision === "ADMIN_PORTAL_REQUIRED"
            ? "adminPortalRequired"
            : "customerAccessDenied";
    return fail(decision, messageKey);
  }

  // The application check and the database/RLS check must agree. An error or
  // false value fails closed and clears the newly-created customer session.
  const { data: entitled, error: entitlementError } = await supabase.rpc(
    "hills_is_verified_user",
  );
  if (entitlementError || entitled !== true) {
    await signOutDeniedSession(supabase);
    return fail("FORBIDDEN", "customerAccessDenied");
  }

  redirect(
    actionRedirectPath(locale, assertSafeRedirect(parsed.data.next, locale)),
  );
}

export async function adminSignInAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale,
  });
  if (!parsed.success) return invalid(parsed);
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return fail("FORBIDDEN", "credentials");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_blocked")
    .eq("id", data.user.id)
    .maybeSingle();
  const decision = adminSignInDecision({
    emailConfirmed: Boolean(data.user.email_confirmed_at),
    role: profile?.role ?? null,
    isBlocked: Boolean(profile?.is_blocked),
  });
  const { data: entitled, error: entitlementError } =
    decision === "OK"
      ? await supabase.rpc("is_admin")
      : { data: false, error: null };

  if (
    profileError ||
    decision !== "OK" ||
    entitlementError ||
    entitled !== true
  ) {
    await signOutDeniedSession(supabase);
    return fail("FORBIDDEN", "adminAccessDenied");
  }

  redirect(actionRedirectPath(locale, localizedPath(locale, "/admin")));
}

export async function signUpAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    companyName: formData.get("companyName") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    locale,
    website: formData.get("website") || "",
  });
  if (!parsed.success) return invalid(parsed);
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");

  const supabase = await createSupabaseServerClient();

  /*
   * A public sign-up must not run on top of somebody else's session.
   *
   * Signing up is by definition the creation of a *new* identity, but every
   * destination after it — starting with the verification screen — is chosen
   * from whoever the browser is currently authenticated as. A browser still
   * holding an Administrator session therefore carried that Administrator
   * through a customer sign-up and out the other side into the Admin
   * workspace, which is the regression this guard closes. Supabase's own
   * `signUp` is ambiguous when a session is present as well, so the
   * incompatible session is replaced before the flow starts rather than
   * reconciled afterwards.
   *
   * `scope: "local"` is deliberate and is the minimum that is correct: it
   * clears only this browser's auth context. Sessions that account holds on
   * other devices are not touched, and no data is destroyed.
   */
  const { data: existing } = await supabase.auth.getUser();
  const incumbent = existing.user?.email?.trim().toLowerCase();
  if (incumbent && incumbent !== parsed.data.email.trim().toLowerCase())
    await supabase.auth.signOut({ scope: "local" });

  const metadata = {
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    ...(parsed.data.companyName
      ? { company_name: parsed.data.companyName }
      : {}),
  };
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: metadata,
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(localizedPath(locale, "/account"))}`,
    },
  });

  // Signup carries no application-side cooldown of its own — this is a genuine
  // provider/SMTP limit. It gets its own wording so it is not mistaken for the
  // resend cooldown, and is never reported as a capability failure.
  if (isRateLimited(error)) return fail("RATE_LIMITED", "signupRateLimited");

  // The live profile trigger intentionally ignores company_name. When Auth is
  // configured without email confirmation and returns a session immediately,
  // persist it now; the normal confirmed-email path persists it in callback.
  if (data.session && data.user && parsed.data.companyName)
    await supabase
      .from("profiles")
      .update({ company_name: parsed.data.companyName })
      .eq("id", data.user.id);

  // Duplicate and non-existing addresses deliberately converge on the same
  // waiting screen. Provider details never cross the action boundary.
  redirect(
    actionRedirectPath(
      locale,
      localizedPath(
        locale,
        `/verify-email?email=${encodeURIComponent(parsed.data.email)}`,
      ),
    ),
  );
}

export async function forgotPasswordAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    locale,
  });
  if (!parsed.success) return invalid(parsed);

  if (isSupabaseConfigured()) {
    const intent = createRecoveryIntent(parsed.data.email);
    if (intent) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(localizedPath(locale, "/reset-password"))}&flow=${encodeURIComponent(intent)}`,
      });
    }
  }

  // Always identical, including missing accounts and provider failures.
  return ok("recoveryEmailSent");
}

export async function resendVerificationAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    locale,
  });
  if (!parsed.success) return invalid(parsed);
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");

  const cookieStore = await cookies();
  const retryAt = Number(cookieStore.get(RESEND_COOKIE)?.value ?? 0);
  if (Number.isFinite(retryAt) && retryAt > Date.now())
    return fail("RATE_LIMITED", "rateLimited");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(localizedPath(locale, "/account"))}`,
    },
  });
  if (isRateLimited(error)) return fail("RATE_LIMITED", "rateLimited");

  // HttpOnly application cooldown is independent of the client countdown;
  // Supabase's own per-address provider rate limit remains the second layer.
  cookieStore.set(
    RESEND_COOKIE,
    String(Date.now() + RESEND_COOLDOWN_SECONDS * 1000),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
      path: "/",
      maxAge: RESEND_COOLDOWN_SECONDS,
    },
  );
  return ok("verificationEmailSent");
}

export async function updatePasswordAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    locale,
  });
  if (!parsed.success) return invalid(parsed);
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");
  if (!(await hasValidRecoveryContext()))
    return fail("AUTH_REQUIRED", "recoveryRequired");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return fail("UNEXPECTED", "passwordUpdateFailed");

  await clearRecoveryContext();
  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect(
    actionRedirectPath(locale, localizedPath(locale, "/sign-in?reset=success")),
  );
}

export async function signOutAction(formData: FormData) {
  const locale = localeFrom(formData.get("locale"));
  await clearRecoveryContext();
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  revalidatePath("/", "layout");
  redirect(actionRedirectPath(locale, localizedPath(locale, "/")));
}
