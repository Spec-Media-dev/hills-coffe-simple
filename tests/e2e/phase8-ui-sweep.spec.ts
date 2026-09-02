import { expect, test, type Page } from "@playwright/test";
import {
  PNG_24x16,
  createContentPersonas,
  hasAuthFixtureCredentials,
  service,
  type ContentPersonas,
} from "./content-fixtures";
import { collectPageProblems } from "./helpers";
import { auditScreen, visitInTheme } from "./ui-audit";

/**
 * Phase 8 runtime UI acceptance sweep.
 *
 * Every surface is driven through its real Admin form — data is typed in and
 * submitted, not inserted — then reloaded to prove persistence, opened on the
 * public side where one exists, edited again, and given deliberately invalid
 * input to prove the inline validation.
 *
 * Every screen additionally runs `auditScreen`, which fails on a raw
 * translation key, a broken image, text the theme has made unreadable, or a
 * page that scrolls sideways — in English and Arabic, light and dark.
 */
test.describe("Phase 8 runtime UI sweep", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "The sweep drives real Admin writes once, on desktop.",
  );
  test.skip(
    !hasAuthFixtureCredentials,
    "MANUAL QA REQUIRED: staging Auth credentials are unavailable",
  );
  // Serial and order-dependent by design: the MEDIA test uploads the image the
  // CMS, ARTICLES and LOGO tests then choose from the picker, which is how an
  // Administrator would actually work. Run the file, not a filtered subset.
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  let people!: ContentPersonas;
  let tag = "";
  /** Everything created through the UI, removed in afterAll. */
  const created = { pages: [] as string[], articles: [] as string[] };

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    people = await createContentPersonas();
    tag = people.tag;
  });

  test.afterAll(async () => {
    test.setTimeout(180_000);
    for (const id of created.articles)
      await service.from("articles").delete().eq("id", id);
    for (const id of created.pages)
      await service.from("site_pages").delete().eq("id", id);
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

  // ============================================================== MEDIA =====

  test("MEDIA: upload, edit, reload, picker, archive warning — audited in both languages and themes", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/media");

    // --- create through the real form ---
    const form = page.locator("form").filter({ hasText: "Upload an image" });
    await form.locator('input[name="file"]').setInputFiles({
      name: "sweep.png",
      mimeType: "image/png",
      buffer: PNG_24x16,
    });
    await form.locator('input[name="altEn"]').fill("[QA-P8] Sweep media");
    await form.locator('input[name="altAr"]').fill("وسائط الفحص QA-P8");
    await form.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Media uploaded", {
      timeout: 30_000,
    });

    // --- reload proves persistence ---
    await page.reload();
    const card = page.getByRole("link", { name: /\[QA-P8\] Sweep media/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText("24×16");
    // Arabic alt was supplied, so the warning must be absent.
    await expect(card).not.toContainText("No Arabic alt");
    await auditScreen(page, "media library EN light");

    // --- edit, then reload again ---
    await card.click();
    await page.waitForURL(/\/admin\/media\/[0-9a-f-]{36}$/);
    const detailUrl = page.url();
    await page.locator('input[name="altEn"]').fill("[QA-P8] Sweep media v2");
    await page.getByRole("button", { name: "Save alt text" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Alt text saved",
      { timeout: 30_000 },
    );
    await page.reload();
    await expect(page.locator('input[name="altEn"]')).toHaveValue(
      "[QA-P8] Sweep media v2",
    );
    await auditScreen(page, "media detail EN light");

    // --- invalid input: clearing required English alt text ---
    await page.locator('input[name="altEn"]').fill("");
    await page.getByRole("button", { name: "Save alt text" }).click();
    const altError = page.locator("#alt-en-error");
    await expect(altError).toBeVisible({ timeout: 30_000 });
    await expect(altError).toContainText("English alt text is required");
    // The Arabic value the Admin had typed is still there.
    await expect(page.locator('input[name="altAr"]')).toHaveValue(
      "وسائط الفحص QA-P8",
    );
    // No native browser bubble: the form opts out of constraint validation.
    await expect(page.locator("form[novalidate]").first()).toBeAttached();

    // --- every theme and language on both screens ---
    for (const theme of ["light", "dark"] as const)
      for (const prefix of ["", "/ar"]) {
        await visitInTheme(page, `${prefix}/admin/media`, theme);
        await auditScreen(page, `media library ${prefix || "/en"} ${theme}`);
        await visitInTheme(
          page,
          `${prefix}${detailUrl.replace(/^https?:\/\/[^/]+/, "")}`,
          theme,
        );
        await auditScreen(page, `media detail ${prefix || "/en"} ${theme}`);
      }

    // Arabic must actually be Arabic.
    await page.goto("/ar/admin/media");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "مكتبة الوسائط", level: 1 }),
    ).toBeVisible();

    expect(problems.appErrors()).toEqual([]);
  });

  // ================================================================ CMS =====

  test("CMS: build a page with every section type, publish, and render it publicly", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/content");
    await auditScreen(page, "cms list EN light");

    // --- create through the real form ---
    const create = page.locator("form").filter({ hasText: "Page key" }).last();
    await create.locator('input[name="pageKey"]').fill(`${tag}-sweep`);
    await create.locator('input[name="routePath"]').fill(`/${tag}-sweep`);
    await create.locator('select[name="template"]').selectOption("SUPPORT");
    await create.getByRole("button", { name: "Create draft" }).click();
    await expect(create.getByRole("status")).toContainText(
      "Page created as a draft",
      { timeout: 30_000 },
    );

    await page.reload();
    await page.getByRole("link", { name: `${tag}-sweep` }).click();
    await page.waitForURL(/\/admin\/content\/[0-9a-f-]{36}$/);
    const editorUrl = page.url();
    const pageId = editorUrl.split("/").pop()!;
    created.pages.push(pageId);

    // --- both translations, one form each ---
    for (const [locale, title, body] of [
      ["en", "[QA-P8] Sweep page", "English page body for the sweep."],
      ["ar", "صفحة الفحص QA-P8", "نص عربي لصفحة الفحص."],
    ] as const) {
      const form = page
        .locator("form")
        .filter({
          has: page.locator(`input[name="locale"][value="${locale}"]`),
        })
        .first();
      await form.locator('input[name="title"]').fill(title);
      await form.locator('textarea[name="bodyMarkdown"]').fill(body);
      await form.getByRole("button", { name: "Save" }).click();
      await expect(form.getByRole("status")).toBeVisible({ timeout: 30_000 });
      await page.reload();
    }
    await expect(page.getByText("No English content yet")).toHaveCount(0);
    await expect(page.getByText("No Arabic content yet")).toHaveCount(0);

    // --- one section of every approved type, created through the UI ---
    const sections: {
      key: string;
      type: string;
      heading: string;
      body?: string;
      cta?: string;
      ctaHref?: string;
      entity?: string;
      media?: boolean;
    }[] = [
      { key: "sweep_hero", type: "HERO", heading: "Sweep hero heading" },
      {
        key: "sweep_rich_text",
        type: "RICH_TEXT",
        heading: "Sweep rich text",
        body: "A paragraph of ordinary prose for the sweep.",
      },
      {
        key: "sweep_card_grid",
        type: "CARD_GRID",
        heading: "Sweep card grid",
        body: "### First card\nFirst card body.\n### Second card\nSecond card body.",
      },
      {
        key: "sweep_media_split",
        type: "MEDIA_SPLIT",
        heading: "Sweep media split",
        body: "Prose beside the image.",
        media: true,
      },
      {
        key: "sweep_cta",
        type: "CTA",
        heading: "Sweep call to action",
        cta: "Talk to the team",
        ctaHref: "/contact",
      },
      {
        key: "sweep_stat_row",
        type: "STAT_ROW",
        heading: "Sweep figures",
        body: "- 3 — warehouses\n- 12 — origins",
      },
      {
        key: "sweep_faq",
        type: "FAQ",
        heading: "Sweep questions",
        body: "### Is this rendered?\nYes, by its own renderer.\n### And this one?\nAlso yes.",
      },
      {
        key: "sweep_entity_list",
        type: "ENTITY_LIST",
        heading: "Sweep automatic list",
        entity: "WAREHOUSES",
      },
    ];

    for (const [index, section] of sections.entries()) {
      await page.goto(editorUrl);
      const add = page
        .locator("form")
        .filter({ hasText: "Section key" })
        .last();
      await add.locator('input[name="sectionKey"]').fill(section.key);
      await add
        .locator('select[name="sectionType"]')
        .selectOption(section.type);
      await add.locator('input[name="sortOrder"]').fill(String(index));
      // Created hidden: content comes next, and a visible section must be
      // renderable before it is shown.
      await add.locator('select[name="isVisible"]').selectOption("false");
      if (section.ctaHref)
        await add.locator('input[name="ctaHref"]').fill(section.ctaHref);
      if (section.entity)
        await add
          .locator('select[name="entityRef"]')
          .selectOption(section.entity);
      if (section.media) {
        await add.getByRole("button", { name: "Choose image" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await auditScreen(page, "media picker dialog");
        await dialog
          .getByRole("button", { name: /\[QA-P8\] Sweep media/ })
          .click();
      }
      await add.getByRole("button", { name: "Save" }).click();
      await expect(
        add.getByRole("status"),
        `creating ${section.type}`,
      ).toContainText("Section saved", { timeout: 30_000 });

      // --- its content, then make it visible ---
      await page.goto(editorUrl);
      const card = page.locator("article").filter({ hasText: section.key });
      const english = card
        .locator("form")
        .filter({ has: page.locator('input[name="locale"][value="en"]') })
        .first();
      await english.locator('input[name="heading"]').fill(section.heading);
      if (section.body)
        await english
          .locator('textarea[name="bodyMarkdown"]')
          .fill(section.body);
      if (section.cta)
        await english.locator('input[name="ctaLabel"]').fill(section.cta);
      await english.getByRole("button", { name: "Save" }).click();
      await expect(
        english.getByRole("status"),
        `content for ${section.type}`,
      ).toContainText("English content saved", { timeout: 30_000 });

      await page.goto(editorUrl);
      const settings = page
        .locator("article")
        .filter({ hasText: section.key })
        .locator("form")
        .filter({ hasText: "Section key" })
        .first();
      await settings.locator('select[name="isVisible"]').selectOption("true");
      await settings.getByRole("button", { name: "Save" }).click();
      await expect(
        settings.getByRole("status"),
        `showing ${section.type}`,
      ).toContainText("Section saved", { timeout: 30_000 });
    }

    await page.goto(editorUrl);
    await auditScreen(page, "cms editor EN light");

    // --- publish ---
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Page published",
      {
        timeout: 30_000,
      },
    );

    // --- the public page renders every type, each distinctly ---
    const publicProblems = collectPageProblems(page);
    await page.goto(`/${tag}-sweep`);
    for (const section of sections)
      await expect(
        page.getByRole("heading", { name: section.heading }),
        `${section.type} did not render`,
      ).toBeVisible();

    // Type-specific structure, not just the shared heading.
    // CARD_GRID renders each card title as its own heading.
    await expect(
      page.getByRole("heading", { name: "First card", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Second card", exact: true }),
    ).toBeVisible();
    // STAT_ROW renders a description list, with the label as the term.
    await expect(page.locator("main dl dt")).toHaveCount(2);
    await expect(page.getByText("warehouses")).toBeVisible();
    // FAQ renders a disclosure per question.
    await expect(page.locator("main details")).toHaveCount(2);
    await expect(
      page.getByText("Is this rendered?", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Talk to the team" }),
    ).toBeVisible();
    await expect(page.locator("main img").first()).toBeVisible();
    await auditScreen(page, "public cms page EN light");

    for (const theme of ["light", "dark"] as const)
      for (const prefix of ["", "/ar"]) {
        await visitInTheme(page, `${prefix}/${tag}-sweep`, theme);
        await auditScreen(page, `public cms ${prefix || "/en"} ${theme}`);
      }
    expect(publicProblems.appErrors()).toEqual([]);

    // --- edit again, and the change reaches the public page ---
    await page.goto(editorUrl);
    const heroEnglish = page
      .locator("article")
      .filter({ hasText: "sweep_hero" })
      .locator("form")
      .filter({ has: page.locator('input[name="locale"][value="en"]') })
      .first();
    await heroEnglish
      .locator('input[name="heading"]')
      .fill("Sweep hero heading v2");
    await heroEnglish.getByRole("button", { name: "Save" }).click();
    await expect(heroEnglish.getByRole("status")).toContainText(
      "English content saved",
      { timeout: 30_000 },
    );
    await page.goto(`/${tag}-sweep`);
    await expect(
      page.getByRole("heading", { name: "Sweep hero heading v2" }),
    ).toBeVisible();

    // --- the Admin editor in Arabic and dark ---
    for (const theme of ["light", "dark"] as const)
      for (const prefix of ["", "/ar"]) {
        await visitInTheme(
          page,
          `${prefix}${editorUrl.replace(/^https?:\/\/[^/]+/, "")}`,
          theme,
        );
        await auditScreen(page, `cms editor ${prefix || "/en"} ${theme}`);
      }
    await page.goto(`/ar/admin/content`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "الصفحات", level: 1 }),
    ).toBeVisible();

    expect(problems.appErrors()).toEqual([]);
  });

  // =========================================================== ARTICLES =====

  test("ARTICLES: create, validate, publish, edit, and render publicly", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/articles");
    await auditScreen(page, "articles list EN light");

    const form = page.locator("form").filter({ hasText: "URL slug" }).last();

    // --- invalid first: every required field reports under itself ---
    await form.getByRole("button", { name: "Create article" }).click();
    for (const field of ["slugEn", "titleEn", "slugAr", "titleAr"]) {
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
    // An invalid slug is named as such, not merely "required".
    await form.locator('input[name="slugEn"]').fill("Not A Valid Slug");
    await form.locator('input[name="titleEn"]').fill("[QA-P8] Sweep article");
    await form.getByRole("button", { name: "Create article" }).click();
    await expect(form.locator('input[name="slugEn"]')).toHaveAttribute(
      "aria-invalid",
      "true",
      { timeout: 30_000 },
    );
    // The valid values the Admin typed survive the rejection.
    await expect(form.locator('input[name="titleEn"]')).toHaveValue(
      "[QA-P8] Sweep article",
    );

    // --- now a valid article, with a category and a featured image ---
    await form.locator('input[name="slugEn"]').fill(`${tag}-sweep-article`);
    await form
      .locator('textarea[name="excerptEn"]')
      .fill("An English excerpt for the sweep.");
    await form
      .locator('textarea[name="bodyEn"]')
      .fill("English body for the sweep article.");
    await form.locator('input[name="slugAr"]').fill(`${tag}-sweep-article-ar`);
    await form.locator('input[name="titleAr"]').fill("مقال الفحص QA-P8");
    await form
      .locator('textarea[name="excerptAr"]')
      .fill("مقتطف عربي لمقال الفحص.");
    await form.locator('textarea[name="bodyAr"]').fill("نص عربي لمقال الفحص.");

    // A real category, chosen from the real select.
    const categorySelect = form.locator('select[name="categoryId"]');
    const categoryValues = await categorySelect
      .locator("option")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean),
      );
    expect(
      categoryValues.length,
      "no article categories to choose",
    ).toBeGreaterThan(0);
    await categorySelect.selectOption(categoryValues[0]);

    // "Show as featured" must read Yes/No, never a raw key or a status word.
    const featured = form.locator('select[name="isFeatured"]');
    const featuredLabels = await featured.locator("option").allTextContents();
    expect(featuredLabels.join("|")).not.toContain("admin.articles");
    expect(featuredLabels).toContain("Yes");
    expect(featuredLabels).toContain("No");
    await featured.selectOption("true");

    await form.getByRole("button", { name: "Choose image" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /\[QA-P8\] Sweep media/ }).click();

    await form.getByRole("button", { name: "Create article" }).click();
    await expect(form.getByRole("status")).toContainText("Article created", {
      timeout: 30_000,
    });

    const { data: article } = await service
      .from("article_translations")
      .select("article_id")
      .eq("slug", `${tag}-sweep-article`)
      .single();
    created.articles.push(String(article!.article_id));

    // --- reload proves persistence, and the draft is not public ---
    await page.reload();
    await expect(
      page.getByRole("link", { name: "[QA-P8] Sweep article" }),
    ).toBeVisible();
    const draft = await page.request.get(`/knowledge/${tag}-sweep-article`, {
      maxRedirects: 0,
    });
    expect(draft.status()).toBe(404);

    // --- open the editor, confirm every value round-tripped ---
    await page.getByRole("link", { name: "[QA-P8] Sweep article" }).click();
    await page.waitForURL(/\/admin\/articles\/[0-9a-f-]{36}$/);
    const articleUrl = page.url();
    await expect(page.locator('input[name="titleAr"]')).toHaveValue(
      "مقال الفحص QA-P8",
    );
    await expect(page.locator('select[name="isFeatured"]')).toHaveValue("true");
    await expect(page.locator('select[name="categoryId"]')).toHaveValue(
      categoryValues[0],
    );
    await expect(page.getByText("[QA-P8] Sweep media")).toBeVisible();
    await auditScreen(page, "article editor EN light");

    // --- publish, then it is public in both languages ---
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Article published",
      { timeout: 30_000 },
    );
    await page.goto(`/knowledge/${tag}-sweep-article`);
    await expect(
      page.getByRole("heading", { name: "[QA-P8] Sweep article" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /\[QA-P8\] Sweep media/ }),
    ).toBeVisible();
    await auditScreen(page, "public article EN light");

    await page.goto(`/ar/knowledge/${tag}-sweep-article-ar`);
    await expect(
      page.getByRole("heading", { name: "مقال الفحص QA-P8" }),
    ).toBeVisible();
    await auditScreen(page, "public article AR light");

    // --- edit again ---
    await page.goto(articleUrl);
    await page
      .locator('input[name="titleEn"]')
      .fill("[QA-P8] Sweep article v2");
    await page.getByRole("button", { name: "Save article" }).click();
    await expect(main(page).getByRole("status")).toContainText(
      "Article updated",
      { timeout: 30_000 },
    );
    await page.goto(`/knowledge/${tag}-sweep-article`);
    await expect(
      page.getByRole("heading", { name: "[QA-P8] Sweep article v2" }),
    ).toBeVisible();

    // --- an unavailable featured image degrades, it does not break ---
    const { data: media } = await service
      .from("media_translations")
      .select("media_id")
      .eq("alt_text", "[QA-P8] Sweep media v2")
      .maybeSingle();
    if (media) {
      await service
        .from("media")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", media.media_id);
      await page.goto(`/knowledge/${tag}-sweep-article`);
      await expect(
        page.getByRole("heading", { name: "[QA-P8] Sweep article v2" }),
      ).toBeVisible();
      await auditScreen(page, "public article with archived image");
      await service
        .from("media")
        .update({ deleted_at: null })
        .eq("id", media.media_id);
    }

    // --- themes and languages on every article screen ---
    for (const theme of ["light", "dark"] as const)
      for (const prefix of ["", "/ar"]) {
        await visitInTheme(page, `${prefix}/admin/articles`, theme);
        await auditScreen(page, `articles list ${prefix || "/en"} ${theme}`);
        await visitInTheme(
          page,
          `${prefix}${articleUrl.replace(/^https?:\/\/[^/]+/, "")}`,
          theme,
        );
        await auditScreen(page, `article editor ${prefix || "/en"} ${theme}`);
      }
    await page.goto("/ar/admin/articles");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "المقالات", level: 1 }),
    ).toBeVisible();

    expect(problems.appErrors()).toEqual([]);
  });

  // ======================================================= ORIGIN MEDIA =====

  test("ORIGIN MEDIA: the closed N61 workspace audits clean in both languages and themes", async ({
    page,
  }) => {
    // N61's behaviour is proven in `origin-media.spec.ts`; this checks only the
    // screen-level qualities the sweep applies everywhere.
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    const { data: origin } = await service
      .from("origins")
      .select("id")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    test.skip(!origin, "no origin exists to audit");

    for (const theme of ["light", "dark"] as const)
      for (const prefix of ["", "/ar"]) {
        await visitInTheme(
          page,
          `${prefix}/admin/origins/${origin!.id}`,
          theme,
        );
        await expect(
          page
            .locator("section")
            .filter({ hasText: /Origin images|صور المنشأ/ }),
        ).toBeVisible();
        await auditScreen(page, `origin media ${prefix || "/en"} ${theme}`);
      }
    expect(problems.appErrors()).toEqual([]);
  });

  // =============================================================== LOGO =====

  test("LOGO: choose, persist across reload, appear in every shell, then reset", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto("/admin/settings");
    await auditScreen(page, "settings EN light");

    const logoForm = page.locator("form").filter({ hasText: "Save logo" });
    await logoForm.getByRole("button", { name: "Choose image" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /\[QA-P8\] Sweep media/ })
      .click();
    await logoForm.getByRole("button", { name: "Save logo" }).click();
    await expect(logoForm.getByRole("status")).toContainText(
      "Project logo updated",
      { timeout: 30_000 },
    );

    // Reload proves it stuck, and the preview shows the chosen image.
    await page.reload();
    const stored = /\/storage\/v1\/object\/public\/hills-public\/media\//;
    await expect(
      page
        .locator("form")
        .filter({ hasText: "Save logo" })
        .locator("img")
        .first(),
    ).toHaveAttribute("src", stored);

    // Public, auth and admin shells, both themes.
    for (const theme of ["light", "dark"] as const) {
      for (const path of ["/", "/ar", "/sign-in"]) {
        await visitInTheme(page, path, theme);
        const mark = page.locator("header img").first();
        await expect(mark, `no mark on ${path} ${theme}`).toBeVisible();
        await expect(mark).toHaveAttribute("src", stored);
      }
      await visitInTheme(page, "/admin", theme);
      await expect(page.locator("img").first()).toHaveAttribute("src", stored);
      await auditScreen(page, `admin shell ${theme}`);
    }

    // The signed-out Admin entry shell.
    await page.context().clearCookies();
    await page.goto("/dashboard-admin");
    await expect(page.locator("header img").first()).toHaveAttribute(
      "src",
      stored,
    );
    await auditScreen(page, "admin sign-in shell");

    // --- reset restores the official artwork ---
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
    await expect(
      page.locator('header img[src*="logo-mark.png"]').first(),
    ).toBeVisible();

    expect(problems.appErrors()).toEqual([]);
  });

  // ================================================ LANGUAGE PERSISTENCE ====

  test("switching language keeps saved content and never falls back silently to English", async ({
    page,
  }) => {
    await signInAdmin(page);
    const { data: cmsPage } = await service
      .from("site_pages")
      .select("id")
      .eq("page_key", `${tag}-sweep`)
      .maybeSingle();
    test.skip(!cmsPage, "the CMS sweep page was not created");

    await page.goto(`/admin/content/${cmsPage!.id}`);
    await expect(page.locator('input[name="title"]').first()).toHaveValue(
      "[QA-P8] Sweep page",
    );

    await page.goto(`/ar/admin/content/${cmsPage!.id}`);
    // Both translations survive the language change.
    await expect(page.locator('input[name="title"]').first()).toHaveValue(
      "[QA-P8] Sweep page",
    );
    await expect(page.locator('input[name="title"]').nth(1)).toHaveValue(
      "صفحة الفحص QA-P8",
    );

    // The Arabic public page shows Arabic page content, and any section still
    // lacking an Arabic translation is marked as English in the markup rather
    // than presented as Arabic.
    await page.goto(`/ar/${tag}-sweep`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('[lang="en"]').first()).toBeVisible();
  });
});
