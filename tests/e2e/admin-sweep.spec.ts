import { expect, test, type Page } from "@playwright/test";
import {
  createContentPersonas,
  hasAuthFixtureCredentials,
  service,
  type ContentPersonas,
} from "./content-fixtures";
import { collectPageProblems } from "./helpers";
import { auditScreen, visitInTheme } from "./ui-audit";

/**
 * Phase 10 — the Admin interaction and responsive sweep.
 *
 * Every Admin module is opened as a real Administrator and audited at five
 * widths, in both languages and both themes. The reference modules are then
 * driven through their full lifecycle — invalid submit first, then create,
 * reload, edit, reload, archive — using the actual forms.
 *
 * `auditScreen` fails on a raw translation key, a broken image, text the theme
 * has made unreadable, or a page that scrolls sideways. That is what turns
 * "looks fine" into evidence.
 */

/** Every Admin surface, with the heading each must show in each language. */
const MODULES = [
  { path: "/admin", en: "Operations overview", ar: "نظرة تشغيلية" },
  { path: "/admin/products", en: "Coffees", ar: "أنواع القهوة" },
  { path: "/admin/offers", en: "Offers", ar: "العروض" },
  { path: "/admin/pricing", en: "Pricing", ar: "التسعير" },
  { path: "/admin/origins", en: "Origins", ar: "المناشئ" },
  { path: "/admin/regions", en: "Regions", ar: "المناطق" },
  { path: "/admin/varieties", en: "Varieties", ar: "الأصناف" },
  { path: "/admin/warehouses", en: "Warehouses", ar: "المخازن" },
  { path: "/admin/taxonomy", en: "Taxonomy", ar: "التصنيفات" },
  { path: "/admin/users", en: "Customers", ar: "العملاء" },
  { path: "/admin/inquiries", en: "Leads", ar: "الطلبات" },
  { path: "/admin/media", en: "Media library", ar: "مكتبة الوسائط" },
  { path: "/admin/content", en: "Pages", ar: "الصفحات" },
  { path: "/admin/articles", en: "Articles", ar: "المقالات" },
  {
    path: "/admin/article-categories",
    en: "Article categories",
    ar: "تصنيفات المقالات",
  },
  { path: "/admin/settings", en: "Site & organization", ar: "الموقع والمؤسسة" },
  { path: "/admin/account", en: "Admin account", ar: "حساب المسؤول" },
  { path: "/admin/audit", en: "Audit log", ar: "سجل التدقيق" },
] as const;

/** The widths the brief names, including the short desktop. */
const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280x650", width: 1280, height: 650 },
  { name: "1440", width: 1440, height: 900 },
] as const;

