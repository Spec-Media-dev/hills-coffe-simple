import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ImageReveal } from "@/components/motion/primitives";
import { AnimatedDetails } from "@/components/motion/animated-details";
import { Link } from "@/i18n/navigation";
import { parseCards, parseFaq, parseStats } from "@/lib/cms/sections";
import type { CmsPage, CmsSection } from "@/lib/data/site-content";
import { SafeMarkdown } from "./safe-markdown";

/**
 * The public CMS renderer, dispatched by the typed section registry (P8-T01).
 *
 * Before Phase 8 this collapsed everything into "hero or standard": a
 * `CARD_GRID`, a `FAQ` and a `STAT_ROW` all rendered as one column of prose,
 * so four of the eight approved types had no visual identity at all
 * (finding N51).
 *
 * Nothing here validates. `getSitePage` has already checked every section
 * against its type and dropped the ones that failed, so a renderer below may
 * assume its required fields are present — and an unknown type can never
 * arrive. That ordering is what keeps a bad row from crashing a public page.
 *
 * All prose goes through `SafeMarkdown`, which sanitises and skips raw HTML.
 * Section content is authored by an Administrator but is still never trusted
 * as markup.
 */

function CtaLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-7 inline-flex h-12 min-h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-forest-light"
    >
      {label}
      {/* Logical mirroring: the arrow points "forward" in both directions. */}
      <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
    </Link>
  );
}

function SectionCopy({
  section,
  withBody = true,
}: {
  section: CmsSection;
  withBody?: boolean;
}) {
  return (
    <div lang={section.lang}>
      {section.subheading ? (
        <p className="eyebrow">{section.subheading}</p>
      ) : null}
      {section.heading ? (
        <h2 className="display-lg mt-4 max-w-4xl">{section.heading}</h2>
      ) : null}
      {withBody && section.bodyMarkdown ? (
        <SafeMarkdown className="prose-hills mt-6 max-w-3xl">
          {section.bodyMarkdown}
        </SafeMarkdown>
      ) : null}
      {section.ctaLabel && section.cta_href ? (
        <CtaLink href={section.cta_href} label={section.ctaLabel} />
      ) : null}
    </div>
  );
}

function Band({
  index,
  children,
  className = "",
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`section-space border-t border-border ${index % 2 ? "bg-page" : "bg-background"} ${className}`}
    >
      <div className="site-container">{children}</div>
    </section>
  );
}

function HeroSection({ section }: { section: CmsSection }) {
  return (
    <section className="relative min-h-[min(78svh,760px)] overflow-hidden bg-primary text-primary-foreground">
      {section.media ? (
        <ImageReveal className="absolute inset-0">
          <Image
            src={section.media.url}
            alt={section.media.alt}
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover opacity-55"
          />
        </ImageReveal>
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,60,50,.94)_0%,rgba(23,60,50,.5)_58%,rgba(23,60,50,.18)_100%)] rtl:scale-x-[-1]" />
      <div className="site-container relative flex min-h-[min(78svh,760px)] items-end py-16 md:py-24">
        <Reveal className="max-w-5xl">
          <SectionCopy section={section} />
        </Reveal>
      </div>
    </section>
  );
}

function RichTextSection({
  section,
  index,
}: {
  section: CmsSection;
  index: number;
}) {
  return (
    <Band index={index}>
      <Reveal>
        <SectionCopy section={section} />
      </Reveal>
    </Band>
  );
}

/** An image beside its prose. The registry guarantees the image is present. */
function MediaSplitSection({
  section,
  index,
}: {
  section: CmsSection;
  index: number;
}) {
  return (
    <Band index={index}>
      <div className="grid gap-10 lg:grid-cols-[1fr_.8fr] lg:items-center">
        <Reveal>
          <SectionCopy section={section} />
        </Reveal>
        {section.media ? (
          <Reveal
            delay={0.08}
            className="relative aspect-[4/3] overflow-hidden border border-border"
          >
            <Image
              src={section.media.url}
              alt={section.media.alt}
              fill
              unoptimized
              sizes="(min-width:1024px) 42vw, 100vw"
              className="object-cover"
            />
          </Reveal>
        ) : null}
      </div>
    </Band>
  );
}

