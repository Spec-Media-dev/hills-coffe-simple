# Implementation Resume Checkpoint

**Last updated**: 2026-09-01

## Current Phase

**Phase 6 — Catalog, Admin data entry, protected pricing, and origins —
COMPLETE, GATE PASSED.**

Phase 7 **has not been started**.

> ### Still outstanding from Phase 3 — one manual step
>
> `P3-T06` remains open pending a single manual Gmail confirmation. Phases 4
> and 5 were executed on instruction and do not depend on it: they depend on
> the Auth guards, which are proven by the 12/12 real-persona suite and the
> 74/74 live security suite. To close P3-T06: sign up at
> <http://localhost:3000/sign-up> with a real inbox (Company Name may be left
> blank), click the confirmation link, expect **/account**, then sign out and
> sign in again.

## Completed Task IDs

### Phase 0 — COMPLETE, gate PASSED

`P0-T01` PASS · `P0-T02` PASS · `P0-T03` PASS · `P0-T04` PASS
Evidence: `evidence/phase-0-baseline.md`

### Phase 1 — COMPLETE, gate PASSED

`P1-T01` PASS · `P1-T02` PASS · `P1-T03` PASS · `P1-T04` PASS · `P1-T05` PASS
Evidence: `evidence/phase-1-authorization-contract.md`
Both approved migrations applied by the owner and verified against the live
database. C1 / FR-067 / FR-068 closed.

### Phase 2 — COMPLETE, gate PASSED

| Task                          | Status       | Notes                                                                                                                           |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `P2-T01` layout ownership     | **PASS**     | one `<html>`/`<body>` owner, one locale mechanism, one provider tree; no `loading.tsx` reintroduced                             |
| `P2-T02` proxy Admin branch   | **PASS**     | no change required — generic rules already route every Admin path; adding a branch would have created a second locale mechanism |
| `P2-T03` Admin route move     | **PASS**     | scoped by owner decision — Admin entry routes moved out of `(site)`; Admin workspace tree left under `[locale]`                 |
| `P2-T04` `(site)` group split | **DEFERRED** | owner decision — no routing or runtime effect with an identical layout                                                          |
| `P2-T05` locale-switch fix    | **PASS**     | D1, D2/F1 and D3/F2 all fixed at the cause; 58/58 runtime assertions, 0 console errors                                          |
| `P2-T06` **PHASE 2 GATE**     | **PASS**     | full matrix identical to the Phase 0 baseline                                                                                   |

Evidence: `evidence/phase-2-route-locale-architecture.md`
Regression guard: `tests/e2e/locale-switch.spec.ts` (44/44).

### Phase 3 — implementation complete, gate pending manual confirmation

| Task                              | Status      | Notes                                                                                     |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `P3-T01` ActionResult contract    | **PASS**    | closed domain-code set; actions return `messageKey`, never localized or raw provider text |
| `P3-T02` sign-in state machine    | **PASS**    | ordering in `src/lib/auth/policy.ts`; 12/12 real personas                                 |
| `P3-T03` three-minute UX          | **PASS**    | presentational only; resend rate-limited server-side                                      |
| `P3-T04` callback re-verification | **PASS**    | re-reads user _and_ session; implicit-fragment path fixed this pass                       |
| `P3-T05` recovery enforcement     | **PASS**    | signed flow token; single-use server-set recovery marker                                  |
| `P3-T06` **GATE**                 | **PENDING** | one manual Gmail confirmation click                                                       |

Evidence: `evidence/phase-3-auth-state-machine.md`

**N1 (HIGH) is closed.** The customer guard is now authenticated + email-confirmed

- `role = USER` + unblocked, composing the live `hills_is_verified_user()` helper
  rather than duplicating it. A blocked customer loses capability on the next
  request even holding a valid session.

### Phase 4 — COMPLETE, gate PASSED

