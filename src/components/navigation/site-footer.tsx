import { getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/mark";
import { SocialIcon } from "@/components/brand/social-icons";
import { SOCIAL_PROFILES } from "@/lib/contact/regions";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSiteLogo } from "@/lib/data/site-logo";
import { getSitePage, getSiteSettings } from "@/lib/data/site-content";
import { requireVerifiedUser } from "@/lib/auth/session";
import { getPublicPersona } from "@/lib/auth/persona";
import { AuthCta } from "@/components/auth/auth-cta";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const brand = await getTranslations("brand");
  const actions = await getTranslations("actions");
  const account = await getTranslations("account");
  const cta = await getTranslations("cta");
  const contact = await getTranslations("contact");
  const locale = (await getLocale()) as Locale;
  const [logo, settings, viewer, persona, privacyPage, termsPage] =
    await Promise.all([
      getSiteLogo(locale),
      getSiteSettings(locale),
      requireVerifiedUser(),
      getPublicPersona(),
      getSitePage("privacy", locale),
      getSitePage("terms", locale),
    ]);
  const legalPages = [
    privacyPage ? { href: "/privacy", label: privacyPage.title } : null,
    termsPage ? { href: "/terms", label: termsPage.title } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));
  return (
    <footer className="site-footer bg-[#13241b] text-[#eee8dc]">
      <div className="h-2 bg-gold" aria-hidden="true" />
      <div className="site-container grid gap-x-8 gap-y-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:py-20">
        <div className="md:col-span-2 lg:col-span-1">
          <BrandMark height={46} label={brand("logoAlt")} logo={logo} />
          <p className="mt-7 max-w-sm font-heading text-3xl font-semibold leading-tight text-[#eee4d1]">
            {t("statement")}
          </p>
          {/* The company's profiles appear once, site-wide, here. */}
          <ul className="mt-8 flex gap-2.5" aria-label={t("follow")}>
            {SOCIAL_PROFILES.map((profile) => (
              <li key={profile.network}>
                <a
                  href={profile.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={contact("regions.socialLabel", {
                    network: profile.label,
                  })}
                  className="grid size-10 place-items-center rounded-full border border-white/15 text-[#c8bfb0] transition-colors hover:border-gold-bright hover:text-gold-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright"
                >
                  <SocialIcon network={profile.network} className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">{t("explore")}</p>
          <div className="footer-links mt-6 grid gap-3 text-sm text-[#c8bfb0]">
            <Link href="/green-coffee-offer-list">{nav("products")}</Link>
            <Link href="/coffee-origins">{nav("origins")}</Link>
            <Link href="/knowledge">{nav("knowledge")}</Link>
            <Link href="/about">{nav("about")}</Link>
          </div>
        </div>
        <div>
          <p className="eyebrow">{nav("account")}</p>
          <div className="footer-links mt-6 grid gap-3 text-sm text-[#c8bfb0]">
            {viewer ? (
              <>
                <Link href="/account">{nav("account")}</Link>
                <Link href="/account/favorites">
                  {account("nav.favorites")}
                </Link>
                <Link href="/account/requests">{account("nav.requests")}</Link>
              </>
            ) : (
              /*
               * Previously an unconditional "Sign in", which an Administrator
               * and an unverified customer both saw despite already holding a
               * session. The persona decides what is actually useful to them.
               */
              <AuthCta
                persona={persona}
                map={{
                  anonymous: { label: actions("signin"), href: "/sign-in" },
                  unverified: {
                    label: cta("verifyEmail"),
                    href: "/verify-email",
                  },
                  blocked: { label: cta("contactSupport"), href: "/contact" },
                  admin: null,
                }}
              />
            )}
          </div>
        </div>
        <div>
          <p className="eyebrow">{nav("contact")}</p>
          <div className="footer-links mt-6 grid gap-3 text-sm text-[#c8bfb0]">
            {settings?.org_email ? (
              <a href={`mailto:${settings.org_email}`}>{settings.org_email}</a>
            ) : null}
            {settings?.org_phone ? (
              <a href={`tel:${settings.org_phone}`}>{settings.org_phone}</a>
            ) : null}
            {settings?.address ? <span>{settings.address}</span> : null}
            {/*
             * The two regional desks, linked straight to their card on the
             * Contact page. The addresses themselves are not repeated here —
             * this is a way in, not a second copy of the same content.
             */}
            <Link href="/contact#uae">{t("officeUae")}</Link>
            <Link href="/contact#egypt">{t("officeEgypt")}</Link>
            <Link href="/contact">{nav("contact")}</Link>
          </div>
        </div>
        <div>
          <p className="eyebrow">{t("legal")}</p>
          <div className="footer-links mt-6 grid gap-3 text-sm text-[#c8bfb0]">
            {legalPages.length ? (
              legalPages.map((page) => (
                <Link key={page.href} href={page.href}>
                  {page.label}
                </Link>
              ))
            ) : (
              <span className="text-[#8fa095]">—</span>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="site-container flex flex-col gap-3 py-5 text-xs text-[#8fa095] sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {t("rights")}
          </span>
          <span>
            {settings?.displayName ||
              settings?.org_brand_name ||
              brand("logoAlt")}
          </span>
        </div>
      </div>
    </footer>
  );
}
