import { expect, test, type Page } from "@playwright/test";
import {
  PNG_24x16,
  createContentPersonas,
  hasAuthFixtureCredentials,
  service,
  type ContentPersonas,
} from "./content-fixtures";
import { collectPageProblems } from "./helpers";

/**
 * N61 — the Admin origin-image workflow, driven through the real Admin.
 *
 * The database guarantees (one hero, role check, composite key, RESTRICT) are
 * proven in `tests/integration/origin-media.test.ts`. This suite proves the
 * part only a browser can: that an Administrator can actually assign a hero,
 * replace it, build a gallery, reorder it and remove an image — using the same
 * media picker the rest of Phase 8 uses, with no upload code of its own.
 */
test.describe("N61 Admin origin media", () => {
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
  let originId = "";
  const mediaIds: string[] = [];
  const tag = `qa-n61-e2e-${Date.now().toString(36)}`;

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    people = await createContentPersonas();

    const origin = await service
      .from("origins")
      .insert({ slug: tag, is_active: true })
      .select("id")
      .single();
    if (origin.error) throw new Error(`origin: ${origin.error.message}`);
    originId = String(origin.data.id);

    // Three library images, created through the same pipeline shape the
    // Admin upload uses (bucket, dimensions, alt text).
    for (const label of ["one", "two", "three"]) {
      const path = `media/${tag}-${label}.png`;
      const upload = await service.storage
        .from("hills-public")
        .upload(path, PNG_24x16, { contentType: "image/png", upsert: true });
      if (upload.error) throw new Error(`upload: ${upload.error.message}`);
      const media = await service
        .from("media")
        .insert({
          storage_bucket: "hills-public",
          storage_path: path,
          mime_type: "image/png",
          width: 24,
          height: 16,
          file_size_bytes: PNG_24x16.length,
          is_public: true,
        })
        .select("id")
        .single();
      if (media.error) throw new Error(`media: ${media.error.message}`);
      const id = String(media.data.id);
      mediaIds.push(id);
      await service.from("media_translations").insert([
        { media_id: id, locale: "en", alt_text: `[QA-N61] ${label}` },
        { media_id: id, locale: "ar", alt_text: `[QA-N61] ${label} عربي` },
      ]);
    }
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    // Links first: media_id is ON DELETE RESTRICT.
    await service.from("origin_media").delete().eq("origin_id", originId);
    for (const id of mediaIds) {
      const { data } = await service
        .from("media")
        .select("storage_bucket,storage_path")
        .eq("id", id)
        .maybeSingle();
      await service.from("media").delete().eq("id", id);
      if (data)
        await service.storage
          .from(String(data.storage_bucket))
          .remove([String(data.storage_path)]);
    }
    await service.from("origins").delete().eq("id", originId);
    await people?.cleanup();
  });

  async function signInAdmin(page: Page) {
    await page.goto("/dashboard-admin");
    await page.locator('input[name="email"]').fill(people.admin.email);
    await page.locator('input[name="password"]').fill(people.admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  }

  /** Opens the picker and chooses the image whose English alt text matches. */
  async function choose(page: Page, label: string) {
    const section = page
      .locator("section")
      .filter({ hasText: "Origin images" });
    await section
      .getByRole("button", { name: /Choose image|Change image/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: new RegExp(label) }).click();
    await expect(dialog).toHaveCount(0);
  }

  const roleOf = async (mediaId: string) =>
    (
      await service
        .from("origin_media")
        .select("role,sort_order")
        .eq("origin_id", originId)
        .eq("media_id", mediaId)
        .maybeSingle()
    ).data;

  test("an origin with no images says so, then takes a hero", async ({
    page,
  }) => {
    const problems = collectPageProblems(page);
    await signInAdmin(page);
    await page.goto(`/admin/origins/${originId}`);

    const section = page
      .locator("section")
      .filter({ hasText: "Origin images" });
    await expect(section).toBeVisible();
    await expect(section.getByText("no images yet")).toBeVisible();
    await expect(section.getByText("No hero image yet.")).toBeVisible();
    await expect(section.getByText("No gallery images yet.")).toBeVisible();

    await choose(page, "\\[QA-N61\\] one");
    await section.getByRole("button", { name: "Set as hero image" }).click();
    await expect(page.getByText("Hero image set.")).toBeVisible({
      timeout: 30_000,
    });

    expect((await roleOf(mediaIds[0]))?.role).toBe("HERO");
    expect(problems.appErrors()).toEqual([]);
  });

  test("replacing the hero demotes the previous one rather than failing", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto(`/admin/origins/${originId}`);
    const section = page
      .locator("section")
      .filter({ hasText: "Origin images" });

    await choose(page, "\\[QA-N61\\] two");
    await section.getByRole("button", { name: "Set as hero image" }).click();
    await expect(page.getByText("Hero image set.")).toBeVisible({
      timeout: 30_000,
    });

    // Exactly one hero, and it is the new one; the old is now gallery.
    expect((await roleOf(mediaIds[1]))?.role).toBe("HERO");
    expect((await roleOf(mediaIds[0]))?.role).toBe("GALLERY");
    const { data: heroes } = await service
      .from("origin_media")
      .select("media_id")
      .eq("origin_id", originId)
      .eq("role", "HERO");
    expect(heroes ?? []).toHaveLength(1);
  });

  test("builds a gallery, promotes from it, and reorders it", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto(`/admin/origins/${originId}`);
    const section = page
      .locator("section")
      .filter({ hasText: "Origin images" });

    await choose(page, "\\[QA-N61\\] three");
    await section.getByRole("button", { name: "Add to gallery" }).click();
    await expect(page.getByText("Images added.")).toBeVisible({
      timeout: 30_000,
    });

    // Two gallery items now: "one" (demoted) and "three".
    await page.reload();
    const items = section.getByRole("listitem");
    await expect(items).toHaveCount(2);

    // Reorder, then save.
    await items.first().getByRole("button", { name: "Move later" }).click();
    await section.getByRole("button", { name: "Save gallery order" }).click();
    await expect(page.getByText("Gallery order saved.")).toBeVisible({
      timeout: 30_000,
    });

    const { data: gallery } = await service
      .from("origin_media")
      .select("media_id,sort_order")
      .eq("origin_id", originId)
      .eq("role", "GALLERY")
      .order("sort_order");
    expect(gallery ?? []).toHaveLength(2);
    expect(gallery![0].sort_order).toBeLessThan(gallery![1].sort_order);

    // Promote a gallery item; the database still permits only one hero.
    await page.reload();
    await section.getByRole("button", { name: "Make hero" }).first().click();
    await expect(page.getByText("Hero image set.")).toBeVisible({
      timeout: 30_000,
    });
    const { data: heroes } = await service
      .from("origin_media")
      .select("media_id")
      .eq("origin_id", originId)
      .eq("role", "HERO");
    expect(heroes ?? []).toHaveLength(1);
  });

  test("removing an image unlinks it and leaves the library row alone", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto(`/admin/origins/${originId}`);
    const section = page
      .locator("section")
      .filter({ hasText: "Origin images" });

    const before =
      (
        await service
          .from("origin_media")
          .select("media_id")
          .eq("origin_id", originId)
      ).data ?? [];

    await section.getByRole("button", { name: "Remove" }).first().click();
    await expect(page.getByText("Image removed.")).toBeVisible({
      timeout: 30_000,
    });

    const after =
      (
        await service
          .from("origin_media")
          .select("media_id")
          .eq("origin_id", originId)
      ).data ?? [];
    expect(after.length).toBe(before.length - 1);

    // Every library row survives: these are shared images, not the origin's.
    for (const id of mediaIds) {
      const { data } = await service
        .from("media")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      expect(data, `media ${id} was deleted`).not.toBeNull();
    }
  });

  test("the media library warns before archiving an image an origin uses", async ({
    page,
  }) => {
    await signInAdmin(page);
    const linked =
      (
        await service
          .from("origin_media")
          .select("media_id")
          .eq("origin_id", originId)
      ).data ?? [];
    expect(linked.length).toBeGreaterThan(0);

    await page.goto(`/admin/media/${linked[0].media_id}`);
    // The Phase 8 reference check now covers origins too.
    await expect(page.locator("main").getByText("Origin")).toBeVisible();

    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Archiving hides this image")).toBeVisible({
      timeout: 30_000,
    });
    // Refused until confirmed: still active.
    const { data } = await service
      .from("media")
      .select("deleted_at")
      .eq("id", linked[0].media_id)
      .single();
    expect(data?.deleted_at).toBeNull();
  });

  test("the workspace is localized and renders right-to-left in Arabic", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto(`/ar/admin/origins/${originId}`);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const section = page.locator("section").filter({ hasText: "صور المنشأ" });
    await expect(section).toBeVisible();
    await expect(
      section.getByRole("button", { name: "تعيين كصورة رئيسية" }),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "إضافة إلى المعرض" }),
    ).toBeVisible();
    // No raw English leaking into the Arabic workspace.
    await expect(section.getByText("Hero image")).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test("a customer cannot reach the origin editor", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator('input[name="email"]').fill(people.customer.email);
    await page.locator('input[name="password"]').fill(people.customer.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/account$/, { timeout: 30_000 });

    const response = await page.request.get(`/admin/origins/${originId}`, {
      maxRedirects: 0,
    });
    expect([302, 307, 308, 404]).toContain(response.status());
  });
});
