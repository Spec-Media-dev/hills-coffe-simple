"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Locale } from "@/i18n/routing";
import type { LegacyActionResult as ActionResult } from "@/lib/actions";
import { localizedPath } from "@/lib/auth/redirects";
import { requireVerifiedUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  localeSchema,
  passwordSchema,
  phoneSchema,
} from "@/lib/validation/auth";

const copy = (locale: Locale) =>
  locale === "ar"
    ? {
        invalid: "راجع الحقول وحاول مرة أخرى.",
        session: "انتهت الجلسة. سجّل الدخول مرة أخرى.",
        config: "خدمة الحساب غير متصلة بعد.",
        saved: "تم حفظ التغييرات.",
        failed: "تعذّر حفظ التغييرات. حاول مرة أخرى.",
        emailSent: "أرسلنا رابط تأكيد إلى بريدك الجديد.",
        passwordUpdated: "تم تحديث كلمة المرور.",
        wrongPassword: "كلمة المرور الحالية غير صحيحة.",
        sameEmail: "هذا هو بريدك الحالي بالفعل.",
      }
    : {
        invalid: "Review the fields and try again.",
        session: "Your session expired. Sign in again.",
        config: "Account service is not connected yet.",
        saved: "Changes saved.",
        failed: "We could not save your changes. Try again.",
        emailSent: "We sent a confirmation link to your new email address.",
        passwordUpdated: "Password updated.",
        wrongPassword: "Your current password is incorrect.",
        sameEmail: "That is already your current email address.",
      };

const localeFrom = (value: FormDataEntryValue | null): Locale =>
  localeSchema.safeParse(value).data ?? "en";

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: phoneSchema.nullable(),
  company_name: z.string().trim().max(160).nullable(),
  address: z.string().trim().max(300).nullable(),
  country_code: z.string().trim().length(2).toUpperCase().nullable(),
});

export async function updateProfileAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const text = copy(locale);
  const viewer = await requireVerifiedUser();
  if (!viewer)
    return { ok: false, code: "session_missing", message: text.session };
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || null,
    company_name: formData.get("company_name") || null,
    address: formData.get("address") || null,
    country_code: formData.get("country_code") || null,
  });
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid",
      message: text.invalid,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  const db = await createSupabaseServerClient();
  const { error } = await db
    .from("profiles")
    .update(parsed.data)
    .eq("id", viewer.id);
  if (error) return { ok: false, code: "unknown", message: text.failed };
  revalidatePath("/account", "layout");
  return { ok: true, message: text.saved };
}

export async function changeEmailAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const text = copy(locale);
  const viewer = await requireVerifiedUser();
  if (!viewer)
    return { ok: false, code: "session_missing", message: text.session };
  if (!isSupabaseConfigured())
    return { ok: false, code: "config", message: text.config };
  const parsed = z
    .object({ email: z.email().trim().toLowerCase() })
    .safeParse({ email: formData.get("email") });
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid",
      message: text.invalid,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  if (parsed.data.email === viewer.email.toLowerCase())
    return {
      ok: false,
      code: "unchanged",
      message: text.sameEmail,
      fieldErrors: { email: [text.sameEmail] },
    };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(
        localizedPath(locale, "/account/security"),
      )}`,
    },
  );
  // Supabase sends a confirmation link to the new address; the change only
  // takes effect once that link is followed.
  if (error) return { ok: false, code: "unknown", message: text.failed };
  return { ok: true, message: text.emailSent };
}

export async function changePasswordAction(
  _: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const text = copy(locale);
  const viewer = await requireVerifiedUser();
  if (!viewer)
    return { ok: false, code: "session_missing", message: text.session };
  if (!isSupabaseConfigured())
    return { ok: false, code: "config", message: text.config };
  const parsed = z
    .object({
      currentPassword: z.string().min(1),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match",
    })
    .safeParse({
      currentPassword: formData.get("currentPassword"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid",
      message: text.invalid,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  const supabase = await createSupabaseServerClient();
  // Reauthenticate before allowing a password change.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: viewer.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError)
    return {
      ok: false,
      code: "invalid_credentials",
      message: text.wrongPassword,
      fieldErrors: { currentPassword: [text.wrongPassword] },
    };
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { ok: false, code: "unknown", message: text.failed };
  return { ok: true, message: text.passwordUpdated };
}

export async function toggleFavoriteAction(formData: FormData) {
  const viewer = await requireVerifiedUser();
  if (!viewer) return;
  const parsed = z
    .object({
      coffeeId: z.string().uuid(),
      returnTo: z.string().startsWith("/"),
    })
    .safeParse({
      coffeeId: formData.get("coffeeId"),
      returnTo: formData.get("returnTo") || "/account/favorites",
    });
  if (!parsed.success) return;
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("favorites")
    .select("coffee_id")
    .eq("user_id", viewer.id)
    .eq("coffee_id", parsed.data.coffeeId)
    .maybeSingle();
  if (data)
    await db
      .from("favorites")
      .delete()
      .eq("user_id", viewer.id)
      .eq("coffee_id", parsed.data.coffeeId);
  else
    await db.from("favorites").insert({
      user_id: viewer.id,
      coffee_id: parsed.data.coffeeId,
      created_at: new Date().toISOString(),
    });
  revalidatePath(parsed.data.returnTo);
  revalidatePath("/account/favorites");
}