| Task                           | Status   | Notes                                                                                                   |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| `P4-T01` avatar upload/delete  | **PASS** | signature-validated bytes, `auth.uid()`-derived path, safe replace ordering; no policy or schema change |
| `P4-T02` header account menu   | **PASS** | header persona now resolved with `requireVerifiedUser()`; never shows an Admin link                     |
| `P4-T03` sign-out confirmation | **PASS** | shared `ConfirmDialog`, reusable by Phase 5/7; wired into header menu and settings                      |
| `P4-T04` account overview      | **PASS** | real favorites / active-sample / recent-activity queries                                                |
| `P4-T05` favorites isolation   | **PASS** | cross-user read, insert and blocked-write all denied at RLS                                             |
| `P4-T06` request history       | **PASS** | ownership enforced at the database layer, foreign codes return empty                                    |
| `P4-T07` `account/settings`    | **PASS** | profile + security consolidated; old URLs permanently redirect                                          |
| `P4-T08` **GATE**              | **PASS** | 43/43 browser assertions, 0 console errors                                                              |

Evidence: `evidence/phase-4-account-avatar-header.md`

**No database or storage change.** The `avatars` bucket stays private and
every `avatars_owner_*` policy is untouched; Phase 1 re-ran green at 50/50.

### Phase 5 — COMPLETE, gate PASSED

| Task                           | Status   | Notes                                                                                                                       |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `P5-T01` Admin overview        | **PASS** | verification only; every metric proven to come from a live query, EN + AR, `requireAdmin()` re-verified                     |
| `P5-T02` Users workspace       | **PASS** | dedicated `admin/users/**`; `users` removed from the generic `[module]` renderer and from `lib/data/admin.ts`               |
| `P5-T03` block / unblock       | **PASS** | durable RPC on the Admin's own session + Auth ban as defense in depth, with a distinct non-blocking partial-failure warning |
| `P5-T04` customer detail       | **PASS** | avatar view-only via a service-role signed URL; no broad Admin storage-read policy added                                    |
| `P5-T05` settings independence | **PASS** | verified independent, and two real defects fixed (N25, N26)                                                                 |
| `P5-T06` **PHASE 5 GATE**      | **PASS** | 13/13 Admin Users + 6/6 Admin settings browser assertions, 0 console errors                                                 |

Evidence: `evidence/phase-5-admin-users-blocking-settings.md`

**No database or storage change.** `admin_list_users()` and
`admin_set_user_blocked()` used exactly as they already exist; the `avatars`
bucket and its four `avatars_owner_*` policies are untouched. Phase 1's
contract re-ran green.

