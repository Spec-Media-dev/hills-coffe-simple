import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const primitives = readFileSync(
  new URL("../components/motion/primitives.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

describe("Phase 9 motion contract", () => {
  it("exports exactly the approved public motion vocabulary", () => {
    for (const name of [
      "PageReveal",
      "SectionReveal",
      "ImageReveal",
      "HoverLift",
      "NavUnderline",
      "MegaMenuReveal",
      "DrawerReveal",
      "AccordionExpand",
      "FilterTransition",
      "Toast",
      "Modal",
      "Status",
    ]) {
      expect(primitives).toMatch(new RegExp(`(?:function|const) ${name}\\b`));
    }
  });

  it("removes movement and delay under reduced motion", () => {
    expect(primitives).toContain("useReducedMotion");
    expect(primitives).toContain("duration: reduced ? 0");
    expect(primitives).toContain("delay: reduced ? 0");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("[data-motion]");
    expect(css).toContain("opacity: 1 !important");
    expect(css).toContain("transform: none !important");
    expect(css).toContain("clip-path: none !important");
  });
});
