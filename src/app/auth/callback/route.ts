import { NextResponse, type NextRequest } from "next/server";
import { assertSafeRedirect, localizedPath } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OtpType = "signup" | "recovery" | "email_change";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as OtpType | null;
  const requestedNext = request.nextUrl.searchParams.get("next");
  const locale = requestedNext?.startsWith("/ar") ? "ar" : "en";
  const next = assertSafeRedirect(requestedNext, locale);
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  // A recovery link only needs a usable session; the reset-password screen
  // performs the actual credential change.
  const isRecovery = type === "recovery";
  const failurePath = isRecovery
    ? localizedPath(locale, "/sign-in?error=link_expired")
    : localizedPath(locale, "/verify-email?error=link_expired");

  if (!isSupabaseConfigured()) return to(failurePath);

  const supabase = await createSupabaseServerClient();
  let exchanged = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchanged = !error;
  } else if (
    tokenHash &&
    (type === "signup" || type === "recovery" || type === "email_change")
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    exchanged = !error;
  }

  if (!exchanged) return to(failurePath);

  // Never trust the callback alone: re-read the user and confirm the real
  // verified state before sending anyone to a verified-only destination.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return to(failurePath);

  if (isRecovery) return to(localizedPath(locale, "/reset-password"));

  if (!user.email_confirmed_at)
    return to(
      localizedPath(
        locale,
        `/verify-email${user.email ? `?email=${encodeURIComponent(user.email)}` : ""}`,
      ),
    );

  // Email is genuinely confirmed at this point.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "ADMIN") return to(localizedPath(locale, "/admin"));

  return to(next);
}
