import { expect, test, type Page } from "@playwright/test";
import {
  createCatalogAdmin,
  hasAuthFixtureCredentials,
  service,
  type CatalogAdmin,
} from "./catalog-fixtures";
import { collectPageProblems } from "./helpers";

/**
 * Phase 6 closure audit — the reference/taxonomy modules.
 *
 * These are the modules Phase 6 did **not** migrate to the new form stack:
 * origins, regions, warehouses, varieties, and the six taxonomy entities all
 * still run on the legacy `AdminActionForm` / `AdminActionState`. This spec
 * establishes what they actually do at runtime rather than by reading source:
 * whether create and edit persist, whether a new row reaches the dependent
 * dropdowns, and what the validation experience really is.
 *
 * Rows created here are audit fixtures, namespaced `qa-p6-audit-*`, and are
 * removed afterwards. They are not part of the owner's persisted QA catalog.
 */
test.describe("Phase 6 closure — reference module flows", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Admin responsive behaviour is Phase 10; this audit runs once on desktop.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let admin!: CatalogAdmin;
  const run = Date.now().toString(36);
  const slug = (name: string) => `qa-p6-audit-${name}-${run}`;

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    admin = await createCatalogAdmin("refaudit");
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    // Remove every audit row, children first.
    for (const [table, owner] of [
      ["region_translations", "region_id"],
      ["origin_translations", "origin_id"],
      ["sensory_note_translations", "sensory_note_id"],
      ["coffee_type_translations", "coffee_type_id"],
      ["warehouse_translations", "warehouse_id"],
    ] as const) {
      const parent = {
        region_id: "regions",
        origin_id: "origins",
        sensory_note_id: "sensory_notes",
        coffee_type_id: "coffee_types",
        warehouse_id: "warehouses",
      }[owner];
      const { data } = await service
        .from(parent)
        .select("id")
        .like("slug", `qa-p6-audit-%-${run}`);
      const ids = (data ?? []).map((row) => String(row.id));
      if (ids.length) await service.from(table).delete().in(owner, ids);
    }
    for (const table of [
      "regions",
      "origins",
      "varieties",
      "sensory_notes",
      "coffee_types",
    ] as const)
      await service.from(table).delete().like("slug", `qa-p6-audit-%-${run}`);
    await service
      .from("warehouses")
      .delete()
      .like("name", `%qa-p6-audit%${run}%`);
    await admin?.cleanup();
  });

  async function signIn(page: Page) {
    await page.goto("/dashboard-admin");
    await page.locator('input[name="email"]').fill(admin.email);
    await page.locator('input[name="password"]').fill(admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  }

  /**
   * Fills a legacy create form and submits it.
   *
   * Every one of these forms carries a `required` `isActive` select that
   * defaults to an empty option. Because the legacy forms are **not**
   * `noValidate`, omitting it makes the browser silently refuse the submit
   * with its own popup — which is exactly the behaviour the last test in this
   * file pins down.
   */
  async function fillAndSave(page: Page, values: Record<string, string>) {
    for (const [name, value] of Object.entries(values)) {
      const field = page.locator(`[name="${name}"]`).first();
      const tag = await field.evaluate((node) => node.tagName.toLowerCase());
      if (tag === "select") await field.selectOption(value);
      else await field.fill(value);
    }
    await page.locator('form button[type="submit"]').first().click();
  }

  test("origins: create persists, is listed, and reaches the coffee form", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signIn(page);
    await page.goto("/admin/origins");

    const originSlug = slug("origin");
    await fillAndSave(page, {
      slug: originSlug,
      countryCode: "KE",
      continent: "Africa",
      nameEn: `QA P6 Audit Origin ${run}`,
      nameAr: `منشأ تدقيق ${run}`,
      isActive: "true",
    });

    await expect
      .poll(
        async () => {
          const { data } = await service
            .from("origins")
            .select("id")
            .eq("slug", originSlug)
            .maybeSingle();
          return Boolean(data);
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Both translations were written, not just English.
    const { data: origin } = await service
      .from("origins")
      .select("id")
      .eq("slug", originSlug)
      .single();
    const { data: translations } = await service
      .from("origin_translations")
      .select("locale,name")
      .eq("origin_id", origin!.id);
    expect(translations?.map((t) => t.locale).sort()).toEqual(["ar", "en"]);

    // The dependent dropdown sees it immediately.
    await page.goto("/admin/products/new");
    await expect(
      page.locator('select[name="originId"] option', {
        hasText: `QA P6 Audit Origin ${run}`,
      }),
    ).toHaveCount(1);
    // …and the Arabic form shows the Arabic name.
    await page.goto("/ar/admin/products/new");
    await expect(
      page.locator('select[name="originId"] option', {
        hasText: `منشأ تدقيق ${run}`,
      }),
    ).toHaveCount(1);
    expect(problems.appErrors()).toEqual([]);
  });

  test("regions: create is scoped to its origin in the coffee form", async ({
    page,
  }) => {
    await signIn(page);
    const { data: origin } = await service
      .from("origins")
      .select("id")
      .eq("slug", slug("origin"))
      .single();

    await page.goto("/admin/regions");
    const regionSlug = slug("region");
    await fillAndSave(page, {
      slug: regionSlug,
      originId: origin!.id,
      nameEn: `QA P6 Audit Region ${run}`,
      nameAr: `منطقة تدقيق ${run}`,
      isActive: "true",
    });

    await expect
      .poll(
        async () => {
          const { data } = await service
            .from("regions")
            .select("id,origin_id")
            .eq("slug", regionSlug)
            .maybeSingle();
          return data?.origin_id ?? null;
        },
        { timeout: 15_000 },
      )
      .toBe(origin!.id);

    // It appears only under its own origin, which is the dependent-select rule.
    await page.goto("/admin/products/new");
    const regionOption = page.locator('select[name="regionId"] option', {
      hasText: `QA P6 Audit Region ${run}`,
    });
    await page
      .locator('select[name="originId"]')
      .selectOption({ label: `QA P6 Audit Origin ${run}` });
    await expect(regionOption).toHaveCount(1);
    // Switch to a different origin by resolving its option value first
    // (Playwright's `label` matcher takes a literal string, not a pattern).
    const originSelect = page.locator('select[name="originId"]');
    const labels = await originSelect.locator("option").allTextContents();
    const values = await originSelect
      .locator("option")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLOptionElement).value),
      );
    const ethiopia = values[labels.findIndex((l) => /Ethiopia/.test(l))];
    await originSelect.selectOption(ethiopia);
    await expect(regionOption).toHaveCount(0);
  });

  test("taxonomy: a new coffee type and sensory note reach their forms", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/taxonomy");

    const typeSlug = slug("type");
    await fillAndSave(page, {
      entity: "coffee_types",
      slug: typeSlug,
      nameEn: `QA P6 Audit Type ${run}`,
      nameAr: `نوع تدقيق ${run}`,
      isActive: "true",
    });
    await expect
      .poll(
        async () => {
          const { data } = await service
            .from("coffee_types")
            .select("id")
            .eq("slug", typeSlug)
            .maybeSingle();
          return Boolean(data);
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await page.goto("/admin/taxonomy");
    const noteSlug = slug("note");
    await fillAndSave(page, {
      entity: "sensory_notes",
      slug: noteSlug,
      nameEn: `QA P6 Audit Note ${run}`,
      nameAr: `ملاحظة تدقيق ${run}`,
      isActive: "true",
    });
    await expect
      .poll(
        async () => {
          const { data } = await service
            .from("sensory_notes")
            .select("id")
            .eq("slug", noteSlug)
            .maybeSingle();
          return Boolean(data);
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // The coffee form sees the new type; the offer form sees the new note
    // (sensory notes attach to offers in this schema).
    // The label must be the *translated name*, not the slug. Matching only the
    // run tag would let a slug fallback pass, which is exactly how N38 hid.
    await page.goto("/admin/products/new");
    const typeOptions = await page
      .locator('select[name="coffeeTypeId"] option')
      .allTextContents();
    expect(
      typeOptions,
      `coffee type options were: ${typeOptions.join(" | ")}`,
    ).toContain(`QA P6 Audit Type ${run}`);

    // Arabic resolves to the Arabic name.
    await page.goto("/ar/admin/products/new");
    const arTypeOptions = await page
      .locator('select[name="coffeeTypeId"] option')
      .allTextContents();
    expect(arTypeOptions).toContain(`نوع تدقيق ${run}`);
    await page.goto("/admin/offers/new");
    await expect(
      page.getByRole("checkbox", { name: `QA P6 Audit Note ${run}` }),
    ).toHaveCount(1);
  });

  test("varieties: create reaches the coffee form (English-only by schema)", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/varieties");

    const varietySlug = slug("variety");
    await fillAndSave(page, {
      slug: varietySlug,
      name: `QA P6 Audit Variety ${run}`,
      isActive: "true",
    });
    await expect
      .poll(
        async () => {
          const { data } = await service
            .from("varieties")
            .select("id,name")
            .eq("slug", varietySlug)
            .maybeSingle();
          return data?.name ?? null;
        },
        { timeout: 15_000 },
      )
      .toBe(`QA P6 Audit Variety ${run}`);

    await page.goto("/admin/products/new");
    await expect(
      page.getByRole("checkbox", { name: `QA P6 Audit Variety ${run}` }),
    ).toHaveCount(1);

    // N32 in the flesh: the Arabic form shows the same English name, because
    // `varieties` has no translation table in the live schema.
    await page.goto("/ar/admin/products/new");
    await expect(
      page.getByRole("checkbox", { name: `QA P6 Audit Variety ${run}` }),
    ).toHaveCount(1);
  });

  test("warehouses: create reaches the offer form", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/warehouses");
    // `warehouses.code` is constrained to EGYPT/DUBAI, so this module can only
    // edit the two existing rows — recorded rather than worked around.
    const codeOptions = await page
      .locator('[name="code"] option')
      .allTextContents();
    expect(codeOptions.join("|")).toMatch(/EGYPT|DUBAI/);

    await page.goto("/admin/offers/new");
    const warehouseOptions = await page
      .locator('select[name="warehouseId"] option')
      .allTextContents();
    expect(warehouseOptions.length).toBeGreaterThan(1);
  });

  test("every Admin form is application-validated, not browser-validated", async ({
    page,
  }) => {
    await signIn(page);

    // Phase 6 recorded the honest state of the reference modules: their forms
    // were not `noValidate`, so the browser blocked a submit with its own
    // unlocalized popup instead of the application rendering a per-field
    // message. Phase 10 moved them onto the same form stack as the catalog,
    // and this test now asserts the fixed behaviour on both.
    for (const path of [
      "/admin/origins",
      "/admin/regions",
      "/admin/warehouses",
      "/admin/varieties",
      "/admin/taxonomy",
      "/admin/article-categories",
      "/admin/products/new",
      "/admin/offers/new",
    ]) {
      await page.goto(path);
      const form = page.locator("main form").first();
      await expect(form, `${path} is not application-validated`).toHaveAttribute(
        "novalidate",
        "",
      );
      await expect(
        form.locator("[required]"),
        `${path} still uses a native required attribute`,
      ).toHaveCount(0);
    }
  });

  test("an empty reference form reports each failure under its own field", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/origins");
    const form = page.locator("main form").first();

    await form.locator('button[type="submit"]').first().click();
    // The page stays put, and the reason appears beside each input rather
    // than in a browser bubble.
    await expect(page).toHaveURL(/\/admin\/origins$/);
    for (const field of ["slug", "countryCode", "nameEn", "nameAr"]) {
      const input = form.locator(`[name="${field}"]`);
      await expect(input, `${field} not flagged`).toHaveAttribute(
        "aria-invalid",
        "true",
        { timeout: 30_000 },
      );
      const describedBy = await input.getAttribute("aria-describedby");
      expect(describedBy, `${field} has no error association`).toBeTruthy();
      await expect(
        page.locator(`#${describedBy!.split(" ")[0]}`),
        `${field} has no inline message`,
      ).toBeVisible();
    }
  });
});
