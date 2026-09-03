import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CmsPageView } from "@/components/content/cms-page";
import { PublicRfqForm } from "@/components/inquiries/public-inquiry-form";
import { RequestQuoteForm } from "@/components/inquiries/request-quote-form";
import type { Locale } from "@/i18n/routing";
import { requireVerifiedUser } from "@/lib/auth/session";
import { getOfferList } from "@/lib/data/catalog";
import { getSitePage } from "@/lib/data/site-content";
import { cmsMetadata, localizedMetadata } from "@/lib/seo/metadata";
import { SectionReveal } from "@/components/motion/primitives";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/request-a-quote">): Promise<Metadata> {
  const { locale } = await params;
  const page = await getSitePage("request-a-quote", locale as Locale);
  if (page) return cmsMetadata(page, locale as Locale, "/request-a-quote");
  const meta = await getTranslations({ locale, namespace: "quote" });
  // Indexable since the Owner Alignment addendum: an anonymous visitor can
  // now complete a real RFQ here, so this is a genuine public entry point
  // rather than an account-only utility page (FR-061, FR-079).
  return localizedMetadata({
    locale: locale as Locale,
    path: "/request-a-quote",
    title: meta("metaTitle"),
    description: meta("metaDescription"),
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
  const publicCopy = await getTranslations("publicInquiry");
  // The hero speaks to whoever is actually reading it. A signed-in customer
  // is here to quote a specific lot; an anonymous visitor — and every
  // crawler, since this page is now indexable — is here to open a general
  // sourcing conversation, and the old "sign in with a verified email"
  // intro would be simply untrue for them.
  const text = {
    title: viewer ? t("title") : publicCopy("rfqTitle"),
    intro: viewer ? t("intro") : publicCopy("rfqIntro"),
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
        <SectionReveal className="site-container max-w-3xl">
          {viewer && offers.length ? (
            <RequestQuoteForm offers={offers} />
          ) : viewer ? (
            <p className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              {text.empty}
            </p>
          ) : (
            // Anonymous visitors get a working GENERAL RFQ rather than the
            // sign-in wall this branch used to be. The two signed-in branches
            // above are untouched: a verified customer still picks a specific
            // offer and raises a PRODUCT inquiry exactly as before (FR-076).
            <div className="grid gap-8">
              <PublicRfqForm />
              <div>
                <h2 className="text-lg font-bold">
                  {publicCopy("stepsTitle")}
                </h2>
                <ol className="mt-4 grid gap-3 text-sm text-muted-foreground">
                  {[
                    publicCopy("step1"),
                    publicCopy("step2"),
                    publicCopy("step3"),
                  ].map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="font-mono text-xs font-bold text-highlight"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="leading-6">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </SectionReveal>
      </section>
    </>
  );
}
