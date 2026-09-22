import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "./lib/supabase/config";

function localeResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const headers = new Headers(request.headers);

  if (headers.get("x-hills-locale-rewrite") === "en") {
    headers.set("x-next-intl-locale", "en");
    return NextResponse.next({ request: { headers } });
  }

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    headers.set("x-next-intl-locale", "ar");
    return NextResponse.next({ request: { headers } });
  }

  headers.set("x-next-intl-locale", "en");
  headers.set("x-hills-locale-rewrite", "en");
  const url = request.nextUrl.clone();
  url.pathname = `/en${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export default async function proxy(request: NextRequest) {
  const pending: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];
  let staleAdminEmailChange = false;
  if (isSupabaseConfigured()) {
    const { url, key } = getSupabaseConfig();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) =>
          items.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            pending.push({ name, value, options });
          }),
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Some expired Supabase email links fall back to Site URL (the public
    // home page) with provider error parameters instead of the configured
    // callback URL. Intercept only that exact, authenticated-Admin case so
    // the raw error never lands on the homepage; all normal public routing is
    // left untouched. The Admin page re-reads Auth and keeps any pending
    // target visible until Supabase actually completes the change.
    const providerRejectedLink =
      (request.nextUrl.pathname === "/" ||
        request.nextUrl.pathname === "/ar") &&
      (request.nextUrl.searchParams.get("error_code") === "otp_expired" ||
        request.nextUrl.searchParams.get("error") === "access_denied");
    if (user && providerRejectedLink) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role,is_blocked")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "ADMIN" && !profile.is_blocked) {
        const { data: isAdmin, error } = await supabase.rpc("is_admin");
        staleAdminEmailChange = !error && isAdmin === true;
      }
    }
  }
  const isArabic =
    request.nextUrl.pathname.startsWith("/ar") ||
    request.cookies.get("NEXT_LOCALE")?.value === "ar";
  const staleAdminPath = isArabic
    ? "/ar/admin/account?email_change=link_expired"
    : "/admin/account?email_change=link_expired";
  const response = staleAdminEmailChange
    ? NextResponse.redirect(
        new URL(staleAdminPath, request.url),
        303,
      )
    : localeResponse(request);
  pending.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  return response;
}

export const config = {
  matcher: "/((?!api|auth|trpc|_next|_vercel|.*\\..*).*)",
};