function CardGridSection({
  section,
  index,
}: {
  section: CmsSection;
  index: number;
}) {
  const cards = parseCards(section.bodyMarkdown);
  return (
    <Band index={index}>
      <Reveal>
        <SectionCopy section={section} withBody={false} />
      </Reveal>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, cardIndex) => (
          <Reveal
            key={`${card.title}-${cardIndex}`}
            delay={0.04 * cardIndex}
            className="border-t border-border bg-card p-7"
          >
            <h3 className="text-xl" lang={section.lang}>
              {card.title}
            </h3>
            {card.body ? (
              <SafeMarkdown className="prose-hills mt-3 text-sm">
                {card.body}
              </SafeMarkdown>
            ) : null}
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

/**
 * Figures the editor typed, presented as figures.
 *
 * Nothing is computed or aggregated here: a number on this page is one an
 * Administrator entered, never one the application inferred (FR-046).
 */
function StatRowSection({
  section,
  index,
}: {
  section: CmsSection;
  index: number;
}) {
  const stats = parseStats(section.bodyMarkdown);
  return (
    <Band index={index}>
      <Reveal>
        <SectionCopy section={section} withBody={false} />
      </Reveal>
      <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, statIndex) => (
          <Reveal
            key={`${stat.label}-${statIndex}`}
            delay={0.04 * statIndex}
            // Column-reverse puts the figure above its label visually while
            // the DOM keeps the `dt` → `dd` order a description list needs.
            // One copy of each string: duplicating the label as `sr-only`
            // plus an `aria-hidden` twin hid the readable text from assistive
            // technology and the announced text from everyone else.
            className="flex flex-col-reverse border-t border-border bg-card p-7"
          >
            <dt
              className="mt-2 text-sm text-muted-foreground"
              lang={section.lang}
            >
              {stat.label}
            </dt>
            <dd className="text-4xl font-bold text-highlight">{stat.value}</dd>
          </Reveal>
        ))}
      </dl>
    </Band>
  );
}

function FaqSection({
  section,
  index,
}: {
  section: CmsSection;
  index: number;
}) {
  const entries = parseFaq(section.bodyMarkdown);
  return (
    <Band index={index}>
      <Reveal>
        <SectionCopy section={section} withBody={false} />
      </Reveal>
      <div className="mt-10 max-w-4xl border-t border-border">
        {entries.map((entry, entryIndex) => (
          <AnimatedDetails
            key={`${entry.question}-${entryIndex}`}
            summary={entry.question}
            lang={section.lang}
          >
            <SafeMarkdown className="prose-hills mt-3 text-sm">
              {entry.answer}
            </SafeMarkdown>
          </AnimatedDetails>
        ))}
      </div>
    </Band>
  );
}

function CtaSection({
  section,
  index,
}: {
  section: CmsSection;
  index: number;
}) {
  return (
    <section
      className={`section-space ${index % 2 ? "bg-page" : "bg-primary"}`}
    >
      <div
        className={`site-container ${index % 2 ? "" : "text-primary-foreground"}`}
      >
        <Reveal className="max-w-3xl">
          <SectionCopy section={section} />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * An entity feed. The list itself is composed by the page that owns the data,
 * so this renders the section's own framing and leaves the feed to `children`.
 */
function EntityListSection({
  section,
  index,
}: {
  section: CmsSection;
  index: number;
}) {
  return (
    <Band index={index}>
      <Reveal>
        <SectionCopy section={section} />
      </Reveal>
    </Band>
  );
}

export function CmsPageView({ page }: { page: CmsPage }) {
  return (
    <>
      {page.sections.map((section, index) => {
        switch (section.sectionType) {
          case "HERO":
            return <HeroSection key={section.id} section={section} />;
          case "MEDIA_SPLIT":
            return (
              <MediaSplitSection
                key={section.id}
                section={section}
                index={index}
              />
            );
          case "CARD_GRID":
            return (
              <CardGridSection
                key={section.id}
                section={section}
                index={index}
              />
            );
          case "STAT_ROW":
            return (
              <StatRowSection
                key={section.id}
                section={section}
                index={index}
              />
            );
          case "FAQ":
            return (
              <FaqSection key={section.id} section={section} index={index} />
            );
          case "CTA":
            return (
              <CtaSection key={section.id} section={section} index={index} />
            );
          case "ENTITY_LIST":
            return (
              <EntityListSection
                key={section.id}
                section={section}
                index={index}
              />
            );
          case "RICH_TEXT":
            return (
              <RichTextSection
                key={section.id}
                section={section}
                index={index}
              />
            );
        }
      })}
    </>
  );
}
