# Contract: Admin User Directory & Blocking Actions

All results use `ActionResult`. All require `requireAdmin()` to pass first,
independently re-checked in each function (FR-024).

## `searchUsers({emailQuery?, nameQuery?, blockedFilter?, page, pageSize})`

- **Effect**: paginated, searchable read over customer accounts. The
  currently-live `admin_list_users()` RPC returns `id, full_name, phone,
  company_name, email, email_verified, registered_at, favorites_count,
  inquiries_count` for `role = 'USER'` rows only — it does **not** currently
  return `is_blocked`/`avatar_path`, and has no search or pagination
  parameters. **Owner-approved extension** (decided during consistency
  analysis, `plan.md` Phase 1 / `tasks.md` `P1-T02`): extend this read path,
  using the current database contract only (no new table/column), to
  additionally support:
  - search by email (`emailQuery`, case-insensitive partial match),
  - search by name (`nameQuery`, case-insensitive partial match),
  - pagination (`page`/`pageSize`, server-side, capped),
  - blocked/unblocked filter and the `is_blocked` value in each row,
  - `avatar_path` (or an equivalent safe avatar reference) in each row,
  - verification/account state (`email_verified`, `registered_at`) — already
    returned today, carried through unchanged.
  This is an additive read-path change (extending `admin_list_users()` or
  adding a second Admin-only RPC) — it does not alter any table, does not
  expose a password or secret, and does not introduce any role-editing
  capability.
- **Returns**: `OK` with a page of results including block state and an
  avatar reference; never a password or an editable role control (FR-025).

## `getUserDetail(userId)`

- **Effect**: single-customer detail read: profile fields, avatar reference,
  verification state, block state/history, favorites count, and inquiry
  history summary.
- **Returns**: `NOT_FOUND` if the target is not a `role = 'USER'` row (an
  Admin looking up another Admin through this tool is out of scope, matching
  FR-027's "standard Users tool" boundary), `OK` otherwise.

## `setUserBlocked(userId, blocked, reason?)`

- **Effect**: calls `admin_set_user_blocked(userId, blocked, reason)`
  (already live). On block, additionally attempts a Supabase Auth Admin ban
  via the service-role client as defense-in-depth (see `research.md` §5).
- **Returns**:
  - `FORBIDDEN` if the database function raises `admin_cannot_block_self`,
    `only_user_accounts_can_be_blocked`, or a non-admin-caller error — these
    map directly to FR-026/FR-027's refusal cases.
  - `NOT_FOUND` if `target_user_not_found`.
  - `OK` on success. If the durable block succeeded but the Auth-ban call
    failed, still return `OK` for the durable effect but attach a
    non-blocking operational warning distinct from the domain error set,
    surfaced to the Admin as "blocked; authentication-layer sync pending
    retry" — never rolled back and never reported as a hard failure, per
    `research.md` §5.
- **Effect on the target's active session**: because every protected
  read/write independently checks `hills_is_verified_user()`/`is_admin()`
  (which both read `is_blocked` live), the block takes effect on the
  customer's very next request without any session/token invalidation step
  being required (FR-029).

## `unblockUser(userId)`

- **Effect**: `admin_set_user_blocked(userId, false)`; removes the Auth ban
  if one was applied.
- **Returns**: `OK`. Explicitly does **not** create a new session for the
  customer (FR-028) — the next customer sign-in is a normal, fresh
  `signIn()` call.
