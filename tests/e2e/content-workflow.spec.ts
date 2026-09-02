import { expect, test, type Page } from "@playwright/test";
import {
  FAKE_PNG,
  PNG_24x16,
  createContentPersonas,
  hasAuthFixtureCredentials,
  service,
  type ContentPersonas,
} from "./content-fixtures";
import { collectPageProblems } from "./helpers";

/**
 * Phase 8 — media, CMS and articles driven end to end through the real Admin.
 *
 * The database-level guarantees (foreign keys, check constraints, RLS) are
 * proven in `tests/integration/content-media.test.ts`. This suite proves what
 * only a browser can: that an Administrator can actually upload an image, build
 * a translated page out of validated sections, publish it, see it render
 * safely on the public site, and be warned before archiving an image the page
 * depends on.
 */
test.describe("Phase 8 content and media workflow", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Real content writes run once on desktop; Admin responsive work is Phase 10.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let people!: ContentPersonas;

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    people = await createContentPersonas();
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
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

  // ------------------------------------------------------------- MEDIA -----

  test("MEDIA: uploads a valid image with alt text, and refuses what is not an image", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/media");
    await expect(
      page.getByRole("heading", { name: "Media library", level: 1 }),
    ).toBeVisible();

    const form = page.locator("form").filter({ hasText: "Upload an image" });

    // --- a file that is not an image, however it is labelled ---
    await form.locator('input[name="file"]').setInputFiles({
      name: "not-really.png",
      mimeType: "image/png",
      buffer: FAKE_PNG,
    });
    await form.locator('input[name="altEn"]').fill("[QA-P8] hostile upload");
    await form.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(form.locator("#media-file-error")).toBeVisible({
      timeout: 30_000,
    });
    await expect(form.locator("#media-file-error")).toContainText(
      "JPEG, PNG or WebP",
    );
    // The value the Admin typed survives the rejection.
    await expect(form.locator('input[name="altEn"]')).toHaveValue(
      "[QA-P8] hostile upload",
    );

    // --- missing English alt text ---
    await form.locator('input[name="altEn"]').fill("");
    await form.locator('input[name="file"]').setInputFiles({
      name: "hero.png",
      mimeType: "image/png",
      buffer: PNG_24x16,
    });
    await form.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(form.locator("#media-altEn-error")).toBeVisible({
      timeout: 30_000,
    });
    await expect(form.locator("#media-altEn-error")).toContainText(
      "English alt text is required",
    );

    // --- a real image, with English alt only ---
    await form.locator('input[name="file"]').setInputFiles({
      name: "hero.png",
      mimeType: "image/png",
      buffer: PNG_24x16,
    });
    await form.locator('input[name="altEn"]').fill("[QA-P8] hero image");
    await form.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Media uploaded", {
      timeout: 30_000,
    });

    await page.reload();
    const card = page.getByRole("link", { name: /\[QA-P8\] hero image/ });
    await expect(card).toBeVisible();
    // Intrinsic dimensions were recorded — without them nothing can render it.
    await expect(card).toContainText("24×16");
    // A missing Arabic alt text is stated, never invented.
    await expect(card).toContainText("No Arabic alt");

    expect(problems.appErrors()).toEqual([]);
  });

  test("MEDIA: edits alt text and shows exactly where an item is used", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto("/admin/media");
    await page.getByRole("link", { name: /\[QA-P8\] hero image/ }).click();
    await page.waitForURL(/\/admin\/media\/[0-9a-f-]{36}$/);

    await expect(page.getByText("24 × 16")).toBeVisible();
    await expect(page.getByText("image/png")).toBeVisible();
    // Nothing references it yet.
    await expect(
      page.getByText("This item is not used anywhere yet."),
    ).toBeVisible();

    await page.locator('input[name="altAr"]').fill("صورة اختبار QA-P8");
    await page.getByRole("button", { name: "Save alt text" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Alt text saved",
      {
        timeout: 30_000,
      },
    );
    // The warning clears once Arabic exists.
    await expect(page.getByText("Missing Arabic alt text")).toHaveCount(0);
  });

  // --------------------------------------------------------------- CMS -----

  test("CMS: builds a translated page from validated sections and publishes it", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/content");

    // --- create the page. The template select's first option must work: the
    // old form defaulted to STANDARD, which the database has always rejected.
    const create = page.locator("form").filter({ hasText: "Page key" }).last();
    await create.locator('input[name="pageKey"]').fill(`${people.tag}-guide`);
    await create
      .locator('input[name="routePath"]')
      .fill(`/${people.tag}-guide`);
    await create.locator('select[name="template"]').selectOption("SUPPORT");
    await create.getByRole("button", { name: "Create draft" }).click();
    await expect(create.getByRole("status")).toContainText(
      "Page created as a draft",
      { timeout: 30_000 },
    );

    await page.reload();
    await page.getByRole("link", { name: `${people.tag}-guide` }).click();
    await page.waitForURL(/\/admin\/content\/[0-9a-f-]{36}$/);
    const pageUrl = page.url();

    // Both languages start missing, and say so.
    await expect(page.getByText("No English content yet")).toBeVisible();
    await expect(page.getByText("No Arabic content yet")).toBeVisible();

    // --- publishing is refused while there is no English content ---
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(main(page).getByRole("alert")).toContainText(
      "Add English page content before publishing",
      { timeout: 30_000 },
    );

    // --- English, then Arabic. Saving one must not disturb the other. ---
    const english = page
      .locator("form")
      .filter({ has: page.locator('input[name="locale"][value="en"]') })
      .first();
    await english.locator('input[name="title"]').fill("[QA-P8] Support guide");
    await english
      .locator('textarea[name="bodyMarkdown"]')
      .fill("A short English body for the Phase 8 acceptance run.");
    await english.getByRole("button", { name: "Save" }).click();
    await expect(english.getByRole("status")).toContainText(
      "English content saved",
      { timeout: 30_000 },
    );

    await page.reload();
    const arabic = page
      .locator("form")
      .filter({ has: page.locator('input[name="locale"][value="ar"]') })
      .first();
    await arabic.locator('input[name="title"]').fill("دليل الدعم QA-P8");
    await arabic
      .locator('textarea[name="bodyMarkdown"]')
      .fill("نص عربي قصير لتشغيل قبول المرحلة الثامنة.");
    // The Arabic editor reads right-to-left.
    await expect(arabic.locator('input[name="title"]')).toHaveAttribute(
      "dir",
      "rtl",
    );
    await arabic.getByRole("button", { name: "Save" }).click();
    await expect(arabic.getByRole("status")).toContainText(
      "Arabic content saved",
      { timeout: 30_000 },
    );

    await page.reload();
    // English survived the Arabic save.
    await expect(page.getByText("No English content yet")).toHaveCount(0);
    await expect(page.getByText("No Arabic content yet")).toHaveCount(0);

    // --- a FAQ section, refused until its body follows the convention ---
    const addSection = page
      .locator("form")
      .filter({ hasText: "Section key" })
      .last();
    await addSection.locator('input[name="sectionKey"]').fill("qa_p8_faq");
    await addSection.locator('select[name="sectionType"]').selectOption("FAQ");
    await addSection.locator('select[name="isVisible"]').selectOption("true");
    await addSection.getByRole("button", { name: "Save" }).click();
    // Visible with no content yet: the registry refuses it rather than letting
    // an unrenderable section reach the public page.
    await expect(addSection.getByRole("alert")).toBeVisible({
      timeout: 30_000,
    });

    // Create it hidden, then give it content, then show it.
    await addSection.locator('select[name="isVisible"]').selectOption("false");
    await addSection.getByRole("button", { name: "Save" }).click();
    await expect(addSection.getByRole("status")).toContainText(
      "Section saved",
      {
        timeout: 30_000,
      },
    );

    await page.goto(pageUrl);
    const faqCard = page.locator("article").filter({ hasText: "qa_p8_faq" });
    const faqEnglish = faqCard
      .locator("form")
      .filter({ has: page.locator('input[name="locale"][value="en"]') })
      .first();
    await faqEnglish.locator('input[name="heading"]').fill("Common questions");
    // The convention is stated in the editor, beside the field.
    await expect(faqCard).toContainText("### Question");
    await faqEnglish
      .locator('textarea[name="bodyMarkdown"]')
      .fill(
        "### Do you ship samples?\nSamples are reviewed manually.\n### Where are you?\nDubai and Alexandria.",
      );
    await faqEnglish.getByRole("button", { name: "Save" }).click();
    await expect(faqEnglish.getByRole("status")).toContainText(
      "English content saved",
      { timeout: 30_000 },
    );

    expect(problems.appErrors()).toEqual([]);
  });

  test("CMS: an unrenderable section is refused, and script content is sanitized on the public page", async ({
    page,
  }) => {
    await signInAdmin(page);
    const { data: cmsPage } = await service
      .from("site_pages")
      .select("id")
      .eq("page_key", `${people.tag}-guide`)
      .single();
    await page.goto(`/admin/content/${cmsPage!.id}`);

    // --- a card grid needs two cards; one is refused with a specific reason.
    const addSection = page
      .locator("form")
      .filter({ hasText: "Section key" })
      .last();
    await addSection.locator('input[name="sectionKey"]').fill("qa_p8_cards");
    await addSection
      .locator('select[name="sectionType"]')
      .selectOption("CARD_GRID");
    await addSection.locator('select[name="isVisible"]').selectOption("false");
    await addSection.getByRole("button", { name: "Save" }).click();
    await expect(addSection.getByRole("status")).toContainText(
      "Section saved",
      {
        timeout: 30_000,
      },
    );

    await page.reload();
    const cards = page.locator("article").filter({ hasText: "qa_p8_cards" });
    // Make it visible so its content is validated.
    const settings = cards
      .locator("form")
      .filter({ hasText: "Section key" })
      .first();
    await settings.locator('select[name="isVisible"]').selectOption("true");
    await settings.getByRole("button", { name: "Save" }).click();
    await expect(settings.getByRole("alert")).toBeVisible({ timeout: 30_000 });

    // --- a hostile body is stored as text and never executed publicly ---
    await page.reload();
    const faqCard = page.locator("article").filter({ hasText: "qa_p8_faq" });
    const faqEnglish = faqCard
      .locator("form")
      .filter({ has: page.locator('input[name="locale"][value="en"]') })
      .first();
    await faqEnglish
      .locator('textarea[name="bodyMarkdown"]')
      .fill(
        '### Is it safe?\nYes. <script>window.__xss = true;</script> <img src=x onerror="window.__xss = true"> [click](javascript:window.__xss=true)',
      );
    await faqEnglish.getByRole("button", { name: "Save" }).click();
    await expect(faqEnglish.getByRole("status")).toContainText(
      "English content saved",
      { timeout: 30_000 },
    );

    // Make the FAQ visible and publish the page.
    const faqSettings = faqCard
      .locator("form")
      .filter({ hasText: "Section key" })
      .first();
    await faqSettings.locator('select[name="isVisible"]').selectOption("true");
    await faqSettings.getByRole("button", { name: "Save" }).click();
    await expect(faqSettings.getByRole("status")).toContainText(
      "Section saved",
      {
        timeout: 30_000,
      },
    );

    await page.goto(`/admin/content/${cmsPage!.id}`);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Page published",
      {
        timeout: 30_000,
      },
    );

    // --- the public page ---
    const publicProblems = collectPageProblems(page);
    await page.goto(`/${people.tag}-guide`);
    await expect(
      page.getByRole("heading", { name: "Common questions" }),
    ).toBeVisible();
    await expect(page.getByText("Is it safe?")).toBeVisible();
    // Nothing executed.
    expect(
      await page.evaluate(
        () => (window as never as Record<string, unknown>).__xss,
      ),
    ).toBeUndefined();
    // Next.js emits its own inline scripts; what matters is that none of them
    // is the injected one, and that no executable node came from the body.
    const scripts = await page.locator("main script").allTextContents();
    expect(scripts.join(" ")).not.toContain("__xss");
    await expect(page.locator("main script[src]")).toHaveCount(0);
    await expect(page.locator('main img[src="x"]')).toHaveCount(0);
    await expect(page.locator('main a[href^="javascript:"]')).toHaveCount(0);
    // The card grid, still invalid, is simply absent rather than crashing.
    await expect(page.locator("main")).toBeVisible();

    // --- Arabic renders the Arabic content, right to left ---
    await page.goto(`/ar/${people.tag}-guide`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // The Arabic page title reaches the breadcrumb and the document title;
    // the body is composed of sections, whose own Arabic content is separate.
    await expect(page.getByText("دليل الدعم QA-P8").first()).toBeVisible();
    // The FAQ section has no Arabic translation yet, so it falls back to
    // English — and says so in the markup rather than passing it off as
    // Arabic (§14).
    await expect(page.locator('[lang="en"]').first()).toBeVisible();

    expect(publicProblems.appErrors()).toEqual([]);
  });

  // ----------------------------------------------------------- ARTICLE -----

  test("ARTICLE: creates a translated article with a featured image, publishes it, and keeps drafts private", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/articles");
    await expect(
      page.getByRole("heading", { name: "Articles", level: 1 }),
    ).toBeVisible();

    const form = page.locator("form").filter({ hasText: "URL slug" }).last();
    await form.locator('input[name="slugEn"]').fill(`${people.tag}-note`);
    await form.locator('input[name="titleEn"]').fill("[QA-P8] Sourcing note");
    await form
      .locator('textarea[name="bodyEn"]')
      .fill("An English body for the Phase 8 acceptance run.");
    await form.locator('input[name="slugAr"]').fill(`${people.tag}-note-ar`);
    await form.locator('input[name="titleAr"]').fill("ملاحظة توريد QA-P8");
    await form
      .locator('textarea[name="bodyAr"]')
      .fill("نص عربي لتشغيل قبول المرحلة الثامنة.");

    // The featured image comes from the shared picker, never a pasted URL.
    await form.getByRole("button", { name: "Choose image" }).click();
    const picker = page.getByRole("dialog");
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: /\[QA-P8\] hero image/ }).click();
    await expect(form.getByText("[QA-P8] hero image")).toBeVisible();

    await form.getByRole("button", { name: "Create article" }).click();
    await expect(form.getByRole("status")).toContainText("Article created", {
      timeout: 30_000,
    });

    // --- a draft is not public ---
    const draftResponse = await page.request.get(
      `/knowledge/${people.tag}-note`,
      { maxRedirects: 0 },
    );
    expect(draftResponse.status()).toBe(404);

    // --- publish, then it is ---
    await page.goto("/admin/articles");
    await page.getByRole("link", { name: "[QA-P8] Sourcing note" }).click();
    await page.waitForURL(/\/admin\/articles\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Article published",
      { timeout: 30_000 },
    );

    await page.goto(`/knowledge/${people.tag}-note`);
    await expect(
      page.getByRole("heading", { name: "[QA-P8] Sourcing note" }),
    ).toBeVisible();
    // The featured image renders, with the alt text the Admin gave it.
    await expect(
      page.getByRole("img", { name: "[QA-P8] hero image" }),
    ).toBeVisible();

    // --- Arabic article, Arabic slug ---
    await page.goto(`/ar/knowledge/${people.tag}-note-ar`);
    await expect(
      page.getByRole("heading", { name: "ملاحظة توريد QA-P8" }),
    ).toBeVisible();

    expect(problems.appErrors()).toEqual([]);
  });

  // ---------------------------------------------- MEDIA REFERENCE WARNING --

  test("MEDIA: archiving an image that content depends on is refused until confirmed", async ({
    page,
  }) => {
    await signInAdmin(page);
    const { data: media } = await service
      .from("media_translations")
      .select("media_id")
      .eq("alt_text", "[QA-P8] hero image")
      .single();
    await page.goto(`/admin/media/${media!.media_id}`);

    // It is now the article's featured image, so the usage list says so.
    await expect(page.getByText("Where this is used")).toBeVisible();
    // Scoped to `main` and exact: the Admin nav also carries "Articles" and
    // "Article categories".
    await expect(
      main(page).getByText("Article", { exact: true }),
    ).toBeVisible();

    // First attempt: refused, with what depends on it named.
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Archiving hides this image")).toBeVisible({
      timeout: 30_000,
    });
    // Still active.
    const { data: before } = await service
      .from("media")
      .select("deleted_at")
      .eq("id", media!.media_id)
      .single();
    expect(before?.deleted_at).toBeNull();

    // Second attempt, explicitly confirming.
    await page.getByRole("button", { name: "Archive anyway" }).click();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const { data: after } = await service
      .from("media")
      .select("deleted_at")
      .eq("id", media!.media_id)
      .single();
    expect(after?.deleted_at).not.toBeNull();

    // The article still renders; its image degrades away rather than breaking.
    const articlePage = await page.request.get(`/knowledge/${people.tag}-note`);
    expect(articlePage.status()).toBe(200);
    await page.goto(`/knowledge/${people.tag}-note`);
    await expect(
      page.getByRole("heading", { name: "[QA-P8] Sourcing note" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "[QA-P8] hero image" }),
    ).toHaveCount(0);

    // Restore it for the logo test.
    await page.goto(`/admin/media/${media!.media_id}`);
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Media restored",
      { timeout: 30_000 },
    );
  });

  // ---------------------------------------------------------------- LOGO ---

  test("LOGO: a chosen media item becomes the mark everywhere, and clearing it restores the official artwork", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto("/admin/settings");

    // Anchored on the submit button: the picker's own control relabels from
    // "Choose image" to "Change image" once something is selected.
    const logoForm = page.locator("form").filter({ hasText: "Save logo" });
    await logoForm.getByRole("button", { name: "Choose image" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /\[QA-P8\] hero image/ })
      .click();
    await logoForm.getByRole("button", { name: "Save logo" }).click();
    await expect(logoForm.getByRole("status")).toContainText(
      "Project logo updated",
      { timeout: 30_000 },
    );

    const { data: settings } = await service
      .from("site_settings")
      .select("org_logo_media_id")
      .limit(1)
      .single();
    expect(settings?.org_logo_media_id).toBeTruthy();

    // The configured logo is drawn in every shell. Asserting the source
    // rather than the alt text: the alt is localized, so `/ar` correctly
    // shows the Arabic one, and matching on it would only prove the label.
    const stored = /\/storage\/v1\/object\/public\/hills-public\/media\//;
    for (const path of ["/", "/ar", "/sign-in"]) {
      await page.goto(path);
      const mark = page.locator("header img").first();
      await expect(mark, `no brand mark on ${path}`).toBeVisible();
      await expect(mark, `static logo still on ${path}`).toHaveAttribute(
        "src",
        stored,
      );
      // Drawn at its own aspect ratio, not stretched to the official one.
      const box = await mark.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(0);
      expect(box?.height ?? 0).toBeGreaterThan(0);
      expect(
        Math.abs(box!.width / box!.height - 24 / 16),
        `wrong aspect ratio on ${path}`,
      ).toBeLessThan(0.2);
    }

    // And in the Admin workspace shell, where the mark sits in the sidebar.
    await page.goto("/admin");
    await expect(page.locator("img").first()).toHaveAttribute("src", stored);

    // The Admin sign-in shell, which only exists for a signed-out visitor:
    // `/dashboard-admin` redirects an Administrator straight to `/admin`.
    await page.context().clearCookies();
    await page.goto("/dashboard-admin");
    await expect(page.locator("header img").first()).toHaveAttribute(
      "src",
      stored,
    );

    // Both themes, since the mark sits on a cream plate in dark mode.
    for (const theme of ["light", "dark"]) {
      await page.goto("/");
      await page.evaluate((value) => {
        document.documentElement.classList.toggle("dark", value === "dark");
      }, theme);
      await expect(
        page.locator("header img").first(),
        `no mark in ${theme}`,
      ).toBeVisible();
    }

    // --- clearing restores the official artwork ---
    await signInAdmin(page);
    await page.goto("/admin/settings");
    await page
      .locator("form")
      .filter({ hasText: "Save logo" })
      .getByRole("button", { name: "Use the official artwork" })
      .click();
    await expect(main(page).getByRole("status")).toContainText(
      "official Hills Coffee artwork",
      { timeout: 30_000 },
    );

    await page.goto("/");
    // The static asset is back — no stale UI after a successful save.
    await expect(
      page.locator('header img[src*="logo-mark.png"]').first(),
    ).toBeVisible();
  });

  // ------------------------------------------------------- AUTHORIZATION ---

  test("a customer cannot reach or write any Phase 8 Admin surface", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.locator('input[name="email"]').fill(people.customer.email);
    await page.locator('input[name="password"]').fill(people.customer.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/account$/, { timeout: 30_000 });

    for (const path of [
      "/admin/media",
      "/admin/content",
      "/admin/articles",
      "/admin/settings",
    ]) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect([302, 307, 308, 404], `${path} was reachable`).toContain(
        response.status(),
      );
    }
  });
});
