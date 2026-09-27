import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/mark";
import { HeaderSearch } from "./header-search";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";
import { CatalogMegaMenu } from "./catalog-mega-menu";
import { TopTicker } from "./top-ticker";
import { ScrollAwareHeader } from "./scroll-aware-header";
import { NavUnderline } from "@/components/motion/primitives";
import { ThemeToggle } from "./theme-toggle";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth/session";
import { getPublicPersona } from "@/lib/auth/persona";
import { AuthCta } from "@/components/auth/auth-cta";
import { getCatalogFacets } from "@/lib/data/catalog-query";
import { AccountMenu } from "./account-menu";
import { avatarInitials, getOwnAvatarUrl } from "@/lib/data/avatar";
import { getSiteLogo } from "@/lib/data/site-logo";
import type { Locale } from "@/i18n/routing";
import { getLocale } from "next-intl/server";

export async function SiteHeader() {
  /*
   * Independent reads are requested together rather than one after another;
   * the header sits in front of every public page, so a serial chain here
   * delayed every first paint.
   *
   * `getViewer()` is a presentation check, deliberately separate from the
   * server pricing entitlement gate: it reads the real Supabase session plus
   * `profiles.role`, so both USER and ADMIN sessions persist across public-page
   * requests. The persona is presentation only too: it decides what the *call
   * to action* says, which is what stopped an Administrator and an unverified
   * customer both being shown a "Sign in" button they should never see.
   * `requireVerifiedUser()` still decides the account affordance, unchanged.
   */
  const [
    t,
    actions,
    brand,
    account,
    catalog,
    search,
    cta,
    viewer,
    persona,
    rawLocale,
  ] = await Promise.all([
    getTranslations("nav"),
    getTranslations("actions"),
    getTranslations("brand"),
    getTranslations("account"),
    getTranslations("catalog"),
    getTranslations("search"),
    getTranslations("cta"),
    getViewer(),
    getPublicPersona(),
    getLocale(),
  ]);
  const locale = rawLocale as Locale;
  const signedInViewer = viewer && !viewer.isBlocked ? viewer : null;
  // The logo is resolved once per render and shared with the mobile menu,
  // which is a client component and cannot read it itself. The facets are the
  // real, active, already-localized origins — the same source the catalog
  // filter uses, so the menu can never offer an origin the filter rejects.
  const [avatarUrl, logo, facets] = await Promise.all([
    signedInViewer ? getOwnAvatarUrl() : Promise.resolve(null),
    getSiteLogo(locale),
    getCatalogFacets(locale),
  ]);
  /*
   * The drawer's primary action follows the same persona rules as the header
   * button, so the two can never disagree — a verified customer used to be
   * offered "Account" here while the header still said "Sign in".
   */
  const mobileAction =
    persona === "verified"
      ? { actionHref: "/account", actionLabel: t("account") }
      : persona === "unverified"
        ? { actionHref: "/verify-email", actionLabel: cta("verifyEmail") }
        : persona === "blocked"
          ? { actionHref: "/contact", actionLabel: cta("contactSupport") }
          : persona === "admin"
            ? { actionHref: null, actionLabel: null }
            : { actionHref: "/sign-in", actionLabel: actions("signin") };

  const items = [
    { href: "/", label: t("home") },
    { href: "/green-coffee-offer-list", label: t("products") },
    { href: "/about", label: t("about") },
    { href: "/coffee-origins", label: t("origins") },
    { href: "/knowledge", label: t("knowledge") },
    { href: "/contact", label: t("contact") },
  ];

  /*
   * Decorative category strip. It reuses the facets already loaded above for
   * the mega menu — real published coffee types and processing methods,
   * already localized — so it costs no extra query and states nothing the
   * catalogue does not. It sits outside the sticky header and is not sticky
   * itself, so it scrolls away and the header keeps its `top-0` behaviour.
   *
   * Origins are deliberately excluded even though they are in the same object.
   * Types and processes are a controlled vocabulary; origin names are free text
   * an Administrator types, so putting them here would repeat whatever the
   * catalogue currently holds across the top of every page in the site. Types
   * and processes are also the better answer to "categories" — an origin is a
   * place, not a category.
   */
  // Shared by the header field and the drawer field, so both read the same.
  const suggestionLabels = {
    suggestions: search("suggestions"),
    searching: search("searching"),
    // Raw templates: the client fills in the live query itself.
    noSuggestions: search.raw("noSuggestions") as string,
    noSuggestionsHint: search("noSuggestionsHint"),
    viewAll: search.raw("viewAll") as string,
    coffees: search("coffees"),
    origins: search("origins"),
    suggestionCount: search.raw("suggestionCount") as string,
  };

  const tickerItems = [...facets.types, ...facets.processes].map(
    (facet) => facet.label,
  );

  return (
    <>
      <TopTicker items={tickerItems} />
      {/*
       * A floating glass bar rather than an edge-to-edge strip. The outer
       * header keeps the sticky position, the hide-on-read behaviour and the
       * reserved height (`--site-header-h`); it is transparent and lets clicks
       * through its gutters. The pill inside carries the surface: a deep-green
       * glass in both themes, so the bar always belongs to Hills rather than
       * turning generic white or black glass with the page. Because that
       * surface is always dark, the cream logo is used in both themes.
       */}
      <ScrollAwareHeader className="site-header pointer-events-none sticky top-0 z-40 h-[var(--site-header-h)] px-2 pt-2 sm:px-4 sm:pt-3 lg:px-6">
        <div className="nav-glass pointer-events-auto relative mx-auto flex h-14 max-w-[84rem] items-center justify-between gap-2 rounded-2xl ps-1.5 pe-1.5 sm:h-16 sm:gap-4 sm:rounded-full sm:ps-3 sm:pe-2.5">
          <Link
            href="/"
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark
              height={36}
              priority
              variant="on-dark"
              label={brand("logoAlt")}
              logo={logo}
              className="px-2 sm:px-3"
            />
          </Link>
          {/* `whitespace-nowrap` is intentional: the header has a responsive
            fallback below xl, so no primary label should split onto two lines
            at the widths where this desktop nav is present. */}
          <nav
            className="hidden items-center gap-4 xl:flex 2xl:gap-6"
            aria-label={t("primary")}
          >
            <Link href="/" className="whitespace-nowrap text-sm font-semibold">
              <NavUnderline>{t("home")}</NavUnderline>
            </Link>
            <CatalogMegaMenu
              labels={{
                trigger: t("products"),
                all: t("all"),
                specialty: t("specialty"),
                commercial: t("commercial"),
                productsMenu: t("productsMenu"),
                origins: t("origins"),
                originsAll: t("originsAll"),
                location: catalog("location"),
                egypt: t("egypt"),
                dubai: t("dubai"),
                // Same reasoning as the catalog aside: the Products panel used
                // to tell a signed-in customer to sign in.
                pricing:
                  persona === "verified"
                    ? catalog("pricingVisible")
                    : persona === "unverified"
                      ? catalog("pricingVerifyTitle")
                      : persona === "blocked"
                        ? catalog("pricingBlockedTitle")
                        : persona === "admin"
                          ? catalog("eyebrow")
                          : actions("pricing"),
              }}
              origins={facets.origins}
            />
            <Link
              href="/coffee-origins"
              className="whitespace-nowrap text-sm font-semibold"
            >
              <NavUnderline>{t("origins")}</NavUnderline>
            </Link>
            <Link
              href="/knowledge"
              className="whitespace-nowrap text-sm font-semibold"
            >
              <NavUnderline>{t("knowledge")}</NavUnderline>
            </Link>
            <Link
              href="/about"
              className="whitespace-nowrap text-sm font-semibold"
            >
              <NavUnderline>{t("about")}</NavUnderline>
            </Link>
            <Link
              href="/contact"
              className="whitespace-nowrap text-sm font-semibold"
            >
              <NavUnderline>{t("contact")}</NavUnderline>
            </Link>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <HeaderSearch
              labels={{
                open: search("open"),
                close: search("close"),
                placeholder: search("placeholder"),
                submit: search("submit"),
                clear: search("clear"),
              }}
              suggestionLabels={suggestionLabels}
            />
            <ThemeToggle
              label={t("theme")}
              className="nav-chip grid size-11 place-items-center rounded-full"
            />
            <LocaleSwitcher className="nav-chip flex h-11 min-h-11 items-center gap-2 rounded-full px-3 text-xs font-bold tracking-wider uppercase" />
            {signedInViewer &&
            (persona === "verified" || persona === "admin") ? (
              <AccountMenu
                locale={locale}
                name={signedInViewer.fullName || signedInViewer.email}
                initials={avatarInitials(
                  signedInViewer.fullName,
                  signedInViewer.email,
                )}
                avatarUrl={avatarUrl}
                links={
                  persona === "admin"
                    ? [
                        { href: "/admin/login", label: t("adminDashboard") },
                        { href: "/admin/account", label: t("account") },
                      ]
                    : [
                        { href: "/account", label: t("account") },
                        {
                          href: "/account/settings",
                          label: account("nav.settings"),
                        },
                        {
                          href: "/account/favorites",
                          label: account("nav.favorites"),
                        },
                        {
                          href: "/account/requests",
                          label: account("nav.requests"),
                        },
                      ]
                }
                labels={{
                  open: account("menu.open"),
                  signOut: actions("signout"),
                  confirmTitle: account("signOut.title"),
                  confirmBody: account("signOut.body"),
                  confirmAction: actions("signout"),
                  cancel: actions("cancel"),
                }}
              />
            ) : (
              <AuthCta
                persona={persona}
                className="hidden h-11 items-center gap-2 rounded-full bg-[#f3ecdd] px-5 text-xs font-bold text-[#123a2f] shadow-[0_6px_18px_-8px_rgb(0_0_0/.45)] transition hover:bg-gold-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
                map={{
                  anonymous: { label: actions("signin"), href: "/sign-in" },
                  unverified: {
                    label: cta("verifyEmail"),
                    href: "/verify-email",
                  },
                  // An Administrator is not a customer; the Admin workspace is
                  // reached at /admin/login, never through public nav.
                  admin: null,
                  blocked: { label: cta("contactSupport"), href: "/contact" },
                }}
              >
                <UserRound className="size-4" aria-hidden="true" />
              </AuthCta>
            )}
            <MobileMenu
              items={items}
              openLabel={t("menu")}
              closeLabel={t("close")}
              brandLabel={brand("logoAlt")}
              logo={logo}
              origins={facets.origins}
              labels={{
                searchPlaceholder: search("placeholder"),
                searchSubmit: search("submit"),
                searchClear: search("clear"),
                origins: t("origins"),
                originsAll: t("originsAll"),
              }}
              suggestionLabels={suggestionLabels}
              {...mobileAction}
            />
          </div>
        </div>
      </ScrollAwareHeader>
    </>
  );
}
