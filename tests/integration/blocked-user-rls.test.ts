/**
 * P1-T04 — Blocked-user enforcement at the DB/storage boundary.
 * Implements the before/after test pair for spec.md FR-067 and FR-068.
 *
 * THESE TESTS ASSERT THE SECURE END STATE AND CURRENTLY FAIL ON PURPOSE.
 *
 * The five "must be denied" cases below all SUCCEED against the live database
 * today. That is analysis finding C1: `hills_profiles_update_own` and the four
 * `avatars_owner_*` storage policies enforce ownership only, with no
 * blocked-state predicate, so a blocked customer holding a still-valid session
 * bypasses the application's gate with a direct client call.
 *
 * They turn green when the owner applies
 *   specs/001-platform-implementation-spec/migrations/
 *     P1-T04_blocked_user_rls_storage_hardening.sql
 *
 * The control blocks (unblocked customer, Administrator, service role) must
 * pass BOTH before and after that migration — they are what proves the fix
 * did not over-reach (FR-068).
 *
 * Run with: npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TINY_PNG,
  avatarPath,
  cleanupFixtures,
  createFixture,
  hasStagingCredentials,
  service,
  type Fixture,
} from "./helpers/staging";

const suite = hasStagingCredentials ? describe : describe.skip;

suite("P1-T04 blocked-user DB/storage enforcement (FR-067, FR-068)", () => {
  let admin: Fixture;
  let blocked: Fixture;
  let active: Fixture;

  beforeAll(async () => {
    admin = await createFixture("t04admin", "ADMIN");
    blocked = await createFixture("t04blocked", "USER");
    active = await createFixture("t04active", "USER");
    const { error } = await admin.client.rpc("admin_set_user_blocked", {
      target_user_id: blocked.id,
      blocked: true,
      reason: "P1-T04 enforcement fixture",
    });
    expect(error).toBeNull();
    // Guard: everything below is meaningless unless the fixture is truly blocked.
    const { data } = await blocked.client.rpc("hills_is_blocked");
    expect(data).toBe(true);
  }, 60_000);

  afterAll(async () => {
    await cleanupFixtures();
  }, 60_000);

  describe("FR-067 — a blocked customer loses self-service at the DB layer", () => {
    // `hills_profiles_update_own` excludes a blocked user in USING, so the
    // statement matches zero rows and PostgREST answers 204 No Content. An
    // RLS-filtered UPDATE is a silent no-op by design, so asserting "an error
    // was raised" would test the mechanism instead of the guarantee. Assert
    // the guarantee: nothing was written.
    it("cannot update their own profiles row", async () => {
      const sentinel = `C1-should-not-persist-${Date.now()}`;
      const { data: affected } = await blocked.client
        .from("profiles")
        .update({ full_name: sentinel })
        .eq("id", blocked.id)
        .select();

      expect(
        affected ?? [],
        "blocked customer's UPDATE must match zero rows",
      ).toEqual([]);

      const { data } = await service
        .from("profiles")
        .select("full_name")
        .eq("id", blocked.id)
        .single();
      expect(
        data?.full_name,
        "blocked customer must not update their own profile",
      ).not.toBe(sentinel);
    });

    it("cannot upload an avatar", async () => {
      const { error } = await blocked.client.storage
        .from("avatars")
        .upload(avatarPath(blocked.id), TINY_PNG, { contentType: "image/png" });
      expect(
        error,
        "blocked customer must not upload an avatar",
      ).not.toBeNull();
    });

    it("cannot replace an avatar", async () => {
      // Seed an object out-of-band so this exercises UPDATE, not INSERT.
      await service.storage
        .from("avatars")
        .upload(avatarPath(blocked.id), TINY_PNG, {
          contentType: "image/png",
          upsert: true,
        });
      const { error } = await blocked.client.storage
        .from("avatars")
        .upload(avatarPath(blocked.id), TINY_PNG, {
          contentType: "image/png",
          upsert: true,
        });
      expect(
        error,
        "blocked customer must not replace an avatar",
      ).not.toBeNull();
    });

    it("cannot read their own private avatar", async () => {
      await service.storage
        .from("avatars")
        .upload(avatarPath(blocked.id), TINY_PNG, {
          contentType: "image/png",
          upsert: true,
        });
      const { error } = await blocked.client.storage
        .from("avatars")
        .download(avatarPath(blocked.id));
      expect(
        error,
        "blocked customer must not read their avatar",
      ).not.toBeNull();
    });

    it("cannot delete an avatar", async () => {
      await service.storage
        .from("avatars")
        .upload(avatarPath(blocked.id), TINY_PNG, {
          contentType: "image/png",
          upsert: true,
        });
      const { data, error } = await blocked.client.storage
        .from("avatars")
        .remove([avatarPath(blocked.id)]);

      // The storage API reports a policy-filtered delete as an empty result
      // rather than an error, so assert the object still exists either way.
      const removed = !error && Array.isArray(data) && data.length > 0;
      expect(removed, "blocked customer must not delete an avatar").toBe(false);

      const { data: still } = await service.storage
        .from("avatars")
        .list(blocked.id);
      expect(still?.some((o) => o.name === "avatar.png")).toBe(true);
    });
  });

  describe("FR-068 — the hardening must not over-reach", () => {
    it("an unblocked customer still updates their own profile", async () => {
      const name = `P1 active ${Date.now()}`;
      const { error } = await active.client
        .from("profiles")
        .update({ full_name: name })
        .eq("id", active.id);
      expect(error).toBeNull();

      const { data } = await service
        .from("profiles")
        .select("full_name")
        .eq("id", active.id)
        .single();
      expect(data?.full_name).toBe(name);
    });

    it("an unblocked customer still uploads, reads and deletes their avatar", async () => {
      const path = avatarPath(active.id);
      const up = await active.client.storage
        .from("avatars")
        .upload(path, TINY_PNG, { contentType: "image/png", upsert: true });
      expect(up.error).toBeNull();

      const dl = await active.client.storage.from("avatars").download(path);
      expect(dl.error).toBeNull();

      const rm = await active.client.storage.from("avatars").remove([path]);
      expect(rm.error).toBeNull();
      expect(rm.data?.length ?? 0).toBeGreaterThan(0);
    });

    it("an Administrator still updates their own profile", async () => {
      const { error } = await admin.client
        .from("profiles")
        .update({ full_name: "P1 admin self-edit" })
        .eq("id", admin.id);
      expect(
        error,
        "the hardening must not lock Administrators out of their own row",
      ).toBeNull();
    });

    it("an Administrator still manages their own avatar", async () => {
      const path = avatarPath(admin.id);
      const up = await admin.client.storage
        .from("avatars")
        .upload(path, TINY_PNG, { contentType: "image/png", upsert: true });
      expect(up.error).toBeNull();
      await admin.client.storage.from("avatars").remove([path]);
    });

    it("the service role retains full access to a blocked customer's data", async () => {
      const { error: readError } = await service
        .from("profiles")
        .select("id,full_name,avatar_path")
        .eq("id", blocked.id)
        .single();
      expect(readError).toBeNull();

      const ls = await service.storage.from("avatars").list(blocked.id);
      expect(ls.error).toBeNull();

      // Seed the object here rather than relying on an earlier test: while the
      // C1 gap is open, the delete case above actually removes it.
      const seeded = await service.storage
        .from("avatars")
        .upload(avatarPath(blocked.id), TINY_PNG, {
          contentType: "image/png",
          upsert: true,
        });
      expect(seeded.error).toBeNull();

      const dl = await service.storage
        .from("avatars")
        .download(avatarPath(blocked.id));
      expect(dl.error).toBeNull();
    });

    // Two independent controls now stand between a blocked customer and their
    // own block fields: RLS filters the row before the statement reaches the
    // trigger, and protect_profile_block_fields() catches anyone the RLS
    // predicate lets through (proven separately in authorization-contract).
    // Either outcome is a pass; a persisted change is not.
    it("a blocked customer still cannot self-unblock", async () => {
      const { data: affected, error } = await blocked.client
        .from("profiles")
        .update({ is_blocked: false })
        .eq("id", blocked.id)
        .select();

      if (error) {
        expect(error.message).toBe("profile_security_fields_not_editable");
      } else {
        expect(affected, "RLS must filter the row out entirely").toEqual([]);
      }

      const { data } = await service
        .from("profiles")
        .select("is_blocked")
        .eq("id", blocked.id)
        .single();
      expect(data?.is_blocked).toBe(true);
    });

    it("an Administrator can still unblock, restoring capability", async () => {
      const { error } = await admin.client.rpc("admin_set_user_blocked", {
        target_user_id: blocked.id,
        blocked: false,
      });
      expect(error).toBeNull();

      const { data } = await blocked.client.rpc("hills_is_verified_user");
      expect(data).toBe(true);

      // Re-block so the fixture's terminal state matches the suite's premise.
      await admin.client.rpc("admin_set_user_blocked", {
        target_user_id: blocked.id,
        blocked: true,
        reason: "P1-T04 enforcement fixture",
      });
    });
  });

  describe("cross-tenant isolation (must hold regardless of block state)", () => {
    it("one customer cannot read another customer's avatar", async () => {
      await service.storage
        .from("avatars")
        .upload(avatarPath(blocked.id), TINY_PNG, {
          contentType: "image/png",
          upsert: true,
        });
      const { error } = await active.client.storage
        .from("avatars")
        .download(avatarPath(blocked.id));
      expect(error).not.toBeNull();
    });

    it("an Administrator session cannot overwrite a customer's avatar", async () => {
      const { error } = await admin.client.storage
        .from("avatars")
        .upload(avatarPath(blocked.id), TINY_PNG, {
          contentType: "image/png",
          upsert: true,
        });
      expect(error).not.toBeNull();
    });
  });
});
