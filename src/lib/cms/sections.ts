import { z } from "zod";

/**
 * P8-T01 — the typed CMS section registry.
 *
 * One table maps every approved `section_type` to the shape it needs, so that
 * exactly one definition governs three things that used to disagree:
 *
 *  - what the Admin editor asks for,
 *  - what is accepted before a write,
 *  - what the public renderer is allowed to assume.
 *
 * Before this existed the renderer collapsed every type into "hero or
 * standard", the create action offered `WAREHOUSES` and `MEDIA_TEXT` (neither
 * approved, neither present in any row) while being unable to create the
 * `MEDIA_SPLIT` sections the database already held, and nothing validated a
 * section's content at all (findings N51, N52).
 *
 * **Storage note.** The live schema gives a section `media_id`, `cta_href`,
 * `entity_ref`, `entity_limit` and — per locale — `heading`, `subheading`,
 * `body_markdown`, `cta_label`. There is no JSON props column, and Phase 8 is
 * explicitly not permitted to add one. So the three list-shaped types
 * (`CARD_GRID`, `STAT_ROW`, `FAQ`) express their items through
 * `body_markdown`, in a documented convention this module both validates and
 * parses. The convention is deliberately the plain Markdown an editor would
 * write anyway, so the body stays readable and safe if it is ever rendered as
 * ordinary prose.
 */

/**
 * Exactly the values `site_pages_template_check` permits.
 *
 * The Admin's create form used to offer `STANDARD` as its first and default
 * option, which the check constraint has always rejected — so creating a page
 * without changing the template could never succeed (finding N54).
 *
 * This lives here, beside the section vocabulary, rather than in the action:
 * a `"use server"` module may only export async functions.
 */
export const PAGE_TEMPLATES = [
  "HOME",
  "ABOUT",
  "COMMERCIAL",
  "SEGMENT",
  "PRICING",
  "SUPPORT",
  "LEGAL",
  "CONTACT",
] as const;

export type PageTemplate = (typeof PAGE_TEMPLATES)[number];

