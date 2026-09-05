import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SocialIcon, WhatsAppIcon } from "@/components/brand/social-icons";
import { RegionMap } from "@/components/contact/region-map";
import { SectionReveal } from "@/components/motion/primitives";
import type { Locale } from "@/i18n/routing";
import {
  CONTACT_REGIONS,
  mapEmbedSrc,
  whatsAppUrl,
  type ContactRegion,
} from "@/lib/contact/regions";
import { env } from "@/lib/env";

/**
 * The regional office cards.
 *
 * Two hairline-separated cards in the grid rhythm the rest of the site uses —
 * `gap-px` over a `bg-border` ground, so the separator is the page's own rule
 * rather than a border drawn twice. Each card states the same facts in the
 * same order, which is the point: a reader comparing Dubai and Cairo should
 * not have to hunt for the phone number in a different place.
 *
 * Every displayed string comes from the translation catalogue. The module
 * `@/lib/contact/regions` supplies only what must not be translated — dial
 * strings, URLs, the registered facility name — so there is no bilingual copy
 * anywhere in this file.
 */

const CHIP =
  "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-gold hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The compact variant, for the actions that sit under a phone number. */
const ACTION =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:border-gold hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** One ledger row: icon, label, value. `dt`/`dd` inside a `div` is valid. */
function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3 gap-y-1 border-t border-border py-4 sm:grid-cols-[1.25rem_8.5rem_1fr]">
      <span className="mt-0.5 text-highlight" aria-hidden="true">
        {icon}
      </span>
      <dt className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase rtl:tracking-normal">
        {label}
      </dt>
      <dd className="col-span-2 text-sm leading-6 sm:col-span-1">{children}</dd>
    </div>
  );
}

async function RegionCard({
  region,
  locale,
}: {
  region: ContactRegion;
  locale: Locale;
}) {
  const t = await getTranslations("contact");
  const name = t(`regions.${region.id}.name`);

  return (
    <article id={region.id} className="scroll-mt-28 bg-card">
      <RegionMap
        src={mapEmbedSrc({
          region,
          locale,
          apiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY,
        })}
        title={t("regions.mapTitle", { region: name })}
        action={t("regions.showMap")}
        placeName={name}
      />
      <div className="p-7 md:p-9">
        <p className="eyebrow">{t(`regions.${region.id}.type`)}</p>
        <h3 className="mt-4 font-heading text-3xl leading-tight font-bold">
          {name}
        </h3>

        <dl className="mt-7">
          <Row
            icon={<MapPin className="size-5" />}
            label={t("regions.address")}
          >
            {t(`regions.${region.id}.address`)}
          </Row>
          {region.facility ? (
            <Row
              icon={<Building2 className="size-5" />}
              label={t("regions.facility")}
            >
              {region.facility}
            </Row>
          ) : null}
          <Row icon={<Clock className="size-5" />} label={t("regions.hours")}>
            {t(`regions.${region.id}.hours`)}
          </Row>
          <Row icon={<Phone className="size-5" />} label={t("regions.phone")}>
            {/*
             * The number is shown as text, and each thing you can do with it
             * is its own labelled control. Making the number itself a single
             * link forced a guess about which app should open — and on a line
             * that takes both calls and WhatsApp, either guess is wrong half
             * the time.
             */}
            <div className="grid gap-3.5">
              {region.phones.map((phone) => (
                <div key={phone.dial} className="grid gap-2">
                  {/* A phone number reads left-to-right in every language; the
                      attribute also isolates it so surrounding Arabic cannot
                      reorder the digits. */}
                  <span dir="ltr" className="w-fit font-semibold">
                    {phone.display}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`tel:${phone.dial}`}
                      className={ACTION}
                      aria-label={t("regions.callLabel", {
                        region: name,
                        number: phone.display,
                      })}
                    >
                      <Phone className="size-3.5" aria-hidden="true" />
                      {t("regions.call")}
                    </a>
                    {phone.whatsapp ? (
                      <a
                        /* https, never `tel:` — this must open WhatsApp, not
                           the operating system's call-app chooser. */
                        href={whatsAppUrl(phone.dial)!}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={ACTION}
                        aria-label={t("regions.whatsappLabel", {
                          region: name,
                          number: phone.display,
                        })}
                      >
                        <WhatsAppIcon className="size-3.5 text-[#25d366]" />
                        {t("regions.whatsapp")}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Row>
        </dl>

        <div className="mt-7 flex flex-wrap gap-2.5">
          {region.email ? (
            <a
              href={`mailto:${region.email}`}
              className={CHIP}
              /* The address itself is on the control, for anyone who wants to
                 copy it rather than open a mail client. */
              title={region.email}
              aria-label={t("regions.emailLabel", { region: name })}
            >
              <Mail className="size-4" aria-hidden="true" />
              {t("regions.emailAction")}
            </a>
          ) : (
            /* No `mailto:` is rendered until a real address is configured —
               a link to a placeholder would open an empty compose window. */
            <span
              aria-disabled="true"
              data-testid={`email-pending-${region.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
            >
              <Mail className="size-4" aria-hidden="true" />
              {t("regions.emailPending")}
            </span>
          )}
          <a
            href={region.mapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={CHIP}
            aria-label={t("regions.mapsLabel", { region: name })}
          >
            <MapPin className="size-4" aria-hidden="true" />
            {t("regions.mapsAction")}
          </a>
        </div>

        <ul className="mt-3 flex flex-wrap gap-2.5">
          {region.social.map((profile) => (
            <li key={profile.network}>
              <a
                href={profile.url}
                target="_blank"
                rel="noreferrer noopener"
                className={CHIP}
                aria-label={t("regions.socialLabel", {
                  network: profile.label,
                })}
              >
                <SocialIcon network={profile.network} className="size-4" />
                {profile.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export async function ContactRegionSection({ locale }: { locale: Locale }) {
  const t = await getTranslations("contact");
  return (
    <section id="offices" className="scroll-mt-24 pb-24">
      <div className="site-container">
        <SectionReveal>
          <p className="eyebrow">{t("regions.eyebrow")}</p>
          <h2 className="display-lg mt-4 max-w-3xl">{t("regions.title")}</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t("regions.intro")}
          </p>
        </SectionReveal>
        <div className="mt-12 grid gap-px bg-border lg:grid-cols-2">
          {CONTACT_REGIONS.map((region) => (
            <RegionCard key={region.id} region={region} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
