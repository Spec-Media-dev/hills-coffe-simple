import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { CmsPage, CmsSection } from "@/lib/data/site-content";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/motion/reveal";
import { SafeMarkdown } from "./safe-markdown";

function SectionCopy({ section }: { section: CmsSection }) {
  return (
    <div lang={section.lang}>
      <p className="eyebrow">{section.subheading}</p>
      {section.heading ? (
        <h2 className="display-lg mt-4 max-w-4xl">{section.heading}</h2>
      ) : null}
      {section.bodyMarkdown ? (
        <SafeMarkdown className="prose-hills mt-6 max-w-3xl">
          {section.bodyMarkdown}
        </SafeMarkdown>
      ) : null}
      {section.ctaLabel && section.cta_href ? (
        <Link
          href={section.cta_href}
          className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground"
        >
          {section.ctaLabel}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" />
        </Link>
      ) : null}
    </div>
  );
}
function HeroSection({ section }: { section: CmsSection }) {
  return (
    <section className="relative min-h-[min(78svh,760px)] overflow-hidden bg-primary text-primary-foreground">
      {section.media ? (
        <Image
          src={section.media.url}
          alt={section.media.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
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
function StandardSection({
  section,
  index,
}: {
  section: CmsSection;
  index: number;
}) {
  return (
    <section
      className={`section-space ${index % 2 ? "bg-page" : "bg-background"}`}
    >
      <div className="site-container grid gap-10 lg:grid-cols-[1fr_.8fr] lg:items-center">
        <Reveal>
          <SectionCopy section={section} />
        </Reveal>
        {section.media ? (
          <Reveal
            delay={0.08}
            className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-border"
          >
            <Image
              src={section.media.url}
              alt={section.media.alt}
              fill
              sizes="(min-width:1024px) 42vw, 100vw"
              className="object-cover"
            />
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
export function CmsPageView({ page }: { page: CmsPage }) {
  return (
    <>
      {page.sections.map((section, index) =>
        section.section_type === "HERO" ? (
          <HeroSection key={section.id} section={section} />
        ) : (
          <StandardSection key={section.id} section={section} index={index} />
        ),
      )}
    </>
  );
}