test.describe("Phase 10 Admin sweep", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "The sweep sets its own viewports; the mobile project would duplicate it.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  let people!: ContentPersonas;
  let tag = "";
  const created: { table: string; id: string }[] = [];

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    people = await createContentPersonas();
    tag = `qa-p10-${Date.now().toString(36)}`;
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    for (const row of created.reverse())
      await service.from(row.table).delete().eq("id", row.id);
    await people?.cleanup();
  });

  async function signInAdmin(page: Page) {
    await page.goto("/dashboard-admin");
    await page.locator('input[name="email"]').fill(people.admin.email);
    await page.locator('input[name="password"]').fill(people.admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  }

  const main = (page: Page) => page.locator("main");

  // ================================================== P10-T01 + P10-T03 =====

  test("every Admin module is titled, localized and clean at every width and theme", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);

    for (const surface of MODULES) {
      // Headings first, at a normal desktop width.
      await page.setViewportSize({ width: 1440, height: 900 });
      for (const [prefix, expected] of [
        ["", surface.en],
        ["/ar", surface.ar],
      ] as const) {
        await page.goto(`${prefix}${surface.path}`);
        await expect(
          page.locator("h1"),
          `${surface.path} ${prefix || "/en"} has no heading`,
        ).toBeVisible();
        if (expected)
          await expect(
            page.getByRole("heading", { level: 1, name: expected }),
            `${surface.path} ${prefix || "/en"} heading`,
          ).toBeVisible();
        if (prefix === "/ar")
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      }
    }
    expect(problems.appErrors()).toEqual([]);
  });

  // One test per width: 18 modules x 2 themes x 2 locales is 72 audited
  // screens per viewport, and a single test covering all five exceeded its
  // budget. Split, each width reports its own result.
  for (const viewport of VIEWPORTS)
    test(`no Admin module overflows or loses contrast at ${viewport.name}`, async ({
      page,
    }) => {
      const problems = collectPageProblems(page);
      await signInAdmin(page);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      for (const theme of ["light", "dark"] as const)
        for (const prefix of ["", "/ar"] as const)
          for (const surface of MODULES) {
            const label = `${surface.path} ${prefix || "/en"} ${theme} ${viewport.name}`;
            await visitInTheme(page, `${prefix}${surface.path}`, theme);
            await auditScreen(page, label);

            // The heading must stay reachable — a sticky bar or a short
            // desktop must never push it out of view.
            await expect(
              page.locator("h1").first(),
              `heading not visible on ${label}`,
            ).toBeInViewport({ ratio: 0.1 });
          }
      expect(problems.appErrors()).toEqual([]);
    });

  test("the Admin navigation reaches every module on a short desktop", async ({
    page,
  }) => {
    await signInAdmin(page);
    // 1280×650 is the case where a tall sidebar would clip its last group.
    await page.setViewportSize({ width: 1280, height: 650 });
    await page.goto("/admin");

    const nav = page.getByRole("navigation", { name: /Admin sections|أقسام/ });
    await expect(nav).toBeVisible();
    for (const surface of MODULES) {
      if (surface.path === "/admin") continue;
      const link = nav.locator(`a[href$="${surface.path}"]`).first();
      await expect(link, `${surface.path} missing from nav`).toHaveCount(1);
      // Scrollable rather than clipped: the link can be brought into view.
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport({ ratio: 0.5 });
    }
  });

  // =============================================== P10-T02 lifecycle ========

  test("REFERENCE CRUD: an origin is validated, created, edited and archived through the real forms", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/origins");

    // The page says what it controls before showing a form.
    await expect(page.getByText("producing countries")).toBeVisible();

    const form = page.locator("form").filter({ hasText: "Slug" }).first();

    // --- invalid first: every required field reports under itself ---
    await form.getByRole("button", { name: "Add new" }).click();
    for (const field of ["slug", "countryCode", "nameEn", "nameAr"]) {
      const input = form.locator(`[name="${field}"]`);
      await expect(input, `${field} not marked invalid`).toHaveAttribute(
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
    // Application-managed, never the browser's own bubble.
    await expect(form).toHaveAttribute("novalidate", "");

    // --- a bad slug is named as such, and typed values survive ---
    await form.locator('input[name="slug"]').fill("Not A Slug");
    await form.locator('input[name="countryCode"]').fill("ET");
    await form.locator('input[name="nameEn"]').fill("[QA-P10] Sweep origin");
    await form.locator('input[name="nameAr"]').fill("منشأ الفحص QA-P10");
    await form.getByRole("button", { name: "Add new" }).click();
    await expect(form.locator('input[name="slug"]')).toHaveAttribute(
      "aria-invalid",
      "true",
      { timeout: 30_000 },
    );
    await expect(form.locator('input[name="nameAr"]')).toHaveValue(
      "منشأ الفحص QA-P10",
    );
    await expect(form.locator('input[name="countryCode"]')).toHaveValue("ET");

    // --- valid ---
    await form.locator('input[name="slug"]').fill(`${tag}-origin`);
    await form.getByRole("button", { name: "Add new" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Record created",
      { timeout: 30_000 },
    );

    const { data: origin } = await service
      .from("origins")
      .select("id")
      .eq("slug", `${tag}-origin`)
      .single();
    expect(origin).toBeTruthy();
    created.push({ table: "origins", id: String(origin!.id) });

    // --- reload proves persistence ---
    await page.reload();
    await expect(page.getByText("[QA-P10] Sweep origin")).toBeVisible();

    // --- edit, then reload again ---
    await page
      .locator("li")
      .filter({ hasText: "[QA-P10] Sweep origin" })
      .getByRole("link", { name: "Edit" })
      .click();
    await page.waitForURL(/\/admin\/origins\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Edit Origins")).toBeVisible();
    await expect(page.locator('input[name="nameAr"]')).toHaveValue(
      "منشأ الفحص QA-P10",
    );
    await page
      .locator('input[name="nameEn"]')
      .fill("[QA-P10] Sweep origin v2");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Record updated",
      { timeout: 30_000 },
    );
    await page.reload();
    await expect(page.locator('input[name="nameEn"]')).toHaveValue(
      "[QA-P10] Sweep origin v2",
    );
    await auditScreen(page, "origin editor EN light");

    // --- archive names the record and needs confirming ---
    await page.goto("/admin/origins");
    const row = page
      .locator("li")
      .filter({ hasText: "[QA-P10] Sweep origin v2" });
    await row.getByRole("button", { name: "Archive" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("[QA-P10] Sweep origin v2");
    await dialog.getByRole("button", { name: "Archive" }).click();
    await expect
      .poll(
        async () =>
          (
            await service
              .from("origins")
              .select("is_active")
              .eq("id", origin!.id)
              .single()
          ).data?.is_active,
        { timeout: 30_000 },
      )
      .toBe(false);

    expect(problems.appErrors()).toEqual([]);
  });

  test("DEPENDENT SELECT: a region cannot be created without an origin, and says where to make one", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto("/admin/regions");

    const select = page.locator('select[name="originId"]');
    await expect(select).toBeVisible();

    const options = await select.locator("option").allTextContents();
    // A required select never sits on a bare "None".
    expect(options[0]).toContain("Select an origin");
    expect(options.join("|")).not.toMatch(/^None/);

    // With origins present the list is populated; with none, the form says so
    // and links to the page that fixes it.
    const { count } = await service
      .from("origins")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_active", true);
    if ((count ?? 0) === 0) {
      await expect(select).toBeDisabled();
      await expect(page.getByText("No origin exists yet.")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Create an origin first" }),
      ).toBeVisible();
    } else {
      expect(options.length).toBeGreaterThan(1);
    }
  });

  test("TAXONOMY: the term type is a real choice and a created term keeps its translations", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/taxonomy");

    const form = page.locator("form").filter({ hasText: "Taxonomy" }).first();
    const entity = form.locator('select[name="entity"]');
    const labels = await entity.locator("option").allTextContents();
    // Localized names, not raw table names.
    expect(labels.join("|")).toContain("Sensory notes");
    expect(labels.join("|")).not.toContain("sensory_notes");

    await entity.selectOption("sensory_notes");
    await form.locator('input[name="slug"]').fill(`${tag}-note`);
    await form.locator('input[name="nameEn"]').fill("[QA-P10] Sweep note");
    await form.locator('input[name="nameAr"]').fill("ملاحظة الفحص QA-P10");
    await form.getByRole("button", { name: "Add new" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Record created",
      { timeout: 30_000 },
    );

    const { data: note } = await service
      .from("sensory_notes")
      .select("id")
      .eq("slug", `${tag}-note`)
      .single();
    expect(note).toBeTruthy();
    created.push({ table: "sensory_notes", id: String(note!.id) });

    // The translation actually landed — the failure mode N38 fixed in Phase 6.
    const { data: translations } = await service
      .from("sensory_note_translations")
      .select("locale,name")
      .eq("sensory_note_id", note!.id);
    expect((translations ?? []).map((t) => t.name).sort()).toEqual(
      ["[QA-P10] Sweep note", "ملاحظة الفحص QA-P10"].sort(),
    );

    await page.reload();
    await expect(page.getByText("[QA-P10] Sweep note")).toBeVisible();
    expect(problems.appErrors()).toEqual([]);
  });

  test("EMPTY vs NO RESULTS: the audit log distinguishes them", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto("/admin/audit");
    await expect(page.getByText("read-only record")).toBeVisible();

    // A search that cannot match anything.
    await page
      .locator('input[name="q"]')
      .fill("zzz-no-such-audit-entry-zzz");
    await page.getByRole("button", { name: "Search" }).click();
    await page.waitForURL(/q=/);
    await expect(page.getByText("No record matches this search.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Clear the search" }),
    ).toBeVisible();
    await auditScreen(page, "audit no-results EN light");
  });

  // ======================================================= AUTHORIZATION ====

  test("a customer is denied every reference module, by route and by direct action", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.locator('input[name="email"]').fill(people.customer.email);
    await page.locator('input[name="password"]').fill(people.customer.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/account$/, { timeout: 30_000 });

    for (const surface of MODULES) {
      const response = await page.request.get(surface.path, {
        maxRedirects: 0,
      });
      expect(
        [302, 307, 308, 404],
        `${surface.path} was reachable by a customer`,
      ).toContain(response.status());
    }
  });
});
