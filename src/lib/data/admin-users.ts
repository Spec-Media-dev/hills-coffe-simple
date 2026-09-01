import "server-only";
import {
  AVATAR_BUCKET,
  AVATAR_SIGNED_URL_TTL_SECONDS,
  isOwnedAvatarPath,
} from "@/lib/avatar";
import { requireAdmin } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseServiceRoleClient,
  hasServiceRoleCredentials,
} from "@/lib/supabase/service-role";

export const ADMIN_USERS_PAGE_SIZE = 20;

export type AdminUserRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  emailVerified: boolean;
  registeredAt: string;
  favoritesCount: number;
  inquiriesCount: number;
  isBlocked: boolean;
  blockedAt: string | null;
  blockReason: string | null;
  avatarPath: string | null;
};

export type AdminUserSearch = {
  emailQuery?: string;
  nameQuery?: string;
  blockedFilter?: boolean;
  page: number;
};

export type AdminUserPage = {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  configured: boolean;
};

const clean = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Paginated, searchable customer directory.
 *
 * `requireAdmin()` is re-checked here rather than inherited from the Admin
 * layout: a data function must not assume the caller reached it through a
 * guarded route. The database enforces it a third time — `admin_list_users()`
 * is `SECURITY DEFINER` behind an `is_admin()` guard that raises `Forbidden`
 * for every non-Admin caller, including the service role.
 *
 * The RPC is deliberately called with the **Administrator's own session**, not
 * the service role: `is_admin()` reads `auth.uid()`, which the service role
 * does not have. It returns `role = 'USER'` rows only, so an Administrator can
 * never appear in the customer directory, and it exposes no password, hash, or
 * raw Auth metadata.
 */
export async function searchAdminUsers(
  search: AdminUserSearch,
): Promise<AdminUserPage> {
  const pageSize = ADMIN_USERS_PAGE_SIZE;
  const page =
    Number.isFinite(search.page) && search.page > 0 ? search.page : 1;
  const empty: AdminUserPage = {
    rows: [],
    total: 0,
    page,
    pageSize,
    pageCount: 0,
    configured: false,
  };

  const admin = await requireAdmin();
  if (!admin) return empty;
  if (!isSupabaseConfigured()) return empty;

  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("admin_list_users", {
    email_query: clean(search.emailQuery) ?? null,
    name_query: clean(search.nameQuery) ?? null,
    blocked_filter:
      search.blockedFilter === undefined ? null : search.blockedFilter,
    page,
    page_size: pageSize,
  });

  if (error) {
    // Never surface a provider error to the UI; log it for diagnosis instead.
    console.error(`[admin-users] directory read failed. adminId=${admin.id}`);
    return { ...empty, configured: true };
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    companyName: row.company_name,
    emailVerified: row.email_verified,
    registeredAt: row.registered_at,
    favoritesCount: Number(row.favorites_count),
    inquiriesCount: Number(row.inquiries_count),
    isBlocked: row.is_blocked,
    blockedAt: row.blocked_at,
    blockReason: row.block_reason,
    avatarPath: row.avatar_path,
  }));

  // `total_count` is the count across the whole filtered set, so pagination
  // stays correct without a second round trip.
  const total = Number(data?.[0]?.total_count ?? 0);
  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    configured: true,
  };
}

/**
 * Single-customer detail. Reuses the same guarded read path, so there is no
 * second, weaker way to reach customer data.
 *
 * Returns `null` — never a distinguishable "forbidden" — for an id that is not
 * a visible customer, so the response cannot be used to probe whether an
 * account exists.
 */
export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserRow | null> {
  const admin = await requireAdmin();
  if (!admin || !isSupabaseConfigured()) return null;

  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("admin_list_users", {
    email_query: null,
    name_query: null,
    blocked_filter: null,
    page: 1,
    page_size: 100,
  });
  if (error) return null;

  const match = (data ?? []).find((row) => row.id === userId);
  if (!match) return null;
  return {
    id: match.id,
    fullName: match.full_name,
    email: match.email,
    phone: match.phone,
    companyName: match.company_name,
    emailVerified: match.email_verified,
    registeredAt: match.registered_at,
    favoritesCount: Number(match.favorites_count),
    inquiriesCount: Number(match.inquiries_count),
    isBlocked: match.is_blocked,
    blockedAt: match.blocked_at,
    blockReason: match.block_reason,
    avatarPath: match.avatar_path,
  };
}

/**
 * Short-lived, read-only display URL for a customer's avatar.
 *
 * The bucket is private and `avatars_owner_select` is owner-scoped, so an
 * Administrator's own session cannot read another customer's object (proven in
 * Phase 1, finding N2). Rather than adding a broad admin-read storage policy —
 * which would widen access for every authenticated Admin code path — the
 * server mints a signed URL with the service role and hands back only the URL.
 *
 * This is read-only by construction: there is no corresponding write helper,
 * and no Admin action anywhere may modify a customer's `avatar_path` or
 * storage object (FR-020).
 */
export async function getAdminCustomerAvatarUrl(
  userId: string,
  avatarPath: string | null,
): Promise<string | null> {
  const admin = await requireAdmin();
  if (!admin) return null;
  if (!isSupabaseConfigured() || !hasServiceRoleCredentials()) return null;
  // A path outside the customer's own folder is treated as absent rather than
  // followed, so a tampered avatar_path cannot be used to read anything else.
  if (!isOwnedAvatarPath(avatarPath, userId)) return null;

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath as string, AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
