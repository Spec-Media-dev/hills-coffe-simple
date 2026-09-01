import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import type { Database } from "./types.generated";

/**
 * Service-role Supabase client. **Server-only, by construction.**
 *
 * `import "server-only"` makes a client-component import a build error, and
 * the key is read from a non-`NEXT_PUBLIC_` variable so it can never be
 * inlined into a browser bundle. The key is never logged.
 *
 * This client bypasses RLS entirely, so it is deliberately confined to the two
 * operations that genuinely cannot be performed with an Administrator's own
 * session — both established as facts in Phase 1:
 *
 *  1. **Supabase Auth ban.** The Admin Auth API requires the service role.
 *  2. **Reading a customer's avatar.** `avatars_owner_select` is owner-scoped
 *     and the bucket has no admin-read policy, so an Administrator session
 *     receives "Object not found". Rather than widening that policy — which
 *     would expose every avatar to any authenticated Admin path — the server
 *     mints a short-lived signed URL here.
 *
 * It is emphatically NOT used for `admin_list_users()` or
 * `admin_set_user_blocked()`: those are `SECURITY DEFINER` functions guarded by
 * `is_admin()`, which reads `auth.uid()`. The service role has no `auth.uid()`,
 * so those calls must carry the acting Administrator's session — which is also
 * what keeps `blocked_by` attributable and the refusal contract intact.
 */
export function createSupabaseServiceRoleClient(): SupabaseClient<Database> {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service-role credentials are not configured.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceRoleCredentials() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
