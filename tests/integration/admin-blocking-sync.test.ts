/**
 * P5-T03 / P5-T04 — the two layers Phase 5 adds on top of the already-proven
 * `admin_set_user_blocked()` contract:
 *
 *   1. the Supabase Auth ban applied as defense in depth, and
 *   2. the service-role signed URL that lets an Admin *view* — and only view —
 *      a customer's avatar.
 *
 * The database-level refusal contract itself (self-block, Admin-target block,
 * non-admin caller, anti-self-unblock) is covered by
 * `authorization-contract.test.ts` and is not duplicated here.
 *
 * Run with: npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  avatarPath,
  cleanupFixtures,
  createFixture,
  hasStagingCredentials,
  service,
  signInAs,
  TINY_PNG,
  type Fixture,
} from "./helpers/staging";

const suite = hasStagingCredentials ? describe : describe.skip;

/** Mirrors `BAN_DURATION` in `src/actions/admin-users.ts`. */
const BAN_DURATION = "876000h";

suite("P5-T03 block/unblock — Auth-ban synchronization", () => {
  let admin: Fixture;
  let customer: Fixture;

  beforeAll(async () => {
    admin = await createFixture("p5-admin", "ADMIN");
    customer = await createFixture("p5-customer", "USER");
  }, 120_000);

  afterAll(async () => {
    // Never leave a fixture banned: cleanup deletes it, but an interrupted run
    // must not strand a banned account behind.
    await service.auth.admin
      .updateUserById(customer.id, { ban_duration: "none" })
      .catch(() => undefined);
    await cleanupFixtures();
  }, 120_000);

  describe("the durable block is what enforces the rule", () => {
    it("takes effect on an already-issued session's very next request", async () => {
      // `customer.client` holds a session issued at fixture creation, before
      // any block — exactly like a customer already browsing when an
      // Administrator blocks them.
      const before = await customer.client.rpc("hills_is_verified_user");
      expect(before.data).toBe(true);

      const { error } = await admin.client.rpc("admin_set_user_blocked", {
        target_user_id: customer.id,
        blocked: true,
        reason: "P5 fixture — sync test",
      });
      expect(error).toBeNull();

      // No sign-out, no token refresh, no new request context: the same
      // session simply asks again and is now refused (SC-004, FR-029).
      const after = await customer.client.rpc("hills_is_verified_user");
      expect(after.data).toBe(false);
    });

    it("records who blocked whom, when, and why", async () => {
      const { data } = await service
        .from("profiles")
        .select("is_blocked,blocked_at,blocked_by,block_reason")
        .eq("id", customer.id)
        .single();
      expect(data?.is_blocked).toBe(true);
      expect(data?.blocked_at).toBeTruthy();
      // Attribution comes from `auth.uid()` inside the SECURITY DEFINER
      // function, so it cannot be forged by the caller.
      expect(data?.blocked_by).toBe(admin.id);
      expect(data?.block_reason).toBe("P5 fixture — sync test");
    });
  });

  describe("the Auth ban is the second, non-authoritative layer", () => {
    it("prevents a fresh sign-in once applied", async () => {
      const { error: banError } = await service.auth.admin.updateUserById(
        customer.id,
        { ban_duration: BAN_DURATION },
      );
      expect(banError).toBeNull();

      const { data, error } = await signInAs(customer);
      expect(data.session).toBeNull();
      expect(error).not.toBeNull();
    });

    it("is not required for the block to hold — the durable state already denies", async () => {
      // Lift only the Auth ban, leaving `is_blocked = true`. This is exactly
      // the state after a partial failure, and the customer must still be
      // denied: the Auth ban is never the thing doing the work.
      await service.auth.admin.updateUserById(customer.id, {
        ban_duration: "none",
      });
      const { data: session } = await signInAs(customer);
      expect(session.session).toBeTruthy();

      const stillBlocked = await customer.client.rpc("hills_is_verified_user");
      expect(stillBlocked.data).toBe(false);
    });
  });

  describe("unblock", () => {
    it("restores protected capability", async () => {
      const { error } = await admin.client.rpc("admin_set_user_blocked", {
        target_user_id: customer.id,
        blocked: false,
      });
      expect(error).toBeNull();
      const { data } = await customer.client.rpc("hills_is_verified_user");
      expect(data).toBe(true);
    });

    it("clears the internal block reason rather than retaining it", async () => {
      const { data } = await service
        .from("profiles")
        .select("is_blocked,blocked_at,blocked_by,block_reason")
        .eq("id", customer.id)
        .single();
      expect(data?.is_blocked).toBe(false);
      expect(data?.blocked_at).toBeNull();
      expect(data?.blocked_by).toBeNull();
      expect(data?.block_reason).toBeNull();
    });

    it("does not create a session for the customer (FR-028)", async () => {
      // The unblock above was performed entirely on the Administrator's
      // client. Nothing in that call can mint a customer session; the customer
      // has to sign in themselves, as a normal fresh sign-in.
      const { data, error } = await signInAs(customer);
      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.user?.id).toBe(customer.id);
    });
  });
});

suite("P5-T04 Admin customer avatar is view-only", () => {
  let admin: Fixture;
  let customer: Fixture;
  let path: string;

  beforeAll(async () => {
    admin = await createFixture("p5av-admin", "ADMIN");
    customer = await createFixture("p5av-customer", "USER");
    path = avatarPath(customer.id);
    const { error } = await customer.client.storage
      .from("avatars")
      .upload(path, TINY_PNG, { contentType: "image/png", upsert: true });
    expect(error).toBeNull();
    await service
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", customer.id);
  }, 120_000);

  afterAll(async () => {
    await cleanupFixtures();
  }, 120_000);

  it("a service-role signed URL renders the object", async () => {
    const { data, error } = await service.storage
      .from("avatars")
      .createSignedUrl(path, 600);
    expect(error).toBeNull();
    const response = await fetch(data!.signedUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image");
  });

  it("the Administrator's own session still cannot read it directly", async () => {
    // This is why the signed URL exists. If this ever starts succeeding, a
    // broad admin-read storage policy has been added and must be reverted.
    const { error } = await admin.client.storage.from("avatars").download(path);
    expect(error).not.toBeNull();
  });

  it("an Administrator cannot upload over a customer's avatar", async () => {
    const { error } = await admin.client.storage
      .from("avatars")
      .upload(path, TINY_PNG, { contentType: "image/png", upsert: true });
    expect(error).not.toBeNull();
  });

  it("an Administrator cannot delete a customer's avatar object", async () => {
    await admin.client.storage.from("avatars").remove([path]);
    // `remove()` reports success for rows RLS filtered away, so the bucket
    // listing is the authoritative check (Phase 4 finding N19).
    const { data } = await service.storage
      .from("avatars")
      .list(customer.id, { limit: 10 });
    expect(data?.some((object) => object.name === "avatar.png")).toBe(true);
  });

  it("an Administrator cannot repoint a customer's avatar_path", async () => {
    await admin.client
      .from("profiles")
      .update({ avatar_path: `${admin.id}/avatar.png` })
      .eq("id", customer.id);
    const { data } = await service
      .from("profiles")
      .select("avatar_path")
      .eq("id", customer.id)
      .single();
    expect(data?.avatar_path).toBe(path);
  });
});
