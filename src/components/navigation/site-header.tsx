import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/mark";
import { HeaderSearch } from "./header-search";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";
import { CatalogMegaMenu } from "./catalog-mega-menu";
import { NavUnderline } from "@/components/motion/primitives";
import { ThemeToggle } from "./theme-toggle";
import { Link } from "@/i18n/navigation";
import { requireVerifiedUser } from "@/lib/auth/session";
import { getPublicPersona } from "@/lib/auth/persona";
import { AuthCta } from "@/components/auth/auth-cta";
import { getCatalogFacets } from "@/lib/data/catalog-query";
import { AccountMenu } from "./account-menu";
import { avatarInitials, getOwnAvatarUrl } from "@/lib/data/avatar";
import { getSiteLogo } from "@/lib/data/site-logo";
import type { Locale } from "@/i18n/routing";
import { getLocale } from "next-intl/server";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const actions = await getTranslations("actions");
  const brand = await getTranslations("brand");
  // Only a verified, unblocked customer gets the account affordance.
  // requireVerifiedUser() rejects ADMIN and blocked sessions, so an
  // Administrator is never rendered as a protected-pricing customer and a
  // blocked customer's protected UI disappears (Constitution VI and VII).
  const viewer = await requireVerifiedUser();
  /*
   * `requireVerifiedUser()` still decides the account affordance, unchanged.
   * The persona is presentation only: it decides what the *call to action*
   * says, which is what stopped an Administrator and an unverified customer
   * both being shown a "Sign in" button they should never see.
   */
  const persona = await getPublicPersona();
  const locale = (await getLocale()) as Locale;
  const avatarUrl = viewer ? await getOwnAvatarUrl() : null;
  // Resolved once per render and shared with the mobile menu, which is a
  // client component and cannot read it itself.
  const logo = await getSiteLogo(locale);
  const account = await getTranslations("account");
  const catalog = await getTranslations("catalog");
  const search = await getTranslations("search");
  const cta = await getTranslations("cta");
  // Real, active, already-localized origins — the same source the catalog
  // filter uses, so the menu can never offer an origin the filter rejects.
  const facets = await getCatalogFacets(locale);
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

  return (
    <header className="site-header sticky top-0 z-40 border-b border-border/75 bg-background/92 backdrop-blur-xl">
      <div className="site-container flex h-20 items-center justify-between gap-3 sm:gap-5">
        <Link
          href="/"
          className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark
            height={38}
            priority
            label={brand("logoAlt")}
            logo={logo}
            className="px-2 sm:px-3"
          />
        </Link>
        <nav
          className="hidden items-center gap-7 xl:flex"
          aria-label={t("primary")}
        >
          <Link href="/" className="text-sm font-semibold">
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
          <Link href="/coffee-origins" className="text-sm font-semibold">
            <NavUnderline>{t("origins")}</NavUnderline>
          </Link>
          <Link href="/knowledge" className="text-sm font-semibold">
            <NavUnderline>{t("knowledge")}</NavUnderline>
          </Link>
          <Link href="/about" className="text-sm font-semibold">
            <NavUnderline>{t("about")}</NavUnderline>
          </Link>
          <Link href="/contact" className="text-sm font-semibold">
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
            }}
          />
          <ThemeToggle label={t("theme")} />
          <LocaleSwitcher />
          {viewer ? (
            <AccountMenu
              locale={locale}
              name={viewer.fullName || viewer.email}
              initials={avatarInitials(viewer.fullName, viewer.email)}
              avatarUrl={avatarUrl}
              links={[
                { href: "/account", label: t("account") },
                { href: "/account/settings", label: account("nav.settings") },
                { href: "/account/favorites", label: account("nav.favorites") },
                { href: "/account/requests", label: account("nav.requests") },
              ]}
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
              className="hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-forest-light sm:flex"
              map={{
                anonymous: { label: actions("signin"), href: "/sign-in" },
                unverified: {
                  label: cta("verifyEmail"),
                  href: "/verify-email",
                },
                // An Administrator is not a customer; the Admin workspace is
                // reached at /dashboard-admin, never through public nav.
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
              origins: t("origins"),
              originsAll: t("originsAll"),
            }}
            {...mobileAction}
          />
        </div>
      </div>
    </header>
  );
}
