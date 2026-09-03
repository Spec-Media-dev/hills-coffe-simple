# Implementation Plan: Hills Coffee Platform Implementation

**Branch**: `001-platform-implementation-spec` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-platform-implementation-spec/spec.md`

## Summary

This plan converts the approved `docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md`
into an execution-ordered technical plan for the 7 user stories and 66
functional requirements in `spec.md`, grounded in the **current, already-live**
Supabase schema in `docs/HILLS_SUPABASE_CURRENT_STATE.md`. It keeps the
master plan's 14-phase backbone (Phase 0 through Phase 13) and its
dependency graph unchanged, because no concrete dependency, security, or
runtime finding in this pass requires reordering it. What changes from the
master plan's original text is factual, not structural:

1. **The avatar, blocking, sample-status, and sample-uniqueness database
   changes the master plan proposed as Phase 1 migrations are already
   applied.** Phase 1 in this plan is therefore a **verification and
   read-path-completion** phase, not a migration-authoring phase.
2. **Some of the master plan's target route architecture is already partially
   built** by a prior implementation pass (`docs/HILLS_IMPLEMENTATION_
   EXECUTION_REPORT.md`, `docs/CLAUDE_MASTER_FINAL_COMPLETION_REPORT.md`):
   a real root `src/app/layout.tsx` exists, `/dashboard-admin` exists and
   correctly redirects, `/admin/login` is a legacy 308 redirect, and
   `/admin/account` exists. Admin still physically lives under
   `src/app/[locale]/admin/**` rather than the master plan's target
   `src/app/(admin)/**` sibling group — this specific gap is still real and
   is scheduled in Phase 2 exactly as the master plan intended, now scoped
   as a completion of partial work rather than a from-scratch move.
3. **No capability in the prior pass is treated as complete because its
   files exist.** Every phase below states exactly what runtime evidence is
   still required, per the planning brief's explicit instruction.

## Technical Context

**Language/Version**: TypeScript (strict), Next.js 16.3.3, React 19.2.8

**Primary Dependencies**: `@supabase/ssr`, `@supabase/supabase-js`,
`next-intl` 4.14, Motion, Sonner, Tailwind CSS 4, Zod, React Hook Form

**Storage**: Supabase Postgres (current live schema — see `data-model.md`)
+ Supabase Storage (`hills-public` public bucket, `avatars` private bucket).
No new migration is part of this plan.

**Testing**: Vitest (unit/behavioral), Playwright (E2E, accessibility via
`@axe-core/playwright`, visual regression via built-in `toHaveScreenshot`)

**Target Platform**: Server-rendered Next.js App Router web application

**Project Type**: Web application — single repository, no separate
frontend/backend split

**Performance Goals**: Core Web Vitals "good" thresholds on public pages;
catalog query cost bounded and independent of total catalog size

**Constraints**: no protected price in any public payload/cache; npm-only
tooling (Constitution Principle XIX); no new database migrations; WCAG 2.2
AA on core journeys; one canonical Admin implementation (Constitution
Principle III)

**Scale/Scope**: live data is currently near-empty (`business_counts`:
1 profile, 2 warehouses, 18 site pages, 0 coffees/offers/origins/articles/
inquiries) — implementation and tests must be correct at this scale and must
not silently break at production scale; no capacity assumption beyond
"bounded, paginated queries" is made without evidence.

*(All Technical Context fields are resolved — see `research.md` §10. No
`NEEDS CLARIFICATION` markers remain.)*

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Platform Identity & Scope | No cart/checkout/payment/seller/custody/trading capability appears anywhere in `spec.md` or this plan | PASS |
| II. Bilingual Routing & Parity | Every phase's "EN/AR/RTL impact" row is mandatory and non-empty; FR-052/FR-053 require full parity | PASS |
| III. Canonical Admin Implementation | Phase 2 explicitly completes the single-Admin-source migration; `/dashboard-admin` is confirmed the canonical entry | PASS |
| IV. Authoritative Authorization Source | `profiles.role` / `is_admin()` / `hills_is_verified_user()` are the sole authorization source in every contract in `contracts/` | PASS |
| V. Protected Customer Access Gate | `requireVerifiedUser()` ordering (auth → verified → unblocked → role) is specified identically across every contract | PASS |
| VI. Admin/Customer Entitlement Separation | `pricing-query.md` explicitly forbids Admin browsing-path access to customer pricing | PASS |
| VII. Blocked-User Enforcement at Every Boundary | Data-model confirms DB-level `protect_profile_block_fields()` and `hills_is_blocked()` back every application-layer check named in the contracts. Consistency analysis found the current `hills_profiles_update_own` RLS policy and the four `avatars_owner_*` storage policies enforce ownership only, not blocked-state — the owner approved closing this gap; Phase 1 now carries an explicit, tested hardening task (P1-T04) and `spec.md` FR-067/FR-068 record the requirement | PASS (gap identified and tracked, not silently accepted) |
| VIII. Protected Price Confidentiality | `pricing-query.md` + Phase 6/13 gates cover HTML/RSC/metadata/JSON-LD/sitemap/cache/Realtime | PASS |
| IX. Static vs. Dynamic Media Separation | Phase 8 explicitly keeps `public/images` to approved editorial-only use and routes business media through Supabase | PASS |
| X. Avatar/Media Independence | `data-model.md` confirms physical bucket separation (`avatars` vs `hills-public`); Phase 4 keeps this separation in code | PASS |
| XI. Full-Surface Localization & Responsiveness | Phase 11 is a dedicated cross-cutting gate; every other phase also carries its own EN/AR/RTL row | PASS |
| XII. No Raw Backend Error Exposure | `action-result.md` contract makes this mechanically enforced (`messageKey` only, never a raw string) | PASS |
| XIII. Preserve Correct Existing Business Logic | Every phase's "KEEP" section is populated before its "REFACTOR"/"REMOVE" sections, per the master plan's own instruction | PASS |
| XIV. Evidence-Based Completion | Every phase requires "Tests required AFTER" + "Runtime acceptance criteria" with real evidence, per `quickstart.md` | PASS |
| XV. Database Contract Governance | This plan proposes zero migrations; `data-model.md` is read directly from the current snapshot | PASS |
| XVI. Security and Correctness Precedence | Phase ordering places Auth/authorization (Phase 3) and blocking (Phase 5) before public redesign (Phase 9) | PASS |
| XVII. Inspiration-Only External References | `research.md` §9 closes further Sucafina research; only the already-approved interaction-pattern table is referenced | PASS |
| XVIII. Realtime Is Not an Authorization Boundary | `research.md` §3 states subscriptions are always RLS-scoped and excludes `offer_price_tiers`/`audit_logs` | PASS |
| XIX. npm-Only Tooling | `research.md` §8 chose Playwright's built-in visual diffing specifically to avoid a new dependency | PASS |

**Gate result**: PASS, no violations. `Complexity Tracking` below is
completed only to record two deliberate, justified deferrals — it is not
recording constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-platform-implementation-spec/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── action-result.md
│   ├── auth-actions.md
│   ├── account-avatar-actions.md
│   ├── admin-users-actions.md
│   ├── catalog-query.md
│   ├── pricing-query.md
│   └── inquiry-actions.md
└── tasks.md              # Produced by /speckit-tasks — NOT created here
```

### Source Code (repository root)

This is a single Next.js repository (no frontend/backend split). Current
state vs. the master plan's target boundary model:

```text
src/app/
  layout.tsx                       # EXISTS — root document, lang/dir from proxy header
  not-found.tsx                    # EXISTS — global not-found (framework-owned document)
  robots.ts / sitemap.ts / manifest.ts   # EXIST
  auth/callback/route.ts           # EXISTS — global, outside locale routing

  [locale]/                        # CURRENT: still wraps Admin (Phase 2 target: split)
    layout.tsx                     # EXISTS — locale/message/provider layer only (already slimmed)
    not-found.tsx / error.tsx      # EXIST
    (site)/                        # public/auth/account tree — TARGET: split into
      page.tsx, about/, contact/,  #   (marketing)/ and (auth)/ route groups (Phase 2)
      request-a-quote/, green-coffee-offer-list/, coffee-origins/,
      knowledge/, [page]/, sign-in/, sign-up/, verify-email/,
      forgot-password/, reset-password/, dashboard-admin/ (EXISTS — canonical
        admin login; TARGET: relocate to src/app/(admin)/ per Phase 2),
      admin/login/ (EXISTS as a legacy 308 redirect — KEEP as redirect only),
      account/ (layout.tsx, page.tsx, profile/, favorites/, requests/[code]/,
        security/) — TARGET: profile/security consolidate into account/settings
        per the master plan's Route Migration Map, with a compatibility redirect
    admin/                         # CURRENT location — TARGET: src/app/(admin)/admin/**
      layout.tsx, page.tsx, account/, content/[id]/, [module]/, [module]/[id]/

src/actions/          # account.ts, admin-operations.ts, auth.ts, inquiries.ts
                       # TARGET: incrementally split into src/features/*/actions
                       # (Phase 4/5/7/10, only after characterization tests — research.md §6)
src/lib/
  auth/ (redirects.ts, session.ts)            # TARGET: src/features/auth/policy.ts
  data/ (admin.ts, catalog.ts, editorial.ts, pricing.ts, shared.ts, site-content.ts)
  admin/ (action-state.ts)
  inquiries/ (sample-request.ts + test)
  seo/ (article.ts, metadata.ts, organization.ts + tests)
  supabase/ (browser.ts, config.ts, server.ts, types.generated.ts)
  actions.ts, env.ts, types.ts, utils.ts
src/components/
  admin/, auth/, brand/, catalog/, contact/, content/, forms/, inquiries/,
  motion/, navigation/, providers/, seo/, ui/
src/features/          # TARGET (does not exist yet): auth/, account/, catalog/,
                        # origins/, inquiries/, admin/, cms/, media/ — populated
                        # incrementally per-phase, never in one big-bang move
tests/e2e/              # public-smoke.spec.ts, routing-auth.spec.ts,
                        # theme-locale.spec.ts, accessibility.spec.ts, helpers.ts
                        # TARGET: + persona fixtures/global setup (Phase 12)