Closed here: **N2** (Admin avatar view via service-role signed URL), **N3**
(admin RPCs carry the Admin's own session), **N4** (Auth-layer ban applied),
**N5** and **N7** and **N8** (all confirmed as intended behavior and now
covered by tests), **N9** (zero-rows treated as denial in the Phase 5 paths).

### Phase 6 — COMPLETE, gate PASSED

| Task                         | Status   | Notes                                                                                                                 |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `P6-T01` catalog query       | **PASS** | filtering, ordering and pagination moved into one bounded database query; the listing had no pagination at all before |
| `P6-T02` origin→region       | **PASS** | the client narrows the list and clears a stale region; the server re-checks the relationship and owns the refusal     |
| `P6-T03` price isolation     | **PASS** | five-persona runtime matrix; the price table is pinned to a four-module allow-list by a unit invariant                |
| `P6-T04` origins aggregation | **PASS** | published-coffee count in one query for all origins (no N+1); detail scoped by the database; dependent regions listed |
| `P6-T05` test matrix         | **PASS** | 18/18 catalog + 4/4 Admin-wide smoke, against real data                                                               |
| `P6-T06` **PHASE 6 GATE**    | **PASS** | full connected flow proven: reference data → coffee → images → offer → pricing → catalog → verified-customer price    |

**Beyond `tasks.md`, on the owner's instruction**: the Admin catalog data-entry
flow was made operational — dedicated `admin/products|offers|pricing`
workspaces, inline per-field bilingual validation replacing browser-native
popups and bottom-of-form English lists, form-value preservation on failure,
server-side reference verification, and multi-image coffee management on the
existing `coffee_media` model.

Evidence: `evidence/phase-6-catalog-admin-flow.md`

**No database, RLS or storage change.** Owner-approved QA/demo **rows** were
inserted and are inventoried in the evidence file.

Closed here: **N30** (offer save wrote a non-existent column — offers had never
saved), **N31** (single-value check constraints surfaced only as opaque
failures), **N34** (unique violations attributed to the wrong field), **N35**
(an out-of-range catalog page treated as an error).

### Phase 7 — COMPLETE, gate PASSED

| Task                          | Status   | Notes                                                                                                                               |
| ----------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `P7-T01` duplicate sample     | **PASS** | 23505 -> `DUPLICATE_SAMPLE` + `conflict.requestCode`; the active-status set now matches the live index predicate exactly (N42)      |
| `P7-T02` transition conflict  | **PASS** | 23514 -> `CONFLICT`; the graph is not duplicated in write code; stale updates match zero rows and are refused                       |
| `P7-T03` Admin Lead Inbox     | **PASS** | server-side search/filter/pagination, full request context, immutable timeline, prior same-coffee history, allowed-actions-only     |
| `P7-T04` customer wording     | **PASS** | three copies of the status vocabulary collapsed into one namespace; wording follows FR-039/FR-043                                   |
| `P7-T05` dialog accessibility | **PASS** | shared `ModalDialog`; keyboard script green; focus no longer lands on the honeypot; typed values survive a rejection                |
| `P7-T06` lifecycle matrix     | **PASS** | 11/11 live-database + 9/9 browser, covering FLOW A-E, the invalid-transition matrix, isolation and zero fulfillment effects         |
| `P7-T07` **PHASE 7 GATE**     | **PASS** | the complete flow proven end to end: request -> code -> customer timeline -> Lead Inbox -> legal transitions -> reopen after CLOSED |

Evidence: `evidence/phase-7-inquiry-sample-workflow.md`

**No database, RLS or storage change.** The pending N32 Variety translation
migration was not touched. Every Phase 7 fixture account and inquiry row was
removed; the owner-approved Phase 6 QA catalog is preserved (verified: 0 stray
accounts, 0 inquiry rows, 2 coffees / 3 offers).

Closed here: **N42** (the duplicate rule covered 3 of the index's 5 statuses),
**N43** (`InquiryStatus` was missing `SAMPLE_SENT`/`DELIVERED`, making the
sample lifecycle untypeable), **N44** (blocked users _and_ Administrators could
create customer requests), **N45** (a second status writer knew only four
statuses and returned raw provider text), **N46** (dialog focus landed on the
aria-hidden honeypot), **N47** (a rejected submission erased the form),
**N48** (the final legal transition confirmed nothing to the Administrator).

Opened here: **N49 (MEDIUM)** — `updateWorkflowStatusAction` still returns
`error.message` for its **offers** and **content** branches. Its inquiry branch
was removed in Phase 7; the other two are a pre-existing Phase 6 surface and a
Constitution Principle XII concern. Deferred to Phase 11 rather than widening
Phase 7's scope.

## Current / Next Task

**Next**: `P8-T01` — first task of Phase 8 (CMS, media, articles and project
logo). Not started; do not begin it without instruction.

Two items need an owner decision before a later phase leans on them:

- **N23** — a block is audited by `blocked_by`/`blocked_at`/`block_reason` on
  the profile row, which is current-state only: unblock clears all four, so
  there is no history of past blocks. `public.profiles` has no audit trigger
  and `audit_logs` has no INSERT policy. Adding either is a database change,
  which Phase 5 was instructed to report rather than apply.
- **N27** — `admin-operations.ts` still returns the legacy `AdminActionState`
  with hardcoded English prose, so Site-settings feedback is English-only in
  both locales until the Phase 11 domain-result migration.

## Tests Passed

| Suite                                               | Result                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run test:e2e` (production, desktop + mobile)   | **200 passed, 74 skipped, 0 failed** (verified server; see N39)         |
| `npm run test:e2e:dev` (**development server**)     | **73 passed, 0 failed**                                                 |
| `tests/e2e/admin-catalog.spec.ts` (new in Phase 6)  | **18/18**                                                               |
| `tests/e2e/admin-smoke.spec.ts` (new in Phase 6)    | **4/4** — all 20 Admin routes, EN + AR                                  |
| `tests/e2e/admin-reference.spec.ts` (closure audit) | **7/7** — reference/taxonomy modules                                    |
| `tests/e2e/admin-users.spec.ts` (Phase 5)           | **13/13**                                                               |
| `tests/e2e/admin-settings.spec.ts` (Phase 5)        | **6/6**                                                                 |
| `tests/e2e/auth-state-machine.spec.ts` (Phase 3)    | **12/12**                                                               |
| `npm run test:integration`                          | **74/74, 0 skipped**                                                    |
| `npm test` (hermetic)                               | **103/103**, 12 files                                                   |
| `npm run typecheck`                                 | PASS, 0 errors                                                          |
| `npm run lint`                                      | PASS, 0/0                                                               |
| `npm run build`                                     | PASS, **68/68** static pages                                            |
| `npm run format:check`                              | 41 docs/tooling files (F5 baseline); 0 in `src/`, `tests/`, `messages/` |

`HILLS_ADMIN_LIST_USERS_EXTENDED` is gone: the owner-approved
`admin_list_users()` extension is applied and Phase 5 depends on it, so its
seven assertions now always run instead of skipping behind an env flag.

## Known Pending

| ID      | Severity   | Item                                                                                                                                                                                                                                                                                                                                                                                                                             | Owner phase                      |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **N23** | **MEDIUM** | **New.** A block is audited only by `blocked_by`/`blocked_at`/`block_reason` on the profile row — attributable and unforgeable, but current-state only: unblock clears all four. `public.profiles` has no audit trigger and `audit_logs` has no INSERT policy, so block _history_ would need a database change. **Owner decision required.**                                                                                     | owner / a later phase            |
| **N32** | **MEDIUM** | **New.** `varieties` has a plain `name` column and **no** `variety_translations` table, so varieties are English-only _by schema_ and an Arabic Admin necessarily sees English names. Closing it needs a migration — **owner decision required**, not applied                                                                                                                                                                    | owner / a later phase            |
| **N33** | **MEDIUM** | **New.** Sensory notes attach to **offers** (`offer_sensory_notes`), not coffees — there is no `coffee_sensory_notes`. Implemented per the live schema; confirm this matches the intended product model                                                                                                                                                                                                                          | owner                            |
| **N37** | **LOW**    | **New.** The legacy `admin-operations.ts` modules Phase 6 did not take (CMS, articles, media, taxonomy, origins, regions, warehouses, varieties) still return hardcoded English prose in both locales. Extends N27                                                                                                                                                                                                               | Phase 11                         |
| **N39** | **HIGH**   | **New.** `reuseExistingServer: true` in both Playwright configs lets a suite attach to whatever holds port 3000. A stale server produced a 104-failure run that was pure artifact; the same suite passed 200/0 against a verified one. The dev config has the mirror hazard — with a production server up the dev suite passes vacuously. **Verify the server answers correctly before trusting a suite result.** Supersedes N29 | noted for every later phase      |
| **N40** | **MEDIUM** | **New.** The locale switcher drops the query string if clicked before hydration (its `href` is pathname-only by design, to keep the shared header statically rendered). No client-side fix exists. Accepted limitation                                                                                                                                                                                                           | owner / Phase 13                 |
| **N38** | —          | **New, fixed in the Phase 6 closure audit.** Taxonomy terms were created without either name: the shared action sent a `description` column to all seven translation tables but only three have one, so four entities failed their translation upsert and displayed as raw slugs                                                                                                                                                 | noted for every later phase      |
| **N41** | —          | **New, fixed in the Phase 6 closure audit.** The catalog write path verified each many-to-many id with its own query (~15 sequential round trips per coffee save); replaced with one `in (…)` per group. Same guarantee, suite time 10.7 → 8.8 min                                                                                                                                                                               | noted for every later phase      |
| N6      | **MEDIUM** | An `auth.users` row (`shadyshref2001@gmail.com`) has no `profiles` row, so it behaves as signed-out                                                                                                                                                                                                                                                                                                                              | Phase 3                          |
| **N27** | **LOW**    | **New.** `admin-operations.ts` still returns the legacy `AdminActionState` with hardcoded English prose, so Site-settings feedback is English-only in both locales                                                                                                                                                                                                                                                               | Phase 11                         |
| **N24** | **LOW**    | **New.** The staging Supabase project rejects `@example.com` for outbound mail, so no fixture can prove an email send end to end                                                                                                                                                                                                                                                                                                 | Phase 12/13 test infrastructure  |
| **N26** | —          | **New, fixed in Phase 5.** `requireAccountOwner()` now gates self-scoped account edits. A later pass must not "harden" it back to `requireVerifiedUser()` or widen it beyond self-scoped writes                                                                                                                                                                                                                                  | noted for every later phase      |
| **N25** | —          | **New, fixed in Phase 5.** `site_settings.id` is a `smallint`, not a uuid. Broader lesson: `types.generated.ts` is curated, not generated, and can drift from the live schema                                                                                                                                                                                                                                                    | noted for every later phase      |
| **N28** | **LOW**    | **New.** Phase 5's block/unblock actions live in `src/actions/admin-users.ts`, not `admin-operations.ts` as `tasks.md` P5-T03 suggests — deliberate, to keep the two result contracts apart                                                                                                                                                                                                                                      | documentation only               |
| F3      | **MEDIUM** | Catalog/origin/article tables empty and all 18 `site_pages` DRAFT; `/about` 404 is content-blocked, not a route failure                                                                                                                                                                                                                                                                                                          | Phase 12 before further evidence |
| **N10** | **LOW**    | A locale switch is a full page load, the deliberate cost of correctness. A later performance pass must not turn it back into a client transition without keeping `locale-switch.spec.ts` green                                                                                                                                                                                                                                   | Phase 13                         |
| **N11** | **LOW**    | `knownRoots` in `src/lib/auth/redirects.ts` omits `/dashboard-admin`, `/sign-in`, `/knowledge`, `/coffee-origins`. Not reachable today                                                                                                                                                                                                                                                                                           | Phase 3                          |
| N19     | **LOW**    | Supabase Storage serves a deleted object from its edge cache for the cache lifetime; assert deletion against the bucket listing, never a download                                                                                                                                                                                                                                                                                | noted for every later phase      |
| N20     | **LOW**    | Real-backend persona specs mutate shared Supabase state and cannot run in parallel; the suite is single-worker                                                                                                                                                                                                                                                                                                                   | noted for every later phase      |
| **N29** | **MEDIUM** | **New.** `reuseExistingServer: true` keeps one `next start` alive across every Playwright invocation; after hours it reached 2.06 GB and stalled `page.goto` for 30 s, failing 2-3 different tests per run. A fresh server runs all 216 in 5.5 min with 0 failures. Kill node before trusting a full-suite result. Supersedes the N20/N21 explanations                                                                           | noted for every later phase      |
| N21     | **LOW**    | Concurrent dev servers corrupt `.next` and produce a global JSON `SyntaxError` on every route while `npm run build` still succeeds                                                                                                                                                                                                                                                                                               | noted for every later phase      |
| N22     | **LOW**    | `getViewer()` stays in the account layout on purpose — it needs the denial _reason_ to route correctly                                                                                                                                                                                                                                                                                                                           | noted for every later phase      |
| P2-T04  | —          | `(marketing)`/`(auth)` route-group split deferred by owner decision                                                                                                                                                                                                                                                                                                                                                              | phase owning the public redesign |
| F4      | **LOW**    | `NEXT_PUBLIC_SUPABASE_URL` carries a `/rest/v1/` suffix                                                                                                                                                                                                                                                                                                                                                                          | Phase 13                         |
| F5      | **LOW**    | `format:check` fails on 41 docs/tooling files; `src/`, `tests/` and `messages/` are clean                                                                                                                                                                                                                                                                                                                                        | Phase 13                         |

**Closed in Phase 1**: C1 / FR-067 / FR-068.
**Closed in Phase 2**: D1 (script-tag), D2 / F1 (stale `lang`/`dir`), D3 / F2
(dropped query string).
**Closed in Phase 3**: N1 (HIGH — the verified-customer gate now requires
authenticated + confirmed + unblocked + `role = 'USER'`).
**Closed in Phase 6**: N30 (offer save wrote a non-existent column), N31
(single-value check constraints), N34 (unique violation attributed to the wrong
field), N35 (out-of-range catalog page).
**Closed in Phase 5**: N2 (Admin avatar view), N3 (admin RPCs carry the Admin's
own session), N4 (Auth-layer ban), N5, N7, N8 (all confirmed intended and now
test-covered), N9 (zero-rows treated as denial), N25, N26.

## Last Safe Checkpoint

- **Branch**: `main`; Phases 0–5 committed. Phases 6 and 7 are uncommitted.
- **Database**: unchanged by Phases 6 and 7 — no migration, no function, RLS,
  storage policy or bucket change. Owner-approved QA/demo **rows** were
  inserted in Phase 6 and are inventoried in
  `evidence/phase-6-catalog-admin-flow.md`. Phase 7 left no rows behind.
- **Phase 6 additions**:
  - new: `src/actions/admin-catalog.ts`, `src/lib/admin/validation.ts`,
    `src/lib/data/admin-catalog.ts`, `src/lib/data/catalog-query.ts`
  - new: `src/components/admin/{admin-form,coffee-form,coffee-images,offer-form,delete-tier-button}.tsx`,
    `src/components/catalog/catalog-card.tsx`
  - new routes: `src/app/[locale]/admin/{products,offers,pricing}/**`
  - new tests: `src/lib/catalog-boundaries.test.ts`,
    `tests/e2e/{admin-catalog,admin-smoke}.spec.ts`,
    `tests/e2e/catalog-fixtures.ts`
  - new: `scripts/seed-qa-catalog.mjs` (idempotent QA/demo seed)
  - modified: the generic `[module]` renderer and `admin-record-editor`
    (catalog modules removed), `admin-operations.ts` (superseded actions
    deleted), `lib/data/{admin,pricing,editorial}.ts`, the catalog listing and
    both origin pages, `messages/{en,ar}.json`, `types.generated.ts`
- **Unchanged**: `src/proxy.ts`, `src/i18n/**`, every layout, the Admin entry
  routes, every storage policy, and `pricing.ts`'s `requireVerifiedUser()` gate.
- **Rollback**: delete the new files above and revert the modified ones. The
  QA/demo rows are data; the evidence file lists the delete order. No schema
  state to undo.

- **Phase 7 additions**:
  - new: `src/actions/admin-inquiries.ts`, `src/lib/data/lead-inbox.ts`,
    `src/lib/inquiries/{labels,transitions}.ts`
  - new: `src/components/ui/modal-dialog.tsx`,
    `src/components/admin/{lead-badges,lead-status-actions}.tsx`
  - new routes: `src/app/[locale]/admin/inquiries/{page.tsx,[id]/page.tsx}`
  - new tests: `tests/integration/inquiry-lifecycle.test.ts`,
    `tests/e2e/{inquiry-workflow.spec.ts,inquiry-fixtures.ts}`
  - modified: `src/actions/inquiries.ts` (rewritten onto `requireVerifiedUser()`
    and the `ActionResult` contract), `src/lib/inquiries/sample-request.ts`,
    `src/lib/actions.ts` (`fieldErrorsOf` made generic),
    `src/components/inquiries/{inquiry-panel,request-quote-form}.tsx`,
    the customer request list/detail/dashboard pages, the coffee detail page
    (hardcoded AR/EN label table removed), the generic `[module]` renderer and
    `admin-operations.ts` (inquiry status writer removed),
    `messages/{en,ar}.json`, `types.generated.ts`
- **Phase 7 rollback**: delete the new files above and revert the modified ones.
  No schema state and no data to undo.
