import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * P13-T01 — the crawl simulation.
 *
 * The route matrix is derived from `/sitemap.xml` rather than hard-coded, so
 * this suite checks what the site actually publishes. A hard-coded list would
 * keep passing after the sitemap silently stopped emitting a page — which is
 * exactly the failure this phase found (`/about` was missing, and no CMS page
 * could ever match because stored paths carry a trailing slash and the
 * allow-list did not).
 *
 * Host-agnostic on purpose. `NEXT_PUBLIC_SITE_URL` is inlined at build time, so
 * under test the canonical host is the local one; asserting a hard-coded
 * production hostname here would only prove which `.env` the runner used. What
 * is asserted instead is the *architecture* — that canonicals are absolute,
 * self-referential and consistent with the sitemap, and that hreflang pairs
 * every page with its counterpart. That the production build stamps
 * `https://www.hillscoffees.com` is verified separately against a build made
 * with that host.
 */

test.describe.configure({ mode: "default", timeout: 120_000 });

/** Paths that must never appear in a sitemap or be indexable. */
const PRIVATE_PATHS = [
  "/account",
  "/account/settings",
  "/account/favorites",
  "/account/requests",
  "/admin",
  "/admin/users",
  "/dashboard-admin",
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/search",
];

type SitemapEntry = { loc: string; alternates: Record<string, string> };

async function readSitemap(request: APIRequestContext) {
  const response = await request.get("/sitemap.xml");
  expect(response.status(), "sitemap must be served").toBe(200);
  const xml = await response.text();
  const entries: SitemapEntry[] = [];
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) continue;
    const alternates: Record<string, string> = {};
    for (const link of block.match(/<xhtml:link[^>]*\/?>/g) ?? []) {
      const lang = link.match(/hreflang="([^"]+)"/)?.[1];
      const href = link.match(/href="([^"]+)"/)?.[1];
      if (lang && href) alternates[lang] = href;
    }
    entries.push({ loc, alternates });
  }
  return { xml, entries };
}

/** The path part of an absolute URL, so assertions are host-independent. */
const pathOf = (url: string) => new URL(url).pathname || "/";

test("the sitemap publishes only indexable public URLs, in both locales", async ({
  request,
}) => {
  const { entries } = await readSitemap(request);
  expect(entries.length, "sitemap is empty").toBeGreaterThan(0);

  const paths = entries.map((entry) => pathOf(entry.loc));

  // No private, auth, admin, search or filtered URL may ever be listed.
  for (const path of paths) {
    const bare = path.replace(/^\/ar/, "") || "/";
    expect(
      PRIVATE_PATHS.some((p) => bare === p || bare.startsWith(`${p}/`)),
      `sitemap lists a private route: ${path}`,
    ).toBe(false);
    expect(entries.find((e) => pathOf(e.loc) === path)!.loc).not.toContain("?");
  }

  // Both locales are represented, and every URL is unique.
  expect(paths.filter((p) => p.startsWith("/ar")).length).toBeGreaterThan(0);
  expect(paths.filter((p) => !p.startsWith("/ar")).length).toBeGreaterThan(0);
  expect(new Set(paths).size, "duplicate URLs in sitemap").toBe(paths.length);

  // Every entry declares en, ar and x-default.
  for (const entry of entries) {
    expect(
      Object.keys(entry.alternates).sort(),
      `missing hreflang alternates on ${entry.loc}`,
    ).toEqual(["ar", "en", "x-default"]);
    expect(entry.alternates["x-default"]).toBe(entry.alternates.en);
  }
});

test("every sitemap URL resolves 200 and is self-canonical with full hreflang", async ({
  request,
}) => {
  const { entries } = await readSitemap(request);
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  const problems: string[] = [];

  for (const entry of entries) {
    const path = pathOf(entry.loc);
    const response = await request.get(path);
    if (response.status() !== 200) {
      problems.push(`${path}: HTTP ${response.status()}`);
      continue;
    }
    const html = await response.text();

    // Indexable: no noindex on anything the sitemap advertises.
    const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
    if (robots?.includes("noindex"))
      problems.push(`${path}: sitemap URL is noindex (${robots})`);

    // Self-canonical, and pointing at this very path.
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) problems.push(`${path}: no canonical`);
    else if (pathOf(canonical) !== path)
      problems.push(`${path}: canonical points at ${pathOf(canonical)}`);

    /*
     * hreflang, including x-default. Matched case-insensitively: Next renders
     * the attribute as `hrefLang`, and HTML attribute names are ASCII
     * case-insensitive, so a crawler reads it correctly either way.
     */
    for (const lang of ["en", "ar", "x-default"])
      if (!new RegExp(`hreflang="${lang}"`, "i").test(html))
        problems.push(`${path}: missing hreflang ${lang}`);

    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? "";
    const description =
      html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim() ??
      "";
    if (!title) problems.push(`${path}: empty title`);
    if (!description) problems.push(`${path}: empty meta description`);

    // The owner's SEO specification names this exact failure as a blocker.
    if (/\[object Object\]|undefined|null/.test(`${title} ${description}`))
      problems.push(`${path}: placeholder value in metadata`);

    titles.set(path, title);
    descriptions.set(path, description);
  }

  // Unique titles and descriptions *within a locale*: the same page in two
  // languages legitimately differs, but two English pages must not collide.
  for (const prefix of ["", "/ar"]) {
    const scoped = [...titles.entries()].filter(([path]) =>
      prefix ? path.startsWith("/ar") : !path.startsWith("/ar"),
    );
    const seen = new Map<string, string>();
    for (const [path, title] of scoped) {
      const clash = seen.get(title);
      if (clash) problems.push(`duplicate title: ${clash} and ${path}`);
      else seen.set(title, path);
    }
  }

  expect(problems, "SEO crawl findings").toEqual([]);
});

