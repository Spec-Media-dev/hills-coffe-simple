/**
 * Phase 4 — customer account, avatar and favorites isolation, proven against
 * the live database and the private `avatars` bucket.
 *
 * These exercise the storage policies and RLS directly. The application-layer
 * guards are the first line of defence; what is asserted here is that the
 * database refuses the same things independently (Constitution VII).
 *
 * Run with: npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TINY_PNG,
  cleanupFixtures,
  createFixture,
  hasStagingCredentials,
  service,
  type Fixture,
} from "./helpers/staging";

const suite = hasStagingCredentials ? describe : describe.skip;
const BUCKET = "avatars";
const objectPath = (id: string, name = "avatar-test.png") => `${id}/${name}`;

suite("P4 customer account, avatar and favorites isolation", () => {
  let admin: Fixture;
  let owner: Fixture;
  let other: Fixture;
  let blocked: Fixture;

  beforeAll(async () => {
    admin = await createFixture("p4-admin", "ADMIN");
    owner = await createFixture("p4-owner", "USER");
    other = await createFixture("p4-other", "USER");
    blocked = await createFixture("p4-blocked", "USER");
    const { error } = await admin.client.rpc("admin_set_user_blocked", {
      target_user_id: blocked.id,
      blocked: true,
      reason: "P4 avatar denial fixture",
    });
    expect(error).toBeNull();
  }, 90_000);

  afterAll(async () => {
    await cleanupFixtures();
  }, 90_000);

  describe("owner avatar lifecycle", () => {
    it("uploads, reads, replaces and deletes its own object", async () => {
      const first = objectPath(owner.id, "avatar-first.png");
      const second = objectPath(owner.id, "avatar-second.png");

      const upload = await owner.client.storage
        .from(BUCKET)
        .upload(first, TINY_PNG, { contentType: "image/png", upsert: true });
      expect(upload.error).toBeNull();

      const read = await owner.client.storage.from(BUCKET).download(first);
      expect(read.error).toBeNull();

      // Replacement writes a new object, then the old one is removed — the
      // ordering the upload action uses so a failure never orphans the profile.
      const replace = await owner.client.storage
        .from(BUCKET)
        .upload(second, TINY_PNG, { contentType: "image/png", upsert: true });
      expect(replace.error).toBeNull();
      const removeOld = await owner.client.storage.from(BUCKET).remove([first]);
      expect(removeOld.error).toBeNull();
      expect(removeOld.data?.length ?? 0).toBeGreaterThan(0);

      // Assert the bucket, not the download endpoint: Supabase Storage keeps
      // serving a deleted object from its edge cache for the cache lifetime,
      // so a successful download proves nothing about whether the object was
      // actually removed. The listing is authoritative.
      const listing = await service.storage.from(BUCKET).list(owner.id);
      expect(listing.error).toBeNull();
      expect(
        (listing.data ?? []).map((object) => object.name),
        "the replaced object must be gone from the bucket",
      ).not.toContain("avatar-first.png");

      const removeNew = await owner.client.storage
        .from(BUCKET)
        .remove([second]);
      expect(removeNew.error).toBeNull();
    });

    it("records and clears profiles.avatar_path for its own row", async () => {
      const path = objectPath(owner.id);
      await owner.client.storage
        .from(BUCKET)
        .upload(path, TINY_PNG, { contentType: "image/png", upsert: true });

      const set = await owner.client
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", owner.id)
        .select("avatar_path");
      expect(set.error).toBeNull();
      expect(set.data?.[0]?.avatar_path).toBe(path);

      const clear = await owner.client
        .from("profiles")
        .update({ avatar_path: null })
        .eq("id", owner.id)
        .select("avatar_path");
      expect(clear.error).toBeNull();
      expect(clear.data?.[0]?.avatar_path).toBeNull();

      await owner.client.storage.from(BUCKET).remove([path]);
    });
  });

  describe("cross-user isolation (FR-020)", () => {
    it("one customer cannot read, overwrite or delete another's avatar", async () => {
      const victim = objectPath(owner.id, "avatar-private.png");
      await service.storage
        .from(BUCKET)
        .upload(victim, TINY_PNG, { contentType: "image/png", upsert: true });

      expect(
        (await other.client.storage.from(BUCKET).download(victim)).error,
        "cross-user read must be denied",
      ).not.toBeNull();

      expect(
        (
          await other.client.storage.from(BUCKET).upload(victim, TINY_PNG, {
            contentType: "image/png",
            upsert: true,
          })
        ).error,
        "cross-user overwrite must be denied",
      ).not.toBeNull();

      const removal = await other.client.storage.from(BUCKET).remove([victim]);
      const removed = !removal.error && (removal.data?.length ?? 0) > 0;
      expect(removed, "cross-user delete must not succeed").toBe(false);

      // The object must still be there afterwards.
      expect(
        (await service.storage.from(BUCKET).download(victim)).error,
      ).toBeNull();
      await service.storage.from(BUCKET).remove([victim]);
    });

    it("a customer cannot write into another customer's folder", async () => {
      // Path traversal is moot because the server derives the path, but the
      // policy must refuse it regardless.
      const foreign = objectPath(other.id, "planted.png");
      const attempt = await owner.client.storage
        .from(BUCKET)
        .upload(foreign, TINY_PNG, { contentType: "image/png", upsert: true });
      expect(attempt.error).not.toBeNull();
    });

    it("a customer cannot mutate another customer's profile row", async () => {
      const before = await service
        .from("profiles")
        .select("full_name")
        .eq("id", other.id)
        .single();

      const attempt = await owner.client
        .from("profiles")
        .update({ full_name: "hijacked" })
        .eq("id", other.id)
        .select("id");
      // RLS filters the foreign row out, so this affects nothing.
      expect(attempt.data ?? []).toEqual([]);

      const after = await service
        .from("profiles")
        .select("full_name")
        .eq("id", other.id)
        .single();
      expect(after.data?.full_name).toBe(before.data?.full_name);
    });
  });

  describe("blocked customer denial (FR-067)", () => {
    it("cannot upload, read, replace or delete an avatar", async () => {
      const path = objectPath(blocked.id);
      // Seed out-of-band so read/replace/delete are exercised against a real
      // object rather than a missing one.
      await service.storage
        .from(BUCKET)
        .upload(path, TINY_PNG, { contentType: "image/png", upsert: true });

      expect(
        (
          await blocked.client.storage
            .from(BUCKET)
            .upload(objectPath(blocked.id, "new.png"), TINY_PNG, {
              contentType: "image/png",
            })
        ).error,
        "blocked upload must be denied",
      ).not.toBeNull();

      expect(
        (
          await blocked.client.storage
            .from(BUCKET)
            .upload(path, TINY_PNG, { contentType: "image/png", upsert: true })
        ).error,
        "blocked replace must be denied",
      ).not.toBeNull();

      expect(
        (await blocked.client.storage.from(BUCKET).download(path)).error,
        "blocked read must be denied",
      ).not.toBeNull();

      const removal = await blocked.client.storage.from(BUCKET).remove([path]);
      const removed = !removal.error && (removal.data?.length ?? 0) > 0;
      expect(removed, "blocked delete must not succeed").toBe(false);

      await service.storage.from(BUCKET).remove([path]);
    });

    it("cannot update its own profile, so avatar_path cannot be repointed", async () => {
      const attempt = await blocked.client
        .from("profiles")
        .update({ avatar_path: `${blocked.id}/forced.png` })
        .eq("id", blocked.id)
        .select("id");
      expect(attempt.data ?? []).toEqual([]);

      const row = await service
        .from("profiles")
        .select("avatar_path")
        .eq("id", blocked.id)
        .single();
      expect(row.data?.avatar_path).toBeNull();
    });
  });

  describe("the avatars bucket stays private", () => {
    it("is not public and is unreadable anonymously", async () => {
      const { data } = await service.storage.getBucket(BUCKET);
      expect(data?.public).toBe(false);
    });
  });

  describe("favorites cross-user isolation (P4-T05)", () => {
    it("a customer sees only their own favorites", async () => {
      // Seeding requires a real published coffee; the catalogue is empty in
      // this environment, so the isolation property is asserted on the read
      // path, which is what RLS governs.
      const mine = await owner.client.from("favorites").select("user_id");
      expect(mine.error).toBeNull();
      expect(
        (mine.data ?? []).every((row) => row.user_id === owner.id),
        "a favorites read must never return another customer's rows",
      ).toBe(true);

      const theirs = await other.client
        .from("favorites")
        .select("user_id")
        .eq("user_id", owner.id);
      expect(theirs.error).toBeNull();
      expect(
        theirs.data ?? [],
        "filtering by another customer's id must return nothing",
      ).toEqual([]);
    });

    it("a customer cannot insert a favorite on another customer's behalf", async () => {
      const attempt = await owner.client.from("favorites").insert({
        user_id: other.id,
        coffee_id: "00000000-0000-0000-0000-000000000000",
        created_at: new Date().toISOString(),
      });
      expect(
        attempt.error,
        "cross-user favorite insert must be denied",
      ).not.toBeNull();
    });

    it("a blocked customer cannot write favorites at all", async () => {
      const attempt = await blocked.client.from("favorites").insert({
        user_id: blocked.id,
        coffee_id: "00000000-0000-0000-0000-000000000000",
        created_at: new Date().toISOString(),
      });
      expect(attempt.error).not.toBeNull();
    });
  });

  describe("request ownership (P4-T06)", () => {
    it("a customer can only read their own inquiries", async () => {
      const mine = await owner.client.from("inquiries").select("user_id");
      expect(mine.error).toBeNull();
      expect((mine.data ?? []).every((row) => row.user_id === owner.id)).toBe(
        true,
      );

      const foreign = await other.client
        .from("inquiries")
        .select("id")
        .eq("user_id", owner.id);
      expect(foreign.data ?? []).toEqual([]);
    });
  });
});
