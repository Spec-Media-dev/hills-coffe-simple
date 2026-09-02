import { expect, type Page } from "@playwright/test";

/**
 * Screen-level auditors for the Phase 8 runtime UI sweep.
 *
 * These check the things a person notices and a unit test cannot: a raw
 * translation key on screen, an image that failed to decode, text the theme
 * has made unreadable, a page that scrolls sideways.
 *
 * They are deliberately generic — every Phase 8 screen runs the same set in
 * both languages and both themes, so a regression anywhere is caught by the
 * same assertion rather than by a bespoke one somebody remembered to write.
 */

/**
 * A dotted path from one of the real message namespaces.
 *
 * next-intl renders the full path when a key is missing, so
 * `admin.articles.statusPublished` appearing as body text is the signature of
 * a missing key. The namespaces are listed explicitly rather than matched as
 * "any dotted word", which would flag file names, domains and slugs.
 */
const NAMESPACES = [
  "admin",
  "account",
  "actions",
  "auth",
  "brand",
  "catalog",
  "footer",
  "inquiry",
  "inquiryStatus",
  "inquiryType",
  "nav",
  "product",
  "quote",
  "seo",
];

export async function findRawTranslationKeys(page: Page): Promise<string[]> {
  return page.evaluate((namespaces) => {
    const pattern = new RegExp(
      `\\b(?:${namespaces.join("|")})(?:\\.[A-Za-z][A-Za-z0-9_]*){1,4}\\b`,
      "g",
    );
    const found = new Set<string>();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      // Scripts and styles legitimately contain dotted identifiers.
      if (
        parent &&
        !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName) &&
        parent.offsetParent !== null
      ) {
        for (const match of (node.textContent ?? "").matchAll(pattern))
          found.add(match[0]);
      }
      node = walker.nextNode();
    }
    return [...found];
  }, NAMESPACES);
}

/** Images that are in the DOM, visible, and failed to decode. */
export async function findBrokenImages(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter(
        (img) =>
          img.offsetParent !== null &&
          img.complete &&
          img.naturalWidth === 0 &&
          // A deliberately empty src is not a broken image.
          Boolean(img.getAttribute("src")),
      )
      .map((img) => img.getAttribute("src") ?? "(no src)"),
  );
}

/**
 * Interactive and label text whose contrast against its own painted
 * background falls below WCAG's 3:1 floor for large text and UI components.
 *
 * The threshold is deliberately the lower one: this sweep is looking for text
 * a theme has made *unreadable*, not for the full AA audit that
 * `accessibility.spec.ts` already runs with axe.
 */
export async function findLowContrastText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const luminance = (color: string) => {
      const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
      if (parts.length < 3) return null;
      const [r, g, b] = parts;
      // A fully transparent layer paints nothing.
      if (parts.length > 3 && parts[3] === 0) return null;
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    const backgroundOf = (element: Element): number | null => {
      let node: Element | null = element;
      while (node) {
        const value = getComputedStyle(node).backgroundColor;
        const lum = luminance(value);
        if (lum !== null) return lum;
        node = node.parentElement;
      }
      return luminance(getComputedStyle(document.body).backgroundColor);
    };

    const problems: string[] = [];
    const selector =
      "main label, main button, main input, main select, main textarea, " +
      'main [role="alert"], main [role="status"], main th, main dt, main h1, main h2, main h3';
    for (const element of document.querySelectorAll(selector)) {
      const el = element as HTMLElement;
      if (el.offsetParent === null) continue;
      const text = (el.textContent ?? "").trim();
      if (!text) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || Number(style.opacity) === 0)
        continue;
      const fg = luminance(style.color);
      const bg = backgroundOf(el);
      if (fg === null || bg === null) continue;
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      if (ratio < 3)
        problems.push(
          `${el.tagName.toLowerCase()} "${text.slice(0, 40)}" ratio ${ratio.toFixed(2)}`,
        );
    }
    return problems;
  });
}

/** The document must never scroll sideways, in either direction. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
}

/**
 * Runs the whole set against the current screen.
 *
 * `label` names the screen in the failure message, so a red build says which
 * page and which theme rather than only which assertion.
 */
export async function auditScreen(page: Page, label: string) {
  const [keys, images, contrast, overflow] = await Promise.all([
    findRawTranslationKeys(page),
    findBrokenImages(page),
    findLowContrastText(page),
    hasHorizontalOverflow(page),
  ]);
  expect(keys, `raw translation keys on ${label}`).toEqual([]);
  expect(images, `broken images on ${label}`).toEqual([]);
  expect(contrast, `unreadable text on ${label}`).toEqual([]);
  expect(overflow, `horizontal overflow on ${label}`).toBe(false);
}

/** Loads a page in a chosen theme, the way next-themes persists it. */
export async function visitInTheme(
  page: Page,
  path: string,
  theme: "light" | "dark",
) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("theme", value);
    } catch {
      // A blocked storage API must not stop the visit.
    }
  }, theme);
  await page.goto(path);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      ),
    )
    .toBe(theme);
}
