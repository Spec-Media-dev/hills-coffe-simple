"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fail,
  ok,
  type ActionFormState,
  type ActionResult,
} from "@/lib/actions";
import { requireAdmin } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseServiceRoleClient,
  hasServiceRoleCredentials,
} from "@/lib/supabase/service-role";

/**
 * Admin customer blocking (`contracts/admin-users-actions.md`).
 *
 * Two layers, in a fixed order that must not be reversed:
 *
 *  1. **`admin_set_user_blocked()` is the durable authority.** It is a
 *     `SECURITY DEFINER` function whose own guards refuse a non-admin caller,
 *     a self-target, and a non-`USER` target, and which stamps `blocked_by`
 *     from `auth.uid()`. It therefore runs on the acting Administrator's
 *     session, never on the service role — the service role has no
 *     `auth.uid()` and would both fail `is_admin()` and lose attribution.
 *  2. **The Supabase Auth ban is defense in depth only.** If it fails, the
 *     durable block already holds and is never rolled back; the Admin is told
 *     the authentication-layer sync is pending retry (`research.md` §5).
 *
 * A block needs no session invalidation to take effect: every protected path
 * re-reads `is_blocked` live through `hills_is_verified_user()` and
 * `requireVerifiedUser()`, so an already-issued customer session loses
 * protected capability on its very next request.
 */

/** Long enough to be indefinite in practice; Supabase has no "forever" value. */
const BAN_DURATION = "876000h";

export type BlockActionData = {
  /** True when the durable block succeeded but the Auth-ban sync did not. */
  authSyncPending: boolean;
};

const schema = z.object({
  userId: z.string().uuid(),
  blocked: z.enum(["true", "false"]),
  reason: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().max(500).nullable().optional(),
  ),
});

/**
 * Maps the database function's own refusal messages onto the closed domain
 * error set. Only these exact, known messages are translated; anything else
 * becomes `UNEXPECTED`, so no Postgres text can ever reach the browser
 * (Constitution Principle XII).
 */
function mapRpcError(message: string | undefined): ActionResult {
  switch (message) {
    case "admin_cannot_block_self":
      return fail("FORBIDDEN", "cannotBlockSelf");
    case "only_user_accounts_can_be_blocked":
      return fail("FORBIDDEN", "onlyCustomersCanBeBlocked");
    case "admin_access_required":
      return fail("FORBIDDEN", "adminRequired");
    case "target_user_not_found":
      return fail("NOT_FOUND", "userNotFound");
    case "target_user_required":
      return fail("VALIDATION", "validation");
    default:
      return fail("UNEXPECTED", "unexpected");
  }
}

/**
 * Applies or lifts the authentication-layer ban.
 *
 * Returns `false` for any failure — including no configured service-role key —
 * so the caller reports "sync pending" rather than pretending the second layer
 * is in place. Nothing about the key or the provider error is returned to the
 * client; the message is logged server-side for reconciliation.
 */
async function syncAuthBan(userId: string, blocked: boolean): Promise<boolean> {
  if (!hasServiceRoleCredentials()) return false;
  try {
    const service = createSupabaseServiceRoleClient();
    const { error } = await service.auth.admin.updateUserById(userId, {
      ban_duration: blocked ? BAN_DURATION : "none",
    });
    if (error) {
      console.error(
        `[admin-users] auth ban sync failed. userId=${userId} blocked=${blocked} reason=${error.message}`,
      );
      return false;
    }
    return true;
  } catch {
    console.error(
      `[admin-users] auth ban sync threw. userId=${userId} blocked=${blocked}`,
    );
    return false;
  }
}

export async function setUserBlockedAction(
  _state: ActionFormState<BlockActionData>,
  formData: FormData,
): Promise<ActionResult<BlockActionData>> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("VALIDATION", "validation", {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }
  const { userId, reason } = parsed.data;
  const blocked = parsed.data.blocked === "true";

  // Authorization is re-checked here and not inherited from the Admin layout.
  const admin = await requireAdmin();
  if (!admin) {
    return fail("FORBIDDEN", "adminRequired");
  }
  if (!isSupabaseConfigured()) {
    return fail("CONFIGURATION", "notConfigured");
  }
  // Refused in the application too, not only by the database function: the two
  // are independent layers of one rule (Constitution Principle VII), and this
  // one produces the precise domain error without a round trip.
  if (userId === admin.id) {
    return fail("FORBIDDEN", "cannotBlockSelf");
  }

  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_set_user_blocked", {
    target_user_id: userId,
    blocked,
    // The reason is internal and Admin-only; it is cleared by the function
    // itself on unblock, so it is never carried across a block cycle.
    reason: blocked ? (reason ?? null) : null,
  });
  if (error) return mapRpcError(error.message);

  // Durable state is now committed. From here nothing may fail the operation.
  const synced = await syncAuthBan(userId, blocked);

  revalidatePath("/[locale]/admin/users", "page");
  revalidatePath("/[locale]/admin/users/[id]", "page");

  const messageKey = blocked
    ? synced
      ? "userBlocked"
      : "userBlockedAuthSyncPending"
    : synced
      ? "userUnblocked"
      : "userUnblockedAuthSyncPending";

  return ok<BlockActionData>(messageKey, { authSyncPending: !synced });
}
