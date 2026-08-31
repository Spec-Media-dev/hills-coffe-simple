# Phase 1 Evidence — Database/storage contract and Admin read path

**Recorded**: 2026-09-01
**Branch**: `main` · **HEAD at start**: `a36b05f`
**Phase 0**: COMPLETE, gate PASSED (see `phase-0-baseline.md`) — not re-run.

**Phase 1 task IDs**: `P1-T01`, `P1-T02`, `P1-T03`, `P1-T04`, `P1-T05` (gate).
**Executed in task-ID order**: T01 → T02 → T03 → T04 → T05.

Every result below came from a live session against the real Supabase project
on this date. Nothing is inferred from policy text alone (Constitution
Principle XIV).

---

## How the evidence was produced

Ephemeral fixture accounts were provisioned through the Auth Admin API with
`email_confirm: true`, which creates a **confirmed account without sending any
email**, on the reserved `@example.com` domain, and deleted afterwards. Final
state was verified back to the starting state:

```
profiles:   [{"id":"da71e821…","role":"ADMIN","is_blocked":false}]   (1 row, unchanged)
auth.users: shadyshref2001@gmail.com, adminhills@gmail.com            (2, unchanged)
avatars/:   []                                                        (empty)
```

The reusable harness is now a committed deliverable:

| Path                                                        | Purpose                                   |
| ----------------------------------------------------------- | ----------------------------------------- |
| `tests/integration/helpers/staging.ts`                      | fixture lifecycle                         |
| `tests/integration/authorization-contract.test.ts`          | P1-T01                                    |
| `tests/integration/blocked-user-rls.test.ts`                | P1-T04                                    |
| `tests/integration/admin-users-read-path.test.ts`           | P1-T02 / P1-T03                           |
| `tests/integration/README.md`                               | how to run, and why one suite fails today |
| `vitest.integration.config.mts`, `npm run test:integration` | separate runner                           |

`tests/integration/**` is excluded from the default `npm test`, which stays
hermetic and offline at **30/30**.

---

## P1-T01 — Authorization-boundary characterization — **PASS**

### `hills_is_verified_user()` — the customer entitlement gate

Live definition requires `role = 'USER'` **and** `is_blocked = false` **and**
`email_confirmed_at IS NOT NULL`. Measured:

| Caller                      | Result                                 | Meaning                                                                |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| unblocked, confirmed USER   | `true`                                 | entitled                                                               |
| **blocked USER**            | **`false`**                            | Constitution VII holds                                                 |
| **ADMIN** (confirmed email) | **`false`**                            | Constitution VI holds — an Admin does **not** inherit customer pricing |
| anonymous                   | `42501 permission denied for function` | not granted to `anon`                                                  |

### `hills_is_blocked()` / `is_admin()`

| Caller       | `hills_is_blocked()` | `is_admin()` |
| ------------ | -------------------- | ------------ |
| blocked USER | `true`               | `false`      |
| active USER  | `false`              | `false`      |
| ADMIN        | `false`              | `true`       |
| anon         | `false`              | `false`      |

### `admin_set_user_blocked()` — complete refusal contract

| Case                           | Result                                    |
| ------------------------------ | ----------------------------------------- |
| ADMIN → USER (block / unblock) | success (`null`), durable state written   |
| ADMIN → self                   | `42501 admin_cannot_block_self`           |
| ADMIN → another ADMIN          | `42501 only_user_accounts_can_be_blocked` |
| ADMIN → nonexistent uuid       | `P0002 target_user_not_found`             |
| non-admin customer → anyone    | `42501 admin_access_required`             |
| blocked USER → unblock self    | `42501 admin_access_required`             |
| **service-role key → anyone**  | **`42501 admin_access_required`**         |

