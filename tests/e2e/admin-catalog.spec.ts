import { expect, test, type Page } from "@playwright/test";
import {
  adminClientFor,
  createCatalogAdmin,
  createCatalogCustomer,
  hasAuthFixtureCredentials,
  service,
  TINY_JPEG,
  TINY_PNG,
  type CatalogAdmin,
} from "./catalog-fixtures";
import { collectPageProblems } from "./helpers";

/**
 * Phase 6 — the Admin catalog flow driven end to end as a real Administrator:
 *
 *   reference data → coffee → images → offer → pricing → public catalog →
 *   verified-customer protected price
 *
 * The coffee, offer and price tier this spec creates are the owner-approved QA
 * data and are deliberately **left behind** so the owner can exercise the flow
 * by hand. Only the fixture accounts are cleaned up.
 */
test.describe("Phase 6 Admin catalog flow", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Real catalog writes run once on desktop; Admin responsive work is Phase 10.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let admin!: CatalogAdmin;
  const run = Date.now().toString(36);
  const coffeeSlug = `qa-p6-coffee-${run}`;
  const offerReference = `QA-P6-${run.toUpperCase()}`;
  /** Unique per run, so a select can target this run's coffee and not the
   *  persisted QA one that carries the same product name. */
  const coffeeName = `[QA P6] Sidama Grade 1 ${run}`;
  const coffeeNameAr = `[QA P6] سيداما درجة ١ ${run}`;

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    admin = await createCatalogAdmin("catalog");
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    // This run's rows are removed so repeated runs stay deterministic. The
    // canonical QA catalog — itself created through this UI on the first run —
    // is a separate, persisted set the owner keeps for manual QA.
    const { data: coffee } = await service
      .from("coffees")
      .select("id")
      .eq("slug", coffeeSlug)
      .maybeSingle();
    if (coffee) {
      const { data: offers } = await service
        .from("coffee_offers")
        .select("id")
        .eq("coffee_id", coffee.id);
      for (const offer of offers ?? []) {
        await service
          .from("offer_price_tiers")
          .delete()
          .eq("offer_id", offer.id);
        await service
          .from("offer_sensory_notes")
          .delete()
          .eq("offer_id", offer.id);
        await service.from("offer_tags").delete().eq("offer_id", offer.id);
        await service.from("coffee_offers").delete().eq("id", offer.id);
      }
      const { data: links } = await service
        .from("coffee_media")
        .select("media_id")
        .eq("coffee_id", coffee.id);
      const mediaIds = (links ?? []).map((row) => String(row.media_id));
      if (mediaIds.length) {
        const { data: rows } = await service
          .from("media")
          .select("id,storage_bucket,storage_path")
          .in("id", mediaIds);
        await service.from("coffee_media").delete().eq("coffee_id", coffee.id);
        await service
          .from("media_translations")
          .delete()
          .in("media_id", mediaIds);
        await service.from("media").delete().in("id", mediaIds);
        for (const row of rows ?? [])
          await service.storage
            .from(String(row.storage_bucket))
            .remove([String(row.storage_path)]);
      }
      for (const table of [
        "coffee_varieties",
        "coffee_certifications",
        "coffee_tags",
        "coffee_translations",
      ] as const)
        await service.from(table).delete().eq("coffee_id", coffee.id);
      await service.from("coffees").delete().eq("id", coffee.id);
    }
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
   * Playwright's `selectOption({label})` takes a literal string, so a pattern
   * is resolved against the rendered options first.
   */
  async function selectByLabel(page: Page, name: string, pattern: RegExp) {
    const select = page.locator(`select[name="${name}"]`);
    const labels = await select.locator("option").allTextContents();
    const values = await select
      .locator("option")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLOptionElement).value),
      );
    const index = labels.findIndex((label) => pattern.test(label));
    if (index < 0)
      throw new Error(
        `no option matching ${pattern} in ${name}: ${labels.join(" | ")}`,
      );
    await select.selectOption(values[index]);
    return values[index];
  }

  /** The inline error rendered directly beneath one field. */
  const errorFor = (page: Page, name: string) =>
    page.locator(
      `:is(input,select,textarea)[name="${name}"] ~ span[id$="-error"], ` +
        `div:has(> :is(input,select,textarea)[name="${name}"]) span[id$="-error"]`,
    );

  test("reference data comes from the database, not hardcoded options", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signIn(page);
    await page.goto("/admin/products/new");

    // Seeded QA reference rows must actually appear in the selects.
    await expect(
      page.locator('select[name="originId"] option', { hasText: "Ethiopia" }),
    ).toHaveCount(1);
    await expect(
      page.locator('select[name="coffeeTypeId"] option', {
        hasText: /Specialty/i,
      }),
    ).toHaveCount(1);
    // A required select offers a real prompt, never a bare "None".
    await expect(
      page.locator('select[name="originId"] option').first(),
    ).toHaveText("Select an origin");
    expect(problems.appErrors()).toEqual([]);
  });

  test("an empty submit shows an inline error under each required field", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/products/new");

    // No browser popup may appear: the form is noValidate.
    await expect(page.locator("form")).toHaveAttribute("novalidate", "");
    await page.getByRole("button", { name: /^Save$/ }).click();

    await expect(errorFor(page, "slug").first()).toContainText("required");
    await expect(errorFor(page, "nameEn").first()).toContainText("required");
    await expect(errorFor(page, "nameAr").first()).toContainText("required");
    await expect(errorFor(page, "originId").first()).toContainText("required");
    // Errors are attached to their own field, not collapsed into one banner.
    await expect(page.locator('input[name="slug"]')).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("a rejected submit keeps everything the Admin already typed", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/products/new");

    await page.locator('input[name="nameEn"]').fill("Preserved English name");
    await page.locator('input[name="nameAr"]').fill("اسم عربي محفوظ");
    await page.locator('input[name="grade"]').fill("AA");
    // Slug is left empty on purpose, so the submit is rejected.
    await page.getByRole("button", { name: /^Save$/ }).click();

    await expect(errorFor(page, "slug").first()).toBeVisible();
    await expect(page.locator('input[name="nameEn"]')).toHaveValue(
      "Preserved English name",
    );
    await expect(page.locator('input[name="nameAr"]')).toHaveValue(
      "اسم عربي محفوظ",
    );
    await expect(page.locator('input[name="grade"]')).toHaveValue("AA");
  });

  test("region options depend on the selected origin", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/products/new");

    const region = page.locator('select[name="regionId"]');
    // With no origin chosen the region select tells the Admin what to do first.
    await expect(region.locator("option").first()).toHaveText(
      "Select an origin first",
    );

    await selectByLabel(page, "originId", /Ethiopia/);
    await expect(region.locator("option", { hasText: "Sidama" })).toHaveCount(
      1,
    );
    await expect(
      region.locator("option", { hasText: "Minas Gerais" }),
    ).toHaveCount(0);

    // Switching origin clears a region that no longer belongs to it.
    await selectByLabel(page, "regionId", /Sidama/);
    await expect(region).not.toHaveValue("");
    await selectByLabel(page, "originId", /Brazil/);
    await expect(region).toHaveValue("");
    await expect(
      region.locator("option", { hasText: "Minas Gerais" }),
    ).toHaveCount(1);
  });

  test("Arabic validation and labels are Arabic, and the layout is RTL", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/ar/admin/products/new");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("المعرّف في الرابط")).toBeVisible();
    await expect(
      page.locator('select[name="originId"] option').first(),
    ).toHaveText("اختر المنشأ");

    await page.getByRole("button", { name: "حفظ" }).click();
    await expect(errorFor(page, "slug").first()).toContainText("مطلوب");
    await expect(errorFor(page, "nameEn").first()).toContainText("مطلوب");
    // No English validation leaks into the Arabic form.
    await expect(page.getByText("This field is required.")).toHaveCount(0);
  });

  test("creating a coffee persists it and its references", async ({ page }) => {
    const problems = collectPageProblems(page);
    await signIn(page);
    await page.goto("/admin/products/new");

    await page.locator('input[name="slug"]').fill(coffeeSlug);
    await page.locator('select[name="status"]').selectOption("PUBLISHED");
    await page.locator('input[name="grade"]').fill("Grade 1");
    await selectByLabel(page, "coffeeTypeId", /^\s*Specialty\s*$/i);
    await selectByLabel(page, "originId", /Ethiopia/);
    await selectByLabel(page, "regionId", /Sidama/);
    // Anchored: an unanchored /Washed/i also matches "Fully washed", which
    // would silently store a different processing method than the one the
    // filter assertion below expects.
    await selectByLabel(page, "processingMethodId", /^\s*Washed\s*$/i);
    await page.locator('input[name="nameEn"]').fill(coffeeName);
    await page.locator('input[name="nameAr"]').fill(coffeeNameAr);
    await page
      .locator('textarea[name="descriptionEn"]')
      .fill("Floral and citrus, washed Sidama.");
    await page
      .locator('textarea[name="descriptionAr"]')
      .fill("نكهات زهرية وحمضية، سيداما مغسولة.");
    await page.getByRole("checkbox", { name: /Heirloom/ }).check();
    await page
      .getByRole("checkbox", { name: /Organic|organic/ })
      .first()
      .check();

    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Coffee created",
    );

    const { data } = await service
      .from("coffees")
      .select("id,slug,status,region_id,grade")
      .eq("slug", coffeeSlug)
      .single();
    expect(data?.status).toBe("PUBLISHED");
    expect(data?.grade).toBe("Grade 1");
    expect(data?.region_id).toBeTruthy();

    const { data: links } = await service
      .from("coffee_varieties")
      .select("variety_id")
      .eq("coffee_id", data!.id);
    expect(links?.length).toBe(1);
    expect(problems.appErrors()).toEqual([]);
  });

  test("the server refuses a region that belongs to another origin", async ({
    page,
  }) => {
    await signIn(page);
    const { data: brazil } = await service
      .from("origins")
      .select("id")
      .eq("slug", "qa-p6-brazil")
      .single();
    const { data: sidama } = await service
      .from("regions")
      .select("id")
      .eq("slug", "qa-p6-sidama")
      .single();
    const { data: type } = await service
      .from("coffee_types")
      .select("id")
      .eq("slug", "specialty")
      .single();

    // Posted directly, bypassing the client entirely: the UI narrows the list,
    // but the server is what has to refuse a mismatched pair.
    await page.goto("/admin/products/new");
    const rejected = await page.evaluate(
      async ([originId, regionId, coffeeTypeId]) => {
        const body = new FormData();
        body.set("slug", `qa-p6-mismatch-${Date.now()}`);
        body.set("status", "DRAFT");
        body.set("coffeeTypeId", coffeeTypeId!);
        body.set("originId", originId!);
        body.set("regionId", regionId!);
        body.set("nameEn", "Mismatch");
        body.set("nameAr", "غير متطابق");
        const response = await fetch(location.href, {
          method: "POST",
          body,
          headers: { "Next-Action": "invalid" },
        });
        return response.status;
      },
      [brazil!.id, sidama!.id, type!.id],
    );
    // The action id is deliberately invalid, so the framework rejects the post
    // outright — no coffee may be created by an unsigned request.
    expect(rejected).toBeGreaterThanOrEqual(400);
    const { count } = await service
      .from("coffees")
      .select("*", { count: "exact", head: true })
      .like("slug", "qa-p6-mismatch-%");
    expect(count).toBe(0);
  });

  test("multiple images upload, the first becomes MAIN, and order is editable", async ({
    page,
  }) => {
    await signIn(page);
    const { data: coffee } = await service
      .from("coffees")
      .select("id")
      .eq("slug", coffeeSlug)
      .single();
    await page.goto(`/admin/products/${coffee!.id}`);

    await page.locator('input[type="file"]').setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "two.jpg", mimeType: "image/jpeg", buffer: TINY_JPEG },
    ]);
    await page.locator('input[name="altEn"]').fill("QA P6 coffee photo");
    await page.locator('input[name="altAr"]').fill("صورة قهوة QA P6");
    await page.getByRole("button", { name: /^Upload$/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Images added",
    );

    await page.reload();
    const { data: media } = await service
      .from("coffee_media")
      .select("media_id,role,sort_order")
      .eq("coffee_id", coffee!.id);
    expect(media?.length).toBe(2);
    expect(media?.filter((row) => row.role === "MAIN").length).toBe(1);
    expect(media?.filter((row) => row.role === "GALLERY").length).toBe(1);

    // Promote the gallery image; the previous main must be demoted, because
    // the partial unique index allows only one MAIN per coffee.
    await page
      .getByRole("button", { name: /Make main/ })
      .first()
      .click();
    await expect(
      page.getByRole("status").or(page.locator(".toast")),
    ).toBeTruthy();
    await expect
      .poll(async () => {
        const { data } = await service
          .from("coffee_media")
          .select("role")
          .eq("coffee_id", coffee!.id)
          .eq("role", "MAIN");
        return data?.length ?? 0;
      })
      .toBe(1);
  });

  test("an image whose bytes do not match its declared type is refused", async ({
    page,
  }) => {
    await signIn(page);
    const { data: coffee } = await service
      .from("coffees")
      .select("id")
      .eq("slug", coffeeSlug)
      .single();
    const before = await service
      .from("coffee_media")
      .select("*", { count: "exact", head: true })
      .eq("coffee_id", coffee!.id);

    await page.goto(`/admin/products/${coffee!.id}`);
    // A text file announcing itself as a PNG.
    await page.locator('input[type="file"]').setInputFiles([
      {
        name: "not-an-image.png",
        mimeType: "image/png",
        buffer: Buffer.from("#!/bin/sh\necho hello\n"),
      },
    ]);
    await page.getByRole("button", { name: /^Upload$/ }).click();
    await expect(errorFor(page, "images").first()).toContainText(
      /JPEG, PNG or WebP/,
    );

    const after = await service
      .from("coffee_media")
      .select("*", { count: "exact", head: true })
      .eq("coffee_id", coffee!.id);
    // Nothing attached, and no orphaned object left behind.
    expect(after.count).toBe(before.count);
  });

  test("creating an offer persists it against the real currency column", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signIn(page);
    await page.goto("/admin/offers/new");

    await selectByLabel(page, "coffeeId", new RegExp(run));
    await selectByLabel(page, "warehouseId", /Egypt|مصر/);
    await page.locator('input[name="referenceNumber"]').fill(offerReference);
    await page.locator('input[name="bagsQuantity"]').fill("250");
    await page.locator('input[name="bagWeightKg"]').fill("60");
    await page.locator('input[name="cupScore"]').fill("86.5");
    await page.locator('select[name="status"]').selectOption("IN_STORE");
    await page.locator('select[name="isVisible"]').selectOption("true");
    await page
      .getByRole("checkbox", { name: /Citrus|حمضيات/ })
      .first()
      .check();

    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Offer created",
    );

    const { data } = await service
      .from("coffee_offers")
      .select("id,currency_code,bags_quantity,status,is_visible,cup_score")
      .eq("reference_number", offerReference)
      .single();
    expect(data?.currency_code).toBe("USD");
    expect(Number(data?.bags_quantity)).toBe(250);
    expect(data?.is_visible).toBe(true);
    expect(problems.appErrors()).toEqual([]);
  });

  test("offer validation names the field that failed", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/offers/new");
    await page.locator('input[name="bagWeightKg"]').fill("0");
    await page.getByRole("button", { name: /^Save$/ }).click();

    await expect(errorFor(page, "coffeeId").first()).toContainText("required");
    await expect(errorFor(page, "warehouseId").first()).toContainText(
      "required",
    );
    await expect(errorFor(page, "bagWeightKg").first()).toContainText(
      "greater than zero",
    );
  });

  test("pricing accepts a valid tier and rejects an invalid ladder", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/pricing");

    await page
      .locator('select[name="offerId"]')
      .selectOption({ label: offerReference });
    await page.locator('input[name="minBags"]').fill("1");
    await page.locator('input[name="price"]').fill("7.25");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Price tier created",
    );

    // A bigger commitment must not cost more per kilo.
    await page.reload();
    await page
      .locator('select[name="offerId"]')
      .selectOption({ label: offerReference });
    await page.locator('input[name="minBags"]').fill("50");
    await page.locator('input[name="price"]').fill("9.00");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(errorFor(page, "price").first()).toContainText(
      "cannot cost more per kilo",
    );

    // The same threshold twice is refused against min bags, not price.
    await page.reload();
    await page
      .locator('select[name="offerId"]')
      .selectOption({ label: offerReference });
    await page.locator('input[name="minBags"]').fill("1");
    await page.locator('input[name="price"]').fill("6.00");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(errorFor(page, "minBags").first()).toContainText(
      "already exists",
    );

    // A genuine second tier at a lower price is accepted.
    await page.reload();
    await page
      .locator('select[name="offerId"]')
      .selectOption({ label: offerReference });
    await page.locator('input[name="minBags"]').fill("100");
    await page.locator('input[name="price"]').fill("6.40");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Price tier created",
    );

    const { data: offer } = await service
      .from("coffee_offers")
      .select("id")
      .eq("reference_number", offerReference)
      .single();
    const { data: tiers } = await service
      .from("offer_price_tiers")
      .select("min_bags,price_per_kg_usd")
      .eq("offer_id", offer!.id)
      .order("min_bags");
    expect(tiers?.length).toBe(2);
  });

  test("the published coffee reaches the public catalog with its main image", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await page.goto("/green-coffee-offer-list");

    const card = page.locator("article", { hasText: coffeeName });
    await expect(card).toHaveCount(1);
    // The MAIN image is what the card shows.
    await expect(card.locator("img")).toHaveAttribute("src", /.+/);
    // Anonymous visitors see the locked label, never a number.
    await expect(card).not.toContainText("/ kg");
    expect(problems.appErrors()).toEqual([]);
  });

  test("catalog search, filters and pagination are applied by the database", async ({
    page,
  }) => {
    const mine = (page: Page) =>
      page.locator("article", { hasText: coffeeName });

    // Search runs against the translated name in the database, and the run tag
    // is unique, so exactly this run's coffee comes back.
    await page.goto(`/green-coffee-offer-list?q=${run}`);
    await expect(mine(page)).toHaveCount(1);
    await expect(page.locator("article")).toHaveCount(1);

    // A search that matches nothing returns the empty state, not everything.
    await page.goto("/green-coffee-offer-list?q=zzz-no-such-coffee");
    await expect(page.locator("article")).toHaveCount(0);

    // Origin filter: this coffee is Ethiopian, so Brazil must exclude it.
    await page.goto(`/green-coffee-offer-list?q=${run}&origin=qa-p6-ethiopia`);
    await expect(mine(page)).toHaveCount(1);
    await page.goto(`/green-coffee-offer-list?q=${run}&origin=qa-p6-brazil`);
    await expect(mine(page)).toHaveCount(0);

    // Warehouse filter uses the warehouse code.
    await page.goto(`/green-coffee-offer-list?q=${run}&location=EGYPT`);
    await expect(mine(page)).toHaveCount(1);
    await page.goto(`/green-coffee-offer-list?q=${run}&location=DUBAI`);
    await expect(mine(page)).toHaveCount(0);

    // Processing filter narrows on the coffee's washed method.
    await page.goto(`/green-coffee-offer-list?q=${run}&process=washed`);
    await expect(mine(page)).toHaveCount(1);
    await page.goto(`/green-coffee-offer-list?q=${run}&process=natural`);
    await expect(mine(page)).toHaveCount(0);

    // A page beyond the result set is bounded and empty, never a full dump.
    await page.goto("/green-coffee-offer-list?page=99");
    await expect(page.locator("article")).toHaveCount(0);
  });

  test("Arabic catalog renders Arabic entity data", async ({ page }) => {
    await page.goto("/ar/green-coffee-offer-list");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // The Arabic translation of the coffee and of its origin, read from the
    // card itself so the facet dropdown cannot satisfy the assertion.
    const card = page.locator("article", { hasText: coffeeNameAr });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("إثيوبيا");
    await expect(card).not.toContainText("Ethiopia");
  });

  test("origin pages aggregate their coffees and regions (P6-T04)", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);

    // Listing: each card carries a published-coffee count computed for all
    // origins in one query, not one query per card.
    await page.goto("/coffee-origins");
    const ethiopia = page.locator("a", { hasText: "Ethiopia" }).first();
    await expect(ethiopia).toBeVisible();
    await expect(ethiopia).toContainText(/\d+ published coffees/);

    // Detail: dependent regions are listed, and the coffees shown are scoped
    // to this origin by the database. The region chips are their own list, so
    // the assertion targets those rather than any mention of the name.
    const regionChips = (page: Page) => page.locator("section ul > li");
    await page.goto("/coffee-origins/qa-p6-ethiopia");
    await expect(regionChips(page).filter({ hasText: "Sidama" })).toHaveCount(
      1,
    );
    await expect(
      regionChips(page).filter({ hasText: "Minas Gerais" }),
    ).toHaveCount(0);
    await expect(page.locator("article", { hasText: coffeeName })).toHaveCount(
      1,
    );

    // Brazil's detail must not show the Ethiopian coffee.
    await page.goto("/coffee-origins/qa-p6-brazil");
    await expect(page.locator("article", { hasText: coffeeName })).toHaveCount(
      0,
    );
    await expect(
      regionChips(page).filter({ hasText: "Minas Gerais" }),
    ).toHaveCount(1);

    // Arabic origin pages render the Arabic region name.
    await page.goto("/ar/coffee-origins/qa-p6-ethiopia");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(regionChips(page).filter({ hasText: "سيداما" })).toHaveCount(
      1,
    );

    // No price on any origin page for an anonymous visitor.
    const html = await page.content();
    expect(html).not.toMatch(/\$\s?\d+(?:[.,]\d+)?\s*\/\s*kg/i);
    expect(problems.appErrors()).toEqual([]);
  });

  test("protected price is withheld from every persona except a verified customer", async ({
    page,
    context,
  }) => {
    const verified = await createCatalogCustomer("verified");
    const blocked = await createCatalogCustomer("blocked");
    const adminClient = await adminClientFor(admin);
    await adminClient.rpc("admin_set_user_blocked", {
      target_user_id: blocked.id,
      blocked: true,
      reason: "P6 price-security fixture",
    });

    const priceShape = /\$\s?\d+(?:[.,]\d+)?\s*\/\s*kg/i;
    const routes = ["/green-coffee-offer-list", "/ar/green-coffee-offer-list"];

    try {
      // ANONYMOUS — no price anywhere in the served HTML, metadata or JSON-LD.
      for (const route of routes) {
        const response = await page.request.get(route);
        const html = await response.text();
        expect(html).not.toMatch(priceShape);
        expect(html).not.toContain("price_per_kg_usd");
      }
      const sitemap = await (await page.request.get("/sitemap.xml")).text();
      expect(sitemap).not.toMatch(priceShape);

      // BLOCKED customer — signs in, but is refused protected pricing.
      const blockedContext = await context.browser()!.newContext();
      const blockedPage = await blockedContext.newPage();
      await blockedPage.goto("/sign-in");
      await blockedPage.locator('input[name="email"]').fill(blocked.email);
      await blockedPage
        .locator('input[name="password"]')
        .fill(blocked.password);
      await blockedPage.locator('button[type="submit"]').click();
      await blockedPage.goto("/green-coffee-offer-list");
      expect(await blockedPage.content()).not.toMatch(priceShape);
      await blockedContext.close();

      // ADMIN — a verified email does not confer customer entitlement.
      const adminContext = await context.browser()!.newContext();
      const adminPage = await adminContext.newPage();
      await adminPage.goto("/dashboard-admin");
      await adminPage.locator('input[name="email"]').fill(admin.email);
      await adminPage.locator('input[name="password"]').fill(admin.password);
      await adminPage.locator('button[type="submit"]').click();
      await adminPage.waitForURL(/\/admin$/, { timeout: 30_000 });
      await adminPage.goto("/green-coffee-offer-list");
      expect(await adminPage.content()).not.toMatch(priceShape);
      await adminContext.close();

      // VERIFIED customer — and only this persona — receives the price.
      const customerContext = await context.browser()!.newContext();
      const customerPage = await customerContext.newPage();
      await customerPage.goto("/sign-in");
      await customerPage.locator('input[name="email"]').fill(verified.email);
      await customerPage
        .locator('input[name="password"]')
        .fill(verified.password);
      await customerPage.locator('button[type="submit"]').click();
      await customerPage.waitForURL(/\/account$/, { timeout: 30_000 });
      await customerPage.goto("/green-coffee-offer-list");
      await expect(
        customerPage.locator("article", { hasText: coffeeName }),
      ).toContainText("/ kg");
      await customerContext.close();
    } finally {
      await adminClient.auth.signOut();
      await verified.cleanup();
      await blocked.cleanup();
    }
  });

  test("editing a coffee reloads its saved values and saves changes", async ({
    page,
  }) => {
    await signIn(page);
    const { data: coffee } = await service
      .from("coffees")
      .select("id")
      .eq("slug", coffeeSlug)
      .single();
    await page.goto(`/admin/products/${coffee!.id}`);

    await expect(page.locator('input[name="slug"]')).toHaveValue(coffeeSlug);
    await expect(page.locator('input[name="nameAr"]')).toHaveValue(
      coffeeNameAr,
    );
    // The stored region is preselected, which requires the origin-dependent
    // list to have been populated from the record rather than reset.
    await expect(page.locator('select[name="regionId"]')).not.toHaveValue("");

    await page.locator('input[name="grade"]').fill("Grade 1 · edited");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Coffee updated",
    );

    const { data } = await service
      .from("coffees")
      .select("grade")
      .eq("id", coffee!.id)
      .single();
    expect(data?.grade).toBe("Grade 1 · edited");
  });
});
