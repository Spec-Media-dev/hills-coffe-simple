/**
 * P1-T01 — Authorization-boundary characterization tests.
 *
 * Proves, against a live staging session rather than by reading SQL, the exact
 * contract that Phases 3, 4 and 5 will depend on:
 *   - hills_is_verified_user() / hills_is_blocked() / is_admin()
 *   - admin_set_user_blocked()'s complete refusal contract
 *   - protect_profile_block_fields()'s anti-self-unblock guarantee
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
  signInAs,
  type Fixture,
} from "./helpers/staging";

const suite = hasStagingCredentials ? describe : describe.skip;

suite("P1-T01 authorization contract (live staging)", () => {
  let admin: Fixture;
  let blocked: Fixture;
  let active: Fixture;

  beforeAll(async () => {
    admin = await createFixture("admin", "ADMIN");
    blocked = await createFixture("blocked", "USER");
    active = await createFixture("active", "USER");
    const { error } = await admin.client.rpc("admin_set_user_blocked", {
      target_user_id: blocked.id,
      blocked: true,
      reason: "P1-T01 characterization fixture",
    });
    expect(error).toBeNull();
  }, 60_000);

  afterAll(async () => {
    await cleanupFixtures();
  }, 60_000);

  describe("the service-role key is not an Administrator", () => {
    it("is refused by admin_set_user_blocked because it has no auth.uid()", async () => {
      const { error } = await service.rpc("admin_set_user_blocked", {
        target_user_id: active.id,
        blocked: true,
      });
      expect(error?.message).toBe("admin_access_required");
    });

    it("is refused by admin_list_users for the same reason", async () => {
      const { error } = await service.rpc("admin_list_users");
      expect(error?.message).toBe("Forbidden");
    });
  });

  describe("hills_is_verified_user() — the customer entitlement gate", () => {
    it("is true for an unblocked, email-confirmed USER", async () => {
      const { data } = await active.client.rpc("hills_is_verified_user");
      expect(data).toBe(true);
    });

    // Constitution Principle VII.
    it("is false for a blocked USER", async () => {
      const { data } = await blocked.client.rpc("hills_is_verified_user");
      expect(data).toBe(false);
    });

    // Constitution Principle VI: an Administrator must never inherit the
    // customer protected-price entitlement just by having a verified email.
    it("is false for an ADMIN", async () => {
      const { data } = await admin.client.rpc("hills_is_verified_user");
      expect(data).toBe(false);
    });

    it("is not callable at all by an anonymous visitor", async () => {
      const { error } = await anon.rpc("hills_is_verified_user");
      expect(error?.code).toBe("42501");
    });
  });

  describe("hills_is_blocked() and is_admin()", () => {
    it("hills_is_blocked() reflects only the blocked customer", async () => {
      expect((await blocked.client.rpc("hills_is_blocked")).data).toBe(true);
      expect((await active.client.rpc("hills_is_blocked")).data).toBe(false);
      expect((await admin.client.rpc("hills_is_blocked")).data).toBe(false);
      expect((await anon.rpc("hills_is_blocked")).data).toBe(false);
    });

    it("is_admin() is true only for the ADMIN session", async () => {
      expect((await admin.client.rpc("is_admin")).data).toBe(true);
      expect((await active.client.rpc("is_admin")).data).toBe(false);
      expect((await blocked.client.rpc("is_admin")).data).toBe(false);
      expect((await anon.rpc("is_admin")).data).toBe(false);
    });
  });

  describe("admin_set_user_blocked() refusal contract", () => {
    it("succeeds for ADMIN -> USER and writes durable block state", async () => {
      const { data } = await service
        .from("profiles")
        .select("is_blocked,blocked_at,blocked_by,block_reason")
        .eq("id", blocked.id)
        .single();
      expect(data?.is_blocked).toBe(true);
      expect(data?.blocked_at).toBeTruthy();
      expect(data?.blocked_by).toBe(admin.id);
      expect(data?.block_reason).toBe("P1-T01 characterization fixture");
    });

    it("refuses an Administrator blocking themselves", async () => {
      const { error } = await admin.client.rpc("admin_set_user_blocked", {
        target_user_id: admin.id,
        blocked: true,
      });
      expect(error?.message).toBe("admin_cannot_block_self");
      expect(error?.code).toBe("42501");
    });

    it("refuses an Administrator blocking another Administrator", async () => {
      const other = await createFixture("admin2", "ADMIN");
      const { error } = await admin.client.rpc("admin_set_user_blocked", {
        target_user_id: other.id,
        blocked: true,
      });
      expect(error?.message).toBe("only_user_accounts_can_be_blocked");
      const { data } = await service
        .from("profiles")
        .select("is_blocked")
        .eq("id", other.id)
        .single();
      expect(data?.is_blocked).toBe(false);
    }, 30_000);

    it("reports a missing target distinctly", async () => {
      const { error } = await admin.client.rpc("admin_set_user_blocked", {
        target_user_id: "00000000-0000-0000-0000-000000000000",
        blocked: true,
      });
      expect(error?.message).toBe("target_user_not_found");
      expect(error?.code).toBe("P0002");
    });

    it("refuses a non-admin caller", async () => {
      const { error } = await active.client.rpc("admin_set_user_blocked", {
        target_user_id: blocked.id,
        blocked: false,
      });
      expect(error?.message).toBe("admin_access_required");
    });

    it("refuses a blocked customer trying to unblock themselves", async () => {
      const { error } = await blocked.client.rpc("admin_set_user_blocked", {
        target_user_id: blocked.id,
        blocked: false,
      });
      expect(error?.message).toBe("admin_access_required");
      const { data } = await service
        .from("profiles")
        .select("is_blocked")
        .eq("id", blocked.id)
        .single();
      expect(data?.is_blocked).toBe(true);
    });
  });

  describe("protect_profile_block_fields() — anti-self-unblock (FR-068)", () => {
    // Since the P1-T04 hardening, `hills_profiles_update_own` excludes a
    // blocked user in its USING clause, so their UPDATE matches zero rows and
    // the trigger is never reached. Denial therefore surfaces as an empty
    // result, not as an error. Assert the security property — no write
    // happened — rather than the mechanism that produced it.
    it("denies a blocked customer editing their own block fields", async () => {
      const { data: affected, error } = await blocked.client
        .from("profiles")
        .update({ is_blocked: false })
        .eq("id", blocked.id)
        .select();

      if (error) {
        // Still acceptable: the trigger raised before RLS filtered.
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

    // The trigger is what protects everyone who DOES pass the RLS predicate.
    // Without this case, hardening RLS would silently retire all coverage of
    // protect_profile_block_fields() for ordinary customers.
    it("denies an unblocked customer tampering with block fields", async () => {
      const selfBlock = await active.client
        .from("profiles")
        .update({ is_blocked: true })
        .eq("id", active.id);
      expect(selfBlock.error?.message).toBe(
        "profile_security_fields_not_editable",
      );
      expect(selfBlock.error?.code).toBe("42501");

      const reason = await active.client
        .from("profiles")
        .update({ block_reason: "tamper" })
        .eq("id", active.id);
      expect(reason.error?.message).toBe(
        "profile_security_fields_not_editable",
      );

      const { data } = await service
        .from("profiles")
        .select("is_blocked,block_reason")
        .eq("id", active.id)
        .single();
      expect(data?.is_blocked).toBe(false);
      expect(data?.block_reason).toBeNull();
    });

    it("denies even the service-role client, so the RPC is the only path", async () => {
      const { error } = await service
        .from("profiles")
        .update({ block_reason: "direct write attempt" })
        .eq("id", blocked.id);
      expect(error?.message).toBe("profile_security_fields_not_editable");
    });
  });

  describe("Supabase Auth ban synchronization (defence in depth)", () => {
    // Documents the CURRENT state: blocking is durable in `profiles` only.
    // The Auth-layer ban described in contracts/admin-users-actions.md is a
    // Phase 5 deliverable; this test records that it is not in place yet and
    // must be updated to assert a denied sign-in once it lands.
    it("a blocked customer can still sign in today", async () => {
      const { data, error } = await signInAs(blocked);
      expect(error).toBeNull();
      expect(data.user?.id).toBe(blocked.id);

      const { data: banned } = await service.auth.admin.getUserById(blocked.id);
      expect(banned.user?.banned_until ?? null).toBeNull();
    });

    it("but that session has already lost every protected capability", async () => {
      const { data } = await blocked.client.rpc("hills_is_verified_user");
      expect(data).toBe(false);
    });
  });
});
