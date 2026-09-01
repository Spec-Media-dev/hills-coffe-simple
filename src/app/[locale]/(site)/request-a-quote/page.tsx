import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CmsPageView } from "@/components/content/cms-page";
import { RequestQuoteForm } from "@/components/inquiries/request-quote-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireVerifiedUser } from "@/lib/auth/session";
import { getOfferList } from "@/lib/data/catalog";
import { getSitePage } from "@/lib/data/site-content";
import { cmsMetadata, localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/request-a-quote">): Promise<Metadata> {
  const { locale } = await params;
  const page = await getSitePage("request-a-quote", locale as Locale);
  if (page) return cmsMetadata(page, locale as Locale, "/request-a-quote");
  const meta = await getTranslations({ locale, namespace: "quote" });
  return localizedMetadata({
    locale: locale as Locale,
    path: "/request-a-quote",
    title: meta("metaTitle"),
    description: meta("metaDescription"),
    robots: { index: false, follow: true },
  });
}

export default async function RequestQuotePage({
  params,
}: PageProps<"/[locale]/request-a-quote">) {
  const { locale } = await params;
  const [page, viewer, catalog] = await Promise.all([
    getSitePage("request-a-quote", locale as Locale),
    requireVerifiedUser(),
    getOfferList(locale as Locale),
  ]);
  const t = await getTranslations("quote");
  const text = {
    title: t("title"),
    intro: t("intro"),
    signin: t("signin"),
    empty: t("empty"),
  };
  const offers = catalog.offers.map((item) => ({
    id: item.id,
    label: `${item.name} · ${item.warehouse} · ${item.reference}`,
  }));

  return (
    <>
      {page ? (
        <CmsPageView page={page} />
      ) : (
        <section className="section-space bg-primary text-primary-foreground">
          <div className="site-container">
            <p className="eyebrow !text-gold-contrast">Hills Coffee</p>
            <h1 className="display-lg mt-6 max-w-4xl">{text.title}</h1>
            <p className="mt-6 max-w-2xl text-white/70">{text.intro}</p>
          </div>
        </section>
      )}
      <section className="section-space">
        <div className="site-container max-w-3xl">
          {viewer && offers.length ? (
            <RequestQuoteForm offers={offers} />
          ) : viewer ? (
            <p className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              {text.empty}
            </p>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <p>{text.intro}</p>
              <Link
                href="/sign-in?next=/request-a-quote"
                className="mt-7 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
              >
                {text.signin}
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