```

**Structure Decision**: keep the master plan's target boundary model
(global root → localized site group → canonical Admin group →
`src/features/**` for use-cases → `src/lib/**` for infrastructure), but
migrate to it incrementally, file-group by file-group, exactly as the
master plan's File-by-File Migration Map and phase dependencies specify —
never as a single restructuring commit. This preserves Constitution
Principle XIII (don't rewrite working logic merely to change folder
aesthetics) while still converging on the target structure.

## Complexity Tracking

| Deferred item | Why deferred now | Simpler alternative rejected because |
|---|---|---|
| Splitting `src/actions/admin-operations.ts` and the generic `[module]` Admin router into per-feature `src/features/admin/**` modules immediately | The prior pass already delivered real, gated, tested CRUD across 16 modules; a wholesale rewrite risks regressing working, audited functionality with no product benefit (master plan's explicit anti-regression rule) | Splitting immediately, before Lead Inbox/Users prove the pattern in Phase 5/10, would mean characterizing and re-testing 1,000+ lines of mutation logic before any user-visible value ships |
| A bespoke catalog filtering RPC/view instead of a composed PostgREST query | The master plan requires index/RPC additions to be evidence-gated by `EXPLAIN ANALYZE`, and the live catalog currently has 0 rows — there is no data to produce that evidence yet | Building a custom RPC now would be exactly the kind of unverified, premature complexity Constitution-adjacent engineering judgment (and the master plan's Performance Plan) warns against |

---

# Implementation Phases

Phase numbering, goals, and dependency ordering match
`docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md` exactly (its own "Recommended
Execution Order for Claude"), updated only where the database is now
confirmed already-migrated or the repository has already partially
implemented a step. Every phase must satisfy `quickstart.md`'s static gates
and the applicable rows of its runtime evidence checklist before being
considered done.

## Phase 0 — Safety baseline, decisions, and environment proof

- **Goal**: Establish a trustworthy current-state baseline before any change,
  confirming this plan's premise that DB migrations are already live and
  that the repository's actual file tree matches what this plan assumes.
- **Dependencies**: none (first phase).
- **Existing implementation to KEEP**: the current git history, current
  `.env.example`, current `package.json`/`package-lock.json` (npm-only,
  already confirmed clean of pnpm artifacts).
- **Existing implementation to REFACTOR**: none — this phase is read-only.
- **Existing implementation to REMOVE/MIGRATE**: none.
- **Exact files/modules likely affected**: none (evidence/decision
  artifacts only — this phase produces no source diff).
- **Supabase/database contract relied upon**: read-only confirmation of
  `docs/HILLS_SUPABASE_CURRENT_STATE.md`'s `hills_security_objects` block
  (`avatars_bucket_exists`, `hills_is_admin_exists`, `hills_is_blocked_
  exists`, `admin_set_user_blocked_exists`, `active_sample_unique_index_
  exists`, `sample_transition_function_exists` — all already `true`) and
  `sample_request_integrity.active_duplicates` (must be empty).
- **Auth/security impact**: none (observation only); confirms which staging
  project and personas will later be used, per the master plan's Test Data
  Strategy, without touching production.
- **Realtime impact**: none — confirm current publication table list and
  the two required exclusions (`offer_price_tiers`, `audit_logs`) as a
  read-only check.
- **EN/AR/RTL impact**: none.
- **UI impact**: none.
- **Tests required BEFORE change**: none (this phase precedes all change).
- **Implementation tasks**: re-run `npm install`, `format:check`,
  `typecheck`, `lint`, `npm test`, `npm run build`; capture the exact
  route/redirect matrix currently observed (extending the matrix already
  recorded in `docs/CLAUDE_MASTER_FINAL_COMPLETION_REPORT.md`); confirm the
  canonical host and trailing-slash policy are still open business decisions
  (they are, per that report) and record them as such rather than guessing;
  reproduce the EN↔AR↔EN script-tag/runtime-overlay symptom once with a
  manual browser pass to have a concrete "before" recording for Phase 2's
  fix.
- **Tests required AFTER change**: re-verification only — the same commands
  above, plus confirming the baseline artifacts are complete and repeatable.
- **Runtime acceptance criteria**: current build is green; current DB
  security objects are confirmed live; current script-tag reproduction is
  recorded; no production data touched.
- **Rollback/checkpoint strategy**: nothing to roll back — no source change
  is made in this phase.
- **Risks**: treating a stale historical report as current proof instead of
  re-running the commands now; using production for any observation.
- **Explicitly out of scope**: any code change, any database change, any
  new dependency.

## Phase 1 — Database/storage contract verification and Admin read-path completion

- **Goal**: Confirm the already-applied avatar/blocking/sample-status/
  sample-uniqueness database changes are correctly usable by the application
  layer; close the read-path gap this plan identified (`admin_list_users()`
  does not yet return `is_blocked`/`avatar_path` or support search/
  pagination); and apply the owner-approved RLS/storage hardening that
  closes a real gap found during consistency analysis — the current
  `hills_profiles_update_own` RLS policy and the four `avatars_owner_*`
  storage policies enforce row/object ownership only, with no blocked-state
  predicate, unlike every other protected-resource policy in the snapshot.
- **Dependencies**: Phase 0 baseline.
- **Existing implementation to KEEP**: all currently-live schema objects
  exactly as-is — `profiles.avatar_path`/`is_blocked`/`blocked_at`/
  `blocked_by`/`block_reason`, `admin_set_user_blocked()`,
  `protect_profile_block_fields()`, `hills_is_admin()`/`hills_is_blocked()`/
  `hills_is_verified_user()`/`is_admin()`, the `inquiry_status` enum
  including `SAMPLE_SENT`/`DELIVERED`, `validate_inquiry_status_transition()`,
  `uq_inquiries_active_sample_user_coffee`, the `avatars` bucket and its
  owner-scoped storage policies, the Realtime publication membership and its
  confirmed exclusions.
- **Existing implementation to REFACTOR**: `admin_list_users()`'s consuming
  code path (`src/lib/data/admin.ts`) needs to read the additional columns
  once the read path is extended — see below. This is an additive read-path
  change, not a table/column migration (`research.md` §6 in
  `admin-users-actions.md`'s terms — this is a database-adjacent addition,
  and it is a **new read-only RPC/RPC extension**, not a schema change).
  **Owner-approved** (during consistency analysis): extend `admin_list_users()`
  (or add a second Admin-only RPC) to support search by email, search by
  name, pagination, the blocked/unblocked filter and value, and the avatar
  reference — the exact technical specification is finalized in `P1-T02`;
  the SQL/RPC definition itself is authored and applied by the database
  owner as its own reviewed unit, not by this planning pass. Separately, and
  also now owner-approved (per the
  consistency-analysis correction to this plan): `hills_profiles_update_own`
  and the four `avatars_owner_*` storage policies (`avatars_owner_insert`,
  `avatars_owner_select`, `avatars_owner_update`, `avatars_owner_delete`)
  are tightened to add an unblocked-customer predicate consistent with
  `hills_is_verified_user()`'s existing use on `hills_favorites_*`,
  `hills_inquiries_*`, and `hills_price_tiers_verified_users` — closing the
  one place a blocked customer's still-valid session could otherwise bypass
  the application's `requireVerifiedUser()` gate via a direct database or
  storage call.
- **Existing implementation to REMOVE/MIGRATE**: none.
- **Exact files/modules likely affected**: `src/lib/data/admin.ts`,
  `src/lib/supabase/types.generated.ts` (regenerate after any RPC
  extension), a new or extended `admin_list_users`-equivalent RPC definition
  (owner-approved, applied outside this plan's own execution — this plan
  only specifies the contract in `contracts/admin-users-actions.md`); a
  second, separate owner-approved migration unit (conceptual scope only,
  authored and applied outside this plan's execution, per Constitution
  Principle XV) tightening `hills_profiles_update_own` and the four
  `avatars_owner_*` policies to require the unblocked-customer predicate.
- **Supabase/database contract relied upon**: `data-model.md` in full;
  specifically the block/verification helper functions and the sample
  uniqueness index/transition trigger, which the application must rely on
  rather than re-implement client-side equivalents of; and, once applied,
  the tightened `hills_profiles_update_own`/`avatars_owner_*` policies.
- **Auth/security impact**: confirm `protect_profile_block_fields()` truly
  rejects a non-Admin attempt to alter `is_blocked` end-to-end (write a
  characterization test against staging, not just read the trigger source).
  Confirm, before and after the approved hardening lands, that a blocked
  customer cannot update their own `profiles` row or mutate/read their own
  avatar object via a direct database/storage call (FR-067), that
  Administrator and service-role access to both resources is unaffected
  (FR-068), and that no path exists for a blocked customer to alter their
  own `is_blocked` state (already independently guarded by
  `protect_profile_block_fields()`, re-confirmed here as a regression
  check).
- **Realtime impact**: confirm subscribing to `inquiries`/`inquiry_status_
  history` as a non-owning customer yields zero rows (RLS-backed), and that
  no client code anywhere subscribes to `offer_price_tiers` or `audit_logs`.
- **EN/AR/RTL impact**: none yet (no UI in this phase).
- **UI impact**: none yet.
- **Tests required BEFORE change**: a duplicate-active-sample query against
  staging (must return zero, matching the current snapshot's
  `active_duplicates: []`); a missing-profile query characterization; a
  direct-SQL/staging attempt to set `is_blocked` as a non-admin session,
  confirmed rejected by the existing trigger; a direct-client attempt, as a
  blocked-fixture session, to `UPDATE` the fixture's own `profiles` row and
  to upload/update/delete/read the fixture's own avatar object — run
  **before** the hardening lands, to record the current (vulnerable)
  baseline the fix is checked against.
- **Implementation tasks**: write Vitest/staging-integration tests that
  exercise `hills_is_verified_user()`/`is_admin()`/`admin_set_user_blocked()`
  behavior through the application's Supabase client wrappers (not just read
  the SQL); specify and get owner approval for the `admin_list_users`
  extension (added columns + search/pagination parameters) before any
  application code depends on it; regenerate `src/lib/supabase/
  types.generated.ts` once the extension is approved and applied. Separately
  (owner already approved): author, review, and apply the RLS/storage
  hardening migration tightening `hills_profiles_update_own` and the four
  `avatars_owner_*` policies to require the same unblocked-customer
  predicate already used by `hills_favorites_*`/`hills_inquiries_*`
  (conceptually: `hills_is_verified_user()` or an equivalent
  `NOT hills_is_blocked()` condition), applied as its own reviewed migration
  unit outside this plan's own execution, per Constitution Principle XV —
  this planning pass does not author or execute that SQL.
- **Tests required AFTER change**: RLS/authorization matrix test for the
  five personas against the helper functions; confirmation that the
  extended user-listing read path returns block state and avatar path
  correctly for a blocked and an unblocked fixture; re-running the
  blocked-fixture direct-client attempts above and confirming every one is
  now denied; confirming an Administrator session and the service-role
  client are unaffected by the tightened policies; confirming no path
  exists for a blocked customer to alter their own `is_blocked`/
  `blocked_at`/`blocked_by`/`block_reason` fields (FR-068).
- **Runtime acceptance criteria**: a blocked-profile JWT cannot pass
  `hills_is_verified_user()`; a non-admin cannot alter block fields; the
  admin user-listing read path returns the fields Phase 5 needs; a blocked
  customer's direct-client profile `UPDATE` and all four avatar storage
  operations are denied (FR-067), with Administrator/service-role access and
  the blocked customer's inability to self-unblock both unaffected (FR-068).
- **Rollback/checkpoint strategy**: this phase's write-adjacent changes (the
  `admin_list_users` extension and the RLS/storage hardening) are each
  additive/tightening and backward compatible for every legitimate caller;
  if the `admin_list_users` extension is delayed, Phase 5 falls back to a
  second narrowly-scoped Admin-only query; the RLS/storage hardening has no
  legitimate caller to break (it only removes a capability a blocked
  customer should never have had), so no functional rollback path is
  needed beyond the database owner's normal migration-revert process.
- **Risks**: assuming a schema capability exists without a runtime check;
  scope-creeping this phase into authoring/executing migration SQL directly
  from this planning pass (the SQL itself remains the database owner's
  separate, reviewed action); under-scoping the hardening predicate such
  that it accidentally also blocks a verified, unblocked customer (test
  against an unblocked fixture as well as a blocked one) or accidentally
  weakens Administrator/service-role access.
- **Explicitly out of scope**: adding any new table, column (beyond the
  already-approved and already-applied ones), enum value, or index; running
  any migration.

## Phase 2 — Route architecture, proxy, and locale stabilization

- **Goal**: Complete the master plan's global/site/Admin boundary — one root
  document, one localized public/auth/account tree, one canonical Admin tree
  outside the `[locale]` segment for both languages — and resolve the
  locale-switch script-tag/runtime-overlay defect.
- **Dependencies**: Phase 0 reproduction; Phase 1 not required for this
  phase's file moves.
- **Existing implementation to KEEP**: `src/app/layout.tsx` (already the
  global document owner — a prior pass already completed this specific
  piece of Phase 2); `src/app/auth/callback/route.ts` (correct global
  position already); `src/proxy.ts`'s Supabase cookie-refresh behavior;
  `src/i18n/routing.ts`'s `localePrefix: "as-needed"` configuration;
  existing redirects in `next.config.ts` for legacy `/products`, `/origins`
  paths.
- **Existing implementation to REFACTOR**: `src/proxy.ts` (currently 61
  lines) to add the explicit Admin-path branch from the master plan's exact
  request algorithm — `/dashboard-admin`/`/admin/**` (EN) and
  `/ar/dashboard-admin`/`/ar/admin/**` (AR, internally rewritten without a
  literal `[locale]` param) — while keeping the existing unprefixed-EN
  rewrite and `/en/**` 308 behavior unchanged; `src/i18n/navigation.ts`
  (or equivalent) to implement "hard document navigation on locale change,
  soft transition on same-locale navigation" per `research.md` §1;
  `src/app/[locale]/layout.tsx` to remain locale/message/provider-only
  (already mostly true).
- **Existing implementation to REMOVE/MIGRATE**: move
  `src/app/[locale]/admin/**` to `src/app/(admin)/admin/**`; move
  `src/app/[locale]/(site)/dashboard-admin/page.tsx` to
  `src/app/(admin)/dashboard-admin/page.tsx`; retain
  `src/app/[locale]/(site)/admin/login/page.tsx` as the existing legacy
  308-redirect page (already correct behavior, just confirm it still
  resolves to the new canonical path after the move); split
  `src/app/[locale]/(site)/**` into `(marketing)/` and `(auth)/` route
  groups per the master plan's target tree (no URL change — groups do not
  affect the external path).
- **Exact files/modules likely affected**: `src/proxy.ts`,
  `src/i18n/routing.ts`, `src/i18n/navigation.ts`, every file under
  `src/app/[locale]/admin/**` and `src/app/[locale]/(site)/dashboard-admin/`
  (moved, not rewritten), `next.config.ts` (redirect table additions for any
  now-legacy path), root/locale `error.tsx`/`not-found.tsx`.
- **Supabase/database contract relied upon**: none new — this phase is
  routing-only; the proxy's existing Supabase session-refresh client
  configuration must remain unchanged (`research.md` §2's "proxy client
  never becomes the authorization authority" rule).
- **Auth/security impact**: `requireAdmin()`/`requireVerifiedUser()` guards
  move with their pages unchanged — this phase must not alter any
  authorization logic, only where the files live and how the URL is routed
  to them.
- **Realtime impact**: none.
- **EN/AR/RTL impact**: this phase's core deliverable — exhaustive
  proxy/redirect table testing for every route in both languages, plus the
  script-tag/runtime-overlay fix (`research.md` §1) verified by repetition
  test.
- **UI impact**: none intentional — this is a routing move, not a redesign
  (matches the master plan's explicit "no intentional redesign in this
  phase").
- **Tests required BEFORE change**: full route/redirect matrix snapshot
  (building on the one already recorded in
  `docs/CLAUDE_MASTER_FINAL_COMPLETION_REPORT.md`'s Runtime Route Audit);
  callback tests; metadata snapshots; exact script-tag overlay reproduction
  from Phase 0; screenshot baseline for every moved page.
- **Implementation tasks**: implement the proxy's exact request algorithm
  from the master plan (`## Proxy / Locale Architecture`) including the
  Admin-specific branch; move Admin source files in small, reviewable
  slices with a working build after each slice; implement locale-switch
  hard navigation; verify every `/en/**`, `/ar/**`, and Admin path against
  the full matrix; remove the old `src/app/[locale]/admin/**` tree only
  after the new location passes the full matrix (parity-before-deletion,
  per Constitution Principle XIII).
- **Tests required AFTER change**: every URL in the master plan's Route
  Migration Map, run for both languages; confirm zero visible `/en` in the
  browser bar; confirm Admin path/query survives a locale switch; confirm
  the script-tag repetition test (EN→AR→EN across 7+ representative pages)
  shows zero console error/hydration warning/Dev Overlay; confirm anonymous
  guards to `/admin`, `/dashboard-admin`, `/account` still 307/308 exactly
  as `docs/CLAUDE_MASTER_FINAL_COMPLETION_REPORT.md` recorded before this
  move.
- **Runtime acceptance criteria**: one Admin implementation serves all four
  external Admin roots (`/dashboard-admin`, `/ar/dashboard-admin`,
  `/admin/**`, `/ar/admin/**`); no redirect loop; no soft 404; the
  script-tag overlay does not reproduce across a full repetition pass.
- **Rollback/checkpoint strategy**: each file-move slice is its own
  reviewable commit; if the new Admin location regresses any matrix row,
  revert that slice's move (not the whole phase) and re-diagnose before
  retrying; keep the old tree and the new tree from ever being simultaneously
  routable to the same external path (would create a Next.js route
  conflict, not just a logical duplication).
- **Risks**: rewrite recursion in the proxy; root/locale layout persistence
  regressions; the script-tag fix (hard navigation) regressing perceived
  performance of locale switching — measure and record this trade-off
  explicitly rather than silently accepting it.
- **Explicitly out of scope**: any visual/design change; any change to
  business queries, actions, or authorization logic; any new public slug.

## Phase 3 — Auth state machine and authorization policy

- **Goal**: Implement `spec.md` User Story 1 in full — the explicit state
  machine, verified-USER/ADMIN separation, recovery, and blocked-session
  handling — as one central, reused policy rather than scattered per-page
  checks.
- **Dependencies**: Phases 1–2.
- **Existing implementation to KEEP**: `src/actions/auth.ts`'s working
  Supabase call sequences for sign-up/sign-in/resend/reset (already
  functionally correct per the prior completion pass — role-aware sign-in
  redirect and callback re-verification already exist); `src/app/auth/
  callback/route.ts`'s already-implemented "re-read user, check
  `email_confirmed_at`" pattern; `src/lib/auth/redirects.ts`'s
  `assertSafeRedirect`/`localizedPath` allow-list pattern.
- **Existing implementation to REFACTOR**: `src/lib/auth/session.ts`'s
  `requireVerifiedUser()` — confirm it composes `hills_is_verified_user()`'s
  exact ordering (auth → confirmed → unblocked → role) rather than a
  hand-rolled equivalent that could drift from the database's own
  definition; every action file to adopt the `ActionResult` contract from
  `contracts/action-result.md` in place of any ad hoc result shape.
- **Existing implementation to REMOVE/MIGRATE**: any lingering ad hoc
  `{ok, message}`-only result type not yet matching `action-result.md`.
- **Exact files/modules likely affected**: `src/actions/auth.ts`,
  `src/app/auth/callback/route.ts`, `src/lib/auth/session.ts`,
  `src/lib/auth/redirects.ts`, Auth pages under the new `(auth)/` route
  group from Phase 2, `messages/en.json`/`messages/ar.json`.
- **Supabase/database contract relied upon**: `hills_is_verified_user()`,
  `is_admin()`, `hills_is_blocked()` exactly as documented in
  `data-model.md` — this phase must not introduce a parallel
  application-only definition of "verified" or "blocked."
- **Auth/security impact**: this phase's entire purpose — `contracts/
  auth-actions.md` in full, including the `BLOCKED` handling in `signIn()`,
  the `ADMIN_PORTAL_REQUIRED` handling in `signIn()`, and the `FORBIDDEN`
  handling in `adminSignIn()`.
- **Realtime impact**: none.
- **EN/AR/RTL impact**: every Auth state/error/countdown/resend message
  localized; RTL form layout verified.
- **UI impact**: verify-email waiting/expired/already-verified states
  (already implemented per the prior pass — confirm against `spec.md`
  Edge Cases rather than re-building); blocked-account message surface.
- **Tests required BEFORE change**: characterize current
  callback/signup/login/recovery behavior exactly as it runs today (a
  regression baseline, since the prior pass already implemented much of
  this correctly and this phase must not regress it).
- **Implementation tasks**: adopt `ActionResult` uniformly; verify (not
  re-implement) the existing three-minute waiting UX is presentational only
  and never treated as token expiry (FR-006); verify resend is
  server-rate-limited, not just client-timer-gated (FR-007); verify the
  blocked-session path clears the customer's session and shows the
  generic message without the internal `block_reason` (FR-014); verify
  `adminSignIn` never grants a session to a non-Admin or blocked Admin
  candidate (FR-009).
- **Tests required AFTER change**: full state-transition matrix (unit +
  Playwright); enumeration tests (identical response for existing vs.
  non-existing email on both signup and recovery); callback purpose-mixing
  tests (signup token used for recovery, and vice versa, both rejected);
  E2E for every automatable persona in `quickstart.md`'s Sign-in row;
  manual live-email acceptance for the actual click-through.
- **Runtime acceptance criteria**: only verified, unblocked USER reaches
  customer capability; only verified, unblocked ADMIN through
  `/dashboard-admin` reaches Admin capability; a blocked or recovery-context
  session cannot leak either capability.
- **Rollback/checkpoint strategy**: keep the current Auth behavior on a
  reviewable commit boundary; revert the `ActionResult` migration and the
  session-policy refactor together, since they are interdependent, while
  never reverting any database-adjacent read (there is none in this phase).
- **Risks**: locking out a legitimate user via an overly strict block check;
  losing the locale on a callback redirect; resend abuse if the server-side
  rate limit is weaker than assumed.
- **Explicitly out of scope**: changing the public signup role default,
  automatic account deletion, token lifetime claims, or the password
  storage model (all explicitly forbidden by `spec.md` Assumptions).

## Phase 4 — Customer account, avatar, and header identity

- **Goal**: Deliver `spec.md` User Story 2 — account overview, profile
  settings, avatar upload/replace/delete, request history, and a header
  identity state that reflects the signed-in customer.
- **Dependencies**: Phases 1–3.
- **Existing implementation to KEEP**: `src/app/[locale]/(site)/account/**`
  page structure (overview, favorites, requests, requests/[code], profile,
  security — already exist and were verified route-correct in the prior
  pass); `src/actions/account.ts`'s existing `updateProfileAction`/
  `changeEmailAction`/`changePasswordAction`/`toggleFavoriteAction`.
- **Existing implementation to REFACTOR**: `src/actions/account.ts` to add
  `uploadAvatar`/`deleteAvatar` per `contracts/account-avatar-actions.md`;
  `src/components/navigation/site-header.tsx` to replace the anonymous
  sign-in CTA with a resolved avatar/default-icon menu for a signed-in
  verified customer (per the master plan's Header Auth State section);
  `account/profile` and `account/security` to converge toward
  `account/settings` per the master plan's Route Migration Map, with the
  old paths becoming compatibility redirects rather than being deleted
  outright.
- **Existing implementation to REMOVE/MIGRATE**: none deleted outright in
  this phase — old profile/security URLs become redirects only after the
  consolidated `settings` page reaches parity.
- **Exact files/modules likely affected**: `src/actions/account.ts`,
  `src/app/[locale]/(site)/account/**`, `src/components/navigation/
  site-header.tsx`, `src/components/navigation/mobile-menu.tsx` (avatar
  entry point), a new avatar-resolving component shared by header/account/
  Admin profile.
- **Supabase/database contract relied upon**: `profiles.avatar_path`, the
  `avatars` bucket and its owner-scoped storage policies exactly as
  documented in `data-model.md` — no schema addition.
- **Auth/security impact**: every account route/action requires
  `requireVerifiedUser()`; avatar object paths are always server-derived
  from `auth.uid()`, never client-supplied; cross-user avatar/profile/
  favorite/request access must be denied (FR-020, FR-021).
- **Realtime impact**: none required for this phase (account pages may
  simply re-fetch on navigation; a Realtime favorites/requests subscription
  is optional polish, not a requirement, and if added must follow
  `research.md` §3's scoping rule).
- **EN/AR/RTL impact**: dashboard/settings/upload/sign-out strings fully
  localized; request codes rendered with `dir="ltr"`/bidi isolation inside
  RTL layout (already partially implemented — verify, don't rebuild).
- **UI impact**: avatar upload/delete control with pending/success/error
  states; header avatar menu (accessible menu primitive: `aria-expanded`,
  keyboard arrows/Escape, focus return, RTL placement); sign-out
  confirmation dialog.
- **Tests required BEFORE change**: current account/favorite/request action
  characterization; avatar Storage policy tests directly against staging
  (owner-isolation, MIME/size rejection) before any UI is built on top.
- **Implementation tasks**: build the avatar upload/delete actions and the
  signed/authenticated-read resolver; wire the header avatar menu; verify
  (not assume) that `account/profile`/`account/security` already satisfy
  the settings requirements or extend them; add cache invalidation for
  avatar changes (cache-bust via `updated_at`, never store a signed URL in
  the profile row, per the master plan's Avatar Flow).
- **Tests required AFTER change**: five-persona gate for every account
  route and action; cross-user denial tests for avatar/profile/favorites/
  requests; upload variant tests (valid, oversize, wrong MIME, corrupt
  signature); sign-out cancel/confirm; responsive/RTL/accessibility pass on
  the account shell and header menu.
- **Runtime acceptance criteria**: default/uploaded avatar is stable across
  navigation/theme/locale changes; account counts and timeline are real,
  not cached-stale; no unauthorized account or avatar object access is
  possible by any tested means.
- **Rollback/checkpoint strategy**: avatar upload can be feature-flagged off
  independently (fall back to default icon) without affecting the rest of
  the account area; header menu can revert to the plain sign-in CTA
  independently of avatar work.
- **Risks**: orphaned storage objects on a failed profile update; stale
  cached avatar after replace; header menu focus/keyboard regressions.
- **Explicitly out of scope**: sample creation rules (Phase 7), Admin
  account semantics (Phase 5), password storage model changes, any
  commerce/checkout scope.

## Phase 5 — Admin authorization, users, blocking, and settings

- **Goal**: Deliver `spec.md` User Story 3 — a secure, localized Admin
  shell with real user search/detail/block/unblock and independently
  ownership-scoped Site/Profile/Account settings.
- **Dependencies**: Phases 1–4.
- **Existing implementation to KEEP**: `src/app/[locale]/admin/layout.tsx`'s
  existing `requireAdmin()` guard and localized-redirect-to-
  `/dashboard-admin` behavior (already correct per the prior pass); the
  existing grouped sidebar structure and `h-dvh`/sticky-scroll fix already
  applied to the Admin shell; `src/app/[locale]/admin/account/page.tsx`
  (Admin's own profile/email/password settings — already exists); the
  existing `admin-operations.ts` allow-listed mutation pattern.
- **Existing implementation to REFACTOR**: the Admin Users module (currently
  a generic `[module]` list) into a dedicated search/detail/block/unblock
  workspace per `contracts/admin-users-actions.md`, consuming the extended
  read path from Phase 1; `src/lib/data/admin.ts` to expose the new
  block-aware, paginated user query.
- **Existing implementation to REMOVE/MIGRATE**: the generic Users list view
  is replaced by the dedicated workspace; the underlying `admin-operations.ts`
  mutation utilities are reused, not deleted (per `research.md` §6).
- **Exact files/modules likely affected**: `src/app/(admin)/admin/users/**`
  (post-Phase-2 location), `src/lib/data/admin.ts`, `src/actions/
  admin-operations.ts` (add `setUserBlocked`/`unblockUser`), a new
  server-only service-role module for the Auth-ban side effect
  (`server-only` directive, never imported by a client component).
- **Supabase/database contract relied upon**: `admin_set_user_blocked()`,
  the extended `admin_list_users`-equivalent read path from Phase 1, and —
  for the Auth-ban side effect only — the Supabase Auth Admin API via the
  service-role client, exactly bounded as described in `research.md` §5.
- **Auth/security impact**: every Admin action re-verifies `requireAdmin()`
  independently (FR-024); the block/unblock action enforces
  self-block/Admin-target refusal both at the application layer and relies
  on the database function's own refusal as the backstop (defense in
  depth, matching Constitution Principle VII); the service-role client is
  constructed only inside a dedicated server-only module, never inlined
  into a shared action file.
- **Realtime impact**: none for this phase's core Users workspace (a
  paginated/searchable read is not a Realtime use case); if a "live block
  status" indicator is later added to an open Admin session, it must
  subscribe scoped to `profiles.id = <viewed user>` only.
- **EN/AR/RTL impact**: fully localized shell, grouped navigation, user
  search/filter/action/settings messages; RTL-correct drawer/table.
- **UI impact**: user search/detail view, block/unblock confirmation dialog
  (with optional internal reason field), Site/Profile/Account settings as
  three independently submittable forms (already true for Profile/Account
  per the prior pass — confirm Site settings maintains the same
  independence).
- **Tests required BEFORE change**: characterize all current Admin
  mutations/readers (the prior pass's 20 `admin-operations.ts` functions)
  before touching any of them; verify the current `admin_list_users()`
  RPC's exact output shape as a regression baseline.
- **Implementation tasks**: build the paginated/searchable Users read path
  consuming Phase 1's extension; build block/unblock actions with the
  Auth-ban side effect and its partial-failure handling
  (`contracts/admin-users-actions.md`); wire the Admin avatar-view-only
  resolver from Phase 4's shared component; keep Site/Profile/Account
  settings as separate actions/forms.
- **Tests required AFTER change**: Admin and wrong-role E2E; block/unblock
  immediate-enforcement test (a still-open Verified-USER session loses
  capability the instant it is blocked, per FR-029/SC-004); self-block and
  Admin-target-block refusal tests; short-height/mobile/RTL Admin shell
  tests; settings-ownership tests (a failure in one settings area does not
  discard another).
- **Runtime acceptance criteria**: one localized Admin workspace, no public
  navigation link to it, real searchable user data, audited durable
  blocking that takes effect immediately, no cross-user/self/role
  escalation possible by any tested means.
- **Rollback/checkpoint strategy**: keep the previous generic Users list
  view reachable on a short-lived branch until the dedicated workspace
  reaches parity; the Auth-ban side effect can be disabled independently
  (durable database block remains fully effective without it) if the
  service-role integration needs more owner review time.
- **Risks**: RPC-search exposing more customer data than intended if the
  extension is not carefully scoped; partial Auth-ban/database-block state
  drift; Admin self-lockout if the self-block refusal is misconfigured.
- **Explicitly out of scope**: public/customer navigation changes; the role
  assignment process itself (role is set only via the existing signup/DB
  path, never edited through this Admin tool); any production account
  action during QA.

## Phase 6 — Catalog, protected pricing, and Origins query layer

- **Goal**: Deliver `spec.md` User Story 4 — database-filtered, paginated,
  performant, price-safe catalog and origin discovery.
- **Dependencies**: Phases 1–3; a representative fixture set (per the master
  plan's Test Data Strategy) to produce real query-plan evidence.
- **Existing implementation to KEEP**: `src/lib/data/pricing.ts` as the
  sole price-read boundary (already correctly isolated per the prior
  security review — confirmed by grep in that earlier pass); the existing
  `getOfferList`/`getCoffeeBySlug` public shape as the target contract
  surface, even though its internals change.
- **Existing implementation to REFACTOR**: `src/lib/data/catalog.ts`'s
  24-query, in-memory-filtered implementation, replaced by the composed
  PostgREST query described in `contracts/catalog-query.md` and
  `research.md` §4 — filter/sort/paginate/count all evaluated by the query,
  not by JavaScript after the fact.
- **Existing implementation to REMOVE/MIGRATE**: the in-memory filter/
  pagination logic in the current catalog page component, once the new
  query contract is proven equivalent on real fixtures.
- **Exact files/modules likely affected**: `src/lib/data/catalog.ts`,
  `src/app/[locale]/(site)/green-coffee-offer-list/**` (or its Phase-2
  `(marketing)` location), `src/lib/data/pricing.ts` (interface only, not
  its authorization boundary), origin listing/detail data modules.
- **Supabase/database contract relied upon**: `coffees`/`coffee_offers`/
  taxonomy tables exactly as documented in `data-model.md`; no new index or
  RPC unless Phase 6's own `EXPLAIN ANALYZE` evidence justifies one
  (`research.md` §4) — any such addition is a separate, owner-approved unit,
  not silently bundled into this phase.
- **Auth/security impact**: `pricing-query.md`'s isolation is re-verified
  after the catalog refactor — the public catalog query must never select
  `offer_price_tiers` columns, and the price query must remain the only
  caller of that table.
- **Realtime impact**: none for public catalog reads (they are cache-
  friendly and do not need live updates in this phase); confirm no
  accidental Realtime dependency is introduced.
- **EN/AR/RTL impact**: localized search/sort/facets; origin-dependent
  region filter (FR-033) verified in both languages.
- **UI impact**: desktop rail/table/cards, mobile filter drawer (accessible
  modal per the master plan's Sucafina-inspired-pattern boundary —
  interaction mechanics only, no copied content), URL-persisted filter
  state.
- **Tests required BEFORE change**: price-leak/source/RLS tests (already
  exist per the prior pass — re-run as a baseline); query-count baseline
  against the current 24-query implementation; existing catalog/origin
  route snapshots.
- **Implementation tasks**: implement the composed query per
  `contracts/catalog-query.md`; separate the price projection call so it is
  never part of the same query/response as public catalog data; aggregate
  origin published-coffee counts without N+1; build URL state for filters/
  page/sort.
- **Tests required AFTER change**: filter-combination/pagination/sort
  stability tests; the five-persona price matrix re-run against the
  refactored path; a query-count/latency comparison against the Phase-6
  "before" baseline; SEO canonical/pagination tests unaffected by the
  refactor.
- **Runtime acceptance criteria**: a bounded, paginated database query
  regardless of catalog size; stable URL filter state; no shared/public
  cache ever contains a price value; correct origin→region dependency.
- **Rollback/checkpoint strategy**: keep the old catalog reader available
  behind an internal adapter switch during validation so a regression can
  be reverted without touching the page/UI layer; remove the old
  implementation only after the new one passes the full test set above.
- **Risks**: query-plan complexity at real data volume (currently
  unmeasurable — the live catalog is empty); localized search quality;
  cache-key design accidentally leaking a price into a shared cache entry;
  filter-URL combinatorics affecting SEO if not paired with Phase 13's
  `noindex,follow` rule for non-approved combinations.
- **Explicitly out of scope**: the public price restriction rule itself
  (unchanged, only its query path changes), catalog taxonomy meaning,
  existing slugs, warehouse business data, any marketplace scope.

## Phase 7 — Inquiry and sample delivery workflow

- **Goal**: Deliver `spec.md` User Story 5 in full, integrating the
  already-live `SAMPLE_SENT`/`DELIVERED` statuses and the already-live
  uniqueness index into the Lead Inbox and customer-facing timeline.
- **Dependencies**: Phases 1, 3–6.
- **Existing implementation to KEEP**: `src/actions/inquiries.ts` and
  `src/lib/inquiries/sample-request.ts`'s already-correct duplicate-identity
  rule (`user_id + coffee_id + type`, never `offer_id`) and its 16 existing
  behavioral unit tests (verified accurate in the prior completion pass);
  the trusted-offer-to-coffee server-side resolution already in place; the
  existing account request-history/timeline pages.
- **Existing implementation to REFACTOR**: the duplicate-handling code path
  to catch the **database's** unique-violation
  (`uq_inquiries_active_sample_user_coffee`) as the authoritative race-safe
  guard, in addition to (not instead of) the existing pre-check — per
  `data-model.md`'s note that the prior application-only check is now
  backstopped by a real constraint; the status-update action to call the
  database transition function directly and translate its exception, rather
  than any hand-rolled transition-graph duplication in application code;
  the generic Admin inquiries list, upgraded into the task-focused **Lead
  Inbox** per `contracts/inquiry-actions.md`'s `listLeadInbox`.
- **Existing implementation to REMOVE/MIGRATE**: any application-side
  transition-graph logic that duplicates `validate_inquiry_status_
  transition()` — the database is the single source of truth for legal
  transitions per `data-model.md`.
- **Exact files/modules likely affected**: `src/actions/inquiries.ts`,
  `src/lib/inquiries/sample-request.ts` (+ its test file), Admin Lead Inbox
  routes/actions (new, replacing the generic inquiries module view),
  `src/components/inquiries/**`, account request-history components,
  `messages/en.json`/`messages/ar.json` (sample-status customer wording
  table from the master plan).
- **Supabase/database contract relied upon**: `inquiry_status` enum
  including `SAMPLE_SENT`/`DELIVERED`, `validate_inquiry_status_
  transition()`, `uq_inquiries_active_sample_user_coffee`,
  `inquiry_status_history` — all already live, per `data-model.md`.
- **Auth/security impact**: inquiry creation requires `requireVerifiedUser()`
  and profile completeness (FR-036); status transitions require
  `requireAdmin()`; a customer's own-history read stays scoped to
  `user_id = auth.uid()`.
- **Realtime impact**: an optional Admin Lead Inbox "live update" may
  subscribe to `inquiries`/`inquiry_status_history` (both confirmed present
  in the publication) scoped to an authenticated Admin session; a
  customer's own request-detail view may similarly subscribe scoped to
  `user_id = auth.uid()`. Neither is required for this phase's acceptance,
  but if built, must follow `research.md` §3 exactly.
- **EN/AR/RTL impact**: the full customer-facing status label table
  (Submitted/Request received/Team contacted you/Sample sent/Sample
  delivered/Closed) in both languages, requiring native-language review per
  the master plan.
- **UI impact**: Lead Inbox list/detail with allowed-actions-only status
  control (never a free-form select), prior-same-coffee-history display
  (FR-040), accessible sample/product request dialogs (harden focus
  trap/restore on the existing custom dialog, or replace its shell with an
  accessible primitive while keeping its form logic).
- **Tests required BEFORE change**: the existing 16-test sample-request
  suite as a regression baseline; current database trigger/RLS
  characterization for the transition function.
- **Implementation tasks**: catch and map the unique-violation to
  `DUPLICATE_SAMPLE` with the winning request's code (contract already
  specified); catch and map transition-rejection exceptions to `CONFLICT`;
  build the Lead Inbox list/detail/actions; surface prior-same-coffee
  history; update customer timeline labels for the two new statuses;
  harden the inquiry dialog's accessibility.
- **Tests required AFTER change**: every case in `spec.md` User Story 5's
  acceptance scenarios, including the exact-timing duplicate race (submit
  two requests for the same customer/coffee as close together as the test
  runner allows, and assert exactly one survives — SC-005); invalid/
  backward/cross-type transition rejection tests; history-count-equals-one-
  per-change test; confirmation of zero shipment/reservation/fulfillment
  side effects; EN/AR/accessibility pass on the Lead Inbox and dialogs.
- **Runtime acceptance criteria**: warehouse-switching cannot bypass the
  duplicate rule; a `CLOSED` request permits a new manual-review submission;
  `SAMPLE_SENT`/`DELIVERED` are Admin-only to set and customer-visible to
  read; no quantity field or automatic fulfillment exists anywhere in the
  flow.
- **Rollback/checkpoint strategy**: the database-level guard (unique index,
  transition trigger) cannot be rolled back by this phase and does not need
  to be — it is already live and safe; if the Lead Inbox UI regresses, it
  can revert to the previous generic inquiries view while the underlying
  action/contract changes remain in place (they are backward compatible
  additions).
- **Risks**: a customer-facing wording mismatch implying guaranteed
  fulfillment; double history-writes if both an application-side and
  database-side transition attempt are made; the Auth-ban-style partial-
  failure pattern being copy-pasted incorrectly into transition handling
  (transitions are all-or-nothing, not partial-success like blocking).
- **Explicitly out of scope**: any shipment/inventory/reservation schema or
  behavior; changing the duplicate-identity key away from `(user_id,
  coffee_id)`; a customer-facing "confirm receipt" self-service action
  (delivered is Admin-recorded only, per FR-043).

## Phase 8 — CMS, media, articles, and project logo

- **Goal**: Deliver `spec.md` User Story 6's content/media/logo half —
  typed CMS sections, a reference-aware media library, and the project logo
  correctly wired to the existing `site_settings.org_logo_media_id`
  relation.
- **Dependencies**: Phases 2, 5–7; owner-approved content/media assets.
- **Existing implementation to KEEP**: the existing `site_pages`/
  translation/section/media schema and its Admin mutation actions (already
  functional per the prior pass, including page/section create, translate,
  order, publish, archive); `src/components/content/cms-page.tsx`,
  `entity-sections.tsx`, `safe-markdown.tsx` (sanitized Markdown rendering,
  already verified safe); `src/components/brand/mark.tsx`'s already-fixed
  real-logo-with-cream-plate dark-mode treatment from the prior completion
  pass.
- **Existing implementation to REFACTOR**: add the master plan's typed
  section registry (`HERO`, `RICH_TEXT`, `CARD_GRID`, `MEDIA_SPLIT`, `CTA`,
  `STAT_ROW`, `FAQ`, `ENTITY_LIST`) as validated rendering props rather than
  loosely-typed section data, so an unknown/invalid section fails safely in
  Admin preview without crashing a public page; `src/components/brand/
  mark.tsx` to resolve the logo from `site_settings.org_logo_media_id`
  through the media relation (rather than only the static fallback it
  currently always uses, per the master plan's gap finding that "DB logo
  relation not consumed").
- **Existing implementation to REMOVE/MIGRATE**: none — this phase is
  additive over already-correct schema and mostly-correct rendering.
- **Exact files/modules likely affected**: `src/components/content/**`,
  Admin content/media/articles routes, `src/lib/data/site-content.ts`,
  `src/lib/data/editorial.ts`, `src/components/brand/mark.tsx`, header/
  footer/Auth/Admin brand consumers.
- **Supabase/database contract relied upon**: `media(storage_bucket,
  storage_path)` uniqueness, `site_settings.org_logo_media_id → media(id)
  ON DELETE SET NULL` (already live — no migration), `hills-public` bucket
  MIME/size limits (already live).
- **Auth/security impact**: Admin-only upload/write/archive; public reads
  limited to active, non-deleted, published content; sanitized Markdown
  (already verified) is retained, not weakened by the section-registry
  change.
- **Realtime impact**: none required.
- **EN/AR/RTL impact**: translation editor parity for every section type;
  a clear "missing Arabic translation" indicator in the Admin editor.
- **UI impact**: typed section renderer/editor, media library/picker
  reusable across coffees/origins/articles/CMS/settings, dynamic logo
  preview with static fallback.
- **Tests required BEFORE change**: current Admin CMS/media mutation
  characterization; existing sanitized-Markdown/XSS tests as a baseline;
  logo-navigation reproduction (confirm the current always-static-fallback
  behavior before changing it).
- **Implementation tasks**: build the section-type registry with validated
  props; wire `BrandMark` to resolve `org_logo_media_id` with the existing
  official static asset as the fallback on any missing/invalid reference
  (FR-047); add reference-aware archive warnings for media (FR-048); build/
  confirm the reusable media picker.
- **Tests required AFTER change**: CRUD/publish/archive tests for CMS and
  media; invalid-media and reference-warning tests; XSS/sanitization
  regression tests; logo-change/restore tests across every shell (public,
  Auth, Admin), both themes, and both locales; missing-translation/missing-
  media graceful-degradation tests.
- **Runtime acceptance criteria**: real content drives the appropriate
  section types; the logo never disappears (falls back correctly); no
  copied or unlicensed asset is introduced; the existing `org_logo_
  media_id` relation is reused, not duplicated.
- **Rollback/checkpoint strategy**: logo resolution can point back to
  `NULL`/static-only behavior instantly (it is the existing fallback path,
  not a new one); the section registry can reject unknown sections safely
  without needing a rollback, by design.
- **Risks**: deleting a still-referenced media row; cache staleness on logo
  change; invalid section JSON reaching a public page if the registry
  validation has a gap.
- **Explicitly out of scope**: hardcoding business-data imagery from
  `public/images` (Constitution Principle IX); any unapproved legal/contact
  content; changing the existing logo column/relation.

## Phase 9 — Public design and motion rebuild

- **Goal**: Deliver `spec.md` User Story 6's remaining public-experience half
  and User Story 7's visual/motion requirements — the Hills-specific
  premium homepage/header/footer/public templates and restrained,
  accessible motion, implementing only the already-approved Sucafina
  interaction patterns.
- **Dependencies**: Phases 2, 4, 6, 8.
- **Existing implementation to KEEP**: existing brand tokens (`#173C32`,
  `#EEE4D1`, `#CE8A39`, `#A44819`) and their already-fixed AA-contrast
  `--gold-text`/darkened-muted variants from the prior completion pass;
  `src/components/motion/reveal.tsx`'s existing `Reveal`/`Stagger`
  primitives as the base to extend, not replace; the already-accessible
  mobile menu (dialog semantics, focus trap/restore, 44px targets,
  confirmed by the prior pass's Playwright suite).
- **Existing implementation to REFACTOR**: expand
  `src/components/motion/**` to the full primitive set from the master
  plan's Motion System table (`PageReveal`, `SectionReveal`, `ImageReveal`,
  `HoverLift`, `NavUnderline`, `MegaMenuReveal`, `DrawerReveal`,
  `AccordionExpand`, `FilterTransition`, `Toast`, `Modal`, `Status`), each
  with the specified duration/easing and reduced-motion equivalence; the
  homepage section sequence per the master plan's Homepage Plan table
  (hero → sourcing proposition → featured coffees → origin discovery →
  quality story → two warehouse sections → account CTA → latest knowledge →
  footer).
- **Existing implementation to REMOVE/MIGRATE**: any homepage section that
  currently substitutes fabricated content for empty data — replaced with
  the approved editorial empty state.
- **Exact files/modules likely affected**: `src/app/[locale]/(marketing)/
  page.tsx` (post-Phase-2 location), `src/components/navigation/**`,
  `src/components/motion/**`, `src/app/globals.css`, image configuration,
  `messages/en.json`/`messages/ar.json`.
- **Supabase/database contract relied upon**: read-only — featured coffees/
  origins (`is_featured`/`featured_sort_order`, already live columns per
  `data-model.md`), latest published articles, the two warehouse rows.
- **Auth/security impact**: header viewer state and price gates must be
  unchanged by this visual work — no client-side price expansion introduced
  by a new homepage section.
- **Realtime impact**: none.
- **EN/AR/RTL impact**: complete copy/layout/motion-direction parity,
  including RTL-correct entrance directions where meaning is directional.
- **UI impact**: this phase's entire purpose — see Goal.
- **Tests required BEFORE change**: screenshot/axe/performance baselines on
  the current homepage/header/footer; empty-state verification (the live
  database currently has 0 coffees/origins/articles, so this phase's empty
  states are immediately testable, not hypothetical).
- **Implementation tasks**: build the motion primitive set; compose the
  homepage from static/CMS/DB sources per the Homepage Plan; implement
  header/footer per the Header Auth State and Footer Plan sections;
  implement only the approved Sucafina interaction rows (cite the specific
  table row in the PR/commit for traceability, per `research.md` §9).
- **Tests required AFTER change**: full public visual-regression matrix
  (`toHaveScreenshot`, per `research.md` §8) across the screen×theme×
  locale×viewport grid in the master plan's Visual Regression Matrix;
  keyboard/axe pass; route/locale/theme/logo repetition test; console gate;
  LCP/CLS checks; both empty-data and (once fixtures exist) loaded-data
  states.
- **Runtime acceptance criteria**: a visually distinctive Hills system with
  real content, no Sucafina copy/asset, usable from 375px through 1440px+
  in both themes and both locales, with restrained, reduced-motion-safe
  interaction.
- **Rollback/checkpoint strategy**: component-by-component commits; each
  homepage section can be reverted independently since sections are
  data-source-isolated (static/CMS/DB) per the Homepage Plan's ownership
  column.
- **Risks**: LCP regression from hero media; motion bundle size; contrast
  regression in a new section; visual drift from the brand guide.
- **Explicitly out of scope**: any change to data/Auth/DB policy, public
  URLs, business facts, or protected-price behavior.

## Phase 10 — Admin interaction and responsive redesign

- **Goal**: Complete task-specific Admin UX across every existing module and
  device size, building on the Lead Inbox/Users pattern from Phases 5 and 7.
- **Dependencies**: Phases 5, 7–9.
- **Existing implementation to KEEP**: the already-gated, allow-listed
  `admin-operations.ts` mutation layer for the remaining 14 modules not
  touched by Phases 5/7 (products, offers, pricing, origins, regions,
  warehouses, taxonomy, varieties, media, articles, article-categories,
  content, settings, audit) — reused, not rewritten, per `research.md` §6.
- **Existing implementation to REFACTOR**: incrementally replace the
  generic `[module]` list/detail UX with task-specific pages **only** for
  modules where the generic pattern is demonstrably insufficient (the
  master plan's explicit REPLACE criterion), following the same
  characterize-first discipline used in Phases 5 and 7.
- **Existing implementation to REMOVE/MIGRATE**: the generic `[module]`/
  `[module]/[id]` router is retained as the shared adapter underneath any
  module not yet given a dedicated page — it is not deleted until every
  module has an equivalent dedicated implementation.
- **Exact files/modules likely affected**: remaining Admin module routes,
  `src/components/admin/**` (nav, action/module forms, record editor,
  offer picker), Admin data/actions per module as split.
- **Supabase/database contract relied upon**: no new tables; per-module
  queries already exist and are reused.
- **Auth/security impact**: preserve the per-action `requireAdmin()`
  guard/audit already present in every existing mutation; no new client
  trust introduced by any redesigned form.
- **Realtime impact**: none required.
- **EN/AR/RTL impact**: all modules/forms/tables/drawers/statuses localized
  and RTL-safe, matching the shell-level work already done in Phase 5.
- **UI impact**: grouped nav (already implemented), responsive list/detail/
  edit, sticky primary actions, clear empty/loading/error/conflict states,
  audit-log links surfaced from relevant record views.
- **Tests required BEFORE change**: mutation inventory and per-module CRUD
  characterization for whichever modules are touched; current mobile/
  short-height screenshots as a baseline (the prior pass already fixed the
  sidebar height bug — confirm it holds, don't re-diagnose it).
- **Implementation tasks**: for each module needing replacement, build the
  task-specific list/detail/edit surface reusing `admin-operations.ts`'s
  validated mutation functions; add search/filter/page state where
  beneficial; accessible confirmation dialogs for destructive/archival
  actions; mobile cards/drawers for dense modules.
- **Tests required AFTER change**: each touched module's CRUD path with
  fixtures; validation/conflict/archive tests; keyboard/axe pass; theme/RTL
  pass; the full responsive matrix (375/768/1024/1280×650/1440) for touched
  modules.
- **Runtime acceptance criteria**: every touched module is operable on
  mobile/tablet/short-desktop and preserves its existing business semantics
  exactly (no behavior regression from the redesign).
- **Rollback/checkpoint strategy**: retain the tested generic editor
  adapter for any module not yet migrated; revert one module's redesign
  independently of any other; never roll back authorization/audit logic as
  part of a UI revert.
- **Risks**: regression across many modules if characterization is skipped;
  oversized forms; table overflow at narrow widths; inconsistent
  generic-vs-specific UX if the migration criterion is applied
  inconsistently.
- **Explicitly out of scope**: the role model, catalog semantics, any
  module/feature not already supported, production records during QA.

## Phase 11 — Cross-cutting accessibility, i18n, theme, and domain errors

- **Goal**: Close systemic quality gaps once major UI paths are stable —
  finish the `ActionResult`/toast contract migration everywhere, and
  converge every remaining page on the shared accessibility/theme/i18n
  primitives.
- **Dependencies**: Phases 3–10.
- **Existing implementation to KEEP**: the message-parity Vitest test
  already added in the prior completion pass (`src/i18n/messages.test.ts`)
  — extend its coverage, don't replace its mechanism; the existing
  reduced-motion CSS block.
- **Existing implementation to REFACTOR**: any remaining `locale === "ar"
  ? ... : ...` inline ternary (the prior pass already removed 29 of these —
  finish the remainder surfaced by any new code from Phases 2–10); any
  remaining action not yet on the `ActionResult` contract from
  `contracts/action-result.md`; any remaining custom dialog not yet using
  an accessible primitive with proven focus trap/restore.
- **Existing implementation to REMOVE/MIGRATE**: raw error strings reaching
  a `messageKey`-shaped field anywhere in the codebase (a grep-able,
  closeable gap).
- **Exact files/modules likely affected**: providers, design-system
  primitives, `messages/en.json`/`ar.json`, global styles, form/action
  helpers, error/not-found/loading boundaries, every feature using a
  dialog/toast/live-region.
- **Supabase/database contract relied upon**: none new.
- **Auth/security impact**: errors redact internals everywhere (Constitution
  Principle XII, mechanically checkable via `action-result.md`);
  unauthorized states remain visually and behaviorally distinct from
  "not found."
- **Realtime impact**: none.
- **EN/AR/RTL impact**: full parity re-verified after Phases 2–10's new
  surfaces; native-language review pass on any newly-added copy (sample
  status labels, block messaging, etc.).
- **UI impact**: standardized toast/form/focus/loading/empty/error/theme
  states across every remaining page.
- **Tests required BEFORE change**: message-parity report; axe/keyboard
  inventory across every route added or changed in Phases 2–10; a grep-
  based raw-error-leak scan as a baseline.
- **Implementation tasks**: finalize `ActionResult` adoption everywhere;
  map every domain error code to a message key in both locales; migrate any
  remaining inaccessible dialog; audit focus order/44px targets/contrast/
  logical CSS properties across all new pages; complete localized 404/error
  pages (already correct at the routing-status level from the prior pass —
  verify copy/locale parity on top of that correct status behavior).
- **Tests required AFTER change**: zero-diff message-parity check; axe pass
  across every persona-relevant page; manual keyboard scripts for menu/
  dialog/form/table/live-region interactions; contrast/reflow/reduced-motion
  checks; a repo-wide raw-error-leak scan returning zero hits.
- **Runtime acceptance criteria**: WCAG 2.2 AA target met for all core
  journeys (SC-007); no raw backend error reachable by any tested action;
  every action state is localized and theme-safe.
- **Rollback/checkpoint strategy**: migrate feature-by-feature with a
  temporary compatibility adapter for any old result shape still in use;
  revert one primitive only together with its consumers.
- **Risks**: translation errors introduced under time pressure; live-region
  noise from over-eager status announcements; inconsistent mixed old/new
  result shapes mid-migration.
- **Explicitly out of scope**: any business-outcome or authorization-
  distinction change; server-side error logging content (that stays
  detailed for operators — only the client-facing shape is redacted).

## Phase 12 — Authenticated E2E, visual regression, and staging acceptance

- **Goal**: Prove real five-persona flows, DB/RLS/storage behavior, and
  visual/console quality in safe staging — the phase that turns every
  "runtime acceptance criteria" claim above into recorded evidence.
- **Dependencies**: Phases 0–11 and an approved staging Supabase project
  with an approved email-testing strategy.
- **Existing implementation to KEEP**: the existing `tests/e2e/**` suite
  (110 runs across desktop/mobile projects from the prior pass) as the
  anonymous-persona baseline — extend it with authenticated personas rather
  than replacing it.
- **Existing implementation to REFACTOR**: `tests/e2e/helpers.ts` to add
  persona session fixtures (real sign-in, not faked cookies/sessions —
  Constitution-adjacent QA integrity requirement carried over from the
  master plan's explicit "never fake sessions" rule).
- **Existing implementation to REMOVE/MIGRATE**: none.
- **Exact files/modules likely affected**: `tests/e2e/**`,
  `playwright.config.ts`, a new test-only seed/cleanup script (run outside
  the browser bundle, using a CI secret, never a `NEXT_PUBLIC_` credential).
- **Supabase/database contract relied upon**: staging-only rows/objects/
  users following the master plan's Test Data Strategy fixture-prefix and
  cleanup-in-reverse-FK-order rules; a fail-closed guard that refuses to run
  destructive fixture operations against anything not explicitly marked as
  the staging project.
- **Auth/security impact**: persona secrets stored in CI secret storage
  only, redacted from logs/screenshots; cross-user/RLS/blocked/service-role
  bundle-exposure tests included.
- **Realtime impact**: if any Realtime subscription was added in Phases 5/7,
  its scoping is verified here under real concurrent staging sessions.
- **EN/AR/RTL impact**: every important shell/path switch tested in both
  directions under real authenticated sessions, not just anonymously.
- **UI impact**: none new — this phase proves what Phases 1–11 built.
- **Tests required BEFORE change**: unit/type/lint/build green; fixture
  target-project guard verified (refuses to run against a non-staging URL);
  cleanup dry run; the existing anonymous public smoke suite green.
- **Implementation tasks**: provision the five personas and minimum dataset
  from the master plan's Test Data Strategy; build reusable authenticated-
  session fixtures; automate every persona journey listed in `spec.md`'s
  acceptance scenarios that does not require a real inbox click; define the
  manual email-acceptance checklist for the one step that does; add the
  console/overlay gate to every authenticated test, not only the anonymous
  suite; run the full responsive/short-desktop/accessibility matrix under
  authenticated sessions.
- **Tests required AFTER change**: the full `npm` static-gate suite plus
  repeated clean fixture runs with verified cleanup; the complete Persona
  Matrix from the master plan (public discovery, price absent/present,
  favorites, sample request, account, sign-in, Admin entry/workspace,
  locale/theme/path preservation) for all five personas; manual live-email
  acceptance signed off separately.
- **Runtime acceptance criteria**: zero unexplained failures/skips in the
  required automated matrix; every manual-only case is explicitly
  identified and signed, not silently treated as passing; no leaked
  fixture data or secret in any artifact; visual diffs reviewed and
  approved, not auto-accepted; console clean across every persona.
- **Rollback/checkpoint strategy**: cleanup runs by fixture-run manifest,
  removing only that run's rows/objects/users after confirming the target
  is staging; a defective product commit is reverted on its own, never by
  loosening a test's acceptance threshold.
- **Risks**: flaky email/provider timing; fixture pollution across parallel
  runs; accidentally targeting a non-staging project; screenshot-baseline
  churn from legitimate UI changes needing re-approval.
- **Explicitly out of scope**: any production data or account; relaxing a
  security control "for test convenience"; treating an ignored console
  error as acceptable; claiming a fake email-success result.

## Phase 13 — SEO, performance, security, and production-readiness audit

- **Goal**: Validate the complete system against every Final Acceptance
  Gate in the master plan and this plan's `spec.md` Success Criteria, and
  produce an evidence-based release recommendation — not a fresh redesign
  pass.
- **Dependencies**: Phases 0–12.
- **Existing implementation to KEEP**: `src/lib/seo/**` (metadata,
  canonical-host fail-fast behavior, Organization/Article schema,
  breadcrumbs — already implemented and unit-tested per the prior
  completion pass); `src/app/robots.ts`/`sitemap.ts` (already fixed to
  exclude private routes without trailing-slash mismatches, per the prior
  pass's real crawlability-bug fix).
- **Existing implementation to REFACTOR**: sitemap segmentation, only if
  Phase 6's real-data volume warrants it (the master plan's "replace
  monolithic sitemap if scale warrants" is explicitly conditional, not
  automatic); any query index, only after `EXPLAIN`-backed evidence from
  Phase 6/10 at real data volume.
- **Existing implementation to REMOVE/MIGRATE**: none unconditionally — any
  removal here must be evidence-driven.
- **Exact files/modules likely affected**: `src/lib/seo/**`,
  `src/app/robots.ts`/`sitemap.ts`, image/font/cache configuration,
  deployment/env documentation, the final execution report.
- **Supabase/database contract relied upon**: query-plan review only;
  any index proposal is a separate, owner-approved unit, never silently
  applied during this audit.
- **Auth/security impact**: final RLS/service-role/headers/cookies/
  redirect/cache review and a secret-exposure scan (confirm
  `SUPABASE_SERVICE_ROLE_KEY` never reaches a browser bundle or log).
- **Realtime impact**: final confirmation that `offer_price_tiers` and
  `audit_logs` remain outside the publication and that no subscription
  added in any earlier phase violates `research.md` §3's scoping rule.
- **EN/AR/RTL impact**: canonical/hreflang/schema/content parity and
  localized 404 checks, full production-like crawl in both languages.
- **UI impact**: only measured performance/accessibility/SEO fixes — no
  late redesign (explicitly matching the master plan's own constraint for
  this phase).
- **Tests required BEFORE change**: Phase 12 fully complete; a production-
  like build; a crawl and Core Web Vitals baseline; DB query plans at
  whatever real data volume exists by this point.
- **Implementation tasks**: validate canonical host/redirect/sitemap/robots/
  schema against the final confirmed production hostname decision;
  performance-budget review (bundle, images, fonts, cache, query count);
  an OWASP-style boundary review against the master plan's Security Plan
  table; backup/runbook/monitoring documentation; a release checklist.
- **Tests required AFTER change**: the full `npm` suite; a crawl; schema
  validators; a no-price scan across every public route (SC-008); a
  Lighthouse/WebPageTest-equivalent pass; an RLS regression pass; a
  deployment smoke test and rollback rehearsal.
- **Runtime acceptance criteria**: every Final Acceptance Gate in the
  master plan (Product/data, Architecture/runtime, Auth/security,
  UX/design, SEO/performance/quality) has current, dated evidence attached
  or an explicit, owner-approved exception — never an unverified assertion.
- **Rollback/checkpoint strategy**: deployment rollback to the last known-
  good build; all new database-adjacent reads remain additive/backward
  compatible so no data rollback is anticipated; any new query/feature can
  be disabled via a documented flag/adapter if a late issue is found.
- **Risks**: canonical-host mismatches if the business decision is finalized
  late; cache leaks discovered only under real production traffic patterns;
  false performance confidence from an unrepresentative staging data
  volume.
- **Explicitly out of scope**: any product-scope change, any URL/schema
  change without a fresh migration-approval cycle, any production
  DB/Auth-record action during the audit itself, lowering an acceptance
  threshold to force a pass.

---

## Dependency Graph

Corrected during consistency analysis: the master plan's phase-level
backbone is kept, but Phase 5's own stated dependency ("Phases 1–4") and its
individual tasks (P5-T01 needs Phase 4 complete; P5-T04 needs `P4-T01`) mean
Phase 5 is **not** freely parallel with Phase 4 as an earlier version of
this graph implied. Phase 6 has no such dependency and remains parallel with
Phase 4.

```text
Phase 0 evidence + owner decisions
├── canonical/locale decisions ──> Phase 2 architecture/proxy ──> Phase 3 Auth redirects
│                                  ├──> Phase 6 catalog/origins
│                                  ├──> Phase 8 CMS/media/logo
│                                  └──> Phase 9 public design
├── DB verification + owner-approved hardening (Phase 1) ──> avatar/blocked-state consumers
│                                ├── avatar ──> Phase 4 account ──> header avatar
│                                │                              └──> Phase 5 Users detail (avatar view needs P4-T01)
│                                ├── blocked state ──> Phase 3 guards ──> Phase 5 users/blocking
│                                ├── profiles/avatars RLS hardening (P1-T04) ──> Phase 3/4 blocked-session evidence
│                                ├── sample statuses ──> Phase 7 Lead Inbox/timeline
│                                └── sample uniqueness index ──> Phase 7 concurrency behavior (already live)
├── staging/persona approval ─────────────────────────────────────> Phase 12 real E2E
└── assets/content/license approval ──> Phase 8 ──> Phase 9

Phase 3 Auth ──> Phase 4 account ──> Phase 5 Admin (Users/blocking)
                                  └──> Phase 6 catalog (parallel with Phase 4/5, no shared dependency)

Phase 3 + Phase 4 + Phase 5 + Phase 6
└──> Phase 7 complete sample journey

Phase 6 data/query + Phase 8 content/media
└──> Phase 9 public rebuild

Phases 5 + 7 + 8 + design tokens
└──> Phase 10 Admin redesign

Phases 3–10
└──> Phase 11 cross-cutting quality
    └──> Phase 12 authenticated/visual staging proof
        └──> Phase 13 SEO/performance/security production audit
```

**Critical path**: `0 → 1 → 2 → 3 → {4, 6} → 5 → {7, 8} → {9, 10} → 11 → 12 → 13`.
Phase 4 and Phase 6 may run in parallel once Phase 3 is gated, with clear
file ownership to avoid collisions on shared files (`src/lib/auth/
session.ts`, `src/components/navigation/site-header.tsx`). **Phase 5 is not
freely parallel with Phase 4**: Phase 5's own dependency line is "Phases
1–4," and concretely its Users workspace (`P5-T01` dashboard re-verification,
`P5-T04` avatar-view-only detail) consumes Phase 4's avatar-resolving
component and completed account actions — so Phase 5's gate (`P5-T06`)
cannot close until Phase 4's gate (`P4-T08`) has passed. Only Phase 5's
Site/Profile/Account settings work (`P5-T05`) has no such dependency and
could in principle start earlier, but for planning and staffing purposes
Phase 5 as a whole is scheduled after Phase 4, not alongside it. Phase 6 has
no dependency on Phase 4 or Phase 5 and remains freely parallel with both.

## Runtime Evidence Traceability

Every capability the planning brief requires real runtime evidence for maps
to the phase that produces it and the `quickstart.md` row that proves it:

| Capability | Produced by | Proven by |
|---|---|---|
| Signup | Phase 3 | `quickstart.md` Signup row |
| Email verification | Phase 3 | `quickstart.md` Email verification row |
| Sign-in (incl. blocked/admin) | Phase 3 | `quickstart.md` Sign-in row |
| Blocked user | Phases 1, 3, 5 | `quickstart.md` Blocked user row |
| Account | Phase 4 | `quickstart.md` Account row |
| Protected pricing | Phase 6 | `quickstart.md` Protected pricing row |
| Favorites | Phase 4 | `quickstart.md` Favorites row |
| Sample request | Phase 7 | `quickstart.md` Sample request row |
| Admin login | Phases 2, 3, 5 | `quickstart.md` Admin login row |
| Admin CRUD | Phases 5, 10 | `quickstart.md` Admin CRUD row |
| CMS publish | Phase 8 | `quickstart.md` CMS publish row |
| Language switching (incl. the script-tag defect) | Phase 2 | `quickstart.md` Language switching row |
| Dark/light | Phases 9, 10 | `quickstart.md` Dark/light row |
| Responsive | Phases 9, 10 | `quickstart.md` Responsive row |

None of these are considered proven by file existence alone, per the
planning brief's explicit instruction and Constitution Principle XIV — each
requires the artifact `quickstart.md` describes, collected no earlier than
Phase 12 for any authenticated-persona row.

---

# Pre-Phase 12 Owner Alignment Addendum: Public RFQ, Public Sample Requests & Buyer Journey

Plans `spec.md` FR-069–FR-083 only. This is not Phase 12 and is not
numbered into the Phase 0–13 sequence — it is a bounded unit of work to be
completed and gated before Phase 12 begins, exactly as `spec.md`'s own
addendum section describes. Nothing below revises the Constitution Check,
Project Structure, Complexity Tracking, or any Phase 0–13 section above;
this block carries its own equivalent sections, scoped to this addendum
only.

## Corrected routing decision: `/request-a-quote` is the canonical RFQ route

An earlier pass of this plan proposed a new `/request-an-offer` route,
reasoning from the audit below. The owner corrected this: **the SEO
architecture already treats `/request-a-quote/` as the canonical RFQ route**
— there is to be no parallel route. "Request an Offer" is CTA/copy wording
only and must link to `/request-a-quote`, never to a second URL.

The audit itself still matters, because it is what makes the correct scope
of the change precise: `src/app/[locale]/(site)/request-a-quote/page.tsx`
already exists, and today it is:

| | Current behavior |
|---|---|
| Gate | `requireVerifiedUser()` — the whole page requires a session |
| Anonymous visitor's experience today | A "sign in to continue" prompt — no form is rendered at all |
| Signed-in shape | Picks **one specific offer** from a dropdown; `RequestQuoteForm` calls `createProductInquiry` |
| Inquiry type created (signed-in path) | `PRODUCT` |
| Indexability | `robots: { index: false, follow: true }` — currently non-indexable, like an account utility page |
| Profile completeness (signed-in path) | Requires phone/address/country already on file (FR-036) |

**Decision**: extend this page rather than build a second one. Its `page.tsx`
gains a **third branch**, alongside its existing two (`viewer && offers.length`
→ `RequestQuoteForm`; `viewer` with no offers → empty state): when there is
**no** `viewer` at all, render a new, coffee-agnostic anonymous form calling
`submitPublicRfq` (`type = 'GENERAL'`) instead of today's sign-in prompt.
Nothing about the signed-in branches changes — `requireVerifiedUser()` stays
exactly where it is for them, `RequestQuoteForm`/`createProductInquiry` is
untouched, and a signed-in verified customer sees exactly what they see
today. Only the *anonymous* branch's content changes, from a dead-end prompt
to a working, unauthenticated form.

Two consequences of the page becoming genuinely public follow directly and
are in scope:

- **`generateMetadata`'s `robots: { index: false, follow: true }` override
  must be removed** (or set to indexable) for the fallback (non-CMS) case —
  the page is no longer authenticated-only, so FR-061's "every indexable
  public page carries a canonical URL and EN/AR alternates" now applies to
  it. If a CMS override for `request-a-quote` already exists, its own
  robots directive is unaffected by this change.
- **`/request-a-quote` must be added to `src/app/sitemap.ts`'s
  `staticPaths`** — it is not there today (correctly, since the page was
  authenticated-only) and needs to be now.
- `/request-a-quote` is **already** in `src/lib/auth/redirects.ts`'s
  `knownRoots` — no change needed there.
- `/request-a-quote` is **not** currently in `tests/e2e/helpers.ts`'s
  `PUBLIC_ROUTES` (it was correctly excluded while authenticated-only) and
  needs to be added now that an anonymous visitor has a real, working path
  through it.

No parallel route is created. No second page exists. "Request an Offer" as
copy/CTA wording points at `/request-a-quote` everywhere it appears.

## Constitution re-check (addendum-scoped)

| Principle | Check | Status |
|---|---|---|
| I. Platform Identity & Scope | FR-082 explicitly forbids any cart/checkout/payment/seller/custody/trading mechanic; "Buy Available Lots"/"Trade With Hills" are positioning copy only | PASS |
| IV/V. Authoritative authorization / protected-access gate | The new path grants no capability at all — it is unauthenticated by design, and `submit_public_inquiry`'s parameter allow-list is the enforcement mechanism (`research.md` #12) | PASS |
| VI. Admin/Customer Entitlement Separation | Unaffected — nothing in this addendum touches pricing or Admin's browsing-path access | PASS |
| XII. No Raw Backend Error Exposure | `public-inquiry-actions.md` maps every failure (including the DB function's raised exceptions) to the closed `ActionResult` vocabulary; no new domain error code is introduced (`DUPLICATE_SAMPLE`/`RATE_LIMITED` already exist) | PASS |
| XIII. Preserve Correct Existing Business Logic | `createProductInquiry`, `createSampleRequestInquiry`, `hydrate_inquiry_context()`, and `validate_inquiry_status_transition()` are all explicitly named as unchanged. `/request-a-quote` itself is extended (a new anonymous branch added) but its existing signed-in branches, gate ordering, and `RequestQuoteForm`/`createProductInquiry` call are untouched — see "Corrected routing decision" above | PASS |
| XIV. Evidence-Based Completion | `quickstart.md`'s new addendum section is the gate; every row requires an artifact, none is proven by file existence | PASS |
| XV. Database Contract Governance | **Two new migrations, two different approval statuses, never conflated**: Migration A (reconciliation) records an **already owner-approved, already-applied** delta — no new approval needed to apply it. Migration B (`submit_public_inquiry`) is genuinely new schema and **does** need explicit owner approval before being applied, exactly like `P1-T04`. The anti-abuse mechanism introduces no schema of its own (`research.md` #16). No migration in this addendum is silent or inferred, and neither migration touches, renames, or replaces an existing file | PASS |
| XVI. Security and Correctness Precedence | The write boundary is a single, narrow, revocable function grant rather than a broadened RLS policy (`research.md` #12) | PASS |
| XIX. npm-Only Tooling | No new npm dependency of any kind — no CAPTCHA vendor package, no Redis/Upstash client (`research.md` #16). The CAPTCHA/Redis avoidance itself is the owner's clarified decision (`spec.md` Clarifications), not something Principle XIX independently requires — this row confirms no *tooling* violation, not that XIX mandated the choice | PASS |

**Gate result**: PASS, no violations, no new Complexity Tracking entry
needed — every deferral (confirmation email, CAPTCHA, durable per-IP rate
limiting) is an owner-approved or research-justified scope boundary, not an
unaddressed constitutional tension.

## Project Structure delta (addendum-scoped)

```text
specs/001-platform-implementation-spec/
├── contracts/
│   └── public-inquiry-actions.md          # NEW — this planning pass
├── migrations/
│   ├── PP12-T01_inquiries_public_rfq_sample_reconciliation.sql   # NEW —
│   │     Migration A. "PP12" = Pre-Phase-12, deliberately NOT "P1-..." —
│   │     this is not Phase 1 work.
│   └── PP12-T02_submit_public_inquiry_function.sql               # NEW —
│         Migration B. A distinct file from Migration A: different content,
│         different approval status (see Constitution re-check, Principle
│         XV, above). Exact filenames/task IDs may be finalized by
│         /speckit-tasks; neither existing migration file is renamed,
│         edited, moved, or rewritten by either.
├── research.md            # extended: §§11–20 (this planning pass)
├── data-model.md           # extended: Inquiry entity note + addendum section
└── quickstart.md           # extended: addendum validation section

src/app/[locale]/(site)/
  request-a-quote/page.tsx         # EXTENDED — new anonymous (no-`viewer`)
                                    #   branch calling `submitPublicRfq`;
                                    #   robots override removed/flipped to
                                    #   indexable. Existing `viewer`/
                                    #   `viewer && offers.length` branches,
                                    #   `RequestQuoteForm`, and
                                    #   `createProductInquiry` untouched.
                                    #   THIS IS THE ONLY RFQ ROUTE — no
                                    #   parallel page is created.
  green-coffee-offer-list/[slug]/page.tsx   # EXTENDED — anonymous "Request a
                                             #   sample" trigger alongside the
                                             #   existing signed-in one
  page.tsx (home) / about/ / contact/       # EXTENDED (copy/positioning
                                             #   sections only) per FR-079

src/app/sitemap.ts                   # EXTENDED — add "/request-a-quote" to
                                      #   staticPaths (not there today,
                                      #   correctly, while authenticated-only)
tests/e2e/helpers.ts                  # EXTENDED — add "/request-a-quote" to
                                      #   PUBLIC_ROUTES
src/lib/auth/redirects.ts             # UNCHANGED — "/request-a-quote" is
                                      #   already in knownRoots

src/actions/
  inquiries.ts                     # UNCHANGED (createProductInquiry,
                                    #   createSampleRequestInquiry)
  public-inquiries.ts               # NEW — submitPublicRfq,
                                    #   submitPublicSampleRequest
                                    #   (public-inquiry-actions.md)

src/components/inquiries/
  inquiry-panel.tsx                 # EXTENDED (anonymous sample branch only;
                                    #   PRODUCT branch and the entire
                                    #   authenticated path untouched)
  public-rfq-form.tsx               # NEW — the anonymous branch of
                                    #   request-a-quote/page.tsx, not a new
                                    #   page of its own
  public-sample-request-form.tsx    # NEW (or a shared component parameterized
                                    #   for both — a task-level, not plan-level,
                                    #   choice)
  request-quote-form.tsx            # UNCHANGED

src/lib/
  rate-limit/public-inquiries.ts    # NEW — the in-process per-IP sliding
                                    #   window (`research.md` #16); per-email
                                    #   limiting lives inside the database
                                    #   function instead, not here

messages/en.json, messages/ar.json   # EXTENDED — a new namespace for the RFQ
                                     #   page + form copy, and the new
                                     #   anonymous sample-request form's
                                     #   labels/errors; both languages, same
                                     #   keys, per the project's standing
                                     #   parity test
```

**Structure decision**: every new file sits inside an existing top-level
directory that already holds its kind of file (`src/actions`,
`src/components/inquiries`, `src/lib`) — no new top-level directory, no move
of anything existing. This mirrors how the rest of this plan already treats
structural change: incremental, file-group by file-group, never a
restructuring commit riding along with a feature change.

## A. DB/repository migration reconciliation — Migration A

**Scope**: FR-083 only. One new file (Migration A of two — see section B for
Migration B),
`specs/001-platform-implementation-spec/migrations/PP12-T01_inquiries_public_rfq_sample_reconciliation.sql`.
**Purpose in one line**: reconcile the repository's migration history with a
database delta the owner already applied and verified live — it represents
an existing fact, it does not introduce a new one.

- **Status the file itself will declare**: `ALREADY APPLIED LIVE` — unlike
  `P1-T04` (pending), this file documents a delta the owner already applied
  and this planning pass already re-verified empirically (`research.md`
  #11). Running it against the current database must be a safe no-op;
  running it against a clean database (the full migration sequence from
  scratch) must produce the identical end state.
- **Contents** (idiom decided, exact statements authored at implementation
  time — `research.md` #15): `BEGIN;` → `ALTER TABLE public.inquiries DROP
  CONSTRAINT IF EXISTS inquiries_product_needs_user` → `ADD CONSTRAINT
  inquiries_product_needs_user CHECK (type = 'PRODUCT'::inquiry_type =
  false OR user_id IS NOT NULL)` (exact boolean form to be finalized against
  the live constraint's actual current text, read once more at
  implementation time rather than re-typed from memory) → `CREATE UNIQUE
  INDEX IF NOT EXISTS uq_inquiries_active_sample_anon_email_coffee ON
  public.inquiries (lower(btrim(email)), coffee_id) WHERE type =
  'SAMPLE_REQUEST' AND user_id IS NULL AND status IN ('NEW','RECEIVED',
  'CONTACTED','SAMPLE_SENT','DELIVERED')` → `COMMIT;`.
- **Explicitly not touched** (stated in the file itself, mirroring `P1-T04`'s
  "Explicitly NOT changed by this migration" section): `uq_inquiries_active_
  sample_user_coffee`, `hydrate_inquiry_context()`,
  `validate_inquiry_status_transition()`, every other constraint/trigger/
  index on `inquiries`, every other table.
- **No generated snapshot is hand-edited.** `src/lib/supabase/types.generated.ts`
  and `docs/HILLS_SUPABASE_CURRENT_STATE.md` are both already stale relative
  to the live database on this one constraint (`research.md` #11); the task
  that authors this migration must also regenerate whichever of those two
  is produced by tooling (not retype by hand) rather than leave the
  discrepancy standing.
- **Owner approval status**: none needed to *apply* this file, since it
  reconciles a delta the owner already approved and applied directly — but
  the file itself, and the fact that it is being added now, should still be
  shown to the owner before being run anywhere, as a courtesy diff-review,
  not as a new approval gate.

## B. Server/security boundary — Migration B

**Scope**: FR-081, FR-078. One new Postgres function
(`public.submit_public_inquiry`, `research.md` #12) plus its Next.js call
sites. This function is its own migration — Migration B of two — in a file
distinct from Migration A (section A), because its content and its approval
status are both different: Migration A represents an already-approved,
already-live fact; Migration B is genuinely new schema.
**Purpose in one line**: create the one narrow, revocable, anonymous-callable
write boundary this whole addendum's public-facing side depends on.

- **File**: `specs/001-platform-implementation-spec/migrations/PP12-T02_submit_public_inquiry_function.sql`
  (name may be finalized by `/speckit-tasks`; never the same file as
  Migration A, and neither file touches, renames, or rewrites an existing
  migration).
- **Owner approval status**: unlike Migration A, this one **does** need
  explicit owner approval before being applied — it is new schema, not a
  record of something already live, exactly like `P1-T04`'s pending status.
- **Required content, all of it explicit in the file** (mirroring `P1-T04`'s
  structure — header/purpose, predicate rationale, `BEGIN`/`COMMIT`,
  "explicitly not changed," post-application verification, commented-out
  rollback):
  - `SECURITY DEFINER`, owned by `postgres` (same ownership pattern as
    `admin_list_users()`/`hydrate_inquiry_context()`).
  - **Pinned `search_path`** — `SET search_path TO 'pg_catalog', 'public',
    'auth'`, the same explicit pin `admin_list_users()` already uses, so the
    function can never be tricked by a session-level `search_path` change
    into resolving an unqualified name to an attacker-controlled object.
  - **Strict parameter allow-list**: exactly the parameters enumerated in
    `data-model.md`'s "New database object" section — no `user_id`, no
    `status`, no `type` string, no snapshot column, ever accepted.
  - **Server-controlled `type`/`status`/`user_id`/snapshot behavior**: the
    function decides `type` from whether `p_offer_id` is present, hardcodes
    `status = 'NEW'`, never sets `user_id` (left to
    `hydrate_inquiry_context()`, which already only touches it when
    `auth.uid()` is non-null), and never accepts a snapshot column as input
    — all per `data-model.md`'s "Behavior" list and FR-072/FR-081.
  - **Coffee-context validation for `SAMPLE_REQUEST`**: inherited from the
    existing `hydrate_inquiry_context()` trigger by requiring `p_offer_id`
    and inserting with it set — not re-implemented inside the new function.
  - **No broad anonymous INSERT RLS policy** — confirmed as unnecessary in
    `research.md` #12; this migration adds none.
  - **`REVOKE ALL` from `PUBLIC` and from `authenticated`**, then
    **`GRANT EXECUTE` to `anon` only** — the minimum role that needs to call
    it, mirroring `P1-T02`'s exact `REVOKE`/`GRANT` shape.
  - **Verification guidance**: a commented block naming the exact empirical
    checks to re-run post-application — the four probe cases from
    `research.md` #11 (now exercised through the function itself rather than
    a raw insert), plus confirming `anon` can call the function but a raw
    `anon` `INSERT` into `inquiries` still fails.
  - **Rollback guidance**: a commented-out `DROP FUNCTION
    public.submit_public_inquiry(...)`, restoring the pre-migration state
    exactly (there is nothing else to revert — no policy or trigger was
    touched).
- No RLS policy change on `public.inquiries` (`research.md` #12's
  "why not a policy" reasoning) — restated here because it is also a
  required-content item for Migration B's own header, not only a design
  note.
- Rate limiting: per-normalized-email inside the function (reads
  `public.inquiries` only, `research.md` #16); per-IP in a new
  `src/lib/rate-limit/public-inquiries.ts` in-process sliding window, IP read
  from `headers()` in the calling server action. Both checks run before the
  honeypot's absence is even relevant, and both map to the single
  `RATE_LIMITED` domain error.
- Honeypot: a `website` field, identical name/shape/emptiness rule to the
  one already in `src/actions/inquiries.ts`, on both new forms.

## C. Public General RFQ

**Scope**: FR-069, FR-070, FR-072, FR-075, FR-077, FR-079 (RFQ half).

- **No new route.** `/request-a-quote` is extended with a new anonymous
  branch (see "Corrected routing decision" above), calling the new server
  action `submitPublicRfq` (`public-inquiry-actions.md`) through a new form
  component rendered only when there is no `viewer`. The page's existing
  signed-in branches are untouched.
- Required: full name, email, phone, message. Never required: delivery
  address, country (FR-070) — the field set is visibly and structurally
  different from the signed-in `RequestQuoteForm`'s (which additionally
  picks a specific offer, since it creates a `PRODUCT` inquiry, not a
  `GENERAL` one).
- No coffee/offer selection at all in the anonymous branch — this is the one
  structural feature that most clearly distinguishes it from the existing
  signed-in form on the same page.
- Success: on-screen confirmation with the request code; no email sent
  (FR-077, clarified decision).
- No duplicate-identity rule applies (FR-075) — repeated submissions from
  the same visitor are simply accepted for manual review, same as any
  ordinary contact form.
- "Request an Offer" as CTA/copy wording, wherever it appears on the site
  (Home, About, Contact, the coffee/offer detail pages), links to
  `/request-a-quote` — never to a second URL.

## D. Public Sample Request

**Scope**: FR-071, FR-073, FR-074, FR-076, FR-079 (sample half).

- New server action `submitPublicSampleRequest`, new form component, attached
  to `InquiryPanel`'s existing `!signedIn` branch on coffee/offer detail
  pages (`research.md` #18) — the `PRODUCT`/"Send inquiry" half of that same
  branch is untouched and still links to `/sign-in`.
- Required: full name, email, phone, delivery address, country, plus the
  specific offer the sample is requested against (FR-071).
- Coffee/offer context resolved server-side by the existing
  `hydrate_inquiry_context()` trigger from a trusted `offer_id` — the new
  action never trusts a client-supplied coffee id, matching FR-037's
  existing guarantee for the authenticated path.
- Duplicate identity: normalized email + coffee (FR-073); active states
  `NEW`/`RECEIVED`/`CONTACTED`/`SAMPLE_SENT`/`DELIVERED` (FR-074); `CLOSED`
  frees a new request, mirroring FR-040.
- The existing authenticated identity (`user_id` + coffee) is untouched and
  never consulted by this path (FR-076) — a signed-in verified customer who
  reaches a coffee page still sees, and must keep using, the existing
  authenticated `InquiryPanel` branch, not this one.
- No quantity, order, reservation, shipping automation, checkout, or payment
  field or side effect, at any point (owner decision 4, FR-082).

## E. Owner content/buyer-journey alignment

**Scope**: FR-079, and the content/journey audit list in `spec.md`'s
addendum section — resolved by the already-approved page-structure decision,
planned here only as *where* each piece of copy lands. No new page is
built anywhere in this addendum: `/request-a-quote` is the sole, canonical
RFQ route, extended rather than duplicated.

| Owner-supplied item | Where it lands | New route? |
|---|---|---|
| Request an Offer / RFQ | `/request-a-quote` (section C) — extended with a new anonymous branch | **No** — the existing canonical route, not a new page |
| Public Sample Request | Coffee/offer detail pages (section D) | No |
| Dubai-first positioning | Home and/or About, as a copy section | No |
| Source a Coffee | Home and/or About, as a copy section | No |
| Buy Available Lots | Home and/or the catalog page's own framing, as copy — never a transactable control (FR-082) | No |
| Trade With Hills | About and/or Contact, as non-executable positioning/navigation only | No |
| Traceability / quality / sourcing proof | Distributed across Home/About/origin pages, wherever the owner supplies real copy — never invented (existing "Assumptions" entry on real content) | No |

Preserves the Phase 9 motion/design system as-is: any new section on Home/
About/Contact uses the same `SectionReveal`/`ImageReveal` primitives already
in use on those pages (including the Phase-11-fixed `ImageReveal`), not a
new pattern. No owner HTML is copied literally; every string is written
fresh into the message catalogue, same as every other page in this project.

## F. Regression and acceptance gate

**Scope**: proves sections A–E did not disturb anything already working,
and that everything new actually works, per `quickstart.md`'s new addendum
section (already written this planning pass) and the brief's own test list.

- **Full existing suite, unmodified, must still pass**: unit (139),
  integration (105), the Phase 7 authenticated inquiry/sample Playwright
  spec, the Phase 9/10/11 desktop/mobile/cross-browser suites, typecheck,
  lint, build — this addendum's acceptance gate is additive to, not a
  replacement for, Phase 11's already-closed gate.
- **New coverage** (task-level detail deferred to `/speckit-tasks`, tested
  per `quickstart.md`'s addendum section): anonymous browse/RFQ/sample
  success, anonymous duplicate blocked/different-coffee-allowed/
  reopens-after-CLOSED, `PRODUCT` still denied without a user, protected
  price/account/favorites/trading still unreachable anonymously, Verified-
  USER paths unchanged, Admin Lead Inbox displays both new anonymous types
  through existing controls, honeypot/rate-limit both work, direct anon
  `INSERT` still denied, console/EN/AR/RTL/light/dark clean on both new/
  changed surfaces.
- **Gate**: this addendum is not closed until every row above has a real
  artifact (Constitution Principle XIV) — the same standard every phase in
  this plan is already held to.
