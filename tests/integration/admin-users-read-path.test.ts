/**
 * P1-T02 / P1-T03 — admin_list_users() read path.
 *
 * The "current contract" block documents the guarantees that must hold
 * whatever else changes. The "extension" block asserts the owner-approved
 * search/pagination/block-state/avatar additions applied from
 *   specs/001-platform-implementation-spec/migrations/
 *     P1-T02_admin_list_users_extension.sql
 *
 * That extension is live (Phase 5 pre-flight re-verified the live signature
 * and the generated types), and Phase 5's Admin Users workspace depends on it,
 * so its former `HILLS_ADMIN_LIST_USERS_EXTENDED` opt-in gate was removed: the
 * contract is now unconditional.
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

type UserRow = Record<string, unknown>;

suite("P1-T02 admin_list_users() read path", () => {
  let admin: Fixture;
  let blocked: Fixture;
  let active: Fixture;

  beforeAll(async () => {
    admin = await createFixture("alu-admin", "ADMIN");
    blocked = await createFixture("alu-blocked", "USER");
    active = await createFixture("alu-active", "USER");
    await admin.client.rpc("admin_set_user_blocked", {
      target_user_id: blocked.id,
      blocked: true,
      reason: "P1-T02 fixture",
    });
    await service
      .from("profiles")
      .update({ avatar_path: `${active.id}/avatar.png` })
      .eq("id", active.id);
  }, 60_000);

  afterAll(async () => {
    await cleanupFixtures();
  }, 60_000);

  describe("access control (must hold before and after the extension)", () => {
    it("an Administrator can call it", async () => {
      const { data, error } = await admin.client.rpc("admin_list_users");
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it("an ordinary customer is refused", async () => {
      const { error } = await active.client.rpc("admin_list_users");
      expect(error?.message).toBe("Forbidden");
      expect(error?.code).toBe("P0001");
    });

    it("a blocked customer is refused", async () => {
      const { error } = await blocked.client.rpc("admin_list_users");
      expect(error?.message).toBe("Forbidden");
    });

    it("an anonymous visitor cannot execute the function at all", async () => {
      const { error } = await anon.rpc("admin_list_users");
      expect(error?.code).toBe("42501");
    });

    it("the service-role key is refused (it has no auth.uid())", async () => {
      const { error } = await service.rpc("admin_list_users");
      expect(error?.message).toBe("Forbidden");
    });
  });

  describe("result shape and scoping", () => {
    it("returns customer rows only — never an Administrator", async () => {
      const { data } = await admin.client.rpc("admin_list_users");
      const rows = (data ?? []) as UserRow[];
      expect(rows.some((r) => r.id === admin.id)).toBe(false);
      expect(rows.some((r) => r.id === active.id)).toBe(true);
      expect(rows.some((r) => r.id === blocked.id)).toBe(true);
    });

    it("never exposes a password, secret, or raw user metadata", async () => {
      const { data } = await admin.client.rpc("admin_list_users");
      const row = ((data ?? []) as UserRow[])[0] ?? {};
      for (const key of Object.keys(row)) {
        expect(key).not.toMatch(
          /password|encrypted|token|secret|raw_user_meta|raw_app_meta/i,
        );
      }
    });

    it("carries verification and account state through", async () => {
      const { data } = await admin.client.rpc("admin_list_users");
      const row = ((data ?? []) as UserRow[]).find((r) => r.id === active.id);
      expect(row?.email).toBe(active.email);
      expect(row?.email_verified).toBe(true);
      expect(row?.registered_at).toBeTruthy();
      expect(typeof row?.favorites_count).toBe("number");
      expect(typeof row?.inquiries_count).toBe("number");
    });
  });

  describe("owner-approved extension (applied; Phase 5 depends on it)", () => {
    it("returns block state and an avatar reference on every row", async () => {
      const { data } = await admin.client.rpc("admin_list_users");
      const rows = (data ?? []) as UserRow[];
      const b = rows.find((r) => r.id === blocked.id);
      const a = rows.find((r) => r.id === active.id);
      expect(b?.is_blocked).toBe(true);
      expect(a?.is_blocked).toBe(false);
      expect(a?.avatar_path).toBe(`${active.id}/avatar.png`);
    });

    it("filters by blocked state", async () => {
      const { data } = await admin.client.rpc("admin_list_users", {
        blocked_filter: true,
      });
      const rows = (data ?? []) as UserRow[];
      expect(rows.every((r) => r.is_blocked === true)).toBe(true);
      expect(rows.some((r) => r.id === blocked.id)).toBe(true);
    });

    it("searches by email, case-insensitively and partially", async () => {
      const fragment = active.email.slice(5, 15).toUpperCase();
      const { data } = await admin.client.rpc("admin_list_users", {
        email_query: fragment,
      });
      expect(((data ?? []) as UserRow[]).some((r) => r.id === active.id)).toBe(
        true,
      );
    });

    it("searches by name", async () => {
      const { data } = await admin.client.rpc("admin_list_users", {
        name_query: "P1 fixture alu-active",
      });
      expect(((data ?? []) as UserRow[]).some((r) => r.id === active.id)).toBe(
        true,
      );
    });

    it("paginates and reports a stable total", async () => {
      const { data } = await admin.client.rpc("admin_list_users", {
        page: 1,
        page_size: 1,
      });
      const rows = (data ?? []) as UserRow[];
      expect(rows.length).toBe(1);
      expect(Number(rows[0]?.total_count)).toBeGreaterThanOrEqual(2);
    });

    it("clamps an oversized page_size instead of scanning everything", async () => {
      const { data, error } = await admin.client.rpc("admin_list_users", {
        page_size: 100_000,
      });
      expect(error).toBeNull();
      expect(((data ?? []) as UserRow[]).length).toBeLessThanOrEqual(100);
    });

    it("still refuses every non-admin caller after the extension", async () => {
      expect((await active.client.rpc("admin_list_users")).error?.message).toBe(
        "Forbidden",
      );
      expect((await anon.rpc("admin_list_users")).error?.code).toBe("42501");
    });
  });

  describe("Admin avatar visibility constraint (Phase 5 design input)", () => {
    it("an Administrator session cannot read a customer avatar directly", async () => {
      const path = `${active.id}/avatar.png`;
      await service.storage
        .from("avatars")
        .upload(path, Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), {
          contentType: "image/png",
          upsert: true,
        });
      const { error } = await admin.client.storage
        .from("avatars")
        .download(path);
      expect(
        error,
        "avatars_owner_select is owner-scoped; Admin view needs a service-role signed URL",
      ).not.toBeNull();
    });

    it("a service-role signed URL is the supported Admin view path", async () => {
      const path = `${active.id}/avatar.png`;
      const { data, error } = await service.storage
        .from("avatars")
        .createSignedUrl(path, 60);
      expect(error).toBeNull();
      expect(data?.signedUrl).toBeTruthy();
      const res = await fetch(data!.signedUrl);
      expect(res.status).toBe(200);
    });
  });
});
