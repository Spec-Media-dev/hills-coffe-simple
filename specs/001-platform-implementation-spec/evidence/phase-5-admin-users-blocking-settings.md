# Phase 5 Evidence — Admin authorization, users, blocking, and settings

**Recorded**: 2026-09-01
**Branch**: `main`, Phases 0–4 committed
**Phases 0–4**: not redone. Re-run as regressions only.

**Scope check before editing**: `tasks.md:499` and `plan.md:623` both define
Phase 5 as "Admin authorization, users, blocking, and settings". Matches the
instruction, so implementation proceeded.

**Path deviation, recorded not silently applied**: `tasks.md` P5-T01/T05 name
`src/app/(admin)/admin/**`. Phase 2's owner-accepted decision kept the Admin
workspace at `src/app/[locale]/admin/**` (only `dashboard-admin` and
`admin/login` live under `(admin)`). The real tree was used; nothing was moved,
per the standing "no architecture move without a routing justification" rule.

**Pre-flight**: `P4-T08` is `[X]`; the Phase 1 `admin_list_users()` extension is
live (verified against the live signature — `blocked_filter, email_query,
name_query, page, page_size` — and the generated types carrying `is_blocked`,
`blocked_at`, `block_reason`, `avatar_path`, `total_count`); blocked-user
hardening re-verified green.

---

## P5-T01 — Admin overview — **PASS** (verification only)

No dashboard logic was rebuilt. `getAdminDashboard()` was read end to end and
every figure is a live query: distinct published coffees derived from offers,
the bag sum, low stock compared against `site_settings.low_stock_threshold`,
open inquiries, and recent `audit_logs` activity. No constant, no placeholder.

Proven two ways rather than by reading:

- a unit invariant that every rendered stat's `value:` resolves through
  `data.` and that `getAdminDashboard` really queries the database
  (`src/lib/admin-boundaries.test.ts`);
- a browser check that all four cards render numeric values in EN **and** AR,
  with `lang="ar"`/`dir="rtl"` and no English heading leaking, and zero console
  errors.

`requireAdmin()` still guards the route: the layout redirects, and the
persona suite proves a customer and an anonymous visitor both land on
`/dashboard-admin` instead.

## P5-T02 — Admin Users workspace — **PASS**

New: `src/lib/data/admin-users.ts` (read path) and
`src/app/[locale]/admin/users/{page,[id]/page}.tsx`.

The generic `[module]` renderer no longer serves `users`: the entry was removed
from the `modules` array **and** the `users` branch was removed from
`src/lib/data/admin.ts`, so there is exactly one customer-directory read path.
Every other module is untouched.

Design decisions worth recording:

1. **The RPC runs on the Administrator's own session, never the service role.**
   `is_admin()` reads `auth.uid()`, which the service role does not have
   (Phase 1 finding N3), and `blocked_by` attribution depends on the acting
   Admin's identity. A unit invariant pins this so a later "optimisation"
   cannot swap the client.
2. **`requireAdmin()` is re-checked in the data path**, once per exported
   read — not inherited from the layout. The database is the third layer:
   `admin_list_users()` is `SECURITY DEFINER` behind `is_admin()` and raises
   `Forbidden` for everyone else, service role included.
3. **State lives in the URL**, so search/filter/page are applied by the
   database, the result set is bounded, and an Admin can hand a colleague a
   link. `total_count` comes back on each row, so pagination needs no second
   round trip.
4. **A tampered `avatar_path` is treated as absent, not followed**
   (`isOwnedAvatarPath`).

Exposed: name, email, phone, optional company, verification state, registered
date, favourites and request counts, block state, blocked timestamp, internal
reason, avatar reference, total count. Not exposed, and asserted absent:
password, hash, `raw_user_meta`/`raw_app_meta`, `banned_until`, and any role
editor. `admin_list_users()` returns `role = 'USER'` rows only, so an
Administrator cannot appear in the customer directory — asserted in the browser
against two real Admin fixtures.

## P5-T03 — Block / unblock with Auth-ban synchronization — **PASS**

New: `src/actions/admin-users.ts` and `src/lib/supabase/service-role.ts`.

**Layer 1 — durable and authoritative.** `admin_set_user_blocked()` is called
unchanged. Its own guards refuse a self-target, a non-`USER` target, a missing
target and a non-admin caller; the action maps those exact messages onto the
closed `DomainErrorCode` set and everything else to `UNEXPECTED`, so no
Postgres text can reach a browser. Self-block is additionally refused in the
application before the round trip — two independent layers of one rule.

