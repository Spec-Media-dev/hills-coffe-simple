# Contract: Customer Account & Avatar Actions

All results use `ActionResult`. All require `requireVerifiedUser()` to pass
first (FR-016 through FR-022).

## `updateProfile({fullName, phone, companyName, address, countryCode})`

- **Effect**: updates only these allow-listed fields on the caller's own
  `profiles` row.
- **Returns**: `VALIDATION` with `fieldErrors` on bad input, `OK` on
  success. Never accepts or silently ignores a `role`/`is_blocked` field —
  the database trigger `protect_profile_block_fields()` is the backstop if
  an allow-list is ever bypassed in code (FR-015).

## `uploadAvatar(file)`

- **Effect**: server-side validates MIME type, size (≤ 5 MiB), and image
  signature/decodability regardless of what the browser reported (FR-019);
  uploads to `avatars/<auth.uid()>/...`; updates `profiles.avatar_path`;
  deletes the previous object only after the new object and profile update
  both succeed.
- **Returns**: `STORAGE_INVALID` (client-checkable failure), `STORAGE_FAILED`
  (server-side failure), or `OK` with the new avatar reference.
- **Failure handling**: if the profile update fails after upload, the
  orphaned new object is removed; if the old-object delete fails, the new
  avatar is still live and cleanup is retried/logged rather than blocking
  the user-visible success.

## `deleteAvatar()`

- **Effect**: clears `profiles.avatar_path` and deletes only the object at
  the owner's previously stored path.
- **Returns**: `OK`; UI falls back to the default avatar icon.

## `listOwnFavorites()` / `toggleFavorite(coffeeId)`

- **Effect**: reads/writes `favorites` scoped to `user_id = auth.uid()`
  only; RLS is the backstop.
- **Returns**: `NOT_FOUND` if the coffee is not visible/published,
  `OK` otherwise.

## `listOwnRequests()` / `getOwnRequest(requestCode)`

- **Effect**: reads `inquiries` + `inquiry_status_history` scoped to
  `user_id = auth.uid()` only.
- **Returns**: `NOT_FOUND` for any request not owned by the caller — never
  `FORBIDDEN`, so the response does not confirm whether the code exists at
  all for another user (avoids enumeration).

## Admin-only read: `getCustomerAvatarUrl(userId)`

- **Requires**: `requireAdmin()`.
- **Effect**: returns a short-lived signed/authenticated read reference to a
  customer's avatar object for display in the Admin user directory.
- **Explicitly forbidden**: no Admin action may write to a customer's
  `avatar_path` or avatar storage object (FR-020) — this contract is
  read-only by construction (no corresponding write function exists).
