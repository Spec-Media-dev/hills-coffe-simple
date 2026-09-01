import { NextResponse, type NextRequest } from "next/server";
import { clearRecoveryContext } from "@/lib/auth/recovery";
import { localizedPath } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const locale =
    request.nextUrl.searchParams.get("locale") === "ar" ? "ar" : "en";
  const reason =
    request.nextUrl.searchParams.get("reason") === "blocked"
      ? "blocked"
      : "access_denied";
  await clearRecoveryContext();
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  return NextResponse.redirect(
    new URL(localizedPath(locale, `/sign-in?error=${reason}`), request.url),
  );
}
