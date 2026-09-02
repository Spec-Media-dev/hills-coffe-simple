import { getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/mark";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSiteLogo } from "@/lib/data/site-logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const brand = await getTranslations("brand");
  const logo = await getSiteLogo((await getLocale()) as Locale);
  return (
    <footer className="site-footer border-t border-white/10 bg-[#13241b] text-[#eee8dc]">
      <div className="site-container grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <BrandMark height={46} label={brand("logoAlt")} logo={logo} />
          <p className="mt-6 max-w-sm text-2xl font-medium leading-snug text-[#c8bfb0]">
            {t("statement")}
          </p>
        </div>
        <div>
          <p className="eyebrow">{t("explore")}</p>
          <div className="mt-6 grid gap-3 text-sm text-[#c8bfb0]">
            <Link href="/green-coffee-offer-list">{nav("products")}</Link>
            <Link href="/coffee-origins">{nav("origins")}</Link>
            <Link href="/knowledge">{nav("knowledge")}</Link>
            <Link href="/about">{nav("about")}</Link>
            <Link href="/contact">{nav("contact")}</Link>
          </div>
        </div>
        <div>
          <p className="eyebrow">{t("locations")}</p>
          <div className="mt-6 grid gap-3 text-sm text-[#c8bfb0]">
            <span>{nav("egypt")}</span>
            <span>{nav("dubai")}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="site-container flex flex-col gap-3 py-5 text-xs text-[#8fa095] sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {t("rights")}
          </span>
          <span className="flex gap-5">
            <span>{t("privacy")}</span>
            <span>{t("terms")}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
