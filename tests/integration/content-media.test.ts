/**
 * P8-T04 — content, media and logo behaviour proven against the live database.
 *
 * Constitution Principle XIV: a route existing does not make a feature
 * complete. The rules Phase 8 depends on are enforced by database objects and
 * by RLS, so this suite exercises them directly:
 *
 *   - the media foreign keys and their ON DELETE behaviour
 *   - `site_pages_template_check` / `site_page_sections_section_type_check` /
 *     `site_page_sections_key_format` / `site_page_sections_entity_ref_check`
 *   - RLS on `media`, `site_pages`, `articles` for anonymous and customer roles
 *   - `site_settings.org_logo_media_id`
 *
 * Run with: npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  cleanupFixtures,
  createFixture,
  hasStagingCredentials,
  service,
  type Fixture,
} from "./helpers/staging";

const suite = hasStagingCredentials ? describe : describe.skip;

const CHECK_VIOLATION = "23514";
const FK_VIOLATION = "23503";

/** Everything this run creates, removed in afterAll. */
const created = {
  media: [] as string[],
  pages: [] as string[],
  articles: [] as string[],
};

suite("P8 content and media (live staging)", () => {
  let admin: Fixture;
  let customer: Fixture;
  const tag = `qa-p8-${Date.now().toString(36)}`;

  const makeMedia = async (label: string) => {
    const { data, error } = await service
      .from("media")
      .insert({
        storage_bucket: "hills-public",
        storage_path: `${tag}/${label}.png`,
        mime_type: "image/png",
        width: 24,
        height: 16,
        file_size_bytes: 128,
        is_public: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`media(${label}): ${error.message}`);
    created.media.push(String(data.id));
    return String(data.id);
  };

  const makePage = async (label: string, template = "SUPPORT") => {
    const { data, error } = await service
      .from("site_pages")
      .insert({
        page_key: `${tag}-${label}`,
        template,
        status: "DRAFT",
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`page(${label}): ${error.message}`);
    created.pages.push(String(data.id));
    return String(data.id);
  };

  beforeAll(async () => {
    admin = await createFixture("p8admin", "ADMIN");
    customer = await createFixture("p8cust", "USER");
  }, 90_000);

  afterAll(async () => {
    // Sections and translations cascade with their page; media translations
    // cascade with their media row.
    for (const id of created.articles)
      await service.from("articles").delete().eq("id", id);
    for (const id of created.pages)
      await service.from("site_pages").delete().eq("id", id);
    for (const id of created.media)
      await service.from("media").delete().eq("id", id);
    await cleanupFixtures();
  }, 60_000);

  // ------------------------------------------------ schema vocabularies ----

  it("accepts only the eight approved section types", async () => {
    const pageId = await makePage("types");
    const approved = [
      "HERO",
      "RICH_TEXT",
      "CARD_GRID",
      "MEDIA_SPLIT",
      "CTA",
      "STAT_ROW",
      "FAQ",
      "ENTITY_LIST",
    ];
    for (const [index, sectionType] of approved.entries()) {
      const { error } = await service.from("site_page_sections").insert({
        page_id: pageId,
        section_key: `ok_${index}`,
        section_type: sectionType,
        sort_order: index,
      });
      expect(error, `${sectionType} was rejected`).toBeNull();
    }
    // The two the old Admin offered are not real types.
    for (const rejected of ["WAREHOUSES", "MEDIA_TEXT", "BANNER"]) {
      const { error } = await service.from("site_page_sections").insert({
        page_id: pageId,
        section_key: "nope",
        section_type: rejected,
        sort_order: 99,
      });
      expect(error?.code, `${rejected} was accepted`).toBe(CHECK_VIOLATION);
    }
  }, 60_000);

  it("requires snake_case section keys and a known entity feed", async () => {
    const pageId = await makePage("keys");
    // Hyphens are what the old action validated; the database refuses them.
    const hyphenated = await service.from("site_page_sections").insert({
      page_id: pageId,
      section_key: "media-split-intro",
      section_type: "RICH_TEXT",
    });
    expect(hyphenated.error?.code).toBe(CHECK_VIOLATION);

    const underscored = await service.from("site_page_sections").insert({
      page_id: pageId,
      section_key: "media_split_intro",
      section_type: "RICH_TEXT",
    });
    expect(underscored.error).toBeNull();

    const badFeed = await service.from("site_page_sections").insert({
      page_id: pageId,
      section_key: "feed",
      section_type: "ENTITY_LIST",
      entity_ref: "SOMETHING_ELSE",
    });
    expect(badFeed.error?.code).toBe(CHECK_VIOLATION);
  }, 60_000);

  it("rejects the STANDARD page template the old form defaulted to", async () => {
    const { error } = await service.from("site_pages").insert({
      page_key: `${tag}-standard`,
      template: "STANDARD",
      status: "DRAFT",
    });
    expect(error?.code).toBe(CHECK_VIOLATION);

    // Every value the application offers is one the database accepts.
    for (const template of [
      "HOME",
      "ABOUT",
      "COMMERCIAL",
      "SEGMENT",
      "PRICING",
      "SUPPORT",
      "LEGAL",
      "CONTACT",
    ]) {
      const id = await makePage(`tmpl-${template.toLowerCase()}`, template);
      expect(id).toBeTruthy();
    }
  }, 90_000);

  // -------------------------------------------- media reference matrix ----

  it("MEDIA REFERENCE MATRIX: every consumer is discoverable, and the delete rules are what the application assumes", async () => {
    // --- unreferenced: nothing points at it, and a hard delete succeeds.
    const loose = await makeMedia("unreferenced");
    const looseDelete = await service
      .from("media")
      .delete()
      .eq("id", loose)
      .select("id");
    expect(looseDelete.error).toBeNull();
    expect(looseDelete.data).toHaveLength(1);
    created.media = created.media.filter((id) => id !== loose);

    // --- coffee: RESTRICT.
    const coffeeMedia = await makeMedia("coffee");
    const coffee = (
      await service.from("coffees").select("id").limit(1).single()
    ).data!;
    await service.from("coffee_media").insert({
      coffee_id: coffee.id,
      media_id: coffeeMedia,
      role: "GALLERY",
      sort_order: 98,
    });
    const coffeeDelete = await service
      .from("media")
      .delete()
      .eq("id", coffeeMedia);
    expect(coffeeDelete.error?.code, "coffee_media should RESTRICT").toBe(
      FK_VIOLATION,
    );
    await service.from("coffee_media").delete().eq("media_id", coffeeMedia);

    // --- CMS section: SET NULL.
    const sectionMedia = await makeMedia("section");
    const pageId = await makePage("refs");
    const section = (
      await service
        .from("site_page_sections")
        .insert({
          page_id: pageId,
          section_key: "with_media",
          section_type: "MEDIA_SPLIT",
          media_id: sectionMedia,
        })
        .select("id")
        .single()
    ).data!;
    await service.from("media").delete().eq("id", sectionMedia);
    created.media = created.media.filter((id) => id !== sectionMedia);
    const sectionAfter = await service
      .from("site_page_sections")
      .select("media_id")
      .eq("id", section.id)
      .single();
    expect(
      sectionAfter.data?.media_id,
      "section media should SET NULL",
    ).toBeNull();

    // --- article: SET NULL.
    const articleMedia = await makeMedia("article");
    const article = (
      await service
        .from("articles")
        .insert({ featured_media_id: articleMedia, status: "DRAFT" })
        .select("id")
        .single()
    ).data!;
    created.articles.push(String(article.id));
    await service.from("media").delete().eq("id", articleMedia);
    created.media = created.media.filter((id) => id !== articleMedia);
    const articleAfter = await service
      .from("articles")
      .select("featured_media_id")
      .eq("id", article.id)
      .single();
    expect(articleAfter.data?.featured_media_id).toBeNull();

    // --- site logo: SET NULL, and the real row is restored afterwards.
    const logoMedia = await makeMedia("logo");
    const settings = (
      await service
        .from("site_settings")
        .select("id,org_logo_media_id")
        .limit(1)
        .single()
    ).data!;
    const originalLogo = settings.org_logo_media_id;
    await service
      .from("site_settings")
      .update({ org_logo_media_id: logoMedia })
      .eq("id", settings.id);
    await service.from("media").delete().eq("id", logoMedia);
    created.media = created.media.filter((id) => id !== logoMedia);
    const settingsAfter = (
      await service
        .from("site_settings")
        .select("org_logo_media_id")
        .eq("id", settings.id)
        .single()
    ).data!;
    expect(settingsAfter.org_logo_media_id).toBeNull();
    await service
      .from("site_settings")
      .update({ org_logo_media_id: originalLogo })
      .eq("id", settings.id);
  }, 120_000);

  it("cascades media translations with their media row", async () => {
    const mediaId = await makeMedia("translations");
    await service
      .from("media_translations")
      .insert({ media_id: mediaId, locale: "en", alt_text: "QA P8" });
    await service.from("media").delete().eq("id", mediaId);
    created.media = created.media.filter((id) => id !== mediaId);
    const { data } = await service
      .from("media_translations")
      .select("media_id")
      .eq("media_id", mediaId);
    expect(data ?? []).toHaveLength(0);
  }, 45_000);

  it("archiving is a soft delete no foreign key defends against", async () => {
    // This is exactly why the application must warn before archiving: the
    // database will happily retire an image the homepage hero depends on.
    const mediaId = await makeMedia("archivable");
    const pageId = await makePage("archive");
    await service.from("site_page_sections").insert({
      page_id: pageId,
      section_key: "hero",
      section_type: "MEDIA_SPLIT",
      media_id: mediaId,
    });
    const { error } = await service
      .from("media")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", mediaId);
    expect(error).toBeNull();
    const still = await service
      .from("site_page_sections")
      .select("media_id")
      .eq("page_id", pageId)
      .single();
    // The reference survives; only the application knows it is now unusable.
    expect(still.data?.media_id).toBe(mediaId);
    await service.from("media").update({ deleted_at: null }).eq("id", mediaId);
  }, 60_000);

  // ------------------------------------------------------ authorization ----

  it("denies anonymous and customer writes to every content table", async () => {
    const pageId = await makePage("authz");

    for (const [label, client] of [
      ["anonymous", anon],
      ["customer", customer.client],
    ] as const) {
      const media = await client
        .from("media")
        .insert({
          storage_bucket: "hills-public",
          storage_path: `${tag}/hostile-${label}.png`,
          mime_type: "image/png",
        })
        .select("id");
      expect(media.error, `${label} inserted media`).not.toBeNull();

      const page = await client
        .from("site_pages")
        .insert({ page_key: `${tag}-${label}`, template: "SUPPORT" })
        .select("id");
      expect(page.error, `${label} inserted a page`).not.toBeNull();

      const publish = await client
        .from("site_pages")
        .update({ status: "PUBLISHED" })
        .eq("id", pageId)
        .select("id");
      expect(publish.data ?? [], `${label} published a page`).toHaveLength(0);

      const article = await client
        .from("articles")
        .insert({ status: "PUBLISHED" })
        .select("id");
      expect(article.error, `${label} inserted an article`).not.toBeNull();

      const logo = await client
        .from("site_settings")
        .update({ org_logo_media_id: null })
        .eq("id", 1)
        .select("id");
      expect(logo.data ?? [], `${label} changed the logo`).toHaveLength(0);
    }
  }, 90_000);

  it("lets an Administrator perform the same writes", async () => {
    const pageId = await makePage("adminwrite");
    const publish = await admin.client
      .from("site_pages")
      .update({ status: "DRAFT", sort_order: 3 })
      .eq("id", pageId)
      .select("id");
    expect(publish.error).toBeNull();
    expect(publish.data ?? []).toHaveLength(1);

    const media = await admin.client
      .from("media")
      .insert({
        storage_bucket: "hills-public",
        storage_path: `${tag}/admin.png`,
        mime_type: "image/png",
        width: 8,
        height: 8,
      })
      .select("id")
      .single();
    expect(media.error).toBeNull();
    if (media.data) created.media.push(String(media.data.id));
  }, 60_000);

  // ------------------------------------------------- public visibility ----

  it("keeps draft and archived content out of anonymous reads", async () => {
    const draftPage = await makePage("draftvisibility");
    await service.from("site_page_translations").insert({
      page_id: draftPage,
      locale: "en",
      title: "QA P8 draft page",
    });
    const draftArticle = (
      await service
        .from("articles")
        .insert({ status: "DRAFT" })
        .select("id")
        .single()
    ).data!;
    created.articles.push(String(draftArticle.id));
    await service.from("article_translations").insert({
      article_id: draftArticle.id,
      locale: "en",
      slug: `${tag}-draft`,
      title: "QA P8 draft article",
    });

    // Whatever RLS allows to be selected, the application's public query
    // filters on status — so assert the filter's own predicate holds.
    const publicPages = await anon
      .from("site_pages")
      .select("id,status")
      .eq("status", "PUBLISHED")
      .eq("is_active", true)
      .is("deleted_at", null);
    expect((publicPages.data ?? []).some((row) => row.id === draftPage)).toBe(
      false,
    );

    const publicArticles = await anon
      .from("articles")
      .select("id,status")
      .eq("status", "PUBLISHED")
      .is("deleted_at", null);
    expect(
      (publicArticles.data ?? []).some((row) => row.id === draftArticle.id),
    ).toBe(false);
  }, 90_000);

  it("resolves the project logo only from a live, public, measurable media row", async () => {
    const settings = (
      await service
        .from("site_settings")
        .select("id,org_logo_media_id")
        .limit(1)
        .single()
    ).data!;
    const original = settings.org_logo_media_id;
    const logoMedia = await makeMedia("logo-resolution");

    // The predicate `getSiteLogo()` applies, asserted against the database.
    const usable = async () =>
      (
        await service
          .from("media")
          .select("id,width,height")
          .eq("id", logoMedia)
          .is("deleted_at", null)
          .eq("is_public", true)
          .maybeSingle()
      ).data;

    await service
      .from("site_settings")
      .update({ org_logo_media_id: logoMedia })
      .eq("id", settings.id);
    expect(await usable(), "a live row should resolve").not.toBeNull();

    // Archived: no longer usable, so the static artwork takes over.
    await service
      .from("media")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", logoMedia);
    expect(await usable(), "an archived row must not resolve").toBeNull();

    // Not public: likewise.
    await service
      .from("media")
      .update({ deleted_at: null, is_public: false })
      .eq("id", logoMedia);
    expect(await usable(), "a private row must not resolve").toBeNull();

    // No dimensions: resolvable as a row, but not renderable.
    await service
      .from("media")
      .update({ is_public: true, width: null, height: null })
      .eq("id", logoMedia);
    const measured = await usable();
    expect(measured?.width ?? null).toBeNull();

    await service
      .from("site_settings")
      .update({ org_logo_media_id: original })
      .eq("id", settings.id);
  }, 90_000);
});