**Layer 2 — defense in depth only.** The Supabase Auth ban is applied through
the dedicated server-only service-role module. If it fails, the durable block
is **never** rolled back and **never** reported as a failure: the action still
returns `OK`, with a distinct `authSyncPending` flag and its own message key,
which the UI renders as a warning toast rather than a success or an error. The
same is true for unblock.

Proven against the real database, not by reading:

| Claim                                                                                     | Evidence                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Block takes effect on an already-issued session's **very next request**, with no sign-out | `hills_is_verified_user()` flips `true` → `false` on the same client; in the browser, a customer signed in _before_ the block is bounced from `/account` immediately after it |
| Attribution is real                                                                       | `blocked_by` = the acting Admin's id, `blocked_at` set, `block_reason` stored — all written by the SECURITY DEFINER function from `auth.uid()`, so they cannot be forged      |
| The Auth ban actually bans                                                                | after `ban_duration`, a fresh sign-in is refused                                                                                                                              |
| The Auth ban is **not** what enforces the rule                                            | with the ban lifted and `is_blocked` still true, the customer signs in and is still denied every protected capability                                                         |
| Unblock restores capability and clears the internal reason                                | `is_blocked`/`blocked_at`/`blocked_by`/`block_reason` all null afterwards                                                                                                     |
| Unblock creates no session (FR-028)                                                       | a brand-new browser context is still anonymous and is sent to `/sign-in`                                                                                                      |
| Self-block and Admin-target block are impossible                                          | neither Admin is reachable through the directory (404), and both remain unblocked                                                                                             |
| A customer cannot reach any of it                                                         | `/admin/users`, a detail route, and `/ar/admin/users` all redirect a verified customer to `/dashboard-admin`                                                                  |

**Service-role boundary.** `import "server-only"`, a non-`NEXT_PUBLIC_`
variable, never logged, and — asserted by a scan of every file under `src/` —
constructed nowhere else and imported by no client component. The one other
reader of that secret, `auth/recovery.ts`, uses it as HMAC key material (not to
build a client) and is itself `server-only`; that is now pinned too.

## P5-T04 — Admin user detail with read-only avatar — **PASS**

`src/app/[locale]/admin/users/[id]/page.tsx`.

The avatar reuses Phase 4's constants and path guard rather than growing a
second avatar system. Because `avatars_owner_select` is owner-scoped, an
Administrator's own session genuinely cannot read a customer's object — so the
server mints a short-lived signed URL with the service role and hands back only
the URL. **No broad Admin storage-read policy was added**, exactly as
instructed; the storage policies are byte-identical to Phase 1's.

Read-only is proven from both ends:

- the page renders no file input, no upload/delete control, no role editor, and
  the read path contains no write call at all (asserted, not asserted-by-eye);
- against the live backend, an Administrator session cannot download,
  overwrite, or delete a customer's avatar object, and cannot repoint their
  `avatar_path` — while the service-role signed URL returns `200` with an image
  content type.

A non-customer id — including another Administrator — returns `404`, never a
distinguishable "forbidden", so the view cannot be used to probe for accounts.

## P5-T05 — Settings independence — **PASS**, and two real defects fixed

Verification found the three areas structurally independent (three separate
forms, three separate actions, per-form `useActionState`), and confirmed it in
the browser: a wrong-password submission raises an alert on the password form
while the profile form keeps its unsaved text and the stored profile is
untouched — and the profile then still saves.

It also found that **two of the three did not work at all**:

1. **An Administrator could not manage their own account.**
   `updateProfileAction`, `changeEmailAction` and `changePasswordAction` all
   ran behind `requireVerifiedUser()`, which by design returns `null` for an
   ADMIN (Constitution VI). Every submission on `/admin/account` came back
   "Your session expired." The forms rendered; nothing they did worked.

   Fixed with a new, narrower gate — `requireAccountOwner()`: authenticated AND
   email-confirmed AND not blocked, for either role, composed against the live
   `hills_is_blocked()` helper the same way `requireVerifiedUser()` composes
   `hills_is_verified_user()`. It is strictly self-scoped: it returns only the
   caller's own viewer, grants no customer entitlement and no Admin capability,
   and every write behind it is still constrained to `auth.uid()` by RLS.
   `requireVerifiedUser()` is unchanged and still guards pricing, favorites and
   the customer avatar. The email-confirmation link now also returns an Admin to
   `/admin/account` rather than to a customer page they cannot reach.

