import type { Metadata } from "next";
import { Compass, Handshake, ScanLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "About us",
  description:
    "The sourcing approach and regional service model behind Hills Coffee.",
};
export default async function AboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  const t = await getTranslations("about");
  const principles = [
    [ScanLine, t("one"), t("oneBody")],
    [Compass, t("two"), t("twoBody")],
    [Handshake, t("three"), t("threeBody")],
  ] as const;
  return (
    <>
      <section className="section-space overflow-hidden bg-primary text-white">
        <div className="site-container grid gap-12 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <Reveal>
            <p className="eyebrow !text-gold-contrast">{t("eyebrow")}</p>
            <h1 className="display-xl mt-6">{t("title")}</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-xl leading-9 text-white/68">{t("intro")}</p>
          </Reveal>
        </div>
      </section>
      <section className="section-space bg-page">
        <div className="site-container grid gap-14 lg:grid-cols-[.75fr_1.25fr]">
          <Reveal>
            <p className="eyebrow">{t("principles")}</p>
            <h2 className="display-lg mt-5">
              {locale === "ar"
                ? "عمل هادئ. أثر واضح."
                : "Quiet work. Clear impact."}
            </h2>
          </Reveal>
          <Stagger className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border">
            {principles.map(([Icon, title, body], index) => (
              <StaggerItem
                key={title}
                className="grid gap-5 bg-card p-7 sm:grid-cols-[auto_1fr] sm:p-9"
              >
                <span className="grid size-12 place-items-center rounded-full bg-primary text-gold-bright">
                  <Icon className="size-5" />
                </span>
                <div>
                  <span className="text-xs font-bold text-gold">
                    0{index + 1}
                  </span>
                  <h3 className="mt-2 text-3xl">{title}</h3>
                  <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
                    {body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
      <section className="section-space bg-background">
        <div className="site-container">
          <Reveal className="grid gap-8 border-y border-border py-12 md:grid-cols-3">
            {[
              [
                "10+",
                locale === "ar"
                  ? "مناشئ ضمن شبكة الاختيار"
                  : "origins across our selection network",
              ],
              [
                "2",
                locale === "ar"
                  ? "مراكز مخزون إقليمية"
                  : "regional stock points",
              ],
              [
                "1",
                locale === "ar"
                  ? "فريق مسؤول من البداية للنهاية"
                  : "accountable team from sample to supply",
              ],
            ].map(([value, label]) => (
              <div key={value + label}>
                <strong className="font-heading text-6xl text-gold">
                  {value}
                </strong>
                <p className="mt-3 max-w-[16rem] text-sm leading-6 text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </>
  );
}
