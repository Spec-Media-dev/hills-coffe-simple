/**
 * N61 — origin images on the existing `origin_media` relation, proven against
 * the live database.
 *
 * The rules the Admin workflow depends on are database objects:
 *
 *   origin_media_one_hero_image  UNIQUE (origin_id) WHERE role = 'HERO'
 *   origin_media_role            CHECK (role IN ('HERO','GALLERY'))
 *   origin_media_pkey            PRIMARY KEY (origin_id, media_id)
 *   media_id                     REFERENCES media(id) ON DELETE RESTRICT
 *   origin_id                    REFERENCES origins(id) ON DELETE CASCADE
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

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const FK_VIOLATION = "23503";

suite("N61 origin media (live staging)", () => {
  let admin: Fixture;
  let customer: Fixture;
  let originId: string;
  const media: string[] = [];
  const tag = `qa-n61-${Date.now().toString(36)}`;

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
    media.push(String(data.id));
    return String(data.id);
  };

  const links = async () =>
    (
      await service
        .from("origin_media")
        .select("media_id,role,sort_order")
        .eq("origin_id", originId)
        .order("sort_order")
    ).data ?? [];

  beforeAll(async () => {
    admin = await createFixture("n61admin", "ADMIN");
    customer = await createFixture("n61cust", "USER");

    const { data, error } = await service
      .from("origins")
      .insert({ slug: tag, is_active: true })
      .select("id")
      .single();
    if (error) throw new Error(`origin: ${error.message}`);
    originId = String(data.id);
  }, 90_000);

  afterAll(async () => {
    // Links first: `origin_media.media_id` is ON DELETE RESTRICT, so the media
    // rows cannot go while the origin still points at them.
    await service.from("origin_media").delete().eq("origin_id", originId);
    for (const id of media) await service.from("media").delete().eq("id", id);
    await service.from("origins").delete().eq("id", originId);
    await cleanupFixtures();
  }, 60_000);

  it("starts with no images", async () => {
    expect(await links()).toHaveLength(0);
  }, 30_000);

  it("accepts only HERO and GALLERY roles", async () => {
    const mediaId = await makeMedia("role");
    const { error } = await service.from("origin_media").insert({
      origin_id: originId,
      media_id: mediaId,
      role: "MAIN",
    });
    expect(error?.code, "MAIN is a coffee role, not an origin one").toBe(
      CHECK_VIOLATION,
    );
  }, 45_000);

  it("assigns a hero, and the database refuses a second one", async () => {
    const first = await makeMedia("hero-a");
    const second = await makeMedia("hero-b");

    const { error } = await admin.client.from("origin_media").insert({
      origin_id: originId,
      media_id: first,
      role: "HERO",
      sort_order: 0,
    });
    expect(error).toBeNull();

    // The partial unique index is the authority on "exactly one hero".
    const duplicate = await admin.client.from("origin_media").insert({
      origin_id: originId,
      media_id: second,
      role: "HERO",
      sort_order: 0,
    });
    expect(duplicate.error?.code).toBe(UNIQUE_VIOLATION);
  }, 60_000);

  it("replaces the hero by demoting before promoting", async () => {
    const rows = await links();
    const currentHero = rows.find((row) => row.role === "HERO")!;
    const replacement = await makeMedia("hero-replacement");

    await admin.client.from("origin_media").insert({
      origin_id: originId,
      media_id: replacement,
      role: "GALLERY",
      sort_order: 5,
    });

    // Promoting first would be rejected; this is the order the action uses.
    const demote = await admin.client
      .from("origin_media")
      .update({ role: "GALLERY", sort_order: 9 })
      .eq("origin_id", originId)
      .eq("media_id", currentHero.media_id);
    expect(demote.error).toBeNull();

    const promote = await admin.client
      .from("origin_media")
      .update({ role: "HERO", sort_order: 0 })
      .eq("origin_id", originId)
      .eq("media_id", replacement);
    expect(promote.error).toBeNull();

    const after = await links();
    expect(after.filter((row) => row.role === "HERO")).toHaveLength(1);
    expect(after.find((row) => row.role === "HERO")?.media_id).toBe(
      replacement,
    );
  }, 60_000);

  it("holds many gallery images and preserves their order", async () => {
    const extra = [
      await makeMedia("gallery-a"),
      await makeMedia("gallery-b"),
      await makeMedia("gallery-c"),
    ];
    for (const [index, mediaId] of extra.entries()) {
      const { error } = await admin.client.from("origin_media").insert({
        origin_id: originId,
        media_id: mediaId,
        role: "GALLERY",
        sort_order: 20 + index,
      });
      expect(error).toBeNull();
    }

    // Reorder the way the action does, one positional update per row.
    const reversed = [...extra].reverse();
    for (const [index, mediaId] of reversed.entries())
      await admin.client
        .from("origin_media")
        .update({ sort_order: index + 1 })
        .eq("origin_id", originId)
        .eq("media_id", mediaId);

    const after = await links();
    const positions = reversed.map(
      (mediaId) => after.find((row) => row.media_id === mediaId)!.sort_order,
    );
    expect(positions).toEqual([1, 2, 3]);
  }, 90_000);

  it("refuses the same image twice on one origin", async () => {
    const rows = await links();
    const existing = rows[0];
    const { error } = await admin.client.from("origin_media").insert({
      origin_id: originId,
      media_id: existing.media_id,
      role: "GALLERY",
      sort_order: 99,
    });
    expect(error?.code, "the primary key is (origin_id, media_id)").toBe(
      UNIQUE_VIOLATION,
    );
  }, 45_000);

  it("removes a gallery image by unlinking it, leaving the library row intact", async () => {
    const rows = await links();
    const target = rows.find((row) => row.role === "GALLERY")!;

    const { error } = await admin.client
      .from("origin_media")
      .delete()
      .eq("origin_id", originId)
      .eq("media_id", target.media_id);
    expect(error).toBeNull();

    expect(
      (await links()).some((row) => row.media_id === target.media_id),
    ).toBe(false);
    // The media itself survives: it is shared library content, not the
    // origin's private copy.
    const { data: still } = await service
      .from("media")
      .select("id")
      .eq("id", target.media_id)
      .maybeSingle();
    expect(still).not.toBeNull();
  }, 60_000);

  it("blocks a hard delete of media an origin still uses (RESTRICT)", async () => {
    const rows = await links();
    const inUse = rows[0];
    const { error } = await service
      .from("media")
      .delete()
      .eq("id", inUse.media_id);
    expect(error?.code).toBe(FK_VIOLATION);
  }, 45_000);

  it("still finds the origin among a media item's references", async () => {
    // What the Phase 8 archive warning reads: the same query, live.
    const rows = await links();
    const inUse = rows[0];
    const { data } = await service
      .from("origin_media")
      .select("role,origins(slug)")
      .eq("media_id", inUse.media_id);
    expect(data ?? []).toHaveLength(1);
    expect((data![0].origins as unknown as { slug: string }).slug).toBe(tag);
  }, 45_000);

  it("denies anonymous and customer writes to origin_media", async () => {
    const mediaId = await makeMedia("hostile");
    for (const [label, client] of [
      ["anonymous", anon],
      ["customer", customer.client],
    ] as const) {
      const insert = await client
        .from("origin_media")
        .insert({ origin_id: originId, media_id: mediaId, role: "GALLERY" })
        .select("origin_id");
      expect(insert.error, `${label} linked an image`).not.toBeNull();

      const rows = await links();
      const update = await client
        .from("origin_media")
        .update({ role: "HERO" })
        .eq("origin_id", originId)
        .eq("media_id", rows[0].media_id)
        .select("origin_id");
      expect(update.data ?? [], `${label} changed a role`).toHaveLength(0);

      const remove = await client
        .from("origin_media")
        .delete()
        .eq("origin_id", originId)
        .eq("media_id", rows[0].media_id)
        .select("origin_id");
      expect(remove.data ?? [], `${label} unlinked an image`).toHaveLength(0);
    }
  }, 90_000);
});
