import { Search, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/mark";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth/session";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const actions = await getTranslations("actions");
  const brand = await getTranslations("brand");
  const viewer = await getViewer();
  const items = [
    { href: "/", label: t("home") },
    { href: "/green-coffee-offer-list", label: t("products") },
    { href: "/about", label: t("about") },
    { href: "/coffee-origins", label: t("origins") },
    { href: "/knowledge", label: t("knowledge") },
    { href: "/contact", label: t("contact") },
  ];

  return (
    <header className="site-header sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="site-container flex h-[72px] items-center justify-between gap-5">
        <Link
          href="/"
          className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark height={40} priority label={brand("logoAlt")} />
        </Link>
        <nav
          className="hidden items-center gap-8 lg:flex"
          aria-label="Primary navigation"
        >
          <Link
            href="/"
            className="text-sm font-semibold transition hover:text-gold"
          >
            {t("home")}
          </Link>
          <div className="group relative flex h-[72px] items-center focus-within:text-gold">
            <Link
              href="/green-coffee-offer-list"
              className="text-sm font-semibold transition hover:text-gold"
            >
              {t("products")}
            </Link>
            <div className="invisible absolute top-[68px] start-1/2 w-[590px] -translate-x-1/2 translate-y-2 rounded-2xl border border-border bg-card p-3 opacity-0 shadow-[var(--shadow-soft)] transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="grid grid-cols-[1.25fr_1fr] gap-2">
                <div className="rounded-xl bg-primary p-5 text-primary-foreground">
                  <p className="eyebrow !text-gold-contrast">{t("catalog")}</p>
                  <p className="mt-8 max-w-xs font-heading text-2xl leading-tight">
                    {t("all")}
                  </p>
                  <div className="mt-5 flex gap-2 text-xs">
                    <span className="rounded-full border border-white/20 px-3 py-1">
                      {t("specialty")}
                    </span>
                    <span className="rounded-full border border-white/20 px-3 py-1">
                      {t("commercial")}
                    </span>
                  </div>
                </div>
                <div className="grid gap-1 p-2 text-sm">
                  <Link
                    href="/green-coffee-offer-list?location=Egypt"
                    className="rounded-lg px-3 py-2.5 hover:bg-muted"
                  >
                    {t("egypt")}
                  </Link>
                  <Link
                    href="/green-coffee-offer-list?location=Dubai"
                    className="rounded-lg px-3 py-2.5 hover:bg-muted"
                  >
                    {t("dubai")}
                  </Link>
                  <Link
                    href="/green-coffee-offer-list?certified=true"
                    className="rounded-lg px-3 py-2.5 hover:bg-muted"
                  >
                    {t("certifications")}
                  </Link>
                  <Link
                    href="/green-coffee-offer-list"
                    className="mt-2 rounded-lg bg-gold px-3 py-2.5 font-bold text-[#17251c]"
                  >
                    {t("all")} →
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <Link
            href="/coffee-origins"
            className="text-sm font-semibold transition hover:text-gold"
          >
            {t("origins")}
          </Link>
          <Link
            href="/knowledge"
            className="text-sm font-semibold transition hover:text-gold"
          >
            {t("knowledge")}
          </Link>
          <Link
            href="/about"
            className="text-sm font-semibold transition hover:text-gold"
          >
            {t("about")}
          </Link>
          <Link
            href="/contact"
            className="text-sm font-semibold transition hover:text-gold"
          >
            {t("contact")}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/green-coffee-offer-list"
            className="hidden size-11 place-items-center rounded-full border border-border transition hover:border-gold hover:text-gold sm:grid"
            aria-label="Search"
          >
            <Search className="size-4" />
          </Link>
          <ThemeToggle />
          <LocaleSwitcher />
          <Link
            href={viewer ? "/account" : "/sign-in"}
            className="hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-forest-light sm:flex"
          >
            <UserRound className="size-4" />
            {viewer ? t("account") : actions("signin")}
          </Link>
          <MobileMenu
            items={items}
            openLabel={t("menu")}
            closeLabel={t("close")}
            brandLabel={brand("logoAlt")}
          />
        </div>
      </div>
    </header>
  );
}
