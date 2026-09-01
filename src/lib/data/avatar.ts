import "server-only";
import {
  AVATAR_BUCKET,
  AVATAR_SIGNED_URL_TTL_SECONDS,
  isOwnedAvatarPath,
} from "@/lib/avatar";
import { getViewer } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolves a short-lived display URL for the signed-in customer's own avatar.
 *
 * The `avatars` bucket is private, so there is no public URL to construct. The
 * read goes through the caller's own session, which means the owner-scoped
 * `avatars_owner_select` policy is what actually authorises it — and a blocked
 * customer is refused by that policy (FR-067), not merely by application code.
 *
 * Returns `null` for every non-entitled case so callers render the default
 * icon rather than a broken image.
 */
export async function getOwnAvatarUrl(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  // A tampered avatar_path pointing outside the owner's folder is ignored.
  if (!isOwnedAvatarPath(viewer.avatarPath, viewer.id)) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(
      viewer.avatarPath as string,
      AVATAR_SIGNED_URL_TTL_SECONDS,
    );
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Initials fallback shown when no avatar object is available. */
export function avatarInitials(fullName: string, email: string) {
  const source = fullName.trim() || email.trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
