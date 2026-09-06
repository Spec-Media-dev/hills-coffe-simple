import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedMetadata } from "@/lib/seo/metadata";

const sections = [
  "website",
  "account",
  "samples",
  "inquiries",
  "privacy",
  "sharing",
  "cookies",
  "contact",
] as const;

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return localizedMetadata({
    locale,
    path: "/legal",
    title: t("title"),
    description: t("description"),
  });
}

export default async function LegalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <article className="bg-page">
      <header className="border-b border-border">
        <div className="site-container py-14 md:py-20">
          <p className="eyebrow">Hills Coffee</p>
          <h1 className="display-lg mt-5 max-w-4xl">{t("title")}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            {t("intro")}
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            <time dateTime="2026-09-06">{t("updated")}</time>
          </p>
        </div>
      </header>
      <div className="site-container grid gap-10 py-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 lg:py-16">
        <nav aria-label={t("contents")}>
          <p className="font-bold">{t("contents")}</p>
          <ul className="mt-4 grid gap-1">
            {sections.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-11 items-center py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  {t(`sections.${id}.title`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-3xl">
          {sections.map((id) => (
            <section
              key={id}
              id={id}
              aria-labelledby={`${id}-title`}
              className="scroll-mt-36 border-b border-border pb-9 not-first:pt-9"
            >
              <h2
                id={`${id}-title`}
                className="font-heading text-2xl font-bold"
              >
                {t(`sections.${id}.title`)}
              </h2>
              <p className="mt-4 leading-8 text-muted-foreground">
                {t(`sections.${id}.body`)}
              </p>
              {id === "contact" ? (
                <Link
                  href="/contact"
                  className="mt-5 inline-flex min-h-11 items-center font-bold underline underline-offset-4"
                >
                  {t("contactLink")}
                </Link>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
