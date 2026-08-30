import type { Metadata } from "next";
import { Clock3, Mail, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/contact/contact-form";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Hills Coffee about green coffee availability in Egypt and Dubai.",
};
export default async function ContactPage({
  params,
}: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  const t = await getTranslations("contact");
  const labels = {
    name: t("name"),
    email: t("email"),
    company: t("company"),
    location: t("location"),
    message: t("message"),
    send: t("send"),
    note: t("note"),
  };
  return (
    <section className="section-space bg-page">
      <div className="site-container">
        <Reveal className="max-w-4xl">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="display-xl mt-6">{t("title")}</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t("intro")}
          </p>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <Reveal className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-9">
            <ContactForm labels={labels} />
          </Reveal>
          <Reveal
            delay={0.08}
            className="rounded-2xl bg-primary p-7 text-white md:p-9"
          >
            <p className="eyebrow !text-gold-contrast">{t("details")}</p>
            <div className="mt-10 grid gap-8">
              <div className="flex gap-4">
                <Mail className="size-5 shrink-0 text-gold-bright" />
                <div>
                  <p className="text-sm text-white/50">
                    {locale === "ar" ? "البريد الإلكتروني" : "Email"}
                  </p>
                  <a
                    href="mailto:hello@hillscoffee.co"
                    className="mt-1 block font-bold"
                  >
                    hello@hillscoffee.co
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <MapPin className="size-5 shrink-0 text-gold-bright" />
                <div>
                  <p className="text-sm text-white/50">
                    {locale === "ar" ? "المخازن" : "Warehouses"}
                  </p>
                  <p className="mt-1 font-bold">
                    {locale === "ar" ? "القاهرة · دبي" : "Cairo · Dubai"}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock3 className="size-5 shrink-0 text-gold-bright" />
                <div>
                  <p className="text-sm text-white/50">
                    {locale === "ar" ? "ساعات العمل" : "Hours"}
                  </p>
                  <p className="mt-1 font-bold">{t("hours")}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
