"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import type { ActionResult } from "@/lib/actions";
import { assertSafeRedirect, localizedPath } from "@/lib/auth/redirects";
import { getViewer } from "@/lib/auth/session";
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

const copy = (locale: Locale) =>
  locale === "ar"
    ? {
        invalid: "راجع الحقول وحاول مرة أخرى.",
        config: "خدمة الحساب غير متصلة بعد.",
        credentials: "تحقق من البيانات وحاول مرة أخرى.",
        inbox: "تحقق من بريدك لإكمال الخطوة التالية.",
        updated: "تم تحديث كلمة المرور.",
        forbidden: "لا تملك صلاحية الدخول إلى مساحة الإدارة.",
      }
    : {
        invalid: "Review the fields and try again.",
        config: "Account service is not connected yet.",
        credentials: "Check your details and try again.",
        inbox: "Check your inbox to complete the next step.",
        updated: "Password updated.",
        forbidden: "You do not have access to the admin workspace.",
      };
const localeFrom = (value: FormDataEntryValue | null): Locale =>
  localeSchema.safeParse(value).data ?? "en";
const invalid = (
  locale: Locale,
  result: {
    error: {
      flatten: () => { fieldErrors: Record<string, string[] | undefined> };
    };
  },
): ActionResult => ({
  ok: false,
  code: "invalid",
  message: copy(locale).invalid,
  fieldErrors: result.error.flatten().fieldErrors,
});

export async function signInAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale,
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return invalid(locale, parsed);
  if (!isSupabaseConfigured())
    return { ok: false, code: "config", message: copy(locale).config };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user)
    return {
      ok: false,
      code: "invalid_credentials",
      message: copy(locale).credentials,
    };
  if (!data.user.email_confirmed_at)
    redirect(
      localizedPath(
        locale,
        `/verify-email?email=${encodeURIComponent(parsed.data.email)}`,
      ),
    );
  // An ADMIN who signs in through the customer form goes straight to the
  // admin workspace instead of a customer account page.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role === "ADMIN") redirect(localizedPath(locale, "/admin"));
  redirect(assertSafeRedirect(parsed.data.next, locale));
}

export async function adminSignInAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale,
  });
  if (!parsed.success) return invalid(locale, parsed);
  if (!isSupabaseConfigured())
    return { ok: false, code: "config", message: copy(locale).config };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user)
    return {
      ok: false,
      code: "invalid_credentials",
      message: copy(locale).credentials,
    };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role !== "ADMIN") {
    await supabase.auth.signOut();
    return { ok: false, code: "forbidden", message: copy(locale).forbidden };
  }
  redirect(localizedPath(locale, "/admin"));
}

export async function signUpAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    locale,
    website: formData.get("website") || "",
  });
  if (!parsed.success) return invalid(locale, parsed);
  if (!isSupabaseConfigured())
    return { ok: false, code: "config", message: copy(locale).config };
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(localizedPath(locale, "/account"))}`,
    },
  });
  redirect(
    localizedPath(
      locale,
      `/verify-email?email=${encodeURIComponent(parsed.data.email)}`,
    ),
  );
}

export async function forgotPasswordAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    locale,
  });
  if (!parsed.success) return invalid(locale, parsed);
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(localizedPath(locale, "/reset-password"))}`,
    });
  }
  return { ok: true, message: copy(locale).inbox };
}

export async function resendVerificationAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    locale,
  });
  if (!parsed.success) return invalid(locale, parsed);
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  }
  return { ok: true, message: copy(locale).inbox };
}

export async function updatePasswordAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    locale,
  });
  if (!parsed.success) return invalid(locale, parsed);
  const viewer = await getViewer();
  if (!viewer || !isSupabaseConfigured())
    return {
      ok: false,
      code: "session_missing",
      message: copy(locale).credentials,
    };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return { ok: false, code: "unknown", message: copy(locale).credentials };
  return { ok: true, message: copy(locale).updated };
}

export async function signOutAction(formData: FormData) {
  const locale = localeFrom(formData.get("locale"));
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect(localizedPath(locale, "/"));
}
