import { NextResponse, type NextRequest } from "next/server";
import { routing, type Locale } from "@/i18n/routing";
import { suggest } from "@/lib/data/search";

/**
 * GET /api/search/suggest?q=…&locale=en|ar
 *
 * Typeahead for the header search. It is a plain GET so the client can abort
 * a superseded request and the browser can reuse a response for a repeated
 * query. The response is public, published catalogue data with no price, but
 * it is read through the requesting session's Supabase client like every
 * other public page, so it is marked `private`: a shared cache must never be
 * the reason one viewer sees another's result.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested = params.get("locale");
  const locale: Locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  try {
    const result = await suggest(locale, params.get("q") ?? "");
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch {
    // Upstream failure reads as "no suggestions", never as a broken header;
    // pressing Enter still runs the full search page.
    return NextResponse.json(
      { query: "", items: [], coffeeTotal: 0 },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
