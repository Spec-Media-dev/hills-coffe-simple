import { Search, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/mark";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";
import { CatalogMegaMenu } from "./catalog-mega-menu";
import { NavUnderline } from "@/components/motion/primitives";
import { ThemeToggle } from "./theme-toggle";
import { Link } from "@/i18n/navigation";
import { requireVerifiedUser } from "@/lib/auth/session";
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
  const locale = (await getLocale()) as Locale;
  const avatarUrl = viewer ? await getOwnAvatarUrl() : null;
  // Resolved once per render and shared with the mobile menu, which is a
  // client component and cannot read it itself.
  const logo = await getSiteLogo(locale);
  const account = await getTranslations("account");
  const catalog = await getTranslations("catalog");
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
              origins: t("origins"),
              egypt: t("egypt"),
              dubai: t("dubai"),
              pricing: actions("pricing"),
            }}
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
          <Link
            href="/green-coffee-offer-list"
            className="hidden size-11 place-items-center rounded-full border border-border transition hover:border-gold hover:text-gold sm:grid"
            aria-label={catalog("search")}
          >
            <Search className="size-4" />
          </Link>
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
            <Link
              href="/sign-in"
              className="hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-forest-light sm:flex"
            >
              <UserRound className="size-4" />
              {actions("signin")}
            </Link>
          )}
          <MobileMenu
            items={items}
            openLabel={t("menu")}
            closeLabel={t("close")}
            brandLabel={brand("logoAlt")}
            logo={logo}
            actionHref={viewer ? "/account" : "/sign-in"}
            actionLabel={viewer ? t("account") : actions("signin")}
          />
        </div>
      </div>
    </header>
  );
}
