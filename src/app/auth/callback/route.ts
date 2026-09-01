import { NextResponse, type NextRequest } from "next/server";
import { assertSafeRedirect, localizedPath } from "@/lib/auth/redirects";
import {
  attachRecoveryContext,
  isValidRecoveryIntent,
} from "@/lib/auth/recovery";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { companyNameSchema } from "@/lib/validation/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const type =
    rawType === "signup" || rawType === "recovery" || rawType === "email_change"
      ? rawType
      : null;
  const flow = request.nextUrl.searchParams.get("flow");
  const settled = request.nextUrl.searchParams.get("settled") === "1";
  const requestedNext = request.nextUrl.searchParams.get("next");
  const locale = requestedNext?.startsWith("/ar") ? "ar" : "en";
  const next = assertSafeRedirect(requestedNext, locale);
  const requestedReset = next === localizedPath(locale, "/reset-password");
  const recoveryHint = type === "recovery" || (type === null && requestedReset);
  // Keep redirects on the exact host that received the callback. Building an
  // absolute URL from NextRequest can adopt the server's canonical host (for
  // example `localhost` instead of `127.0.0.1`) and strand host-only Auth
  // cookies on the callback origin.
  const to = (path: string) =>
    new NextResponse(null, {
      status: 303,
      headers: { location: path },
    });
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const secureCookies = forwardedProtocol
    ? forwardedProtocol === "https"
    : request.nextUrl.protocol === "https:";
  const failurePath = recoveryHint
    ? localizedPath(locale, "/sign-in?error=link_expired")
    : localizedPath(locale, "/verify-email?error=link_expired");

  if (!isSupabaseConfigured()) return to(failurePath);

  const supabase = await createSupabaseServerClient();
  let exchanged = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchanged = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    exchanged = !error;
  } else if (settled) {
    // Return trip from the browser-side fragment handler below. The session
    // now exists in cookies; nothing is left to exchange, and the
    // classification further down is still performed server-side.
    exchanged = true;
  } else {
    // Nothing exchangeable arrived. Supabase's verify endpoint falls back to
    // the implicit flow when the originating request registered no PKCE
    // challenge, returning `#access_token=…&refresh_token=…`. A fragment is
    // never sent to the server, so this handler cannot see a perfectly valid
    // confirmation. Hand off to a browser page that can read it; per RFC 7231
    // the fragment survives this redirect because the Location carries none.
    // Previously this fell through to `link_expired`, which reported a
    // successful confirmation as a broken link and established no session.
    return to(
      `${localizedPath(locale, "/continue")}?mode=confirm&next=${encodeURIComponent(next)}`,
    );
  }

  if (!exchanged) return to(failurePath);

  // Callback arrival is never evidence. Re-read both the user and resulting
  // session from Supabase before selecting any protected destination.
  const userResult = await supabase.auth.getUser();
  const sessionResult = await supabase.auth.getSession();
  const user = userResult.data.user;
  const session = sessionResult.data.session;
  if (!user || !session) return to(failurePath);

  // PKCE code callbacks do not carry a reliable `type`. The signed flow value
  // binds a prior forgot-password request to this email without exposing it.
  // Explicit token types still win, so signup/email-change tokens can never be
  // re-labelled recovery by editing `next`.
  const validRecoveryIntent = isValidRecoveryIntent(flow, user.email);
  const isRecovery =
    type === "recovery" ||
    (type === null && requestedReset && validRecoveryIntent);

  if (recoveryHint && !isRecovery) {
    await supabase.auth.signOut({ scope: "local" });
    return to(failurePath);
  }

  if (isRecovery) {
    if (!validRecoveryIntent) {
      await supabase.auth.signOut({ scope: "local" });
      return to(failurePath);
    }
    const response = to(localizedPath(locale, "/reset-password"));
    if (!attachRecoveryContext(response, user.id, secureCookies)) {
      await supabase.auth.signOut({ scope: "local" });
      return to(failurePath);
    }
    return response;
  }

  if (!user.email_confirmed_at)
    return to(
      localizedPath(
        locale,
        `/verify-email${user.email ? `?email=${encodeURIComponent(user.email)}` : ""}`,
      ),
    );

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_blocked")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile || profile.is_blocked) {
    await supabase.auth.signOut({ scope: "local" });
    return to(
      localizedPath(
        locale,
        `/sign-in?error=${profile?.is_blocked ? "blocked" : "access_denied"}`,
      ),
    );
  }

  // The profile trigger persists name/phone but, as confirmed against the
  // live database, intentionally ignores optional company_name. It is a
  // normal editable profile field (never authorization state), so persist the
  // validated signup value with the now-confirmed user's own RLS session.
  const companyName = companyNameSchema.safeParse(
    user.user_metadata?.company_name,
  );
  if (companyName.success && companyName.data)
    await supabase
      .from("profiles")
      .update({ company_name: companyName.data })
      .eq("id", user.id);

  if (profile.role === "ADMIN") {
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (!error && isAdmin === true) return to(localizedPath(locale, "/admin"));
  } else if (profile.role === "USER") {
    const { data: isCustomer, error } = await supabase.rpc(
      "hills_is_verified_user",
    );
    if (!error && isCustomer === true) return to(next);
  }

  await supabase.auth.signOut({ scope: "local" });
  return to(localizedPath(locale, "/sign-in?error=access_denied"));
}
