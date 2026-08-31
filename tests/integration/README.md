# Live-staging integration tests

These prove database and storage authorization by **behavior**, not by reading
policy text — Constitution Principle XIV ("a route or component existing does
NOT make a feature complete").

```bash
npm run test:integration
```

They are excluded from the default `npm test`, which stays hermetic and
offline. Without Supabase credentials every suite here reports as skipped
rather than failing.

## What they do to the database

Each run provisions ephemeral fixture accounts through the Auth Admin API with
`email_confirm: true`, which creates a **confirmed account without sending any
email**, and deletes them again in `afterAll`. Fixture addresses use the
reserved `@example.com` domain and a per-run tag, so they can never collide
with a real account.

Two ordering rules matter, both learned the hard way:

- **USER fixtures are deleted before ADMIN fixtures.** `profiles.blocked_by`
  references the acting Administrator, so deleting the Admin first fails with
  "Database error deleting user" and leaves a stray privileged account behind.
- **An ADMIN fixture is required for any admin-guarded RPC.** The service-role
  key has no `auth.uid()`, so `is_admin()` is false for it and
  `admin_set_user_blocked` / `admin_list_users` refuse it with
  `admin_access_required` / `Forbidden`. Service role is not an Administrator.

## Suites

| File                             | Purpose                                                                                                                                                                        | Expected today                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `authorization-contract.test.ts` | P1-T01 characterization of `hills_is_verified_user()`, `hills_is_blocked()`, `is_admin()`, `admin_set_user_blocked()`'s refusal contract, and `protect_profile_block_fields()` | **passes**                      |
| `blocked-user-rls.test.ts`       | P1-T04 enforcement of FR-067 / FR-068                                                                                                                                          | **fails by design** — see below |
| `admin-users-read-path.test.ts`  | P1-T02 / P1-T03 `admin_list_users()` contract                                                                                                                                  | passes; extension block skipped |

## Why `blocked-user-rls.test.ts` fails right now

That is analysis finding **C1**, and the failure is the point. Today
`hills_profiles_update_own` and the four `avatars_owner_*` storage policies
enforce ownership only, with no blocked-state predicate, so a blocked customer
holding a still-valid session can update their own profile row and
upload/replace/read/delete their avatar with a direct client call — bypassing
the application's `requireVerifiedUser()` gate entirely.

The suite asserts the secure end state. It turns green when the owner applies:

```
specs/001-platform-implementation-spec/migrations/P1-T04_blocked_user_rls_storage_hardening.sql
```

The FR-068 control cases in the same file (unblocked customer, Administrator,
service role, anti-self-unblock) pass **both** before and after, and are what
proves the fix did not over-reach.

Once the owner also applies
`P1-T02_admin_list_users_extension.sql`, set
`HILLS_ADMIN_LIST_USERS_EXTENDED=1` to enable the extension assertions in
`admin-users-read-path.test.ts`.
