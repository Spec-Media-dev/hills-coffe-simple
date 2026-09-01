/**
 * Customer avatar storage rules. Pure validation and path logic with no
 * secrets or I/O, so it is safe in any environment; the DB- and
 * session-touching resolver lives in `lib/data/avatar.ts` and is server-only.
 *
 * Shared by the customer upload/delete actions and, in Phase 5, the Admin
 * read-only viewer.
 *
 * The `avatars` bucket is private and owner-folder-scoped by RLS. Nothing here
 * relaxes that: the storage policies remain the enforcement boundary, and this
 * module is the first line of defence, never the only one.
 */
export const AVATAR_BUCKET = "avatars";

/** Matches the bucket's configured limit. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

const EXTENSION: Record<AvatarMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Identifies the format from the file's own bytes.
 *
 * The browser-reported `type` is attacker-controlled, so it is never trusted
 * on its own (FR-019). A file is accepted only when its declared type and its
 * actual signature agree.
 */
export function sniffImageType(bytes: Uint8Array): AvatarMimeType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b))
    return "image/png";

  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";

  return null;
}

export type AvatarRejection =
  "empty" | "too_large" | "unsupported_type" | "signature_mismatch";

export type AvatarValidation =
  | { ok: true; mimeType: AvatarMimeType; bytes: Uint8Array }
  | { ok: false; reason: AvatarRejection };

/**
 * Validates the uploaded bytes. Size is re-measured from the buffer rather
 * than trusting `File.size`, and the signature must match the declared type.
 */
export function validateAvatarBytes(
  bytes: Uint8Array,
  declaredType: string,
): AvatarValidation {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > AVATAR_MAX_BYTES)
    return { ok: false, reason: "too_large" };

  const declared = AVATAR_MIME_TYPES.find((type) => type === declaredType);
  if (!declared) return { ok: false, reason: "unsupported_type" };

  const actual = sniffImageType(bytes);
  if (!actual) return { ok: false, reason: "signature_mismatch" };
  // A PNG renamed to .jpg, or a script with an image extension, is refused.
  if (actual !== declared) return { ok: false, reason: "signature_mismatch" };

  return { ok: true, mimeType: actual, bytes };
}

/**
 * Builds the storage path from the owner's id — never from client input.
 *
 * The first path segment must equal `auth.uid()` for the `avatars_owner_*`
 * policies to permit the operation, so deriving it server-side means a
 * client-supplied path (including traversal attempts) can never be used.
 * The random suffix makes replacement a distinct object, which avoids serving
 * a stale cached image after an update.
 */
export function buildAvatarPath(userId: string, mimeType: AvatarMimeType) {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${userId}/avatar-${unique}.${EXTENSION[mimeType]}`;
}

/**
 * True when a stored path actually belongs to this owner.
 *
 * Used before deleting a previously-recorded path, so a tampered
 * `profiles.avatar_path` can never make the server delete another customer's
 * object. Storage RLS would refuse anyway; this fails earlier and louder.
 */
export function isOwnedAvatarPath(path: string | null, userId: string) {
  if (!path) return false;
  if (path.includes("..") || path.startsWith("/")) return false;
  return path.split("/")[0] === userId;
}

/** How long an avatar display URL stays valid. Short, because it is re-minted per render. */
export const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 10;