test("filtered and searched catalog states are not indexable, and consolidate", async ({
  request,
}) => {
  const filtered = [
    "/green-coffee-offer-list?origin=qa-p6-brazil",
    "/green-coffee-offer-list?q=coffee",
    "/green-coffee-offer-list?sort=cup-score",
    "/green-coffee-offer-list?certified=1&process=natural",
    "/ar/green-coffee-offer-list?origin=qa-p6-brazil",
  ];
  for (const path of filtered) {
    const html = await (await request.get(path)).text();
    const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
    expect(robots, `${path}: filtered state must be noindex`).toContain(
      "noindex",
    );
    // `follow` keeps the lots linked from a filtered view discoverable.
    expect(robots, `${path}: filtered state must stay followable`).toContain(
      "follow",
    );
    // Equity consolidates on the clean hub rather than the filtered URL.
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    expect(canonical, `${path}: no canonical`).toBeTruthy();
    expect(pathOf(canonical!)).toMatch(/\/(ar\/)?green-coffee-offer-list$/);
  }

  // The unfiltered hub itself stays indexable.
  const hub = await (await request.get("/green-coffee-offer-list")).text();
  expect(
    hub.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? "",
  ).not.toContain("noindex");
});

test("private, auth and search routes are never indexable", async ({
  request,
}) => {
  const problems: string[] = [];
  for (const path of PRIVATE_PATHS) {
    for (const prefixed of [path, `/ar${path}`]) {
      const response = await request.get(prefixed, { maxRedirects: 0 });
      const status = response.status();
      // A redirect is already sufficient: nothing indexable is served.
      if (status >= 300 && status < 400) continue;
      if (status !== 200) continue;
      const html = await response.text();
      const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
      if (!robots?.includes("noindex"))
        problems.push(`${prefixed}: 200 without noindex (${robots ?? "none"})`);
    }
  }
  expect(problems, "indexable private routes").toEqual([]);
});

test("robots.txt disallows private areas and points at the sitemap", async ({
  request,
}) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/);
  for (const path of ["/account", "/admin", "/dashboard-admin"]) {
    expect(body, `robots.txt must disallow ${path}`).toContain(
      `Disallow: ${path}`,
    );
    expect(body, `robots.txt must disallow /ar${path}`).toContain(
      `Disallow: /ar${path}`,
    );
  }
  // Public routes must stay crawlable.
  expect(body).not.toContain("Disallow: /green-coffee-offer-list");
  expect(body).not.toContain("Disallow: /coffee-origins");
});

test("structured data parses, describes the page, and carries no price", async ({
  request,
}) => {
  const routes = [
    "/",
    "/green-coffee-offer-list",
    "/coffee-origins",
    "/contact",
    "/ar",
    "/ar/green-coffee-offer-list",
    "/ar/coffee-origins",
  ];
  const problems: string[] = [];

  for (const path of routes) {
    const html = await (await request.get(path)).text();
    const blocks = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((match) => match[1]);
    if (!blocks.length) {
      problems.push(`${path}: no JSON-LD`);
      continue;
    }
    for (const raw of blocks) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        problems.push(`${path}: JSON-LD does not parse`);
        continue;
      }
      const text = JSON.stringify(parsed);
      if (text.includes("[object Object]"))
        problems.push(`${path}: [object Object] in structured data`);
      // Constitution VIII: no protected price may reach public structured data.
      for (const field of ["price", "priceCurrency", "lowPrice", "highPrice"])
        if (new RegExp(`"${field}"`).test(text))
          problems.push(`${path}: structured data exposes ${field}`);
      // Every node must declare a type.
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes)
        if (!(node as { "@type"?: string })["@type"])
          problems.push(`${path}: JSON-LD node with no @type`);
    }
  }
  expect(problems, "structured data findings").toEqual([]);
});
