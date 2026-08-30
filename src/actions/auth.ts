"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.email(),
  password: z.string().min(8),
  locale: z.enum(["en", "ar"]),
});
const safeNext = (value: FormDataEntryValue | null, locale: string) =>
  typeof value === "string" &&
  value.startsWith(`/${locale}/`) &&
  !value.startsWith("//")
    ? value
    : `/${locale}/account`;

export async function signInAction(formData: FormData) {
  const result = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
  });
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  if (!result.success) redirect(`/${locale}/sign-in?error=invalid`);
  if (!isSupabaseConfigured()) redirect(`/${locale}/sign-in?error=config`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });
  if (error) redirect(`/${locale}/sign-in?error=credentials`);
  redirect(safeNext(formData.get("next"), locale));
}

export async function signUpAction(formData: FormData) {
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const result = credentials
    .extend({ name: z.string().min(2), company: z.string().min(2) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      company: formData.get("company"),
      locale,
    });
  if (!result.success) redirect(`/${locale}/sign-up?error=invalid`);
  if (!isSupabaseConfigured()) redirect(`/${locale}/sign-up?error=config`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      data: { full_name: result.data.name, company: result.data.company },
    },
  });
  if (error) redirect(`/${locale}/sign-up?error=signup`);
  redirect(`/${locale}/account`);
}

export async function forgotPasswordAction(formData: FormData) {
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success || !isSupabaseConfigured())
    redirect(`/${locale}/forgot-password?error=config`);
  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/${locale}/reset-password`,
  });
  redirect(`/${locale}/forgot-password?sent=true`);
}

export async function updatePasswordAction(formData: FormData) {
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success || !isSupabaseConfigured())
    redirect(`/${locale}/reset-password?error=invalid`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect(`/${locale}/reset-password?error=update`);
  redirect(`/${locale}/account`);
}

export async function signOutAction(formData: FormData) {
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect(`/${locale}`);
}
