import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 5 structural invariants.
 *
 * These are source-text assertions on purpose: the properties below ("no
 * client component may import the service-role client", "the customer detail
 * view offers no avatar write") are absences, and an absence is proven by
 * scanning the tree, not by exercising one code path. They complement the
 * live-database proofs in `tests/integration/admin-blocking-sync.test.ts`
 * rather than standing in for them.
 */

/** Every source file under `src/`, so a new file cannot quietly opt out. */
function sourceFiles(dir = resolve("src")): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts"))
      out.push(path);
  }
  return out;
}

const read = (path: string) => readFileSync(resolve(path), "utf8");

/**
 * Source with comments removed. Documentation legitimately names the things
 * these tests assert are absent ("never writes avatar_path"), so the checks
 * run against code only — otherwise explaining a rule would break it.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("service-role boundary (P5-T03)", () => {
  const modulePath = "src/lib/supabase/service-role.ts";

  it("is a dedicated server-only module", () => {
    const source = read(modulePath);
    expect(source).toContain('import "server-only"');
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("never reads the key from a NEXT_PUBLIC_ variable", () => {
    // A `NEXT_PUBLIC_` name would be inlined into the browser bundle.
    expect(read(modulePath)).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE");
  });

  it("never logs the key", () => {
    const source = read(modulePath);
    for (const line of source.split("\n")) {
      if (line.includes("console.")) expect(line).not.toContain("key");
    }
  });

  it("is the only place an RLS-bypassing client is constructed", () => {
    const offenders = sourceFiles()
      .filter((file) => !file.endsWith("service-role.ts"))
      .filter((file) => {
        const source = code(file);
        return (
          source.includes("SUPABASE_SERVICE_ROLE_KEY") &&
          source.includes("createClient(")
        );
      });
    expect(offenders).toEqual([]);
  });

  it("keeps every other reader of that secret server-only", () => {
    // `auth/recovery.ts` uses it as HMAC key material, not to build a client.
    const readers = sourceFiles()
      .filter((file) => !file.endsWith("service-role.ts"))
      .filter((file) => code(file).includes("SUPABASE_SERVICE_ROLE_KEY"));
    for (const file of readers) {
      expect(read(file), file).toContain('import "server-only"');
    }
  });

  it("is never imported by a client component", () => {
    const offenders = sourceFiles().filter((file) => {
      const source = read(file);
      return (
        source.trimStart().startsWith('"use client"') &&
        source.includes("supabase/service-role")
      );
    });
    expect(offenders).toEqual([]);
  });
});

describe("Admin pending-email recovery", () => {
  const actionPath = "src/actions/account.ts";
  const adminAccountPage = "src/app/[locale]/admin/account/page.tsx";
  const customerSettingsPage =
    "src/app/[locale]/(site)/account/settings/page.tsx";
  const callbackRoute = "src/app/auth/callback/route.ts";
  const continuePage = "src/app/[locale]/continue/page.tsx";
  const proxyPath = "src/proxy.ts";

  it("uses the service role only after the live Administrator gate", () => {
    const source = read(actionPath);
    const start = source.indexOf(
      "export async function correctPendingAdminEmailAction",
    );
    expect(start).toBeGreaterThan(-1);
    const recovery = source.slice(
      start,
      source.indexOf("export async function changePasswordAction", start),
    );
    expect(recovery).toContain("await requireAdmin()");
    expect(recovery).toContain("createSupabaseServiceRoleClient()");
    expect(recovery).toContain("updateUserById(admin.id");
    expect(recovery).toContain("email_confirm: true");
  });

  it("uses only Supabase's pending target and refreshes the session", () => {
    const source = read(actionPath);
    const start = source.indexOf(
      "export async function correctPendingAdminEmailAction",
    );
    const recovery = source.slice(
      start,
      source.indexOf("export async function changePasswordAction", start),
    );
    expect(recovery).toContain("admin.pendingEmail");
    expect(recovery).not.toContain('formData.get("email")');
    expect(recovery).toContain(
      'formData.get("confirm_inaccessible_old_email")',
    );
    expect(recovery).toContain("auth.refreshSession()");
  });

  it("resends the active secure flow from the authenticated current email", () => {
    const source = read(actionPath);
    const start = source.indexOf(
      "export async function resendEmailChangeAction",
    );
    const resend = source.slice(
      start,
      source.indexOf(
        "export async function correctPendingAdminEmailAction",
        start,
      ),
    );
    expect(resend).toContain("email: viewer.email");
    expect(resend).not.toContain("email: viewer.pendingEmail");
    expect(resend).toContain("options: { emailRedirectTo:");
  });

  it("keeps normal email changes and recovery in their separate UI states", () => {
    const admin = read(adminAccountPage);
    expect(admin).toContain("admin.pendingEmail ?");
    expect(admin).toContain("AdminPendingEmailForm");
    expect(admin).toContain("ChangeEmailForm");
    expect(read(customerSettingsPage)).toContain("ChangeEmailForm");
    expect(read(customerSettingsPage)).not.toContain("AdminPendingEmailForm");
  });

  it("returns stale admin email links to the protected pending state", () => {
    const callback = read(callbackRoute);
    expect(callback).toContain("providerReportedError");
    expect(callback).toContain("adminEmailChangeFailurePath");
    expect(callback).toContain("?email_change=link_expired");
    expect(callback).toContain("auth.refreshSession()");
    expect(read(continuePage)).toContain("?email_change=link_expired");
    expect(read(adminAccountPage)).toContain('emailChange === "link_expired"');
    const proxy = read(proxyPath);
    expect(proxy).toContain("staleAdminEmailChange");
    expect(proxy).toContain("/admin/account?email_change=link_expired");
  });
});

describe("Admin Users workspace (P5-T02)", () => {
  const dataPath = "src/lib/data/admin-users.ts";
  const actionPath = "src/actions/admin-users.ts";

  it("re-checks requireAdmin() in the data path, not only in the layout", () => {
    const source = read(dataPath);
    expect(source).toContain('import "server-only"');
    // One per exported read: search, detail, and the avatar resolver.
    expect(source.match(/await requireAdmin\(\)/g)?.length).toBe(3);
  });

  it("re-checks requireAdmin() in the block action too", () => {
    expect(read(actionPath)).toContain("await requireAdmin()");
  });

  it("reads the directory with the Administrator's session, not the service role", () => {
    // `is_admin()` reads `auth.uid()`, which the service role does not have,
    // and `blocked_by` attribution depends on the acting Admin's identity.
    const source = read(actionPath);
    const rpcIndex = source.indexOf('rpc("admin_set_user_blocked"');
    expect(rpcIndex).toBeGreaterThan(-1);
    const callSite = source.slice(rpcIndex - 200, rpcIndex);
    expect(callSite).toContain("createSupabaseServerClient");
    expect(callSite).not.toContain("ServiceRole");
  });

  it("exposes no password, hash, or raw Auth metadata field", () => {
    const source = code(dataPath);
    expect(source).not.toMatch(
      /password|encrypted|raw_user_meta|raw_app_meta|banned_until/i,
    );
  });

  it("offers no role editor anywhere in the workspace", () => {
    const pages = [
      "src/app/[locale]/admin/users/page.tsx",
      "src/app/[locale]/admin/users/[id]/page.tsx",
    ];
    for (const page of pages) {
      const source = read(page);
      expect(source).not.toContain('name="role"');
      expect(source).not.toContain("ADMIN");
    }
  });

  it("is no longer served by the generic module renderer", () => {
    const router = read("src/app/[locale]/admin/[module]/page.tsx");
    expect(router).not.toMatch(/^\s*"users",$/m);
    expect(read("src/lib/data/admin.ts")).not.toContain('module === "users"');
  });
});

describe("Admin customer avatar is read-only (P5-T04)", () => {
  const detail = read("src/app/[locale]/admin/users/[id]/page.tsx");

  it("renders no avatar write control", () => {
    for (const forbidden of [
      "uploadAvatarAction",
      "deleteAvatarAction",
      "AvatarForm",
      'type="file"',
    ]) {
      expect(detail).not.toContain(forbidden);
    }
  });

  it("never writes avatar_path", () => {
    expect(code("src/app/[locale]/admin/users/[id]/page.tsx")).not.toContain(
      "avatar_path",
    );
    // The whole Admin Users read path is read-only: no write call at all.
    expect(code("src/lib/data/admin-users.ts")).not.toContain(".update(");
  });

  it("resolves the avatar through the shared Phase 4 helpers, not a second system", () => {
    const source = read("src/lib/data/admin-users.ts");
    expect(source).toContain("AVATAR_BUCKET");
    expect(source).toContain("AVATAR_SIGNED_URL_TTL_SECONDS");
    // A tampered avatar_path must not be followed outside the owner's folder.
    expect(source).toContain("isOwnedAvatarPath");
  });
});

describe("Admin overview metrics are real (P5-T01)", () => {
  const dashboard = read("src/app/[locale]/admin/page.tsx");
  const data = read("src/lib/data/admin.ts");

  it("takes every stat value from the data layer", () => {
    // Each rendered stat's `value:` must reference `data.`, never a literal.
    // The `label: t(` requirement skips the array's type annotation, which
    // also contains the word `value:`.
    const values = [
      ...dashboard.matchAll(
        /\{\s*icon:[^}]*?label:\s*t\([^}]*?value:\s*([^,}\n]+)/g,
      ),
    ].map((match) => match[1].trim());
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value).toMatch(/^data\./);
  });

  it("computes those metrics from database queries", () => {
    const start = data.indexOf("export async function getAdminDashboard");
    expect(start).toBeGreaterThan(-1);
    const body = data.slice(start, start + 4000);
    expect(body).toContain("from(");
    expect(body).toContain("low_stock_threshold");
    expect(body).toContain("audit_logs");
  });
});
