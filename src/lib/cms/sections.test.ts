import { describe, expect, it } from "vitest";
import {
  SECTION_REGISTRY,
  SECTION_TYPES,
  parseCards,
  parseFaq,
  parseStats,
  validateSection,
  type SectionInput,
} from "./sections";

const base: SectionInput = {
  sectionType: "RICH_TEXT",
  heading: "Heading",
  subheading: null,
  bodyMarkdown: "Body copy.",
  ctaLabel: null,
  ctaHref: null,
  entityRef: null,
  entityLimit: null,
  hasMedia: false,
};

const fields = (input: Partial<SectionInput>) =>
  validateSection({ ...base, ...input }).map((issue) => issue.field);

describe("CMS section registry", () => {
  it("covers exactly the approved section types", () => {
    // The list is fixed by the specification; a new type is a scope change,
    // not an implementation detail.
    expect([...SECTION_TYPES].sort()).toEqual(
      [
        "CARD_GRID",
        "CTA",
        "ENTITY_LIST",
        "FAQ",
        "HERO",
        "MEDIA_SPLIT",
        "RICH_TEXT",
        "STAT_ROW",
      ].sort(),
    );
    expect(Object.keys(SECTION_REGISTRY).sort()).toEqual(
      [...SECTION_TYPES].sort(),
    );
  });

  it("rejects an unknown type as a field issue, never an exception", () => {
    // A row written before the registry existed must fail safely.
    expect(validateSection({ ...base, sectionType: "WAREHOUSES" })).toEqual([
      { field: "sectionType", messageKey: "unknownSectionType" },
    ]);
    expect(validateSection({ ...base, sectionType: "" })).toHaveLength(1);
  });

  it("requires a heading on every type", () => {
    for (const sectionType of SECTION_TYPES)
      expect(
        fields({ sectionType, heading: "   " }),
        `${sectionType} accepted a blank heading`,
      ).toContain("heading");
  });

  it("requires body copy where the type is nothing without it", () => {
    expect(fields({ sectionType: "RICH_TEXT", bodyMarkdown: null })).toContain(
      "bodyMarkdown",
    );
    // A hero is a headline over an image; body copy is optional there.
    expect(fields({ sectionType: "HERO", bodyMarkdown: null })).toEqual([]);
  });

  it("requires both halves of a call to action", () => {
    expect(fields({ sectionType: "CTA" })).toEqual(
      expect.arrayContaining(["ctaLabel", "ctaHref"]),
    );
    expect(
      fields({
        sectionType: "CTA",
        ctaLabel: "Talk to us",
        ctaHref: "/contact",
      }),
    ).toEqual([]);
  });

  it("requires an image on MEDIA_SPLIT", () => {
    expect(fields({ sectionType: "MEDIA_SPLIT" })).toContain("mediaId");
    expect(fields({ sectionType: "MEDIA_SPLIT", hasMedia: true })).toEqual([]);
  });

  it("requires a known entity feed on ENTITY_LIST and a sane limit", () => {
    expect(fields({ sectionType: "ENTITY_LIST" })).toContain("entityRef");
    expect(
      fields({ sectionType: "ENTITY_LIST", entityRef: "SOMETHING_ELSE" }),
    ).toContain("entityRef");
    expect(
      fields({ sectionType: "ENTITY_LIST", entityRef: "WAREHOUSES" }),
    ).toEqual([]);
    expect(
      fields({
        sectionType: "ENTITY_LIST",
        entityRef: "WAREHOUSES",
        entityLimit: 0,
      }),
    ).toContain("entityLimit");
    expect(
      fields({
        sectionType: "ENTITY_LIST",
        entityRef: "WAREHOUSES",
        entityLimit: 99,
      }),
    ).toContain("entityLimit");
  });
});

describe("section body conventions", () => {
  it("reads cards from level-three headings", () => {
    const body = "Intro prose.\n### One\nFirst body.\n### Two\nSecond body.";
    expect(parseCards(body)).toEqual([
      { title: "One", body: "First body." },
      { title: "Two", body: "Second body." },
    ]);
    // Prose before the first heading is not a card.
    expect(parseCards("Just prose")).toEqual([]);
    expect(parseCards(null)).toEqual([]);
  });

  it("needs at least two cards for a grid", () => {
    expect(
      fields({ sectionType: "CARD_GRID", bodyMarkdown: "### One\nA" }),
    ).toContain("bodyMarkdown");
    expect(
      fields({
        sectionType: "CARD_GRID",
        bodyMarkdown: "### One\nA\n### Two\nB",
      }),
    ).toEqual([]);
  });

  it("reads a value and a label per stat, accepting either dash or colon", () => {
    expect(
      parseStats("- 3 — warehouses\n- 12: origins\n- broken line"),
    ).toEqual([
      { value: "3", label: "warehouses" },
      { value: "12", label: "origins" },
    ]);
    // Nothing is computed: the value is exactly what the editor typed, so no
    // statistic can be invented by the renderer.
    expect(parseStats("- 3 — warehouses")[0].value).toBe("3");
  });

  it("needs at least two stats for a stat row", () => {
    expect(
      fields({ sectionType: "STAT_ROW", bodyMarkdown: "- 3 — warehouses" }),
    ).toContain("bodyMarkdown");
    expect(
      fields({
        sectionType: "STAT_ROW",
        bodyMarkdown: "- 3 — warehouses\n- 12 — origins",
      }),
    ).toEqual([]);
  });

  it("reads questions and answers, ignoring a question with no answer", () => {
    expect(parseFaq("### Do you ship?\nYes.\n### Empty?\n")).toEqual([
      { question: "Do you ship?", answer: "Yes." },
    ]);
    expect(
      fields({ sectionType: "FAQ", bodyMarkdown: "### Only a question?\n" }),
    ).toContain("bodyMarkdown");
    expect(fields({ sectionType: "FAQ", bodyMarkdown: "### Q\nA" })).toEqual(
      [],
    );
  });

  it("does not treat markup in a body as anything but text", () => {
    // The parsers must not strip, execute or interpret HTML; sanitisation is
    // the renderer's job and must stay the only place it happens.
    const hostile = '### <script>alert(1)</script>\n<img onerror="x">';
    expect(parseCards(hostile)[0].title).toBe("<script>alert(1)</script>");
    expect(parseCards(hostile)[0].body).toBe('<img onerror="x">');
  });
});
