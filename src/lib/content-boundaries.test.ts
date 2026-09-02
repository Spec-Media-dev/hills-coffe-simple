import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 8 structural invariants.
 *
 * These assert absences and single-sourcing — "no second upload system", "no
 * new logo column", "one media picker" — which are proven by scanning the tree
 * rather than by exercising one code path. They complement the live runtime
 * proofs in `tests/integration/content-media.test.ts` and
 * `tests/e2e/content-workflow.spec.ts`; they do not replace them.
 */

function sourceFiles(dir = resolve("src")): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts"))
      out.push(path);
  }
  return out;
}

const read = (path: string) => readFileSync(resolve(path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const root = resolve(".");
/** Repo-relative, forward-slashed, so assertions read the same everywhere. */
const relative = (path: string) =>
  path.slice(root.length + 1).replaceAll("\\", "/");

const allSources = sourceFiles();
const allCode = allSources.map((path) => ({
  path: relative(path),
  source: code(path),
}));

describe("the media model is the existing normalized one (P8 §3)", () => {
  it("adds no denormalized image column anywhere", () => {
    // The whole point of `media` + join tables is that no consumer grows its
    // own URL column. One shortcut here would fork the model permanently.
    const forbidden = [
      "image_url",
      "image_path",
      "gallery_urls",
      "featured_image_url",
      "logo_url",
      "logo_path",
      "dark_logo_id",
      "light_logo_id",
    ];
    for (const { path, source } of allCode)
      for (const column of forbidden)
        expect(source, `${path} introduces ${column}`).not.toContain(column);
  });

  it("keeps the project logo on the relation the schema already has", () => {
    const logo = code("src/lib/data/site-logo.ts");
    expect(logo).toContain("org_logo_media_id");
    // Resolution reads media, never a second table.
    expect(logo).toContain('from("media")');
    const branding = code("src/actions/admin-branding.ts");
    expect(branding).toContain("org_logo_media_id");
    expect(branding).not.toMatch(/create\s+table|logos?\b.*table/i);
  });

  it("has exactly one image upload pipeline", () => {
    // `.upload(` may appear only in the shared pipeline and the avatar path,
    // which is a different bucket with its own owner-scoped RLS.
    const uploaders = allCode
      .filter(({ source }) => source.includes(".upload("))
      .map(({ path }) => path)
      .sort();
    // Business media has exactly one ingest path. `account.ts` is the customer
    // avatar, a different bucket with its own owner-scoped storage policies.
    expect(uploaders).toEqual([
      "src/actions/account.ts",
      "src/lib/media/upload.ts",
    ]);
  });

  it("has exactly one media picker component", () => {
    // One component owns choosing an image, for coffee, origin, article, CMS
    // section and the site logo alike.
    const pickers = allCode
      .filter(({ source }) => source.includes("function MediaPicker"))
      .map(({ path }) => path);
    expect(pickers).toEqual(["src/components/admin/media-picker.tsx"]);
    // And every consumer reaches it by import rather than reimplementing it.
    const consumers = allCode
      .filter(({ source }) => source.includes("<MediaPicker"))
      .map(({ path }) => path)
      .sort();
    expect(consumers.length).toBeGreaterThanOrEqual(3);
  });
});

describe("content write paths never leak provider text (P8 §9)", () => {
  const phase8Actions = [
    "src/actions/admin-media.ts",
    "src/actions/admin-cms.ts",
    "src/actions/admin-articles.ts",
    "src/actions/admin-branding.ts",
  ];

  it("returns a message key, never a Postgres or Supabase message", () => {
    for (const path of phase8Actions) {
      const source = code(path);
      expect(source, path).not.toMatch(/fail\([^)]*error\.(message|details)/);
      expect(source, path).not.toMatch(/messageKey:\s*.*error\.message/);
      // An error code may be logged server-side, but never returned.
      expect(source, path).not.toMatch(/return[^;]*error\.message/);
    }
  });

  it("re-checks admin authorization in every write path", () => {
    for (const path of phase8Actions) {
      const source = code(path);
      expect(source, path).toContain("requireAdmin()");
      const exported = source.match(/export async function (\w+)/g) ?? [];
      expect(exported.length, `${path} exports no actions`).toBeGreaterThan(0);
    }
  });

  it("verifies a submitted media reference instead of trusting the uuid", () => {
    for (const path of [
      "src/actions/admin-cms.ts",
      "src/actions/admin-articles.ts",
      "src/actions/admin-branding.ts",
    ]) {
      const source = code(path).replace(/\s+/g, " ");
      // Each checks the media row exists and is not archived before storing
      // the reference.
      expect(source, path).toContain('from("media")');
      expect(source, path).toContain('.is("deleted_at", null)');
    }
  });
});

describe("public content reads only what may be public (P8 §35)", () => {
  it("filters CMS pages to published, active, non-deleted rows", () => {
    const source = code("src/lib/data/site-content.ts").replace(/\s+/g, " ");
    expect(source).toContain('.eq("status", "PUBLISHED")');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain('.is("deleted_at", null)');
  });

  it("filters articles to published, non-deleted, non-embargoed rows", () => {
    const source = code("src/lib/data/editorial.ts").replace(/\s+/g, " ");
    expect(source).toContain('.eq("status", "PUBLISHED")');
    expect(source).toContain('.is("deleted_at", null)');
    // A future publication date is not yet public.
    expect(source).toContain("new Date(row.published_at).getTime() <= now");
  });

  it("treats archived media as absent on every public surface", () => {
    for (const path of [
      "src/lib/data/site-content.ts",
      "src/lib/data/editorial.ts",
      "src/lib/data/site-logo.ts",
    ])
      expect(code(path), path).toMatch(/deleted_at/);
  });

  it("never uses the service-role client in a content path", () => {
    for (const { path, source } of allCode) {
      if (!/data\/(site-content|editorial|site-logo|media-library)/.test(path))
        continue;
      expect(source, path).not.toContain("service-role");
      expect(source, path).not.toContain("SERVICE_ROLE");
    }
  });
});

describe("CMS content is sanitized, not trusted (P8 §15)", () => {
  it("renders every body through the sanitizing markdown component", () => {
    const renderer = code("src/components/content/cms-page.tsx");
    // No raw HTML sink anywhere in the CMS renderer.
    expect(renderer).not.toContain("dangerouslySetInnerHTML");
    expect(renderer).toContain("SafeMarkdown");

    const article = code("src/app/[locale]/(site)/knowledge/[slug]/page.tsx");
    expect(article).toContain("SafeMarkdown");
    // The one permitted sink is the JSON-LD script, which carries serialized
    // structured data with `<` escaped; it never carries article prose.
    const sinks = [...article.matchAll(/dangerouslySetInnerHTML/g)];
    expect(sinks).toHaveLength(1);
    const normalized = article.replace(/\s+/g, " ");
    expect(normalized).toContain('type="application/ld+json"');
    expect(normalized).toContain("JSON.stringify(jsonLd)");
    // The body is never handed to it.
    expect(normalized).not.toContain("__html: article.bodyMarkdown");
  });

  it("keeps the sanitizer configured to strip HTML", () => {
    const safe = code("src/components/content/safe-markdown.tsx");
    expect(safe).toContain("rehypeSanitize");
    expect(safe).toContain("skipHtml");
  });

  it("does not let a section parser interpret markup", () => {
    // The parsers split text; sanitisation stays the renderer's single job.
    const registry = code("src/lib/cms/sections.ts");
    expect(registry).not.toContain("innerHTML");
    expect(registry).not.toContain("dangerouslySetInnerHTML");
  });
});