On success it writes `is_blocked`, `blocked_at`, `blocked_by` (the acting
Admin's id) and `block_reason`; unblocking clears all four back to null.

### `protect_profile_block_fields()` — anti-self-unblock (FR-068)

| Case                                          | Result                                                        |
| --------------------------------------------- | ------------------------------------------------------------- |
| blocked USER sets own `is_blocked = false`    | `42501 profile_security_fields_not_editable`, state unchanged |
| **service-role sets `block_reason` directly** | `42501 profile_security_fields_not_editable`                  |

The trigger fires only when a block field actually changes, and requires
`hills_is_admin()`. **`admin_set_user_blocked()` is therefore the only path
that can alter block state** — even the service role cannot write these
columns directly.

### Blocked customers and Supabase Auth

A blocked customer **can still sign in** (`banned_until` is null) — the
Auth-layer ban described in `contracts/admin-users-actions.md` is a Phase 5
deliverable and is not in place. It is not a live exposure: the session it
obtains already returns `hills_is_verified_user() = false`, so every
correctly-guarded resource is closed to it. Recorded as finding **N4**.

---

## P1-T02 — `admin_list_users()` extension — **PASS (specification finalized)**

### Live contract confirmed

Signature takes **no parameters**. Returns exactly nine columns:
`id, full_name, phone, company_name, email, email_verified, registered_at,
favorites_count, inquiries_count`. Filters `WHERE p.role = 'USER'`, orders by
`u.created_at DESC`. Guard: `if not public.is_admin() then raise exception
'Forbidden'`.

| Caller                     | Result                                                       |
| -------------------------- | ------------------------------------------------------------ |
| ADMIN                      | rows returned; **Administrators never appear** in the result |
| active USER / blocked USER | `P0001 Forbidden`                                            |
| anon                       | `42501 permission denied for function`                       |
| service-role               | `P0001 Forbidden`                                            |

Confirmed absent: `is_blocked`, `avatar_path`, search, pagination — exactly
the approved extension scope.

### Deliverable

`migrations/P1-T02_admin_list_users_extension.sql` — reviewable, ready to
apply, **not yet applied**. It adds `email_query`, `name_query`,
`blocked_filter`, `page`, `page_size` (all defaulted, so the existing
zero-argument call keeps working) and returns `is_blocked`, `blocked_at`,
`block_reason`, `avatar_path`, `total_count`. `page_size` is clamped to 100
server-side. No table, no column, no role mutation, no secret.

Two details the file calls out because they are easy to get wrong:

- A `DROP` is required — `CREATE OR REPLACE` cannot change a `RETURNS TABLE`
  shape, and defaulted parameters would otherwise create an ambiguous
  overload against the existing zero-argument function.
- `CREATE FUNCTION` grants `EXECUTE` to `PUBLIC` by default. The original was
  **not** reachable by `anon`, so the migration explicitly revokes from
  `PUBLIC`/`anon` and grants to `authenticated`. Omitting that would silently
  widen reachability.

---

## P1-T03 — Regenerate generated types — **BLOCKED (dependency not met)**

The task's own precondition is "P1-T02 approved and **applied by the database
owner**". It has not been applied, so there is no new signature to generate
from. Regenerating now would either reproduce the current types or fabricate a
shape the database does not have. Deferred, with the exact command recorded in
the migration file.

---

## P1-T04 — Blocked-user RLS/storage hardening — **PARTIAL: baseline proven, application BLOCKED**

### Pre-migration baseline — C1 confirmed exploitable

Against a genuinely blocked fixture (`hills_is_blocked() = true` asserted
first), all five owner-named operations **succeeded**:

| Operation                   | Result today                           |
| --------------------------- | -------------------------------------- |
| `UPDATE` own `profiles` row | **ALLOWED** — sentinel value persisted |
| avatar upload (INSERT)      | **ALLOWED**                            |
| avatar replace (UPDATE)     | **ALLOWED**                            |
| avatar read (SELECT)        | **ALLOWED** — 70 bytes returned        |
| avatar delete (DELETE)      | **ALLOWED**                            |

Root cause, from the authoritative snapshot:

| Policy                      | `USING` / `WITH CHECK` today                                               |
| --------------------------- | -------------------------------------------------------------------------- |
| `hills_profiles_update_own` | `(id = auth.uid())`                                                        |
| `avatars_owner_insert`      | `bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text` |
| `avatars_owner_select`      | same, `USING`                                                              |
| `avatars_owner_update`      | same, both clauses                                                         |
| `avatars_owner_delete`      | same, `USING`                                                              |

Ownership only — no blocked-state predicate anywhere.

### FR-068 controls — all already green

These passed **before** the migration and must stay green after, which is what
proves the fix does not over-reach:

| Control                                                  | Result    |
| -------------------------------------------------------- | --------- |
| unblocked customer updates own profile                   | allowed   |
| unblocked customer uploads / reads / deletes own avatar  | allowed   |
| ADMIN updates own profile                                | allowed   |
| ADMIN manages own avatar                                 | allowed   |
| service role reads/manages a blocked customer's data     | allowed   |
| blocked customer self-unblock                            | denied    |
| ADMIN unblock restores `hills_is_verified_user() = true` | confirmed |
| customer reads another customer's avatar                 | denied    |
| ADMIN session overwrites a customer's avatar             | denied    |

### Deliverable

`migrations/P1-T04_blocked_user_rls_storage_hardening.sql`, tightening exactly
the five named policies and nothing else.

**Predicate choice — `NOT hills_is_blocked()`, not `hills_is_verified_user()`.**
The task text offered either. `hills_is_verified_user()` additionally requires
`role = 'USER'`, so using it would lock **Administrators out of their own
profile row and their own avatar** — a direct FR-068 violation and a broken
Admin account screen. `hills_is_blocked()` measured `false` for ADMIN, `false`
for anon, `true` only for the blocked customer, which is exactly the required
shape.

### Why application is blocked

Applying this needs DDL. The only credentials in the environment are the
PostgREST publishable and service-role keys; there is no Postgres password, no
`SUPABASE_ACCESS_TOKEN` for the Management API, no Supabase CLI, and no
`supabase/` directory. PostgREST exposes table CRUD and RPCs only — the full
list of callable functions is `admin_list_users`, `admin_set_user_blocked`,
`hills_is_admin`, `hills_is_blocked`, `hills_is_verified_user`, `is_admin`,
`is_email_verified`, `is_valid_month_array`, `show_limit`, `show_trgm`. None
executes arbitrary SQL. **The owner must run both migration files in the
Supabase SQL editor**, as a role owning `public.profiles` and
`storage.objects`.

Verification after applying is already written: `npm run test:integration`
turns the five failing cases green with no test edits.

---

## P1-T05 — PHASE 1 ACCEPTANCE GATE — **FAIL (one criterion unmet)**

| Gate criterion                                                                                       | Result                                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A blocked-profile JWT cannot pass `hills_is_verified_user()`                                         | **PASS** — returns `false`, proven by test                                            |
| A non-admin cannot alter block fields, proven by test not by source                                  | **PASS** — `42501 profile_security_fields_not_editable`; even service role is refused |
| The `admin_list_users()` extension specification is finalized and ready to apply                     | **PASS** — `P1-T02_…sql`, reviewable and complete                                     |
| Types regenerated once applied (P1-T03)                                                              | **BLOCKED** — not applied yet                                                         |
| A blocked customer's direct-client profile update and all four avatar operations are denied (FR-067) | **FAIL** — all five still succeed; fix authored, awaiting owner application           |
| Administrator/service-role access unaffected, anti-self-unblock intact (FR-068)                      | **PASS** — nine controls green                                                        |

**Gate verdict: FAIL.** Phase 1's central security requirement is not yet
satisfied in the database. It cannot be satisfied by this agent — it needs one
owner action. Reporting this as a pass would be exactly the "a route or
component existing does NOT make a feature complete" failure Principle XIV
forbids.

---

## New findings for later phases

| #      | Severity   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N1** | **HIGH**   | `requireVerifiedUser()` (`src/lib/auth/session.ts:48`) checks **only** `emailVerified`. It does not check `is_blocked` or `role === 'USER'`, and `getViewer()` does not even select `is_blocked` — the string `is_blocked` appears **nowhere in `src/`**. So the application-layer customer gate does not implement Constitution V, and an ADMIN passes it, contradicting Constitution VI. Not currently a live leak: `getProtectedPriceTiers()` (`src/lib/data/pricing.ts:7`) queries through the user's RLS-scoped client, and `hills_price_tiers_verified_users` requires `hills_is_verified_user()`, which correctly excludes both blocked users and Admins. **The database is carrying this gate alone; the app layer is a no-op, not defence in depth.** Phase 3 must fix `requireVerifiedUser()`. |
| **N2** | **HIGH**   | An **ADMIN session cannot read customer avatars**. `download`, `list` and `createSignedUrl` against another user's object all fail with "Object not found", because `avatars_owner_select` is owner-scoped and no admin-read policy exists on the bucket. `profiles.avatar_path` _is_ readable by an Admin. The approved "Admin may view customer avatars but not edit them" must therefore be implemented as a **server-side service-role `createSignedUrl`** (verified working, HTTP 200) — not by handing the Admin session the path. Phase 5.                                                                                                                                                                                                                                                        |
| **N3** | **MEDIUM** | **The service-role key is not an Administrator.** It has no `auth.uid()`, so `is_admin()` is false for it and `admin_set_user_blocked` / `admin_list_users` refuse it. Any Phase 5 server action that reaches for the service-role client to call an admin RPC will fail with `admin_access_required` / `Forbidden`; it must pass the Admin's own session.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **N4** | **MEDIUM** | Blocking is durable in `profiles` only — a blocked customer can still sign in (`banned_until` null). The Auth-ban defence-in-depth step is a Phase 5 deliverable. `authorization-contract.test.ts` asserts today's behavior and must be updated when the ban lands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **N5** | **MEDIUM** | `protect_profile_block_fields()` refuses the **service role** too, so block state can only ever change through `admin_set_user_blocked()` with a real Admin session. Admin tooling must never attempt a direct write to those four columns.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **N6** | **MEDIUM** | Data integrity: `auth.users` holds 2 accounts but `profiles` holds 1. `shadyshref2001@gmail.com` (uid `6be11094`, unconfirmed) has **no profile row**, so `getViewer()` returns `null` and the account behaves as signed-out despite valid credentials. Phase 3 should decide whether sign-in provisions a missing profile or refuses cleanly.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **N7** | **LOW**    | Deleting an Administrator who has blocked someone fails with "Database error deleting user" — `profiles.blocked_by` holds the reference. Observed and worked around in the test harness; any Admin-deletion flow needs the same care.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **N8** | **LOW**    | In `admin_set_user_blocked()`, the self-check runs **before** the role check: an Admin targeting themselves gets `admin_cannot_block_self`, never `only_user_accounts_can_be_blocked`. Phase 5 error mapping must respect that precedence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Carried from Phase 0 and still open: **F3** — `offer_price_tiers` has 0 rows, so
`hills_price_tiers_verified_users` could only be verified negatively (no
caller got rows). Positive proof that an entitled customer _receives_ tiers
needs Phase 12 fixtures.

---

## Commands and results

| Command                    | Result                                                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:integration` | **5 failed / 37 passed / 7 skipped** — the 5 are the intended C1 cases in `blocked-user-rls.test.ts`; the 7 skipped are the `admin_list_users()` extension assertions, gated behind `HILLS_ADMIN_LIST_USERS_EXTENDED=1` |
| `npm test` (hermetic)      | **PASS — 5 files, 30/30**, unchanged from Phase 0                                                                                                                                                                       |
| `npm run typecheck`        | **PASS**, 0 errors                                                                                                                                                                                                      |
| `npm run lint`             | **PASS**, 0 errors / 0 warnings                                                                                                                                                                                         |
| `npm run format:check`     | **31 files — exactly the Phase 0 baseline.** Every file Phase 1 authored is Prettier-clean; still **0 in `src/` and 0 in `tests/`**                                                                                     |

## Database changes actually executed

**None.** No DDL, no migration, no schema change, no policy change, no grant
change. The only writes were to ephemeral fixture accounts created and deleted
within the test runs, and every one of them is gone — `profiles` is back to
its single ADMIN row and the `avatars` bucket is empty.

---

# ADDENDUM — 2026-09-01, post-migration verification

Both migrations were applied by the owner. `P1-T04` as authored; `P1-T02` with
two safety-preserving corrections (single transaction around DROP/CREATE/grants,
and `search_path` hardened to `pg_catalog, public, auth`). Both corrections are
improvements: the transaction removes the window in which the function does not
exist, and putting `pg_catalog` first is the standard defence against
`search_path` manipulation in a `SECURITY DEFINER` function.

Everything below was re-derived from the **live database**, not from the
migration files.

## Live schema re-read

The project's PostgREST OpenAPI document now advertises `admin_list_users`
with `email_query`, `name_query`, `blocked_filter`, `page`, `page_size` — all
optional, so the existing no-argument call still works. Exactly one
`admin_list_users` entry exists (no ambiguous overload). The RPC list is
otherwise unchanged: `admin_list_users, admin_set_user_blocked, hills_is_admin,
hills_is_blocked, hills_is_verified_user, is_admin, is_email_verified,
is_valid_month_array, show_limit, show_trgm`.

## P1-T04 verified against real controls — **PASS**

Fresh fixtures, blocked state asserted (`hills_is_blocked() = true`,
`hills_is_verified_user() = false`) before any attempt.

### FR-067 — blocked customer denied at the DB/storage boundary

| Operation                   | Before             | After                                                                       |
| --------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `UPDATE` own `profiles` row | ALLOWED, persisted | **DENIED** — `204 No Content`, `UPDATE … RETURNING` → `[]`, value unchanged |
| avatar upload (INSERT)      | ALLOWED            | **DENIED** — `new row violates row-level security policy`                   |
| avatar replace (UPDATE)     | ALLOWED            | **DENIED** — `new row violates row-level security policy`                   |
| avatar read (SELECT)        | ALLOWED, 70 bytes  | **DENIED** — `Object not found`                                             |
| avatar delete (DELETE)      | ALLOWED            | **DENIED** — no-op, object confirmed still present                          |

### FR-068 — no over-reach

| Control                                                  | Result                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| unblocked customer updates own profile                   | allowed, persisted                                                                   |
| unblocked customer uploads / reads / deletes own avatar  | allowed                                                                              |
| **ADMIN updates own profile**                            | allowed, persisted                                                                   |
| **ADMIN manages own avatar**                             | allowed                                                                              |
| service role reads blocked customer's profile            | allowed                                                                              |
| service role downloads / lists blocked customer's avatar | allowed                                                                              |
| blocked customer self-unblock                            | denied, `is_blocked` still `true`                                                    |
| **unblocked customer tampering with block fields**       | `42501 profile_security_fields_not_editable` — trigger still fires                   |
| ADMIN unblock → capability restored                      | `hills_is_verified_user()` back to `true`; profile edit and avatar upload work again |
| customer reads another customer's avatar                 | denied                                                                               |
| ADMIN session overwrites a customer's avatar             | denied                                                                               |
| `avatars` bucket public flag                             | `false`                                                                              |

## Denial changed shape, and three assertions were corrected

Three tests failed after the migration. Investigation proved they were
asserting the **mechanism** of denial rather than the guarantee, and that the
database was behaving correctly:

Once `hills_profiles_update_own` excludes a blocked user in its `USING`
clause, that user's `UPDATE` matches **zero rows**. PostgreSQL does not raise
for an RLS-filtered `UPDATE`; the statement simply affects nothing, and
PostgREST answers `204 No Content`. The row never reaches
`protect_profile_block_fields()`, so the trigger cannot raise either. Measured
directly: `UPDATE … RETURNING` returns `[]` and the stored value is unchanged.

The assertions were changed from "an error was raised" to "zero rows were
affected **and** nothing persisted", which is a strictly stronger security
claim — an error is now accepted as an alternative pass, not required. No
assertion was weakened to obtain green, and no test that was checking a real
guarantee was removed.

Coverage was **added**, not just adjusted: because a blocked user no longer
reaches the trigger, a new case proves the trigger still fires for an
**unblocked** customer attempting to set `is_blocked` or `block_reason`
(`42501 profile_security_fields_not_editable`, values unchanged). Without it,
hardening RLS would have silently retired all live coverage of
`protect_profile_block_fields()` for ordinary customers.

## P1-T02 verified live — **PASS**

All seven previously-skipped extension assertions now run and pass: block
state and `avatar_path` on every row, `blocked_filter`, case-insensitive
partial email search, name search, pagination with a stable `total_count`,
`page_size` clamped at 100, and every non-admin caller still refused
(`P0001 Forbidden`; `42501` for `anon`). Administrators still never appear in
the result, and no password, secret, or raw metadata field is returned.

## P1-T03 — **PASS**

`src/lib/supabase/types.generated.ts` synced to the live signature. Note this
file is not CLI output: its own header describes it as a
"generated-contract equivalent … refresh with `supabase gen types typescript
--linked` when credentials are available", and those credentials still do not
exist here (no `SUPABASE_ACCESS_TOKEN`, no database password, no CLI). The
Functions block was therefore derived from the live OpenAPI document rather
than from the migration file, and the header now records that.

Updated: `admin_list_users` (five optional args, fourteen returned columns);
added `admin_set_user_blocked`, `hills_is_admin`, `hills_is_blocked`,
`hills_is_verified_user`, which were live but entirely absent from the type.
The `Profile` row type also gained the five live columns it was missing —
`avatar_path`, `is_blocked`, `blocked_at`, `blocked_by`, `block_reason` —
which Phase 3 needs in order to fix finding N1.

## P1-T05 — PHASE 1 ACCEPTANCE GATE — **PASS**

| Gate criterion                                                                   | Result                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Blocked-profile JWT cannot pass `hills_is_verified_user()`                       | **PASS**                                                            |
| Non-admin cannot alter block fields, proven by test                              | **PASS** — trigger for unblocked users, RLS filter for blocked ones |
| `admin_list_users()` extension finalized **and applied**                         | **PASS**                                                            |
| Types regenerated once applied (P1-T03)                                          | **PASS**                                                            |
| Blocked customer's profile update and all four avatar operations denied (FR-067) | **PASS**                                                            |
| Administrator/service-role access unaffected, anti-self-unblock intact (FR-068)  | **PASS**                                                            |

## Commands and results

| Command                                                      | Result                                           |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `HILLS_ADMIN_LIST_USERS_EXTENDED=1 npm run test:integration` | **PASS — 3 files, 50/50, 0 skipped**             |
| `npm test` (hermetic)                                        | **PASS — 5 files, 30/30**                        |
| `npm run typecheck`                                          | **PASS**, 0 errors                               |
| `npm run lint`                                               | **PASS**, 0/0                                    |
| `npm run build`                                              | **PASS** — compiled 2.7s, **51/51** static pages |

## Database state after verification

Returned to exactly its pre-test state: `profiles` holds one ADMIN row,
`auth.users` holds the same two accounts, the `avatars` bucket is empty and
still `public = false`. Every fixture account was deleted.

## Findings closed by this run

- **C1 / FR-067** — closed and proven.
- **N1 (HIGH) is now the top open risk.** With the database layer correct, the
  application gate is the remaining weak point: `requireVerifiedUser()`
  (`src/lib/auth/session.ts:48`) still checks only `emailVerified`. Phase 3
  must fix it. The types it needs are now in place.

All other findings (N2–N8, D1–D3, F3–F5) stand unchanged.
