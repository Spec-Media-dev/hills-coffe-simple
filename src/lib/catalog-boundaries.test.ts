import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 6 structural invariants.
 *
 * These assert absences — "the public catalog never selects a price", "no
 * select is populated from a hardcoded array" — which are proven by scanning
 * the tree rather than by exercising one code path. They complement the live
 * runtime proofs in `tests/e2e/admin-catalog.spec.ts`, they do not replace
 * them.
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

describe("protected pricing stays isolated from the catalog (P6-T03)", () => {
  it("keeps the price table inside a short, deliberate allow-list", () => {
    // Four modules may name the price table, each for a stated reason:
    //  - `data/pricing.ts`      customer reads, behind `requireVerifiedUser()`
    //  - `actions/admin-catalog` Admin price management, behind `requireAdmin()`
    //  - `data/admin-catalog`    Admin tier counts, behind `requireAdmin()`
    //  - `types.generated`       the schema type map, no query at all
    // Anything else here would be a new, ungated price path.
    const allowed = [
      join("lib", "data", "pricing.ts"),
      join("actions", "admin-catalog.ts"),
      join("lib", "data", "admin-catalog.ts"),
      join("lib", "supabase", "types.generated.ts"),
    ];
    const offenders = sourceFiles()
      .filter((file) => !allowed.some((suffix) => file.endsWith(suffix)))
      .filter((file) => code(file).includes("offer_price_tiers"));
    expect(offenders).toEqual([]);
  });

  it("gates both Admin price paths on requireAdmin", () => {
    expect(code("src/actions/admin-catalog.ts")).toContain("requireAdmin");
    expect(code("src/lib/data/admin-catalog.ts")).toContain("requireAdmin");
  });

  it("never selects a price column in the catalog query", () => {
    const source = code("src/lib/data/catalog-query.ts");
    expect(source).not.toContain("price_per_kg_usd");
    expect(source).not.toContain("offer_price_tiers");
    expect(source).not.toMatch(/\bprice\b/);
  });

  it("gates the price read on the verified-customer check", () => {
    const pricing = read("src/lib/data/pricing.ts");
    expect(pricing).toContain("requireVerifiedUser");
    expect(pricing).toContain("offer_price_tiers");
  });

  it("does not let the catalog card read a price of its own", () => {
    // The card receives an already-authorised number as a prop and can never
    // fetch one, so it cannot leak a price on a page that withheld it.
    const card = code("src/components/catalog/catalog-card.tsx");
    expect(card).not.toContain("getProtectedPriceTiers");
    expect(card).not.toContain("supabase");
  });
});

describe("the catalog query is evaluated by the database (P6-T01)", () => {
  const source = code("src/lib/data/catalog-query.ts");

  it("paginates with a bounded range rather than slicing in memory", () => {
    expect(source).toContain(".range(");
    expect(source).not.toMatch(/\.slice\(/);
  });

  it("filters and orders in the query, not with Array.filter", () => {
    expect(source).toContain(".ilike(");
    expect(source).toContain(".order(");
    // A `.filter(` on the result rows would mean the database did not do it.
    expect(source).not.toMatch(/rows\.filter\(/);
  });

  it("asks the database for the total instead of counting fetched rows", () => {
    expect(source).toContain('count: "exact"');
  });

  it("no longer lets the listing page narrow a full fetch in JavaScript", () => {
    const page = code(
      "src/app/[locale]/(site)/green-coffee-offer-list/page.tsx",
    );
    expect(page).toContain("queryCatalog");
    expect(page).not.toContain("getOfferList");
    expect(page).not.toMatch(/data\.offers\.filter\(/);
  });
});

describe("Admin catalog forms (P6 owner requirements)", () => {
  it("turns off native browser validation so errors are the application's", () => {
    const form = code("src/components/admin/admin-form.tsx");
    expect(form).toContain("noValidate");
  });

  it("renders each field's error beside that field", () => {
    const form = code("src/components/admin/admin-form.tsx");
    expect(form).toContain("aria-invalid");
    expect(form).toContain("aria-describedby");
    expect(form).toContain("FieldError");
  });

  it("never hardcodes reference options in a catalog form", () => {
    for (const file of [
      "src/components/admin/coffee-form.tsx",
      "src/components/admin/offer-form.tsx",
    ]) {
      const source = code(file);
      // Options come from `options.*`, which is database-backed. The only
      // literal lists allowed are the database's own closed enums.
      const literalLists = [...source.matchAll(/options=\{\[/g)];
      for (const match of literalLists) {
        const tail = source.slice(match.index, match.index + 400);
        expect(
          /"DRAFT"|"PUBLISHED"|"ARCHIVED"|"IN_STORE"|"ARRIVING_SOON"|"true"|"USD"|"KG"/.test(
            tail,
          ),
          `${file}: literal option list that is not a database enum`,
        ).toBe(true);
      }
      expect(source).toContain("options.");
    }
  });

  it("returns message keys, never English prose, from the catalog actions", () => {
    const source = code("src/actions/admin-catalog.ts");
    // Every failure goes through `fail(...)`/`fieldFail(...)` with a key, so a
    // sentence with spaces would mean prose leaked into the contract.
    for (const match of source.matchAll(/fieldFail\("[^"]+",\s*"([^"]+)"\)/g))
      expect(match[1]).not.toMatch(/\s/);
    for (const match of source.matchAll(/\bfail\("[A-Z_]+",\s*"([^"]+)"/g))
      expect(match[1]).not.toMatch(/\s/);
  });

  it("never returns a provider error or constraint name to the client", () => {
    const source = code("src/actions/admin-catalog.ts");
    // A constraint name may be inspected server-side to pick a field, but it
    // must not be handed back in the result.
    expect(source).not.toMatch(/messageKey:\s*.*error\.message/);
    expect(source).not.toMatch(/fail\([^)]*error\.(message|details|code)/);
  });

  it("verifies every submitted reference on the server", () => {
    const source = code("src/actions/admin-catalog.ts");
    expect(source).toContain("collectReferenceErrors");
    expect(source).toContain("referenceExists");
    expect(source).toContain("regionBelongsToOrigin");
  });
});

describe("coffee images use the existing normalized media model (P6 §5)", () => {
  it("adds no image column to coffees", () => {
    const source = code("src/actions/admin-catalog.ts");
    for (const forbidden of [
      "image_url",
      "image_path",
      "gallery_urls",
      "featured_image",
    ])
      expect(source).not.toContain(forbidden);
  });

  it("writes through coffee_media and media, not a second system", () => {
    const source = code("src/actions/admin-catalog.ts");
    expect(source).toContain("coffee_media");
    expect(source).toContain('from("media")');
    expect(source).toContain("hills-public");
  });

  it("decides the file type from its bytes and builds the path server-side", () => {
    const source = code("src/actions/admin-catalog.ts");
    expect(source).toContain("sniffImageType");
    // The stored path is derived from the coffee id and a generated uuid, so a
    // client cannot choose where its upload lands.
    expect(source).toContain("`coffees/${coffeeId}/${crypto.randomUUID()}");
  });

  it("removes the uploaded object when a later step fails", () => {
    // Whitespace-insensitive: what matters is that a failed attach cleans up
    // its storage object and media row rather than orphaning them.
    const source = code("src/actions/admin-catalog.ts").replace(/\s+/g, " ");
    expect(source).toContain(
      'db.storage.from("hills-public").remove([storagePath])',
    );
    expect(source).toContain('db.from("media").delete().eq("id", mediaId)');
  });
});
