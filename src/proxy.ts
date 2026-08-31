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
    await supabase.auth.getUser();
  }
  const response = localeResponse(request);
  pending.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  return response;
}

export const config = {
  matcher: "/((?!api|auth|trpc|_next|_vercel|.*\\..*).*)",
};