2. **Site settings could never be saved.** `updateSiteSettingsAction` validated
   `id` as a uuid, but `site_settings` is a single-row table keyed by a
   `smallint` (`id = 1`). Every submission failed validation with "Invalid
   UUID". `types.generated.ts` declared the same wrong type. Both corrected —
   application-side only, **no database change**.

Now proven in the browser: an Admin saves their own name and company (role
untouched, still `ADMIN`); rotates their own password and signs back in with
it; requests an email change that is authorized and passes to Supabase Auth
without committing anything locally; and saves a real `low_stock_threshold`
that the database reflects, while an invalid submission leaves the stored value
alone. No password or email is ever stored in `public.profiles`.

## Admin routing / shell — verified, unchanged

`/dashboard-admin` and `/ar/dashboard-admin` remain the canonical entry; the
Admin route migration was not restarted and no Admin file was moved. Admin
credentials reach the workspace, customer credentials are denied, anonymous
visitors reach the Admin login, EN and AR reach the same implementation, no
redirect loop, no locale leakage, and no public navigation link anywhere on `/`
or `/ar` points at `/admin` or `/dashboard-admin`.

---

## Test results

| Suite                                             | Result                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm test` (unit)                                 | **84/84**, 11 files (was 67/67 — +17 Phase 5 invariants)                                      |
| `npm run test:integration`                        | **74/74** (was 62/62 — +12 Phase 5)                                                           |
| `npm run test:e2e` (production, desktop + mobile) | **165 passed, 51 skipped, 0 failed** in 5.5 min against a freshly started server (was 146/32) |
| `npm run test:e2e:dev` (Phase 2 locale/runtime)   | **73/73**                                                                                     |
| `admin-users.spec.ts`                             | **13/13**                                                                                     |
| `admin-settings.spec.ts`                          | **6/6**                                                                                       |
| `auth-state-machine.spec.ts` (Phase 3)            | **12/12**                                                                                     |
| `npm run typecheck`                               | PASS, 0 errors                                                                                |
| `npm run lint`                                    | PASS, 0 errors / 0 warnings                                                                   |
| `npm run build`                                   | PASS, 58/58 static pages                                                                      |
| `npm run format:check`                            | 41 docs/tooling files (the pre-existing F5 baseline); **0 in `src/`, `tests/`, `messages/`**  |

### Three test changes, none weakening

1. **The `admin_list_users()` extension tests no longer skip.** They were gated
   behind `HILLS_ADMIN_LIST_USERS_EXTENDED=1` while the owner-approved
   migration was pending. It is applied and Phase 5 depends on it, so the gate
   was removed and those seven assertions now always run. Strictly more
   coverage.
2. **The Phase 3 three-minute countdown test became hydration-aware.** It was
   fast-forwarding the fake clock before the client effect had set the
   countdown's deadline, so the deadline moved with the clock and the timer
   never expired (it read `2:53`, not `0:00`). The test now proves the timer is
   actually live — one real tick off the server-rendered `3:00` — before
   jumping past three minutes. It exercises strictly more than before. Not a
   Phase 5 regression: nothing in this phase touches that path, and the test
   fails the same way in isolation.
3. **The Admin email-change test asserts the authorization boundary, not
   delivery.** The staging Supabase project rejects `@example.com` as an
   outbound address, so a fixture address cannot prove that the mail was sent.
   The test instead proves what Phase 5 changed — the request is authorized
   rather than refused as "session expired" — and that the surfaced message
   comes from the localized catalog, never from the provider.

### Suite stability — a real cause found, not a flake dismissed

Three consecutive full runs failed, each on a **different, disjoint** set of
two or three tests, almost all of them pre-existing Phase 2/3 specs rather than
Phase 5's. Every one passed in isolation, and
`admin-users + admin-settings + locale-switch` run back to back passed 41/41 —
so "it passes alone" was not an acceptable answer.

The failures were not assertion failures. They were `page.goto("/")` timing out
after 30 seconds on a plain public route. That pointed at the server, and the
server was the culprit: `playwright.config.ts` sets
`webServer.reuseExistingServer: true`, so every `npx playwright test`
invocation across hours of this phase reused **one** `next start` process. By
the time the failures appeared it held **2.06 GB** resident and had begun
stalling requests.

Killing every node process and re-running the same 216 tests against a fresh
server: **165 passed, 51 skipped, 0 failed, in 5.5 minutes** — less than half
the 11.7-15.3 minutes the degraded server was taking.

This retroactively explains Phase 4's N20/N21 observations, which were read at
the time as worker contention and a corrupted `.next`. The common factor is a
long-lived reused server. Recorded as **N29**; no test was changed for it.

### Fixtures

Every fixture is namespaced with a per-run tag in both address and name, and
searches are scoped by that tag, so no real account is read or written. 23
accounts are created concurrently for the directory suite (21 customers, so
pagination is exercised across a genuine second page, plus two Administrators)
and removed in `afterAll`, customers before Admins because `profiles.blocked_by`
references the acting Admin (Phase 1 finding N7). Banned fixtures are un-banned
before deletion so an interrupted run cannot strand one.

---

## Database and storage changes

**None.** No migration, no function change, no RLS change, no policy change, no
bucket reconfiguration, no new column. `admin_list_users()` and
`admin_set_user_blocked()` are used exactly as they already exist. The
`avatars` bucket is still private with only the four `avatars_owner_*`
policies. Phase 1's contract re-ran green.

Two **application-side** corrections were needed and are recorded above: the
`site_settings.id` validator/type, and the own-account authorization gate.
Neither touches the database.

---

## New findings

| #       | Severity   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N23** | **MEDIUM** | `public.profiles` has **no** `audit_hills_changes` trigger (only `articles`, `coffees`, `coffee_offers`, `offer_price_tiers`, `site_pages` do), and `audit_logs` has no INSERT policy, so nothing but a SECURITY DEFINER trigger can write it. A block is therefore audited by `blocked_by`/`blocked_at`/`block_reason` on the profile row — attributable and unforgeable, but **current-state only**: unblock clears all four, so there is no history of past blocks. Closing that needs a database change, which Phase 5 was told to report rather than apply. **Owner decision required** before any phase relies on block history. |
| **N24** | **LOW**    | The staging Supabase project rejects `@example.com` for outbound mail (`email_address_invalid`), so no fixture can prove an email-change or verification send end to end. Any future test of a send path needs a deliverable address or a mail-catcher, and must not be written as if a fixture address will work.                                                                                                                                                                                                                                                                                                                     |
| **N25** | **MEDIUM** | **Fixed here.** `updateSiteSettingsAction` validated `site_settings.id` as a uuid against a `smallint` key, so Site settings had never been savable; `types.generated.ts` carried the same wrong type. Worth noting as a class: `types.generated.ts` is curated, not generated, and can drift from the live schema.                                                                                                                                                                                                                                                                                                                    |
| **N26** | **MEDIUM** | **Fixed here.** Admin own-profile/email/password actions were gated by `requireVerifiedUser()`, which an ADMIN can never satisfy, so `/admin/account` was inert. New `requireAccountOwner()` covers self-scoped account edits without granting customer entitlement. A future pass must not "harden" it back to `requireVerifiedUser()`, and must not widen it to any non-self-scoped path.                                                                                                                                                                                                                                            |
| **N27** | **LOW**    | `src/actions/admin-operations.ts` still returns the legacy `AdminActionState` with hardcoded English prose (Phase 11 owns that migration). Phase 5's new actions use the real `ActionResult`/`messageKey` contract, so the Admin workspace currently has two result shapes. Site-settings feedback is therefore English-only in both locales until Phase 11.                                                                                                                                                                                                                                                                           |
| **N28** | **LOW**    | The new block/unblock actions live in `src/actions/admin-users.ts`, not in `admin-operations.ts` as `tasks.md` P5-T03 suggests. Deliberate: mixing `ActionResult` actions into a file where every other action is `AdminActionState` would have obscured which contract applies.                                                                                                                                                                                                                                                                                                                                                       |
| **N29** | **MEDIUM** | **New.** `webServer.reuseExistingServer: true` keeps one `next start` process alive across every Playwright invocation. Over hours it reached 2.06 GB and began stalling `page.goto` for 30 s, producing 2-3 failures per full run on a different, disjoint set of tests each time - all of which passed in isolation. A fresh server runs the same 216 tests in 5.5 min with zero failures. **Kill every node process before trusting a full-suite result**, and treat "different tests fail each run" as a server-health symptom rather than flaky tests. This also explains Phase 4 N20 and N21.                                    |
