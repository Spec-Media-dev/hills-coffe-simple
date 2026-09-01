import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types.generated";
import { hasRecoveryMarker } from "@/lib/auth/recovery";

export type Viewer = {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  countryCode: string | null;
  role: AppRole;
  isBlocked: boolean;
  avatarPath: string | null;
};

/**
 * `public.profiles.role` is the sole authorization authority (Constitution
 * Principle IV). Auth user metadata is never consulted for role, because it is
 * client-writable.
 *
 * `is_blocked` is selected here so every application-layer guard can see it —
 * before Phase 3 it was not read at all, which left `requireVerifiedUser()`
 * unable to honor Principle VII (finding N1).
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id,full_name,phone,company_name,address,country_code,role,is_blocked,avatar_path",
    )
    .eq("id", user.id)
    .maybeSingle();
  // No profile row means the account is not provisioned for this application,
  // so it is treated as unauthenticated rather than partially trusted.
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    fullName: profile.full_name,
    phone: profile.phone,
    companyName: profile.company_name,
    address: profile.address,
    countryCode: profile.country_code,
    role: profile.role,
    isBlocked: Boolean(profile.is_blocked),
    avatarPath: profile.avatar_path ?? null,
  };
});

export async function requireUser() {
  return getViewer();
}

/**
 * The protected-customer gate (Constitution Principles V, VI and VII):
 *
 *   authenticated AND email-confirmed AND role = USER AND NOT blocked
 *
 * All four conditions are required. In particular:
 *  - an ADMIN never passes, so an Administrator cannot inherit customer
 *    protected-price entitlement merely by having a confirmed email
 *    (Principle VI);
 *  - a blocked customer never passes, even holding a previously-issued
 *    session, so a block takes effect at the application layer and not only
 *    in RLS (Principle VII).
 *
 * This mirrors the database's `hills_is_verified_user()` exactly, by design:
 * the two are independent enforcement layers of one rule, not a replacement
 * for one another.
 */
export async function requireVerifiedUser() {
  if (await hasRecoveryMarker()) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  if (!viewer.emailVerified) return null;
  if (viewer.isBlocked) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }
  if (viewer.role !== "USER") return null;

  // Compose the live database helper instead of letting this application
  // check become a parallel definition that can drift from RLS.
  const supabase = await createSupabaseServerClient();
  const { data: entitled, error } = await supabase.rpc(
    "hills_is_verified_user",
  );
  return !error && entitled === true ? viewer : null;
}

/**
 * The own-account gate: authenticated AND email-confirmed AND NOT blocked,
 * for **either** role.
 *
 * This exists because `requireVerifiedUser()` is deliberately narrower — it
 * also requires `role = 'USER'`, which is what stops an Administrator
 * inheriting customer protected-price entitlement (Principle VI). Applying
 * that same gate to "edit your own name / email / password" locked
 * Administrators out of their own account page, which is a different question
 * from entitlement.
 *
 * What this gate grants is strictly self-scoped: it returns the caller's own
 * viewer and nothing else. It confers no customer entitlement and no Admin
 * capability, so it must never be substituted for `requireVerifiedUser()` on a
 * pricing/favorites path or for `requireAdmin()` on an Admin path. Every write
 * behind it is additionally constrained to `auth.uid()` by RLS.
 */
export async function requireAccountOwner() {
  if (await hasRecoveryMarker()) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  if (!viewer.emailVerified) return null;
  if (viewer.isBlocked) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  // Composed against the live database helper for the same reason
  // `requireVerifiedUser()` is: the application check must not become a second
  // definition that can drift from RLS.
  const supabase = await createSupabaseServerClient();
  const { data: blocked, error } = await supabase.rpc("hills_is_blocked");
  return !error && blocked === false ? viewer : null;
}

/**
 * Administrator gate. `is_blocked` is checked defensively: the database
 * refuses to block a non-USER row (`only_user_accounts_can_be_blocked`), so
 * this should be unreachable, but an Administrator flagged by any future path
 * must not retain Admin capability.
 */
export async function requireAdmin() {
  if (await hasRecoveryMarker()) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  if (viewer.role !== "ADMIN") return null;
  if (viewer.isBlocked) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: entitled, error } = await supabase.rpc("is_admin");
  return !error && entitled === true ? viewer : null;
}

/** True when a signed-in customer exists but has not confirmed their email. */
export async function isAwaitingVerification() {
  const viewer = await getViewer();
  return Boolean(viewer && !viewer.emailVerified);
}