export const SECTION_TYPES = [
  "HERO",
  "RICH_TEXT",
  "CARD_GRID",
  "MEDIA_SPLIT",
  "CTA",
  "STAT_ROW",
  "FAQ",
  "ENTITY_LIST",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const isSectionType = (value: unknown): value is SectionType =>
  typeof value === "string" &&
  (SECTION_TYPES as readonly string[]).includes(value);

/** The entity feeds a list section may draw from, as used by live rows. */
export const ENTITY_REFS = [
  "FEATURED_COFFEES",
  "FEATURED_ORIGINS",
  "LATEST_ARTICLES",
  "WAREHOUSES",
  "COMMERCIAL_PAGES",
] as const;

export type EntityRef = (typeof ENTITY_REFS)[number];

/** What a section row and its active translation together provide. */
export type SectionInput = {
  sectionType: string;
  heading: string | null;
  subheading: string | null;
  bodyMarkdown: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  entityRef: string | null;
  entityLimit: number | null;
  hasMedia: boolean;
};

const text = (value: string | null | undefined) => value?.trim() || null;

// ---------------------------------------------------------------- parsers --

export type Card = { title: string; body: string };
export type Stat = { value: string; label: string };
export type FaqEntry = { question: string; answer: string };

/**
 * `### Title` followed by its prose, repeated. Anything before the first
 * heading is ignored, so a lead paragraph does not become a card.
 */
export function parseCards(body: string | null): Card[] {
  if (!body) return [];
  const cards: Card[] = [];
  let current: Card | null = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = /^###\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) cards.push(current);
      current = { title: heading[1], body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) cards.push(current);
  return cards.map((card) => ({ ...card, body: card.body.trim() }));
}

/**
 * `- 12 — warehouses` per line: a value and its label, separated by an em
 * dash, en dash, or a colon. The value is whatever the editor typed; nothing
 * is computed, so no statistic can be fabricated here.
 */
export function parseStats(body: string | null): Stat[] {
  if (!body) return [];
  const stats: Stat[] = [];
  for (const line of body.split(/\r?\n/)) {
    const item = /^\s*[-*]\s+(.+)$/.exec(line);
    if (!item) continue;
    const split = /^(.+?)\s*[—–:]\s*(.+)$/.exec(item[1]);
    if (!split) continue;
    const value = split[1].trim();
    const label = split[2].trim();
    if (value && label) stats.push({ value, label });
  }
  return stats;
}

/** `### Question` followed by its answer. Same shape as cards, read as Q&A. */
export function parseFaq(body: string | null): FaqEntry[] {
  return parseCards(body)
    .filter((card) => card.body)
    .map((card) => ({ question: card.title, answer: card.body }));
}

// --------------------------------------------------------------- registry --

/**
 * A failure names the field that caused it and a message key, so the Admin
 * sees an actionable error under the right input rather than "Invalid JSON".
 */
export type SectionIssue = { field: string; messageKey: string };

export type SectionDefinition = {
  /** Which of the shared inputs the editor should show for this type. */
  editor: {
    heading: "required" | "optional" | "hidden";
    subheading: "optional" | "hidden";
    body: "required" | "optional" | "hidden";
    cta: "optional" | "hidden";
    media: "required" | "optional" | "hidden";
    entity: "required" | "hidden";
  };
  /** The body convention shown to the Admin as help text, if any. */
  bodyHintKey?: string;
  validate: (input: SectionInput) => SectionIssue[];
};

const requireHeading = (input: SectionInput): SectionIssue[] =>
  text(input.heading) ? [] : [{ field: "heading", messageKey: "required" }];

const requireBody = (input: SectionInput): SectionIssue[] =>
  text(input.bodyMarkdown)
    ? []
    : [{ field: "bodyMarkdown", messageKey: "required" }];

export const SECTION_REGISTRY: Record<SectionType, SectionDefinition> = {
  HERO: {
    editor: {
      heading: "required",
      subheading: "optional",
      body: "optional",
      cta: "optional",
      media: "optional",
      entity: "hidden",
    },
    validate: requireHeading,
  },

  RICH_TEXT: {
    editor: {
      heading: "required",
      subheading: "optional",
      body: "required",
      cta: "optional",
      media: "hidden",
      entity: "hidden",
    },
    validate: (input) => [...requireHeading(input), ...requireBody(input)],
  },

  CARD_GRID: {
    editor: {
      heading: "required",
      subheading: "optional",
      body: "required",
      cta: "optional",
      media: "hidden",
      entity: "hidden",
    },
    bodyHintKey: "cardGridHint",
    validate: (input) => {
      const issues = requireHeading(input);
      const cards = parseCards(input.bodyMarkdown);
      if (cards.length < 2)
        issues.push({ field: "bodyMarkdown", messageKey: "needsTwoCards" });
      return issues;
    },
  },

  MEDIA_SPLIT: {
    editor: {
      heading: "required",
      subheading: "optional",
      body: "required",
      cta: "optional",
      media: "required",
      entity: "hidden",
    },
    validate: (input) => {
      const issues = [...requireHeading(input), ...requireBody(input)];
      // The whole point of this type is the image beside the prose; without
      // one it is a RICH_TEXT section wearing the wrong name.
      if (!input.hasMedia)
        issues.push({ field: "mediaId", messageKey: "mediaRequired" });
      return issues;
    },
  },

  CTA: {
    editor: {
      heading: "required",
      subheading: "optional",
      body: "optional",
      cta: "optional",
      media: "hidden",
      entity: "hidden",
    },
    validate: (input) => {
      const issues = requireHeading(input);
      // A call to action needs somewhere to go and something to say; half a
      // button renders as nothing at all.
      if (!text(input.ctaLabel))
        issues.push({ field: "ctaLabel", messageKey: "required" });
      if (!text(input.ctaHref))
        issues.push({ field: "ctaHref", messageKey: "required" });
      return issues;
    },
  },

  STAT_ROW: {
    editor: {
      heading: "required",
      subheading: "optional",
      body: "required",
      cta: "hidden",
      media: "hidden",
      entity: "hidden",
    },
    bodyHintKey: "statRowHint",
    validate: (input) => {
      const issues = requireHeading(input);
      if (parseStats(input.bodyMarkdown).length < 2)
        issues.push({ field: "bodyMarkdown", messageKey: "needsTwoStats" });
      return issues;
    },
  },

  FAQ: {
    editor: {
      heading: "required",
      subheading: "optional",
      body: "required",
      cta: "hidden",
      media: "hidden",
      entity: "hidden",
    },
    bodyHintKey: "faqHint",
    validate: (input) => {
      const issues = requireHeading(input);
      if (parseFaq(input.bodyMarkdown).length < 1)
        issues.push({ field: "bodyMarkdown", messageKey: "needsOneQuestion" });
      return issues;
    },
  },

  ENTITY_LIST: {
    editor: {
      heading: "required",
      subheading: "optional",
      body: "optional",
      cta: "optional",
      media: "hidden",
      entity: "required",
    },
    validate: (input) => {
      const issues = requireHeading(input);
      if (!input.entityRef || !isEntityRef(input.entityRef))
        issues.push({ field: "entityRef", messageKey: "required" });
      const limit = input.entityLimit;
      if (
        limit !== null &&
        (!Number.isInteger(limit) || limit < 1 || limit > 24)
      )
        issues.push({ field: "entityLimit", messageKey: "invalidNumber" });
      return issues;
    },
  },
};

export const isEntityRef = (value: unknown): value is EntityRef =>
  typeof value === "string" &&
  (ENTITY_REFS as readonly string[]).includes(value);

/**
 * Validates one section against its own type's rules.
 *
 * An unrecognised type is an issue on the type itself, never an exception:
 * a row written before this registry existed, or by a future migration, must
 * fail safely in the editor rather than crash it.
 */
export function validateSection(input: SectionInput): SectionIssue[] {
  if (!isSectionType(input.sectionType))
    return [{ field: "sectionType", messageKey: "unknownSectionType" }];
  return SECTION_REGISTRY[input.sectionType].validate(input);
}

/** The Zod schema for the section fields an Admin submits. */
export const sectionTypeSchema = z.enum(SECTION_TYPES, {
  message: "unknownSectionType",
});
export const entityRefSchema = z.enum(ENTITY_REFS, { message: "required" });
