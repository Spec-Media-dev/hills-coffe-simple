import createMiddleware from "next-intl/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { getSupabaseConfig, isSupabaseConfigured } from "./lib/supabase/config";

const handleI18n = createMiddleware(routing);

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
  const response = handleI18n(request);
  pending.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  return response;
}

export const config = {
  matcher: "/((?!api|auth|trpc|_next|_vercel|.*\\..*).*)",
};
