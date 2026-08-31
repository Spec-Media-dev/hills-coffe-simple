# Tasks: Hills Coffee Platform Implementation

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md` (all in this directory), plus
`docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md`, `docs/HILLS_SUPABASE_CURRENT_STATE.md`,
and `.specify/memory/constitution.md`.

**Organization**: Tasks are grouped by the 14 approved implementation phases
(Phase 0 – Phase 13), preserved exactly from `plan.md`, per explicit
instruction — **not** by user-story priority. Every phase ends with a
**PHASE ACCEPTANCE GATE** task; the next phase's tasks MUST NOT be marked
complete until that phase's own gate task passes (some phases may start in
parallel per the Dependency Graph in `plan.md`, but none may be *closed out*
before its gate passes).

**Task ID scheme**: `P{phase}-T{seq}`, stable and sequential within each
phase.

**Format**: `- [ ] TaskID [P?] Short title`, followed by a field block. `[P]`
marks a task that can run in parallel with sibling tasks in the same phase
(different files, no dependency between them).

**No source code is implemented, no test is executed, and no database
change is made by this document** — it is the task breakdown only.

---

## Phase 0 — Safety baseline, decisions, and environment proof

- [ ] P0-T01 [P] Re-run and record static baseline
  - **Goal**: Produce a current, dated "before" record of every static gate so later phases have a real regression baseline instead of trusting a stale report.
  - **Dependencies**: none.
  - **Files/modules**: none changed; output is a recorded log/artifact only.
  - **KEEP**: current `package.json` scripts, `.env.example`.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none.
  - **Realtime**: none.
  - **EN/AR/RTL**: none.
  - **Tests required**: `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — record exact pass/fail counts, do not fix anything found here yet.
  - **Runtime acceptance condition**: all five commands run to completion and their exact output is recorded (even if something fails — this phase documents, it does not fix).
  - **Out of scope**: fixing any failure found; any code change.

- [ ] P0-T02 Record current route/redirect matrix and reproduce the locale-switch defect
  - **Goal**: Capture the exact current behavior of every route in both languages, and reproduce the EN↔AR↔EN script-tag/runtime-overlay symptom once as a concrete "before" recording that Phase 2's fix will be checked against.
  - **Dependencies**: none.
  - **Files/modules**: none changed; a recorded matrix/observation artifact only.
  - **KEEP**: current `src/proxy.ts`, `src/i18n/routing.ts` behavior, unchanged.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none — observation only, no auth logic touched.
  - **Realtime**: none.
  - **EN/AR/RTL**: this task's entire purpose — walk every route in `docs/CLAUDE_MASTER_FINAL_COMPLETION_REPORT.md`'s Runtime Route Audit in both `en` and `ar`, and repeat the EN→AR→EN cycle on homepage, catalog, coffee detail, origin, article, account, and Admin while watching the browser console/Dev Overlay for the script-tag reconciliation warning described in `research.md` §1.
  - **Tests required**: manual browser observation; no automated test is written in this task (Phase 2 writes the automated repetition test against this recording).
  - **Runtime acceptance condition**: a written record exists showing (a) the full current route matrix with status codes/redirect targets and (b) whether/where the script-tag symptom reproduces today.
  - **Out of scope**: fixing the symptom (Phase 2); any proxy/route code change.

- [ ] P0-T03 [P] Confirm live Supabase security objects and Realtime exclusions
  - **Goal**: Read-only confirmation that the database objects this entire plan depends on are genuinely live, using `docs/HILLS_SUPABASE_CURRENT_STATE.md` as the source of truth, so no later phase re-derives or second-guesses this.
  - **Dependencies**: none.
  - **Files/modules**: none.
  - **KEEP**: no changes — confirmation only.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: confirm `hills_security_objects` block shows `avatars_bucket_exists`, `avatars_bucket_private`, `hills_is_admin_exists`, `hills_is_blocked_exists`, `hills_is_verified_user_exists`, `admin_set_user_blocked_exists`, `active_sample_unique_index_exists`, `sample_transition_function_exists` all `true`; confirm `sample_request_integrity.active_duplicates` is empty; confirm `offer_price_tiers`/`audit_logs` are absent from the Realtime `publication_tables` list.
  - **Auth/security**: none touched — read-only.
  - **Realtime**: confirmation only (see above).
  - **EN/AR/RTL**: none.
  - **Tests required**: none (documentation confirmation, not a test).
  - **Runtime acceptance condition**: a written confirmation, quoting the exact snapshot fields checked, exists before Phase 1 begins.
  - **Out of scope**: any migration, any schema change, any write to Supabase.

- [ ] P0-T04 **PHASE 0 ACCEPTANCE GATE**
  - **Goal**: Confirm Phase 0 is genuinely complete before Phase 1 is allowed to start.
  - **Dependencies**: P0-T01, P0-T02, P0-T03 all recorded.
  - **Runtime acceptance condition** (per `plan.md` Phase 0): current build is green (or its exact failures are recorded); current DB security objects are confirmed live; the script-tag symptom reproduction is recorded either way; no production data was touched; no source file was changed by this phase.
  - **Out of scope**: proceeding to any Phase 1 task before this gate is signed off.

---

## Phase 1 — Database/storage contract verification and Admin read-path completion

- [ ] P1-T01 [P] Write authorization-boundary characterization tests against staging
  - **Goal**: Prove — with real tests against a real staging session, not by reading SQL — that `hills_is_verified_user()`, `is_admin()`, and `admin_set_user_blocked()` behave exactly as `data-model.md` documents when called through the application's own Supabase client wrappers.
  - **Dependencies**: Phase 0 complete.
  - **Files/modules**: new Vitest/staging-integration test files alongside `src/lib/auth/session.ts` and `src/lib/supabase/**` (no production code changed yet).
  - **KEEP**: `src/lib/supabase/browser.ts`, `server.ts`, `config.ts` as-is.
  - **REFACTOR/MOVE/REMOVE**: none yet.
  - **Supabase/DB contract**: `hills_is_verified_user()`, `is_admin()`, `hills_is_blocked()`, `admin_set_user_blocked()`, `protect_profile_block_fields()` — all already live per `data-model.md`.
  - **Auth/security**: confirms the self-block/non-USER-target/non-admin-caller refusals raised by `admin_set_user_blocked()` actually surface correctly through the app's client, and that `protect_profile_block_fields()` rejects a non-admin attempt to alter `is_blocked`/`blocked_at`/`blocked_by`/`block_reason` end-to-end.
  - **Realtime**: none.
  - **EN/AR/RTL**: none.
  - **Tests required**: this task **is** the test-writing task.
  - **Runtime acceptance condition**: all characterization tests pass against staging and clearly document the exact function/error-code contract later phases will rely on.
  - **Out of scope**: any application code change; any new database object.

- [ ] P1-T02 Finalize the owner-approved `admin_list_users()` read-path extension specification
  - **Goal**: The extension itself is **already owner-approved** (decided during consistency analysis): extend the customer-user read path, using the current database contract only, to support search by email, search by name, pagination, the blocked/unblocked filter and value, and the avatar reference. This task produces the exact, reviewable technical specification (not code, not SQL) the database owner applies, per `contracts/admin-users-actions.md`'s updated `searchUsers` contract.
  - **Dependencies**: P0-T03.
  - **Files/modules**: a written specification artifact (e.g., appended to this plan's tracking, not application code) describing the exact additional return columns and parameters; **no RPC/SQL is written or executed by this task** — the database owner authors and applies the RPC definition as a separate, reviewed unit.
  - **KEEP**: the existing `admin_list_users()` RPC continues to work unchanged for any current caller until the extension is applied by the database owner.
  - **REFACTOR/MOVE/REMOVE**: none — this task only finalizes the specification the database owner applies.
  - **Supabase/DB contract**: extends (additively) the existing `admin_list_users()` function or adds a second Admin-only RPC — explicitly **not** a new table/column, since `is_blocked`/`avatar_path` already exist on `profiles`.
  - **Auth/security**: the specification requires the extended RPC to remain `SECURITY DEFINER` with the existing `is_admin()` guard, and must not expose any field beyond what `contracts/admin-users-actions.md` specifies (no password, no unrestricted role editor).
  - **Realtime**: not applicable — this is a request/response RPC, not a subscription.
  - **EN/AR/RTL**: none at this stage.
  - **Tests required**: none yet — the finalized specification is the deliverable of this task; tests run once P1-T03 regenerates types against the applied RPC.
  - **Runtime acceptance condition**: a complete, unambiguous technical specification exists, matching `contracts/admin-users-actions.md`'s `searchUsers` contract exactly, ready for the database owner to apply before Phase 5 begins any Admin Users implementation work.
  - **Out of scope**: writing or applying the migration/RPC SQL itself; adding any field beyond the owner-approved scope (email search, name search, pagination, blocked filter/value, avatar reference).

- [ ] P1-T03 Regenerate `src/lib/supabase/types.generated.ts` once the Phase 1 extension is applied
  - **Goal**: Keep the generated Supabase types in sync with the approved, applied `admin_list_users()` extension from P1-T02, so Phase 5's TypeScript consumers are correctly typed.
  - **Dependencies**: P1-T02 approved and applied by the database owner (this task does not apply the change itself — it only regenerates types after the owner has).
  - **Files/modules**: `src/lib/supabase/types.generated.ts`.
  - **KEEP**: all other generated types unchanged.
  - **REFACTOR/MOVE/REMOVE**: regenerate in place; no manual hand-editing of generated types.
  - **Supabase/DB contract**: reflects whatever P1-T02 specified and the owner applied.
  - **Auth/security**: none beyond confirming the regenerated type matches the approved, authorization-safe shape.
  - **Realtime**: none.
  - **EN/AR/RTL**: none.
  - **Tests required**: `npm run typecheck` passes with the new types.
  - **Runtime acceptance condition**: generated types compile and match the approved RPC signature exactly.
  - **Out of scope**: applying the extension itself (that is an owner/database action outside this plan's execution).

- [ ] P1-T04 Apply the owner-approved RLS/storage hardening for blocked-user enforcement
  - **Goal**: Close the gap found during consistency analysis and approved by the owner: `hills_profiles_update_own` (RLS) and the four `avatars_owner_*` storage policies (`avatars_owner_insert`, `avatars_owner_select`, `avatars_owner_update`, `avatars_owner_delete`) currently enforce ownership only, with no blocked-state predicate — unlike `hills_favorites_*`, `hills_inquiries_*`, and `hills_price_tiers_verified_users`, which all correctly require `hills_is_verified_user()`. A blocked customer with a still-valid session can therefore bypass the application's `requireVerifiedUser()` gate entirely via a direct database or storage call. Implements `spec.md` FR-067/FR-068.
  - **Dependencies**: P0-T03; approved per owner decision (this task authors and applies the fix — the decision itself is no longer pending).
  - **Files/modules**: a reviewed, owner-authored RLS/storage migration unit tightening exactly the five named policies (conceptual scope only — no SQL is written or executed by this planning document; the migration is applied by the database owner as its own reviewed unit, per Constitution Principle XV).
  - **KEEP**: every other policy in the snapshot exactly as-is (they are already correct); Administrator (`is_admin()`) and service-role access paths to `profiles` and the `avatars` bucket, which MUST remain unaffected (FR-068); `protect_profile_block_fields()`, which already independently prevents a blocked customer from touching their own `is_blocked`/`blocked_at`/`blocked_by`/`block_reason` — this task must not create a second path around that trigger.
  - **REFACTOR/MOVE/REMOVE**: TIGHTEN `hills_profiles_update_own`'s `USING`/`WITH CHECK` clauses and each `avatars_owner_*` policy's `USING`/`WITH CHECK` clause to additionally require the same unblocked-customer predicate `hills_is_verified_user()` already uses elsewhere (or an equivalent `NOT hills_is_blocked()` condition, whichever the database owner determines is the correct fit for a policy that must also work for the avatar-read case, which does not require `role = 'USER'`).
  - **Supabase/DB contract**: `hills_profiles_update_own`, `avatars_owner_insert`, `avatars_owner_select`, `avatars_owner_update`, `avatars_owner_delete`, cross-checked against `hills_is_blocked()`/`hills_is_verified_user()`/`is_admin()` exactly as already defined (no change to the helper functions themselves).
  - **Auth/security**: this task is the direct, database-level closure of Constitution Principle VII for the one remaining gap found; it must not weaken any other boundary and must not introduce any path for a blocked customer to self-unblock (FR-068).
  - **Realtime**: none.
  - **EN/AR/RTL**: none (database-layer task).
  - **Tests required**: **before** the migration — as a blocked-fixture session, attempt a direct-client `UPDATE` of the fixture's own `profiles` row and attempt direct-client avatar upload/update/delete/read; confirm all currently **succeed** (recording the vulnerable baseline). **After** the migration — repeat the identical attempts and confirm all are now **denied**; additionally confirm an Administrator session and the service-role client can still read/manage the same resources; confirm a blocked customer still cannot alter their own block-state fields (regression check on `protect_profile_block_fields()`); confirm an **unblocked** verified customer's own profile update and avatar operations are unaffected (no false-positive denial).
  - **Runtime acceptance condition**: `spec.md` FR-067 and FR-068 both hold, proven by the before/after test pair above, not by inspecting the policy definition alone.
  - **Out of scope**: authoring or executing the SQL as part of this planning artifact (the database owner applies it as a separate, reviewed migration); any change to `protect_profile_block_fields()`, `hills_is_blocked()`, `hills_is_verified_user()`, or `is_admin()`; any change to the `hills-public` bucket or its policies.

- [ ] P1-T05 **PHASE 1 ACCEPTANCE GATE**
  - **Goal**: Confirm the database contract this entire plan depends on is verified, the required read-path gap has an owner decision on record, and the approved blocked-user RLS/storage hardening is applied and proven — before any UI work depends on any of it.
  - **Dependencies**: P1-T01, P1-T02, P1-T04, (P1-T03 if approved).
  - **Runtime acceptance condition** (per `plan.md` Phase 1): a blocked-profile JWT cannot pass `hills_is_verified_user()`; a non-admin cannot alter block fields (proven by test, not by reading source); the owner-approved `admin_list_users()` extension's technical specification is finalized and ready for the database owner to apply (P1-T02), with types regenerated once applied (P1-T03); a blocked customer's direct-client profile update and all four avatar storage operations are denied, with Administrator/service-role access and the anti-self-unblock guarantee both unaffected (FR-067, FR-068, proven by P1-T04's before/after tests).
  - **Out of scope**: any Phase 5 implementation beginning before this gate passes; any Phase 3/4 claim that blocked-session capability loss is proven before this gate closes.

---

## Phase 2 — Route architecture, proxy, and locale stabilization

- [ ] P2-T01 [P] Confirm root/locale layout ownership boundary
  - **Goal**: Verify the already-existing `src/app/layout.tsx` (global document, `lang`/`dir` from the proxy header) and `src/app/[locale]/layout.tsx` (locale/message/provider only) match the target boundary in `plan.md`'s Project Structure, and close any remaining gap.
  - **Dependencies**: Phase 0 complete.
  - **Files/modules**: `src/app/layout.tsx`, `src/app/[locale]/layout.tsx`.
  - **KEEP**: the existing root-layout implementation exactly as-is if it already matches the target (this is largely a verification task, not a rebuild, per `plan.md`'s explicit note that this piece is already done).
  - **REFACTOR/MOVE/REMOVE**: remove any remaining document-level concern accidentally left in `[locale]/layout.tsx` that belongs at the root.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none — this task must not touch any auth guard.
  - **Realtime**: none.
  - **EN/AR/RTL**: confirm `lang`/`dir` resolve correctly from the proxy's `x-next-intl-locale` header for both `en` and `ar` at the root document level.
  - **Tests required**: a quick manual/automated check that `curl`ing `/` and `/ar` returns the correct `<html lang dir>` pair.
  - **Runtime acceptance condition**: exactly one file owns `<html>`/`<body>`; no duplicate document ownership exists anywhere in the tree.
  - **Out of scope**: any Admin route move (P2-T03/T04 below).

- [ ] P2-T02 Extend `src/proxy.ts` with the explicit Admin-path branch
  - **Goal**: Implement the master plan's exact request algorithm's Admin-specific branch — `/dashboard-admin`/`/admin/**` (EN) and `/ar/dashboard-admin`/`/ar/admin/**` (AR, internally rewritten without a literal `[locale]` param) — while leaving the existing unprefixed-EN rewrite and `/en/**` 308 behavior untouched.
  - **Dependencies**: P2-T01.
  - **Files/modules**: `src/proxy.ts` (currently 61 lines), `src/i18n/routing.ts` (only if the locale-detection helper needs a shared export).
  - **KEEP**: the existing Supabase cookie-refresh logic in `src/proxy.ts`; the existing `/en/**` → unprefixed 308 behavior; the existing unprefixed-EN → `/en` internal rewrite for non-Admin paths.
  - **REFACTOR/MOVE/REMOVE**: refactor the branching logic to add the Admin-specific header/cookie setting (`x-hills-locale`, `x-next-intl-locale`, `NEXT_LOCALE`, `x-hills-admin-rewrite`) without disturbing the existing non-Admin branches.
  - **Supabase/DB contract**: none — the proxy's Supabase client remains the session-refresh-only client per `research.md` §2; it must never become an authorization decision point.
  - **Auth/security**: this task must not add or remove any `requireAdmin()`/`requireVerifiedUser()` check — those stay exactly where they are on pages/actions; the proxy only routes.
  - **Realtime**: none.
  - **EN/AR/RTL**: this is the core of the Admin EN/AR routing requirement — verify both `/admin/**` and `/ar/admin/**` reach the same underlying source once P2-T03 moves it.
  - **Tests required**: unit tests for the proxy's branch logic (given a path, assert the expected headers/rewrite/redirect).
  - **Runtime acceptance condition**: every Admin path in both languages sets the correct headers and reaches the same source file, with zero change to any non-Admin path's existing behavior.
  - **Out of scope**: the actual file move of the Admin tree (P2-T03); any visual change.

- [ ] P2-T03 Move the Admin source tree to the canonical `(admin)` route group
  - **Goal**: Complete (not restart) the Admin route migration — move `src/app/[locale]/admin/**` to `src/app/(admin)/admin/**` and `src/app/[locale]/(site)/dashboard-admin/` to `src/app/(admin)/dashboard-admin/`, per `plan.md`'s explicit note that this specific piece is still outstanding.
  - **Dependencies**: P2-T02 (proxy must already route Admin paths correctly before the files move, so the matrix can be re-verified against the new location immediately).
  - **Files/modules**: every file under `src/app/[locale]/admin/**` (layout, page, `[module]/page.tsx`, `[module]/[id]/page.tsx`, `content/[id]/page.tsx`, `account/page.tsx`) and `src/app/[locale]/(site)/dashboard-admin/page.tsx`, moved to `src/app/(admin)/**`.
  - **KEEP**: every existing page's internal logic, imports, and the already-correct `requireAdmin()` guard in the Admin layout — this is a **file move**, not a rewrite; keep `src/app/[locale]/(site)/admin/login/page.tsx` exactly as-is (it is already the correct legacy 308-redirect page, just confirm its target still resolves after the move).
  - **REFACTOR/MOVE/REMOVE**: MOVE (not delete) the old tree only after the new location passes the full route matrix from P0-T02; only then REMOVE the old `src/app/[locale]/admin/**` directory, per Constitution Principle XIII (parity before deletion).
  - **Supabase/DB contract**: none — no query logic changes, only file location.
  - **Auth/security**: the moved layout's `requireAdmin()` guard and redirect-to-`/dashboard-admin` behavior must be verified unchanged after the move — this is the single highest-risk step in this phase for an authorization regression, so it gets its own explicit re-test in P2-T05.
  - **Realtime**: none.
  - **EN/AR/RTL**: after the move, `/ar/admin/**` and `/ar/dashboard-admin` must still resolve to the exact same source as their English counterparts via the proxy's internal rewrite (no literal `[locale]` segment in the new path).
  - **Tests required**: a full before/after route-matrix diff for every Admin URL in both languages.
  - **Runtime acceptance condition**: one Admin implementation serves all four external Admin roots (`/dashboard-admin`, `/ar/dashboard-admin`, `/admin/**`, `/ar/admin/**`); the old `src/app/[locale]/admin/**` path is confirmed gone with zero remaining references.
  - **Out of scope**: splitting `(site)/**` into `(marketing)`/`(auth)` (P2-T04); any Admin UI/CRUD change.

- [ ] P2-T04 [P] Split `(site)/**` into `(marketing)/` and `(auth)/` route groups
  - **Goal**: Complete the master plan's target public-tree structure by grouping marketing pages and Auth pages separately (no external URL change — route groups are invisible to the URL).
  - **Dependencies**: P2-T01 (root layout confirmed stable); independent of P2-T02/T03 (different files) so can run in parallel with the Admin move.
  - **Files/modules**: `src/app/[locale]/(site)/**` reorganized into `src/app/[locale]/(marketing)/**` (home, about, contact, request-a-quote, green-coffee-offer-list, coffee-origins, knowledge, `[page]`) and `src/app/[locale]/(auth)/**` (sign-in, sign-up, verify-email, forgot-password, reset-password); `account/**` remains its own group per `plan.md`'s Project Structure.
  - **KEEP**: every page's internal logic and existing route paths exactly unchanged — this is a folder-grouping move only.
  - **REFACTOR/MOVE/REMOVE**: MOVE files into the new groups; REMOVE the old `(site)` directory only after the full public route matrix is re-verified.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none — no guard logic changes.
  - **Realtime**: none.
  - **EN/AR/RTL**: re-verify every moved page's canonical/hreflang metadata still resolves correctly (route groups must not appear in any URL or canonical tag).
  - **Tests required**: full public route matrix re-run after the move.
  - **Runtime acceptance condition**: every public/auth/account URL in both languages resolves identically before and after the grouping.
  - **Out of scope**: any Admin file (P2-T03); any visual/content change.

- [ ] P2-T05 Implement locale-switch hard navigation and verify the script-tag/overlay fix
  - **Goal**: Implement the `research.md` §1 decision — locale switching performs a full document navigation while same-locale links keep client transitions — and prove the EN↔AR↔EN script-tag/runtime-overlay symptom from P0-T02 no longer reproduces.
  - **Dependencies**: P2-T01–T04 complete (the fix must be verified against the final route locations, not the pre-move tree).
  - **Files/modules**: the locale-switcher component (`src/i18n/navigation.ts` and/or `src/components/navigation/locale-switcher.tsx`).
  - **KEEP**: the existing server-rendered JSON-LD emission exactly as-is (`dangerouslySetInnerHTML` with `<` escaped) — this task does not touch JSON-LD generation, only navigation behavior.
  - **REFACTOR/MOVE/REMOVE**: refactor the locale-switch handler to use a full document navigation (not the App Router's client `<Link>` transition) specifically when the locale prefix changes; same-locale navigation is unaffected.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none.
  - **Realtime**: none.
  - **EN/AR/RTL**: this task's entire purpose.
  - **Tests required**: a Playwright repetition test navigating EN→AR→EN across homepage, catalog, coffee detail, origin, article, account, and Admin, asserting zero `console.error`/`pageerror`/hydration warning/Dev Overlay and that path/query/theme/logo are preserved at every hop (per `quickstart.md`'s Language switching row) — this is the console-error failure gate for locale switching specifically.
  - **Runtime acceptance condition**: the repetition test is green; the symptom recorded in P0-T02 does not reproduce.
  - **Out of scope**: any change to JSON-LD content/shape; any change to same-locale navigation behavior.

- [ ] P2-T06 **PHASE 2 ACCEPTANCE GATE**
  - **Goal**: Confirm the full route/proxy/locale architecture is stable before Auth work depends on it.
  - **Dependencies**: P2-T01 through P2-T05.
  - **Runtime acceptance condition** (per `plan.md` Phase 2): one Admin implementation serves all four external Admin roots; no visible `/en` in the browser bar; Admin path/query survives a locale switch; the script-tag repetition test is green; anonymous guards to `/admin`, `/dashboard-admin`, `/account` still redirect exactly as recorded in P0-T02, with no regression.
  - **Out of scope**: any Phase 3 Auth-logic task beginning before this gate passes.

---

## Phase 3 — Auth state machine and authorization policy

- [ ] P3-T01 [P] Adopt the `ActionResult` contract in `src/actions/auth.ts`
  - **Goal**: Bring every Auth action onto the single typed result shape in `contracts/action-result.md`, replacing any ad hoc result type.
  - **Dependencies**: Phase 2 complete (routes stable).
  - **Files/modules**: `src/actions/auth.ts`, `src/lib/actions.ts` (shared type), Auth-consuming form components.
  - **KEEP**: the existing Supabase call sequences for sign-up/sign-in/resend/reset — this task changes the *result shape*, not the underlying calls, which are already functionally correct per the prior completion pass.
  - **REFACTOR/MOVE/REMOVE**: refactor each action's return statements to the `ActionResult` discriminated union with the closed domain-code set from `contracts/action-result.md`.
  - **Supabase/DB contract**: none new.
  - **Auth/security**: no `messageKey` may ever carry a raw Postgres/Supabase error string (Constitution Principle XII) — this is the mechanical enforcement point.
  - **Realtime**: none.
  - **EN/AR/RTL**: every `messageKey` must resolve in both `messages/en.json` and `messages/ar.json`.
  - **Tests required**: unit tests asserting each action returns a well-formed `ActionResult` for its success/failure branches.
  - **Runtime acceptance condition**: `npm run typecheck` passes with the new shared type; no raw error string appears in any Auth action's output for any tested failure path.
  - **Out of scope**: changing sign-up/sign-in/reset business logic itself (that is P3-T02–T04).

- [ ] P3-T02 Harden `signIn`/`adminSignIn` state-machine branches
  - **Goal**: Verify and, where needed, correct the exact ordering `spec.md` FR-004/FR-008/FR-009/FR-014 require: unverified → `VERIFICATION_REQUIRED`; blocked → `BLOCKED` with session cleared and no reason disclosed; Admin via customer sign-in → `ADMIN_PORTAL_REQUIRED` with no customer session; customer via Admin sign-in → `FORBIDDEN`.
  - **Dependencies**: P3-T01; Phase 1 verification (P1-T01) that `hills_is_verified_user()`/`is_admin()` behave as documented.
  - **Files/modules**: `src/actions/auth.ts` (`signIn`, `adminSignIn`), `src/lib/auth/session.ts`.
  - **KEEP**: the already-implemented role-aware sign-in redirect logic from the prior completion pass, if it already matches this ordering exactly — verify before rewriting.
  - **REFACTOR/MOVE/REMOVE**: refactor only the branches that do not yet match the exact ordering above.
  - **Supabase/DB contract**: `hills_is_verified_user()`, `is_admin()`, `hills_is_blocked()` per `data-model.md` — no application-only re-implementation of "verified"/"blocked."
  - **Auth/security**: this task **is** the core of Constitution Principle IV/V/VI/VII enforcement at the sign-in boundary.
  - **Realtime**: none.
  - **EN/AR/RTL**: the `ADMIN_PORTAL_REQUIRED` and blocked-account messages must be localized in both languages.
  - **Tests required**: the full sign-in persona matrix (anonymous invalid credentials, unverified, verified USER, blocked USER, ADMIN-via-customer-form, USER-via-admin-form) as unit + Playwright tests.
  - **Runtime acceptance condition**: every branch in `spec.md` User Story 1's acceptance scenarios 2, 5, 7 passes.
  - **Out of scope**: password recovery (P3-T04); the three-minute verification UX (P3-T03).

- [ ] P3-T03 Verify the three-minute verification UX is presentational-only
  - **Goal**: Confirm (and correct if needed) that the post-signup waiting window is a UX convention, never treated as token expiry, and that resend is server-rate-limited rather than only client-timer-gated (FR-006, FR-007).
  - **Dependencies**: P3-T01.
  - **Files/modules**: `src/app/[locale]/(auth)/verify-email/page.tsx` (post-Phase-2 location), `src/components/forms/verify-email-form.tsx`, `src/actions/auth.ts` (`resendVerification`).
  - **KEEP**: the existing verify-email page's already-implemented already-verified redirect, expired-link state, and masked-email display from the prior completion pass — verify against `spec.md` Edge Cases rather than rebuilding.
  - **REFACTOR/MOVE/REMOVE**: refactor the resend action to enforce a server-side rate limit if one is not already enforced independent of the client countdown.
  - **Supabase/DB contract**: none new.
  - **Auth/security**: confirm the waiting-window expiry never triggers automatic account deletion and never implies the confirmation token itself expired (FR-006).
  - **Realtime**: none.
  - **EN/AR/RTL**: countdown/resend copy fully localized.
  - **Tests required**: a test asserting the account is not deleted and remains resendable after the three-minute window elapses; a test asserting resend is blocked server-side even if client-side state is manipulated.
  - **Runtime acceptance condition**: `spec.md` Edge Cases row "customer never confirms within the three-minute window" passes.
  - **Out of scope**: the real email-click confirmation itself (P3-T04).

- [ ] P3-T04 Harden `/auth/callback` real-state re-verification
  - **Goal**: Confirm the callback route re-reads the actual resulting user/session state (not just "callback was reached") before granting any protected destination, for both signup-confirmation and recovery purposes, and that a purpose-mismatched or expired/reused link is handled safely (FR-005).
  - **Dependencies**: P3-T01–T02.
  - **Files/modules**: `src/app/auth/callback/route.ts`.
  - **KEEP**: the already-implemented "exchange then re-read `email_confirmed_at`" pattern from the prior completion pass if it already satisfies FR-005 — verify, don't rebuild.
  - **REFACTOR/MOVE/REMOVE**: refactor only the specific gap, if any, found in purpose-mixing handling (a signup token used for recovery, or vice versa).
  - **Supabase/DB contract**: none new.
  - **Auth/security**: this is the mechanical enforcement of FR-005 — reaching the callback URL must never by itself be sufficient.
  - **Realtime**: none.
  - **EN/AR/RTL**: the locale hint carried through the callback URL must be preserved into the final redirect destination in both languages.
  - **Tests required**: callback tests for confirmed, unconfirmed, malformed, expired/reused, and recovery-vs-signup-vs-email-change token purposes.
  - **Runtime acceptance condition**: every callback purpose-mixing/expiry case in `spec.md` Edge Cases passes; no protected destination is ever reached without a genuinely re-verified state.
  - **Out of scope**: the reset-password form itself (P3-T05).

- [ ] P3-T05 [P] Harden forgot/reset password recovery-session enforcement
  - **Goal**: Confirm `requestPasswordReset` returns a neutral response regardless of account existence (FR-003) and that `resetPassword` refuses to operate outside a genuine, server-verified recovery session (FR-012), invalidating that recovery context after a successful update (FR-013).
  - **Dependencies**: P3-T01, P3-T04 (recovery arrives via the same callback route).
  - **Files/modules**: `src/actions/auth.ts` (`requestPasswordReset`, `resetPassword`), `src/app/[locale]/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx`.
  - **KEEP**: the existing neutral forgot-password response if already correct.
  - **REFACTOR/MOVE/REMOVE**: refactor `resetPassword` to explicitly reject an ordinary authenticated session that lacks a genuine recovery marker, if any gap exists.
  - **Supabase/DB contract**: none new.
  - **Auth/security**: no user-enumeration; recovery session invalidated immediately after success (FR-013).
  - **Realtime**: none.
  - **EN/AR/RTL**: success/failure messages localized identically regardless of account existence.
  - **Tests required**: old password fails after reset; new password succeeds; the recovery link cannot be reused; a protected page does not remain reachable using a stale recovery context.
  - **Runtime acceptance condition**: `spec.md` User Story 1 acceptance scenario 6 passes in full.
  - **Out of scope**: the in-account (already-authenticated) password-change flow, which belongs to Phase 4's account/security work.

- [ ] P3-T06 **PHASE 3 ACCEPTANCE GATE**
  - **Goal**: Confirm the full authorization state machine is correct before any customer- or Admin-facing feature depends on it.
  - **Dependencies**: P3-T01 through P3-T05; P1-T05 (Phase 1 gate, including the FR-067/FR-068 RLS/storage hardening) already passed.
  - **Runtime acceptance condition** (per `plan.md` Phase 3, `spec.md` SC-001/SC-002): only verified, unblocked USER reaches customer capability; only verified, unblocked ADMIN through `/dashboard-admin` reaches Admin capability; a blocked or recovery-context session cannot leak either capability at the application layer — and, per `P1-T05`, not at the database/storage layer either; the full sign-in/verify/recover persona matrix passes.
  - **Out of scope**: any Phase 4/5 task beginning before this gate passes.

---

## Phase 4 — Customer account, avatar, and header identity

- [ ] P4-T01 Implement `uploadAvatar`/`deleteAvatar` actions
  - **Goal**: Deliver `contracts/account-avatar-actions.md`'s avatar upload/delete contract in full — server-side MIME/size/signature validation, owner-derived storage path, safe replace/orphan-cleanup ordering.
  - **Dependencies**: Phase 3 complete (requires `requireVerifiedUser()`).
  - **Files/modules**: `src/actions/account.ts`, a new avatar-resolving helper shared with Phase 5's Admin avatar view.
  - **KEEP**: the existing `avatars` bucket and its owner-scoped storage policies exactly as-is (already live per `data-model.md`) — no policy change.
  - **REFACTOR/MOVE/REMOVE**: none removed; this is new functionality added to the existing `account.ts` action file.
  - **Supabase/DB contract**: `profiles.avatar_path` (already live), `avatars` bucket (5 MiB, JPEG/PNG/WebP, owner-folder-scoped policies, already live).
  - **Auth/security**: object path always derived from `auth.uid()` server-side, never client-supplied; upload rejected server-side regardless of what the browser reports (FR-019); cross-user avatar access denied by the storage policy itself, not only application code (FR-020); a **blocked** customer's own avatar upload/replace/delete/read is denied at the storage-policy layer itself (FR-067), proven by `P1-T04`/`P1-T05` — this task's application-layer `requireVerifiedUser()` gate is the first line of defense, not the only one.
  - **Realtime**: none.
  - **EN/AR/RTL**: upload/delete success/error messages localized via `ActionResult`.
  - **Tests required**: valid upload, oversize rejection, wrong-MIME rejection, corrupt-signature rejection, cross-user path-traversal attempt denied, delete-then-default-icon.
  - **Runtime acceptance condition**: `spec.md` User Story 2 acceptance scenarios 1–3 pass.
  - **Out of scope**: the Admin read-only avatar viewer (Phase 5); the project logo (Phase 8) — these never share storage location or actions with customer avatars (FR-022).

- [ ] P4-T02 [P] Build the header avatar/account menu
  - **Goal**: Replace the anonymous sign-in CTA with a resolved avatar/default-icon menu for a signed-in verified customer, per the master plan's Header Auth State section.
  - **Dependencies**: P4-T01 (avatar resolver must exist).
  - **Files/modules**: `src/components/navigation/site-header.tsx`, `src/components/navigation/mobile-menu.tsx`.
  - **KEEP**: the existing accessible mobile-menu dialog semantics/focus-trap/44px targets already verified in the prior completion pass — extend, don't rebuild.
  - **REFACTOR/MOVE/REMOVE**: refactor the header's signed-in branch to show the avatar menu instead of (or alongside, for anonymous) the sign-in CTA.
  - **Supabase/DB contract**: reads `profiles.avatar_path` via the Phase 4-T01 resolver only.
  - **Auth/security**: the Admin portal must never appear in this public-facing menu (per the master plan's explicit "Admin portal does not appear in public navigation").
  - **Realtime**: none.
  - **EN/AR/RTL**: accessible menu primitive with `aria-expanded`, keyboard arrows/Escape, focus return, and RTL-correct placement.
  - **Tests required**: keyboard-only menu operation test; RTL placement screenshot; menu never shows an Admin link.
  - **Runtime acceptance condition**: the avatar menu is stable across navigation/theme/locale changes (no flash of the wrong state).
  - **Out of scope**: the sign-out confirmation dialog itself (P4-T03).

- [ ] P4-T03 [P] Build the sign-out confirmation dialog
  - **Goal**: A localized, theme-aware confirmation dialog with Cancel/Sign Out; success clears the session, invalidates viewer caches, closes menus, and navigates home.
  - **Dependencies**: P4-T02 (menu must exist to trigger this dialog from).
  - **Files/modules**: a new shared confirmation-dialog component (reusable by Phase 5's Admin sign-out and Phase 7's destructive Admin actions), wired into the header menu and account/security page.
  - **KEEP**: the existing `signOutAction` server action if it already performs a full session clear.
  - **REFACTOR/MOVE/REMOVE**: none removed.
  - **Supabase/DB contract**: none new.
  - **Auth/security**: confirms no stale session/cache remains reachable after sign-out.
  - **Realtime**: if any Realtime subscription exists on the page at sign-out time, this task must confirm it is torn down (no orphaned subscription surviving the session).
  - **EN/AR/RTL**: dialog copy and button order localized/RTL-correct.
  - **Tests required**: cancel leaves the session intact; confirm clears it and redirects home in both languages.
  - **Runtime acceptance condition**: `spec.md` Header Auth State sign-out behavior passes for both customer and (later, Phase 5) Admin contexts using the same shared component.
  - **Out of scope**: Admin-specific sign-out wiring (Phase 5 references this component, does not rebuild it).

- [ ] P4-T04 [P] Finalize the account overview dashboard
  - **Goal**: Real favorites count, real active-sample count (all non-`CLOSED` `SAMPLE_REQUEST` states), recent request activity, and quick links — with zero fabricated business metric (FR-016).
  - **Dependencies**: Phase 3 complete.
  - **Files/modules**: `src/app/[locale]/account/page.tsx`.
  - **KEEP**: the existing account overview page structure verified route-correct in the prior pass; extend its data-fetching, don't replace the page.
  - **REFACTOR/MOVE/REMOVE**: refactor any placeholder/fake metric found to a real query.
  - **Supabase/DB contract**: `favorites`, `inquiries` (filtered `type='SAMPLE_REQUEST' AND status != 'CLOSED'` for the active count), scoped to `user_id = auth.uid()`.
  - **Auth/security**: `requireVerifiedUser()`; no cross-user data.
  - **Realtime**: none required (a static page-load fetch is sufficient for this task's acceptance).
  - **EN/AR/RTL**: all labels localized.
  - **Tests required**: a fixture with known favorites/requests produces the exact expected counts.
  - **Runtime acceptance condition**: `spec.md` User Story 2 acceptance scenario 5 passes.
  - **Out of scope**: the request list/detail pages themselves (P4-T06).

- [ ] P4-T05 [P] Verify favorites cross-user isolation
  - **Goal**: Confirm `toggleFavorite`/list-favorites are scoped to `user_id = auth.uid()` with no possible cross-user read/write (FR-020, part of FR-021's spirit for favorites).
  - **Dependencies**: Phase 3 complete.
  - **Files/modules**: `src/actions/account.ts` (`toggleFavoriteAction`), `src/app/[locale]/account/favorites/page.tsx`.
  - **KEEP**: the existing favorites action/page — already functionally scoped per the prior security review; this task adds the explicit cross-user test coverage that proves it, and fixes anything that test reveals.
  - **REFACTOR/MOVE/REMOVE**: none expected; refactor only if the test finds a gap.
  - **Supabase/DB contract**: `favorites(user_id, coffee_id)`, RLS-backed.
  - **Auth/security**: cross-user isolation is this task's entire purpose.
  - **Realtime**: none.
  - **EN/AR/RTL**: empty-favorites state localized.
  - **Tests required**: fixture A cannot see/toggle fixture B's favorites by any tested means (direct ID guessing, replayed request).
  - **Runtime acceptance condition**: zero cross-user favorite access possible.
  - **Out of scope**: the catalog data those favorites reference (Phase 6).

- [ ] P4-T06 Finalize request history list/detail/timeline
  - **Goal**: A verified customer can list and open their own request history with an immutable, chronological status timeline (FR-021).
  - **Dependencies**: Phase 3 complete.
  - **Note (not a dependency)**: this task uses whatever status labels exist today for `NEW`/`RECEIVED`/`CONTACTED`/`CLOSED`; it is not blocked on Phase 7, but is revisited without reopening by `P7-T04`, which adds the `SAMPLE_SENT`/`DELIVERED` labels this task's timeline component then also renders.
  - **Files/modules**: `src/app/[locale]/account/requests/page.tsx`, `requests/[code]/page.tsx`.
  - **KEEP**: the existing list/detail pages and their `inquiry_status_history` read, already verified route-correct in the prior pass.
  - **REFACTOR/MOVE/REMOVE**: none expected in this phase (label completeness for the two new statuses is Phase 7's job).
  - **Supabase/DB contract**: `inquiries`, `inquiry_status_history`, scoped to `user_id = auth.uid()`.
  - **Auth/security**: a request code belonging to another customer returns `NOT_FOUND`, never `FORBIDDEN` (no enumeration, per `contracts/account-avatar-actions.md`).
  - **Realtime**: none required for this phase's acceptance.
  - **EN/AR/RTL**: request codes rendered `dir="ltr"` inside RTL layout.
  - **Tests required**: owner can view; another customer's code returns not-found; timeline renders every historical entry in order.
  - **Runtime acceptance condition**: `spec.md` User Story 2 acceptance scenario 5 (history) and the Requests contract in `contracts/account-avatar-actions.md` pass.
  - **Out of scope**: Admin's view of the same data (Phase 5/7).

- [ ] P4-T07 Consolidate `account/profile` and `account/security` toward `account/settings`
  - **Goal**: Converge on the master plan's target `account/settings` route per its Route Migration Map, keeping the old URLs alive as compatibility redirects rather than deleting them outright.
  - **Dependencies**: P4-T01 (avatar must be part of settings), P3-T05 (password-change semantics finalized).
  - **Files/modules**: new `src/app/[locale]/account/settings/page.tsx`; `profile/page.tsx` and `security/page.tsx` become redirect stubs once parity is confirmed.
  - **KEEP**: every field/action currently on `profile`/`security` — this is a consolidation, not a feature reduction.
  - **REFACTOR/MOVE/REMOVE**: MOVE the combined UI to `settings`; REMOVE the standalone `profile`/`security` pages only after `settings` reaches full parity, replacing them with redirects.
  - **Supabase/DB contract**: `profiles` allow-listed fields (FR-017); Supabase Auth for email/password change.
  - **Auth/security**: no new capability — same `requireVerifiedUser()` boundary; still cannot edit role/blocked fields (FR-015); a **blocked** customer's own profile update is denied at the RLS layer itself, not only by this action's application-layer gate (FR-067), proven by `P1-T04`/`P1-T05`.
  - **Realtime**: none.
  - **EN/AR/RTL**: full localization of the merged page.
  - **Tests required**: old URLs redirect correctly; new page exercises every field/action previously split across two pages.
  - **Runtime acceptance condition**: no bookmarked old URL breaks; `settings` is feature-complete relative to the two pages it replaces.
  - **Out of scope**: any new settings field not already present on `profile`/`security`.

- [ ] P4-T08 **PHASE 4 ACCEPTANCE GATE**
  - **Goal**: Confirm the customer account experience is complete and correctly isolated before Admin-side avatar viewing (Phase 5) or public redesign (Phase 9) depends on it.
  - **Dependencies**: P4-T01 through P4-T07.
  - **Runtime acceptance condition** (per `plan.md` Phase 4, `spec.md` SC-001): default/uploaded avatar stable across navigation/theme/locale; account counts and timeline are real; zero unauthorized account/avatar/favorite/request access by any tested means.
  - **Out of scope**: any Phase 5 task beginning before this gate passes.

---

## Phase 5 — Admin authorization, users, blocking, and settings

- [ ] P5-T01 [P] Verify the Admin overview dashboard against the moved route tree
  - **Goal**: Confirm the already-implemented real-metrics Admin dashboard (published coffees, offers, leads, content state, recent activity — no invented KPIs) still renders correctly at its new `src/app/(admin)/admin/page.tsx` location after Phase 2's move.
  - **Dependencies**: Phase 2 complete (route move), Phase 4 complete.
  - **Files/modules**: `src/app/(admin)/admin/page.tsx`.
  - **KEEP**: the existing real-metrics dashboard query logic exactly as-is — this is a post-move verification task, not a rebuild.
  - **REFACTOR/MOVE/REMOVE**: none expected beyond the file having already moved in P2-T03.
  - **Supabase/DB contract**: read-only aggregate counts already queried by the existing implementation.
  - **Auth/security**: `requireAdmin()` re-verified at the new location.
  - **Realtime**: none.
  - **EN/AR/RTL**: dashboard labels localized (already true — verify).
  - **Tests required**: a render test confirming no metric is hardcoded/fabricated.
  - **Runtime acceptance condition**: dashboard renders identically (content-wise) before and after the Phase 2 move.
  - **Out of scope**: any new metric.

- [ ] P5-T02 Build the paginated/searchable Admin Users read path
  - **Goal**: Consume the Phase 1 `admin_list_users()` extension (or its approved alternative) to deliver `contracts/admin-users-actions.md`'s `searchUsers`/`getUserDetail`.
  - **Dependencies**: P1-T02/T03 (extension approved and typed); Phase 2 complete.
  - **Files/modules**: `src/lib/data/admin.ts`, a new Admin Users workspace route (replacing the generic `[module]` view for `users`).
  - **KEEP**: the generic `[module]` router for every other module — only the `users` module gets a dedicated workspace in this phase.
  - **REFACTOR/MOVE/REMOVE**: REMOVE the generic list rendering specifically for the `users` module once the dedicated workspace reaches parity; KEEP the underlying `admin-operations.ts` utilities for everything else.
  - **Supabase/DB contract**: the Phase 1-approved extended read path; never exposes a password or an unrestricted role editor (FR-025).
  - **Auth/security**: `requireAdmin()` independently re-verified in this read path, not only at the layout.
  - **Realtime**: none — paginated search is not a Realtime use case.
  - **EN/AR/RTL**: search/filter/pagination UI localized and RTL-correct.
  - **Tests required**: search returns expected fixtures; pagination is stable; block state and avatar reference are present in the result.
  - **Runtime acceptance condition**: `spec.md` User Story 3 acceptance scenario 3 passes.
  - **Out of scope**: block/unblock actions themselves (P5-T03).

- [ ] P5-T03 Implement `setUserBlocked`/`unblockUser` with Auth-ban synchronization
  - **Goal**: Deliver `contracts/admin-users-actions.md`'s block/unblock contract in full, including the defense-in-depth Supabase Auth ban and its partial-failure handling per `research.md` §5.
  - **Dependencies**: P5-T02; Phase 1 verification (P1-T01) of `admin_set_user_blocked()`'s refusal behavior.
  - **Files/modules**: `src/actions/admin-operations.ts` (add the two actions), a new server-only service-role module (`server-only` directive, never imported by a client component) for the Auth-ban call.
  - **KEEP**: `admin_set_user_blocked()` exactly as-is (already live) as the sole durable-state write path.
  - **REFACTOR/MOVE/REMOVE**: none removed; new additive actions only.
  - **Supabase/DB contract**: `admin_set_user_blocked(target_user_id, blocked, reason)`; the service-role client is constructed only inside its own dedicated module.
  - **Auth/security**: self-block and Admin-target-block refused both by application check and by the database function's own guard (defense in depth, Constitution Principle VII); a failed Auth-ban call never rolls back the durable block and is surfaced as a distinct, non-blocking operational warning (FR-026, FR-027, FR-029).
  - **Realtime**: none for the action itself; if a "live block status" indicator is added to an open Admin session viewing that user, it must subscribe scoped to that single `profiles.id` only, per `research.md` §3.
  - **EN/AR/RTL**: block/unblock confirmation dialog and result messages localized.
  - **Tests required**: block takes effect on the target's very next request without requiring their sign-out (SC-004); self-block refused; Admin-target block refused; unblock does not create a new session for the customer (FR-028).
  - **Runtime acceptance condition**: `spec.md` User Story 3 acceptance scenarios 4–6 pass.
  - **Out of scope**: any change to the durable block's authority (Auth ban is always secondary, never primary).

- [ ] P5-T04 [P] Build the Admin user detail view with read-only avatar
  - **Goal**: A single-customer detail read (profile, avatar reference, verification state, block state/history, favorites/inquiry summary) reusing Phase 4's avatar-resolving component in read-only mode.
  - **Dependencies**: P5-T02; P4-T01 (shared avatar resolver).
  - **Files/modules**: the new Admin Users workspace's detail route/component.
  - **KEEP**: Phase 4's avatar resolver, reused not duplicated.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: same extended read path as P5-T02; explicitly no write path to `avatar_path` exists in this view (FR-020).
  - **Auth/security**: `requireAdmin()`; confirms the view is genuinely read-only for the avatar (no upload/delete control rendered).
  - **Realtime**: none.
  - **EN/AR/RTL**: fully localized detail layout.
  - **Tests required**: an Admin session cannot find any control that writes the viewed customer's avatar.
  - **Runtime acceptance condition**: `spec.md` User Story 3 acceptance scenario 3 (avatar viewing without edit capability) passes.
  - **Out of scope**: any Admin write to customer avatar data.

- [ ] P5-T05 [P] Verify Site/Profile/Account settings independence
  - **Goal**: Confirm (per the master plan) that Site settings, Admin's own Profile settings, and Admin's own Account (email/password) settings are three independently submittable forms/actions, so a failure in one never discards another.
  - **Dependencies**: Phase 2 complete (route move to `src/app/(admin)/admin/settings/**` or equivalent).
  - **Files/modules**: `src/app/(admin)/admin/account/page.tsx` (already exists), site-settings module.
  - **KEEP**: the already-implemented Admin account page (own name/email/password) from the prior pass, verified at its new location.
  - **REFACTOR/MOVE/REMOVE**: none expected; refactor only if the independence property is found broken.
  - **Supabase/DB contract**: `site_settings` (Admin-only write, audited), `profiles` (Admin's own row), Supabase Auth (Admin's own credentials).
  - **Auth/security**: Profile/Account actions may affect only `auth.uid()` (the acting Admin); Site settings require `requireAdmin()` and are audited.
  - **Realtime**: none.
  - **EN/AR/RTL**: all three settings areas fully localized.
  - **Tests required**: submitting invalid data to one settings area does not discard a pending or already-saved change in another.
  - **Runtime acceptance condition**: `spec.md` User Story 6 acceptance scenario 2 (specific to settings validation) passes for all three areas.
  - **Out of scope**: any new settings field not already approved.

- [ ] P5-T06 **PHASE 5 ACCEPTANCE GATE**
  - **Goal**: Confirm Admin authorization, user management, and blocking are correct and audited before Lead Inbox (Phase 7) or Admin CRUD redesign (Phase 10) depends on this shell.
  - **Dependencies**: P5-T01 through P5-T05.
  - **Runtime acceptance condition** (per `plan.md` Phase 5, `spec.md` SC-004/SC-009): one localized Admin workspace, no public navigation link to it, real searchable user data, audited durable blocking that takes effect immediately, no cross-user/self/role escalation possible by any tested means.
  - **Out of scope**: any Phase 6/7/10 task beginning before this gate passes.

---

## Phase 6 — Catalog, protected pricing, and Origins query layer

- [ ] P6-T01 Replace in-memory catalog filtering with the composed database query
  - **Goal**: Implement `contracts/catalog-query.md`'s `queryCatalog` — filtering, sorting, and pagination evaluated by the database, not by JavaScript after a full-table fetch, per `research.md` §4.
  - **Dependencies**: Phase 2 complete (route stable); a representative fixture set for meaningful before/after comparison (may still be sparse given the current near-empty database — the query contract must be correct at any scale, not only measured at production scale).
  - **Files/modules**: `src/lib/data/catalog.ts` (currently 24 queries with in-memory filtering), the catalog page's data-fetching call site.
  - **KEEP**: `src/lib/data/pricing.ts` as the sole, unchanged price-read boundary — this task must not touch it except to confirm the catalog query never selects price columns.
  - **REFACTOR/MOVE/REMOVE**: REFACTOR `catalog.ts` to the composed-query approach; REMOVE the in-memory filter/pagination logic once the new query is proven equivalent.
  - **Supabase/DB contract**: `coffees`/`coffee_offers`/taxonomy tables per `data-model.md`; no new index/RPC in this task unless P6-T05's `EXPLAIN ANALYZE` evidence justifies one as a separate, owner-approved unit.
  - **Auth/security**: the public catalog query must never select `offer_price_tiers` columns — verified explicitly in P6-T03.
  - **Realtime**: none — public catalog reads are not a Realtime use case in this phase.
  - **EN/AR/RTL**: localized search/sort/facet labels; results render correctly in both languages.
  - **Tests required**: a query-count/latency baseline comparison against the pre-refactor implementation; filter-combination correctness tests.
  - **Runtime acceptance condition**: `spec.md` User Story 4 acceptance scenario 4 (server-side, paginated, bounded) passes.
  - **Out of scope**: any bespoke SQL view/RPC (deferred per `research.md` §4 unless evidence-justified).

- [ ] P6-T02 [P] Enforce origin-dependent region filtering
  - **Goal**: The available region filter set depends on the selected origin at the query layer, and an inconsistent origin/region pair is treated as "region cleared," not an error (FR-033).
  - **Dependencies**: P6-T01.
  - **Files/modules**: the same catalog query module; the filter UI component.
  - **KEEP**: the existing origin→region FK dependency already enforced at the database level for coffee assignment (unchanged).
  - **REFACTOR/MOVE/REMOVE**: refactor the filter-building logic to validate the pair before querying.
  - **Supabase/DB contract**: `origins`/`regions` (`regions.origin_id` FK, already live).
  - **Auth/security**: none beyond standard public-read visibility rules.
  - **Realtime**: none.
  - **EN/AR/RTL**: region option labels localized per selected origin.
  - **Tests required**: selecting a region not belonging to the selected origin clears the region filter rather than erroring or silently ignoring it.
  - **Runtime acceptance condition**: `spec.md` User Story 4 acceptance scenario 5 passes.
  - **Out of scope**: origin/region Admin CRUD (already covered by existing Admin modules, untouched here).

- [ ] P6-T03 Re-verify the protected-pricing isolation boundary post-refactor
  - **Goal**: Prove `contracts/pricing-query.md` still holds exactly after P6-T01's catalog refactor — no price in anonymous/unverified HTML, RSC payload, metadata, JSON-LD, sitemap, or shared cache; an authenticated Admin browsing publicly does not receive customer pricing through this path (FR-030, FR-031).
  - **Dependencies**: P6-T01.
  - **Files/modules**: `src/lib/data/pricing.ts` (verification only — no change expected), the catalog/coffee-detail page components.
  - **KEEP**: `src/lib/data/pricing.ts`'s existing `requireVerifiedUser()` gate and its isolation from `catalog.ts` (already enforced by a source-text test in the prior pass — extend that test to cover the refactored catalog module too).
  - **REFACTOR/MOVE/REMOVE**: none — this is a verification task; any regression found here must be fixed in P6-T01, not patched around here.
  - **Supabase/DB contract**: `offer_price_tiers` — confirmed absent from the Realtime publication; confirmed the sole caller remains `pricing.ts`.
  - **Auth/security**: this task **is** the direct enforcement of Constitution Principle VI/VIII.
  - **Realtime**: confirms no Realtime subscription anywhere touches `offer_price_tiers`.
  - **EN/AR/RTL**: the "sign in to see price" locked-price message localized.
  - **Tests required**: a full five-persona price-presence/absence scan across every catalog/detail route, in both languages, including a grep-style scan of the rendered HTML/JSON-LD for price-shaped tokens.
  - **Runtime acceptance condition**: `spec.md` User Story 4 acceptance scenarios 1–3 and SC-008 pass.
  - **Out of scope**: Admin price *management* (unchanged, separate contract).

- [ ] P6-T04 [P] Finalize origin listing/detail aggregation
  - **Goal**: Active, non-deleted origins/regions with an efficiently computed published-coffee count (no N+1 per coffee) and dependent-region aggregation on origin detail.
  - **Dependencies**: Phase 2 complete; independent of P6-T01–T03 (different data module) so can run in parallel.
  - **Files/modules**: origin listing/detail data modules and pages.
  - **KEEP**: the existing origin list/detail route structure, already verified route-correct.
  - **REFACTOR/MOVE/REMOVE**: refactor the coffee-count query to a single aggregated query instead of a per-origin loop, if the current implementation loops.
  - **Supabase/DB contract**: `origins`, `regions`, `coffees` per `data-model.md`.
  - **Auth/security**: none beyond standard public-read rules.
  - **Realtime**: none.
  - **EN/AR/RTL**: origin/region names and continent grouping localized.
  - **Tests required**: a query-count assertion confirming no N+1 pattern.
  - **Runtime acceptance condition**: `spec.md` User Story 4 acceptance scenario 6 (empty/partial data honesty) and the origin-count performance property both pass.
  - **Out of scope**: origin/region CRUD (existing Admin modules, untouched).

- [ ] P6-T05 Run the filter/pagination/price persona test matrix and query-plan comparison
  - **Goal**: Produce the actual evidence (not a description) that this phase's runtime acceptance criteria hold, and record whether any evidence-backed index/RPC is now justified per `research.md` §4.
  - **Dependencies**: P6-T01 through P6-T04.
  - **Files/modules**: Playwright specs under `tests/e2e/**`.
  - **KEEP**: the existing anonymous price-leak/source tests as the baseline being extended, not replaced.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: read-only `EXPLAIN`-style observation only; any resulting index/RPC proposal is a separate, owner-approved unit, not applied by this task.
  - **Auth/security**: the five-persona price matrix is the core deliverable.
  - **Realtime**: none.
  - **EN/AR/RTL**: matrix run in both languages.
  - **Tests required**: this task is the test-running task.
  - **Runtime acceptance condition**: a bounded, paginated database query regardless of catalog size; stable URL filter state; no shared/public cache ever contains a price value; correct origin→region dependency — all with attached evidence per `quickstart.md`.
  - **Out of scope**: applying any index/RPC found necessary (recorded as a follow-up decision only).

- [ ] P6-T06 **PHASE 6 ACCEPTANCE GATE**
  - **Goal**: Confirm the catalog/pricing/origins query layer is correct, bounded, and price-safe before the public redesign (Phase 9) builds on it.
  - **Dependencies**: P6-T01 through P6-T05.
  - **Runtime acceptance condition** (per `plan.md` Phase 6, `spec.md` SC-006/SC-008): all conditions in P6-T05 hold with recorded evidence.
  - **Out of scope**: any Phase 9 task beginning before this gate passes.

---

## Phase 7 — Inquiry and sample delivery workflow

- [ ] P7-T01 Map the database unique-violation to `DUPLICATE_SAMPLE`
  - **Goal**: Catch `uq_inquiries_active_sample_user_coffee`'s unique-violation on insert, look up the caller's existing active request for that `coffee_id`, and return `DUPLICATE_SAMPLE` with `conflict.requestCode` set — never surfacing the raw constraint violation (FR-039, SC-005).
  - **Dependencies**: Phase 3, Phase 6 complete (needs verified-user gate and trusted-offer resolution).
  - **Files/modules**: `src/actions/inquiries.ts`, `src/lib/inquiries/sample-request.ts`.
  - **KEEP**: the existing application-level pre-check (`user_id + coffee_id + type='SAMPLE_REQUEST'`, never `offer_id`) and its 16 existing behavioral unit tests — this task adds the database-level backstop *in addition to*, not instead of, that pre-check.
  - **REFACTOR/MOVE/REMOVE**: refactor the insert path to catch the specific unique-violation error code and map it per `contracts/inquiry-actions.md`.
  - **Supabase/DB contract**: `uq_inquiries_active_sample_user_coffee` — already live per `data-model.md`, covering `NEW`/`RECEIVED`/`CONTACTED`/`SAMPLE_SENT`/`DELIVERED`.
  - **Auth/security**: this is the authoritative, race-safe implementation of the one-active-sample rule (Constitution-adjacent correctness requirement carried from the master plan).
  - **Realtime**: none.
  - **EN/AR/RTL**: the "already active" duplicate message localized, including the returned request code rendered `dir="ltr"`.
  - **Tests required**: two near-simultaneous requests for the same customer/coffee — exactly one succeeds, the other returns `DUPLICATE_SAMPLE` with the survivor's code (this is the concurrency-race test SC-005 requires).
  - **Runtime acceptance condition**: `spec.md` User Story 5 acceptance scenario 2 passes under genuine concurrency, not just sequential calls.
  - **Out of scope**: changing the duplicate-identity key away from `(user_id, coffee_id)`.

- [ ] P7-T02 [P] Map inquiry status-transition rejections to `CONFLICT`
  - **Goal**: The application attempts the status-update write and translates `validate_inquiry_status_transition()`'s raised exceptions into the `CONFLICT` domain error, per `contracts/inquiry-actions.md` — never pre-validating and duplicating the transition graph client-side.
  - **Dependencies**: Phase 5 complete (`requireAdmin()` for status changes).
  - **Files/modules**: `src/actions/inquiries.ts` (`updateInquiryStatus`), any Admin inquiry-status UI.
  - **KEEP**: `validate_inquiry_status_transition()` exactly as-is (already live) as the sole arbiter of legal transitions.
  - **REFACTOR/MOVE/REMOVE**: REMOVE any application-side transition-graph duplication if one exists; REFACTOR the action to attempt the write and catch the exception.
  - **Supabase/DB contract**: `validate_inquiry_status_transition()`, `inquiry_status_history` (auto-populated) per `data-model.md`.
  - **Auth/security**: `requireAdmin()`.
  - **Realtime**: none required for this task.
  - **EN/AR/RTL**: the conflict message ("refresh and try again") localized.
  - **Tests required**: an invalid/backward/cross-type transition attempt (e.g., a `PRODUCT` inquiry into `SAMPLE_SENT`) is rejected with no data change and no duplicate history row.
  - **Runtime acceptance condition**: `spec.md` User Story 5 acceptance scenario 5 and 7 pass.
  - **Out of scope**: any change to the transition graph itself (it is already correctly defined in the database).

- [ ] P7-T03 Build the Admin Lead Inbox
  - **Goal**: Replace the generic inquiries module view with the task-focused workspace from `contracts/inquiry-actions.md`'s `listLeadInbox`/`getInquiryDetail` — search/filter/pagination, allowed-actions-only status control, and prior-same-coffee history display (FR-040).
  - **Dependencies**: P7-T01, P7-T02; Phase 5 complete (Admin shell/auth).
  - **Files/modules**: a new Admin Lead Inbox route (replacing the generic `[module]` view for `inquiries`), `src/lib/data/admin.ts` (or a new inquiries-specific data module).
  - **KEEP**: `admin-operations.ts`'s existing allow-listed mutation utilities, reused underneath the new UI.
  - **REFACTOR/MOVE/REMOVE**: REMOVE the generic list rendering specifically for the `inquiries` module once the dedicated Lead Inbox reaches parity.
  - **Supabase/DB contract**: `inquiries`, `inquiry_status_history`, joined with `coffees`/`coffee_offers`/`warehouses` for display context.
  - **Auth/security**: `requireAdmin()`; status actions offered are derived from the current status/type, never a free-form select (avoiding an invalid-transition attempt at the UI layer, even though the database is still the enforcement authority).
  - **Realtime**: optional — if added, a Lead Inbox "live update" subscription must be scoped to an authenticated Admin session on `inquiries`/`inquiry_status_history`, both confirmed present in the Realtime publication.
  - **EN/AR/RTL**: fully localized search/filter/detail/status-action UI, RTL-correct table/detail layout.
  - **Tests required**: search/filter/pagination correctness; allowed-actions-only rendering per current status; prior-same-coffee history displayed for a `SAMPLE_REQUEST` row.
  - **Runtime acceptance condition**: `spec.md` User Story 5 acceptance scenarios 5–6 and User Story 6 acceptance scenario 1 (Admin nav grouping including Leads) pass.
  - **Out of scope**: any change to the underlying transition rules or duplicate-identity key.

- [ ] P7-T04 [P] Finalize customer-facing sample status labels
  - **Goal**: Implement the master plan's customer wording table for `SAMPLE_SENT`/`DELIVERED` (and confirm the existing labels for the other statuses) in both languages, with native-language review.
  - **Dependencies**: Phase 4's request timeline (P4-T06) already exists to extend.
  - **Files/modules**: `messages/en.json`, `messages/ar.json`, the customer request-detail/timeline component.
  - **KEEP**: the existing status-label rendering mechanism from Phase 4.
  - **REFACTOR/MOVE/REMOVE**: add the two missing labels; do not change existing correct labels.
  - **Supabase/DB contract**: `inquiry_status` enum values (already live, including `SAMPLE_SENT`/`DELIVERED`).
  - **Auth/security**: none beyond the existing owner-scoped read.
  - **Realtime**: none.
  - **EN/AR/RTL**: this task's entire purpose — native-language review is required before sign-off, not just machine-symmetric translation.
  - **Tests required**: message-parity test extended to include the two new keys; a fixture request that reaches `DELIVERED` renders the correct label in both languages.
  - **Runtime acceptance condition**: `spec.md` User Story 5 acceptance scenario in the customer timeline context, and FR-043's "Admin-recorded confirmation" framing, are both correctly communicated in the copy (never implying customer self-confirmation).
  - **Out of scope**: any change to when/how `DELIVERED` is set (that is Admin-only, per P7-T02/T03).

- [ ] P7-T05 [P] Harden the sample/product inquiry dialog's accessibility
  - **Goal**: Replace or harden the existing custom inquiry dialog's focus management with a proven accessible primitive — focus trap, Escape-to-close, focus restoration, inert background, scroll lock — per the master plan's Accessibility Plan callout for this specific component.
  - **Dependencies**: none beyond Phase 4 (dialog is reachable from coffee detail/account pages).
  - **Files/modules**: `src/components/inquiries/inquiry-panel.tsx`, `request-quote-form.tsx`.
  - **KEEP**: the existing form logic/validation inside the dialog exactly as-is — this task replaces the dialog *shell*, not the form.
  - **REFACTOR/MOVE/REMOVE**: refactor the dialog wrapper onto an accessible primitive (the codebase already depends on `@base-ui/react`, which provides one).
  - **Supabase/DB contract**: none new.
  - **Auth/security**: none beyond the existing `requireVerifiedUser()` gate on submission.
  - **Realtime**: none.
  - **EN/AR/RTL**: dialog direction and focus order correct in RTL.
  - **Tests required**: a keyboard-only script — open, tab-cycle stays within the dialog, Escape closes and restores focus to the trigger.
  - **Runtime acceptance condition**: `spec.md` User Story 7 acceptance scenario 5 (modal dialog focus management) passes specifically for this dialog.
  - **Out of scope**: the sign-out or block/unblock dialogs (already covered elsewhere).

- [ ] P7-T06 Run the full sample lifecycle test matrix
  - **Goal**: Produce the actual evidence for every acceptance scenario in `spec.md` User Story 5, including the exact-timing duplicate race, invalid/backward/cross-type transitions, and the zero-fulfillment-side-effect confirmation.
  - **Dependencies**: P7-T01 through P7-T05.
  - **Files/modules**: `tests/e2e/**`, `src/lib/inquiries/sample-request.test.ts` (extended).
  - **KEEP**: the existing 16-test suite as the baseline being extended.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: staging-only test data, per the master plan's Test Data Strategy fixture-prefix convention.
  - **Auth/security**: the full persona coverage for this workflow (verified USER only can create; Admin only can transition).
  - **Realtime**: if P7-T03's optional subscription was built, verify it here under concurrent staging sessions.
  - **EN/AR/RTL**: matrix run in both languages.
  - **Tests required**: this task is the test-running task.
  - **Runtime acceptance condition**: warehouse-switching cannot bypass the duplicate rule; a `CLOSED` request permits a new manual-review submission; `SAMPLE_SENT`/`DELIVERED` are Admin-only to set and customer-visible to read; zero quantity field or automatic fulfillment side effect anywhere — all with attached evidence.
  - **Out of scope**: any shipment/inventory/reservation feature (explicitly forbidden).

- [ ] P7-T07 **PHASE 7 ACCEPTANCE GATE**
  - **Goal**: Confirm the complete inquiry/sample lifecycle is correct, race-safe, and accessible before the public redesign or Admin redesign builds further UI on top of it.
  - **Dependencies**: P7-T01 through P7-T06.
  - **Runtime acceptance condition** (per `plan.md` Phase 7, `spec.md` SC-005): all conditions in P7-T06 hold with recorded evidence.
  - **Out of scope**: any Phase 8/9/10 task beginning before this gate passes.

---

## Phase 8 — CMS, media, articles, and project logo

- [ ] P8-T01 Build the typed CMS section registry
  - **Goal**: Map the existing section types (`HERO`, `RICH_TEXT`, `CARD_GRID`, `MEDIA_SPLIT`, `CTA`, `STAT_ROW`, `FAQ`, `ENTITY_LIST`) to validated rendering props, so an unknown/invalid section fails safely in Admin preview and never crashes a public page.
  - **Dependencies**: Phase 2 complete.
  - **Files/modules**: `src/components/content/cms-page.tsx`, `entity-sections.tsx`.
  - **KEEP**: the existing page/translation/section/media schema and Admin mutation actions (already functional per the prior pass) and the existing sanitized-Markdown rendering (`safe-markdown.tsx`) — this task adds validation, not new content capability.
  - **REFACTOR/MOVE/REMOVE**: refactor the section-rendering switch to validate props per type before rendering.
  - **Supabase/DB contract**: `site_pages`/`site_page_sections`/translations, already live, unchanged shape.
  - **Auth/security**: Admin-only writes; sanitized content preserved, not weakened.
  - **Realtime**: none.
  - **EN/AR/RTL**: translation editor parity for every section type; a clear "missing Arabic translation" indicator.
  - **Tests required**: an intentionally malformed section fails safely in preview and does not crash the public page; XSS-attempt content remains sanitized.
  - **Runtime acceptance condition**: `spec.md` User Story 6 acceptance scenario 2 (validation before write) extends to section content specifically.
  - **Out of scope**: adding a new section type not already in the approved list.

- [ ] P8-T02 [P] Wire `BrandMark` to `site_settings.org_logo_media_id`
  - **Goal**: Resolve the project logo from the existing `org_logo_media_id → media(id)` relation, with the existing official static asset as the fallback on any missing/invalid reference (FR-047) — closing the master plan's gap finding that the DB logo relation is not yet consumed.
  - **Dependencies**: Phase 2 complete; the already-fixed dark-mode cream-plate treatment from the prior completion pass.
  - **Files/modules**: `src/components/brand/mark.tsx`, header/footer/Auth/Admin brand consumers.
  - **KEEP**: the existing real-logo-with-cream-plate dark-mode treatment and correct `next/image` `width`/`height` usage exactly as-is — this task only adds the dynamic-resolution step in front of the existing static fallback.
  - **REFACTOR/MOVE/REMOVE**: refactor `BrandMark` to attempt the dynamic resolution first, falling back to the current static behavior on any failure.
  - **Supabase/DB contract**: `site_settings.org_logo_media_id → media(id) ON DELETE SET NULL` — already live, no migration.
  - **Auth/security**: none beyond standard public-read visibility for the referenced media row.
  - **Realtime**: none.
  - **EN/AR/RTL**: logo alt text localized; layout stable in both directions.
  - **Tests required**: logo renders from the DB relation when set; falls back correctly when unset, archived, or invalid; never shows a broken image in any shell/theme/locale.
  - **Runtime acceptance condition**: `spec.md` User Story 6 acceptance scenario 3 and Edge Cases "referenced project logo media item is archived" both pass.
  - **Out of scope**: any new logo-related column (e.g., a separate dark-logo relation) — out of scope unless separately approved.

- [ ] P8-T03 [P] Add reference-aware media archive warnings and the reusable picker
  - **Goal**: Warn an Admin before archiving/deleting a media item still referenced by an active coffee, origin, article, CMS section, or the site logo (FR-048); ensure one reusable media picker serves all these consumers.
  - **Dependencies**: P8-T02 (logo reference is one of the checked references).
  - **Files/modules**: Admin media module, a shared media-picker component.
  - **KEEP**: the existing media upload/MIME/size validation (already correct per the prior pass).
  - **REFACTOR/MOVE/REMOVE**: refactor the archive action to run a reference check first.
  - **Supabase/DB contract**: `media` table plus its consuming FKs (coffee/origin/article/CMS section/`site_settings.org_logo_media_id`).
  - **Auth/security**: Admin-only.
  - **Realtime**: none.
  - **EN/AR/RTL**: warning dialog localized.
  - **Tests required**: archiving a referenced item shows the warning and requires explicit confirmation; archiving an unreferenced item proceeds normally.
  - **Runtime acceptance condition**: `spec.md` User Story 6 acceptance scenario 5 passes.
  - **Out of scope**: any change to the `hills-public` bucket's MIME/size policy (already correct, unchanged).

- [ ] P8-T04 Run the CMS/media/logo test matrix
  - **Goal**: Produce evidence for CRUD/publish/archive correctness, invalid-media handling, XSS/sanitization regression, and logo behavior across every shell, both themes, and both locales.
  - **Dependencies**: P8-T01 through P8-T03.
  - **Files/modules**: `tests/e2e/**`.
  - **KEEP**: the existing sanitized-Markdown/XSS baseline tests, extended.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: staging-only content fixtures.
  - **Auth/security**: Admin-only write paths re-verified.
  - **Realtime**: none.
  - **EN/AR/RTL**: full matrix run in both languages.
  - **Tests required**: this task is the test-running task.
  - **Runtime acceptance condition**: real content drives the appropriate section types; the logo never disappears; no copied/unlicensed asset is introduced; the existing `org_logo_media_id` relation is reused, not duplicated — all with attached evidence.
  - **Out of scope**: any new CMS/media capability not already approved.

- [ ] P8-T05 **PHASE 8 ACCEPTANCE GATE**
  - **Goal**: Confirm CMS/media/logo correctness before the public redesign (Phase 9) composes the homepage from this content.
  - **Dependencies**: P8-T01 through P8-T04.
  - **Runtime acceptance condition** (per `plan.md` Phase 8): all conditions in P8-T04 hold with recorded evidence.
  - **Out of scope**: any Phase 9 task beginning before this gate passes.

---

## Phase 9 — Public design and motion rebuild

- [ ] P9-T01 [P] Expand the motion primitive set with reduced-motion equivalence
  - **Goal**: Implement the master plan's full Motion System table (`PageReveal`, `SectionReveal`, `ImageReveal`, `HoverLift`, `NavUnderline`, `MegaMenuReveal`, `DrawerReveal`, `AccordionExpand`, `FilterTransition`, `Toast`, `Modal`, `Status`) with their specified durations/easings, each with a reduced-motion equivalent that preserves full functional access.
  - **Dependencies**: Phase 2 complete (script-tag fix must already be in place before any JSON-LD-adjacent page gets new motion wrappers, so motion is never placed around a server script element, per `research.md` §1's explicit rule).
  - **Files/modules**: `src/components/motion/**` (currently only `reveal.tsx` with `Reveal`/`Stagger`).
  - **KEEP**: the existing `Reveal`/`Stagger` primitives as the base — extend, don't replace.
  - **REFACTOR/MOVE/REMOVE**: none removed; new primitives added alongside.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none.
  - **Realtime**: none.
  - **EN/AR/RTL**: entrance directions mirror correctly in RTL where meaning is directional (e.g., `DrawerReveal`'s logical-X direction).
  - **Tests required**: a reduced-motion-preference test confirming every primitive removes translation/scale/parallax/stagger delay while content remains fully visible/reachable.
  - **Runtime acceptance condition**: `spec.md` User Story 7 acceptance scenario 6 passes for every new primitive.
  - **Out of scope**: any primitive not in the approved table.

- [ ] P9-T02 Compose the homepage section sequence
  - **Goal**: Implement the master plan's Homepage Plan order (hero → sourcing proposition → featured coffees → origin discovery → quality story → Egypt/Dubai warehouse sections → account CTA → latest knowledge → footer) with honest empty states wherever data is absent.
  - **Dependencies**: P8 complete (CMS/media/logo), P6 complete (catalog/origin data), P9-T01 (motion primitives).
  - **Files/modules**: `src/app/[locale]/(marketing)/page.tsx` (post-Phase-2 location).
  - **KEEP**: any already-correct static/CMS section from the current homepage.
  - **REFACTOR/MOVE/REMOVE**: REMOVE any section currently substituting fabricated content for empty data; REFACTOR the section sequence to match the approved order and per-section data ownership (static/CMS/database, as specified per row in the Homepage Plan).
  - **Supabase/DB contract**: `coffees.is_featured`/`featured_sort_order`, `origins.is_featured`/`featured_sort_order` (already live per `data-model.md`), published articles, the two warehouse rows.
  - **Auth/security**: header viewer state and price gates unchanged by this visual work — no new client-side price exposure.
  - **Realtime**: none.
  - **EN/AR/RTL**: complete copy/layout/motion-direction parity.
  - **Tests required**: with the live database's current near-empty state (0 coffees/origins/articles), every dynamic section renders its approved empty state, not a fabricated substitute — directly testable today.
  - **Runtime acceptance condition**: `spec.md` User Story 4 acceptance scenario 6 (honest empty state) passes at the homepage level; FR-034 and Constitution "no fake business data" hold across every section.
  - **Out of scope**: any statistic, establishment date, or business claim not sourced from real data or approved static copy.

- [ ] P9-T03 [P] Finalize header and footer per the approved plans
  - **Goal**: Implement the master plan's Header Auth State and Footer Plan sections in full — sticky header hierarchy, avatar-aware CTA (built in Phase 4, verified here in the public shell), and the footer's Brand/Explore/Account/Contact/Legal structure sourced from real `site_settings`/pages only.
  - **Dependencies**: P4-T02 (header avatar menu), P8-T02 (logo resolution).
  - **Files/modules**: `src/components/navigation/site-header.tsx`, `site-footer.tsx`.
  - **KEEP**: the already-accessible mobile menu; the already-correct avatar menu from Phase 4.
  - **REFACTOR/MOVE/REMOVE**: refactor the footer to remove any invented legal/newsletter link not backed by real content, per the Footer Plan's explicit "do not invent" rule.
  - **Supabase/DB contract**: `site_settings` (contact fields), `site_pages` (real legal/support pages only).
  - **Auth/security**: footer's Account column shows Sign In when anonymous, Dashboard/Favorites/Requests when eligible USER, and never an Admin portal link.
  - **Realtime**: none.
  - **EN/AR/RTL**: footer column order and bottom-bar layout correct in RTL.
  - **Tests required**: footer renders no link to a non-existent legal page; Admin link never appears in public footer/header.
  - **Runtime acceptance condition**: `spec.md` User Story 7 acceptance scenario 1 (functional parity) passes for header/footer specifically.
  - **Out of scope**: newsletter functionality (explicitly deferred until a consent/provider/privacy flow is separately approved).

- [ ] P9-T04 [P] Implement only the approved Sucafina-inspired interaction patterns
  - **Goal**: Apply the specific, already-approved interaction-pattern rows from the master plan's Sucafina Live UX Study table (sticky header behavior, accessible mega-menu semantics, filter-drawer mechanics, card hover restraint) — citing the exact table row implemented, with zero copied content, imagery, or brand identity.
  - **Dependencies**: P9-T01–T03.
  - **Files/modules**: whichever header/menu/filter/card components the cited rows apply to.
  - **KEEP**: all existing Hills-original copy and imagery.
  - **REFACTOR/MOVE/REMOVE**: refactor only the interaction mechanics named in the cited rows.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none.
  - **Realtime**: none.
  - **EN/AR/RTL**: interaction patterns verified correct in RTL (e.g., mega-menu keyboard-accessible compound menu direction).
  - **Tests required**: a review checklist confirming each implemented pattern cites its source table row and contains no copied Sucafina text/asset.
  - **Runtime acceptance condition**: Constitution Principle XVII and `research.md` §9 are satisfied — no further Sucafina research occurred, only implementation of what was already approved.
  - **Out of scope**: any new comparative research against Sucafina; any global region selector (explicitly rejected by the master plan's study — Egypt/Dubai remain a warehouse-availability dimension, not a site-region selector).

- [ ] P9-T05 Run the public visual-regression, accessibility, and performance matrix
  - **Goal**: Produce evidence across the master plan's Visual Regression Matrix (screen × theme × locale × viewport), an axe accessibility pass, and Core Web Vitals baseline for the redesigned public surface.
  - **Dependencies**: P9-T01 through P9-T04.
  - **Files/modules**: `tests/e2e/**` (Playwright `toHaveScreenshot`, axe integration).
  - **KEEP**: the existing accessibility suite's already-fixed WCAG AA contrast tokens and 44px targets from the prior completion pass.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: none new — reads whatever data exists at test time (empty or fixture-populated).
  - **Auth/security**: none beyond confirming no new section leaks price.
  - **Realtime**: none.
  - **EN/AR/RTL**: full matrix run in both languages and both themes.
  - **Tests required**: this task is the test-running task.
  - **Runtime acceptance condition**: a visually distinctive Hills system with real content, no Sucafina copy/asset, usable from 375px through 1440px+ in both themes and both locales, restrained and reduced-motion-safe — all with attached evidence; LCP/CLS recorded, not assumed.
  - **Out of scope**: any data/Auth/DB policy change, any public URL change, any protected-price behavior change.

- [ ] P9-T06 **PHASE 9 ACCEPTANCE GATE**
  - **Goal**: Confirm the public redesign is complete and evidenced before Admin redesign (Phase 10) and cross-cutting polish (Phase 11) proceed.
  - **Dependencies**: P9-T01 through P9-T05.
  - **Runtime acceptance condition** (per `plan.md` Phase 9): all conditions in P9-T05 hold with recorded evidence.
  - **Out of scope**: any Phase 10/11 task beginning before this gate passes.

---

## Phase 10 — Admin interaction and responsive redesign

- [ ] P10-T01 [P] Characterize the remaining 14 Admin modules before touching any of them
  - **Goal**: Record the exact current CRUD behavior (create/update/archive, validation, allow-listed fields, `requireAdmin()` re-check) for every module not already redesigned in Phase 5/7 — products, offers, pricing, origins, regions, warehouses, taxonomy, varieties, media, articles, article-categories, content, settings, audit — so no working, audited functionality regresses.
  - **Dependencies**: Phase 5, Phase 7 complete.
  - **Files/modules**: none changed; a recorded characterization artifact only, covering `src/actions/admin-operations.ts` and each module's current route.
  - **KEEP**: everything characterized here, by definition, until a specific module is proven to need replacement.
  - **REFACTOR/MOVE/REMOVE**: none in this task.
  - **Supabase/DB contract**: read-only observation of current behavior.
  - **Auth/security**: confirms every existing mutation still independently re-checks `requireAdmin()` before any redesign touches it.
  - **Realtime**: none.
  - **EN/AR/RTL**: none yet.
  - **Tests required**: none — this is the pre-change characterization itself.
  - **Runtime acceptance condition**: a complete, accurate record of current behavior exists for all 14 modules.
  - **Out of scope**: any code change.

- [ ] P10-T02 Replace generic UX only where demonstrably insufficient
  - **Goal**: For any module where P10-T01 shows the generic `[module]` list/detail pattern is genuinely insufficient (per the master plan's explicit REPLACE criterion — not by default for every module), build a task-specific list/detail/edit surface reusing `admin-operations.ts`'s existing validated mutation functions.
  - **Dependencies**: P10-T01.
  - **Files/modules**: whichever specific module routes are identified as needing replacement.
  - **KEEP**: the generic `[module]`/`[module]/[id]` router as the shared adapter underneath every module not replaced in this task.
  - **REFACTOR/MOVE/REMOVE**: REPLACE only the identified modules' UI; the underlying `admin-operations.ts` functions are reused, never rewritten just for this UI change.
  - **Supabase/DB contract**: whatever each identified module already queries — no new table access.
  - **Auth/security**: the existing per-action `requireAdmin()` guard/audit is preserved exactly; no new client trust introduced by any redesigned form.
  - **Realtime**: none.
  - **EN/AR/RTL**: every redesigned module fully localized and RTL-safe, matching the Phase 5 shell-level work.
  - **Tests required**: per-module CRUD path with fixtures for each redesigned module; validation/conflict/archive tests.
  - **Runtime acceptance condition**: every redesigned module preserves its existing business semantics exactly (zero behavior regression) while gaining task-specific UX.
  - **Out of scope**: redesigning a module P10-T01 found the generic pattern already serves adequately.

- [ ] P10-T03 [P] Verify Admin responsive, theme, and RTL treatment
  - **Goal**: Confirm the already-fixed sidebar height/scroll behavior and grouped navigation (from the prior completion pass) hold across the full responsive matrix (375/768/1024/1280×650/1440) and both themes/locales, for both redesigned and un-redesigned modules.
  - **Dependencies**: P10-T02.
  - **Files/modules**: `src/components/admin/**` (nav, forms, tables), the Admin shell layout.
  - **KEEP**: the already-fixed `h-dvh`/sticky-scroll sidebar structure exactly as-is.
  - **REFACTOR/MOVE/REMOVE**: refactor only a specific module's table/form found to overflow or misbehave at a tested width.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none.
  - **Realtime**: none.
  - **EN/AR/RTL**: RTL-correct drawer/table/sidebar placement across every module.
  - **Tests required**: the full responsive matrix at the specified widths, including the short-height desktop viewport, for both themes and both locales.
  - **Runtime acceptance condition**: no horizontal overflow, no clipped status chip, no obscured sticky action, at any tested width/theme/locale combination.
  - **Out of scope**: any new module capability.

- [ ] P10-T04 Run the full per-module CRUD/responsive/RTL test pass
  - **Goal**: Produce evidence that every touched module (Phase 5, 7, and 10) is operable on mobile/tablet/short-desktop and preserves its business semantics exactly.
  - **Dependencies**: P10-T01 through P10-T03.
  - **Files/modules**: `tests/e2e/**`.
  - **KEEP**: existing Admin CRUD test baselines, extended.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: staging fixtures per module.
  - **Auth/security**: authorization re-check confirmed for every touched action.
  - **Realtime**: none.
  - **EN/AR/RTL**: full matrix.
  - **Tests required**: this task is the test-running task.
  - **Runtime acceptance condition**: `plan.md` Phase 10's runtime acceptance criteria hold with attached evidence.
  - **Out of scope**: the role model, catalog semantics, or any module/feature not already supported.

- [ ] P10-T05 **PHASE 10 ACCEPTANCE GATE**
  - **Goal**: Confirm the Admin workspace is fully task-appropriate and responsive before cross-cutting polish (Phase 11) closes remaining gaps.
  - **Dependencies**: P10-T01 through P10-T04.
  - **Runtime acceptance condition** (per `plan.md` Phase 10): all conditions in P10-T04 hold with recorded evidence.
  - **Out of scope**: any Phase 11 task beginning before this gate passes.

---

## Phase 11 — Cross-cutting accessibility, i18n, theme, and domain errors

- [ ] P11-T01 [P] Finish `ActionResult` adoption and eliminate raw-error leaks
  - **Goal**: Every remaining server action across the codebase (not just Auth from Phase 3) returns the `ActionResult` shape from `contracts/action-result.md`; a repo-wide scan finds zero raw Postgres/Supabase error strings reaching any user-facing field.
  - **Dependencies**: Phases 3–10 complete (all major action surfaces exist by now).
  - **Files/modules**: any remaining action file not yet migrated (`src/actions/account.ts`, `admin-operations.ts`, `inquiries.ts` — confirm each, migrate any stragglers).
  - **KEEP**: every already-migrated action (Phase 3's Auth actions) unchanged.
  - **REFACTOR/MOVE/REMOVE**: refactor any remaining ad hoc result shape.
  - **Supabase/DB contract**: none new.
  - **Auth/security**: this is the mechanical, repo-wide enforcement of Constitution Principle XII.
  - **Realtime**: none.
  - **EN/AR/RTL**: every `messageKey` resolves in both locale catalogs.
  - **Tests required**: a repo-wide grep-based scan for raw error patterns reaching a response field, returning zero hits.
  - **Runtime acceptance condition**: `spec.md` FR-060 holds with a passing scan, not just a manual review.
  - **Out of scope**: server-side logging detail (which intentionally stays detailed for operators).

- [ ] P11-T02 [P] Remove remaining hardcoded locale ternaries and extend parity coverage
  - **Goal**: Close out any `locale === "ar" ? ... : ...` inline ternary introduced by Phases 2–10's new code (the prior completion pass already removed 29 of these — this task catches any new ones), and extend `src/i18n/messages.test.ts` to cover every message key added since.
  - **Dependencies**: Phases 2–10 complete.
  - **Files/modules**: `src/i18n/messages.test.ts`, `messages/en.json`, `messages/ar.json`, any file the parity test or a repo grep flags.
  - **KEEP**: the existing parity-test mechanism exactly as-is — extend its coverage, don't replace it.
  - **REFACTOR/MOVE/REMOVE**: refactor any found ternary to a message-key lookup.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none.
  - **Realtime**: none.
  - **EN/AR/RTL**: this task's entire purpose.
  - **Tests required**: `npm test` (message-parity) passes with zero missing/empty keys across the full, now-larger catalog.
  - **Runtime acceptance condition**: `spec.md` SC-003 holds — zero missing or mismatched translation keys.
  - **Out of scope**: authoring genuinely new copy beyond what earlier phases already required.

- [ ] P11-T03 [P] Audit remaining dialogs/menus/live-regions for accessible-primitive compliance
  - **Goal**: Confirm every dialog/menu/drawer built or touched across Phases 2–10 (beyond the ones already explicitly hardened — mobile menu, header avatar menu, sign-out confirmation, inquiry dialog, block/unblock confirmation) uses correct focus trap/restore, Escape handling, and non-duplicative live-region announcements.
  - **Dependencies**: Phases 2–10 complete.
  - **Files/modules**: any remaining custom dialog/menu component found by the audit.
  - **KEEP**: every already-hardened primitive from earlier phases.
  - **REFACTOR/MOVE/REMOVE**: refactor any remaining non-compliant primitive.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none.
  - **Realtime**: none.
  - **EN/AR/RTL**: focus order and live-region text correct in RTL.
  - **Tests required**: manual keyboard-only scripts for every audited component, per the master plan's Accessibility Plan list (header menu, filters, sample dialog, sign-out confirm, account, Admin drawer, CRUD form, Lead Inbox transition).
  - **Runtime acceptance condition**: `spec.md` User Story 7 acceptance scenario 5 holds across every interactive primitive in the product, not only the ones explicitly named in earlier phases.
  - **Out of scope**: introducing a new dialog/menu pattern not already used elsewhere in the product.

- [ ] P11-T04 Run the full WCAG 2.2 AA cross-persona accessibility pass
  - **Goal**: Produce the axe + manual-keyboard evidence for every core journey across all five personas, closing SC-007.
  - **Dependencies**: P11-T01 through P11-T03.
  - **Files/modules**: `tests/e2e/**`.
  - **KEEP**: the existing axe suite's already-fixed contrast/target baselines.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none beyond confirming unauthorized states remain visually/behaviorally distinct from "not found."
  - **Realtime**: none.
  - **EN/AR/RTL**: full pass in both languages.
  - **Tests required**: this task is the test-running task.
  - **Runtime acceptance condition**: WCAG 2.2 AA target met for all core journeys (SC-007); zero raw backend error reachable by any tested action; every action state is localized and theme-safe.
  - **Out of scope**: any business-outcome or authorization-distinction change.

- [ ] P11-T05 **PHASE 11 ACCEPTANCE GATE**
  - **Goal**: Confirm cross-cutting quality is closed out before authenticated staging proof (Phase 12) begins.
  - **Dependencies**: P11-T01 through P11-T04.
  - **Runtime acceptance condition** (per `plan.md` Phase 11): all conditions in P11-T04 hold with recorded evidence.
  - **Out of scope**: any Phase 12 task beginning before this gate passes.

---

## Phase 12 — Authenticated E2E, visual regression, and staging acceptance

- [ ] P12-T01 Provision the staging project and five-persona fixture dataset
  - **Goal**: Set up the approved staging Supabase project (never production) with the minimum dataset from the master plan's Test Data Strategy and the five personas (Anonymous, Unverified USER, Verified USER, Blocked USER, ADMIN), fixture-prefixed `E2E-HILLS-<run-id>`.
  - **Dependencies**: Phases 0–11 complete; an approved staging project and email-testing strategy from the business owner.
  - **Files/modules**: a new test-only seed/cleanup script, run outside the browser bundle using a CI secret (never a `NEXT_PUBLIC_` credential).
  - **KEEP**: production data completely untouched — this task must fail closed if the target project is not explicitly marked staging.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: writes only staging rows/objects/users, cleaned up in reverse FK order.
  - **Auth/security**: fixture passwords/secrets stored only in CI secret storage, redacted from logs/screenshots.
  - **Realtime**: none for this task.
  - **EN/AR/RTL**: fixture content includes both EN/AR translations where the dataset requires it (origins, coffees, CMS Home/About).
  - **Tests required**: a target-project guard test confirming the script refuses to run against anything not explicitly staging.
  - **Runtime acceptance condition**: the minimum dataset (3 origins with translations/media, populated taxonomy, 4–6 published coffees plus one draft/archived boundary record, Egypt/Dubai offers with price tiers, 2 published articles, CMS Home/About, a temporary logo asset, five personas, sample inquiries spanning each status plus a prior `CLOSED` same-coffee request) exists in staging.
  - **Out of scope**: any production account, any real (non-approved) email inbox automation.

- [ ] P12-T02 [P] Build authenticated Playwright session fixtures
  - **Goal**: Real sign-in for each of the four non-anonymous personas as a reusable Playwright fixture — never a faked cookie or fabricated session.
  - **Dependencies**: P12-T01.
  - **Files/modules**: `tests/e2e/helpers.ts` (extended).
  - **KEEP**: the existing anonymous-persona test baseline (110 runs from the prior pass) unchanged.
  - **REFACTOR/MOVE/REMOVE**: none removed.
  - **Supabase/DB contract**: none new.
  - **Auth/security**: this task is a direct enforcement of the master plan's "never fake sessions" QA-integrity rule.
  - **Realtime**: none.
  - **EN/AR/RTL**: fixtures parameterized by locale so any authenticated test can run in both.
  - **Tests required**: a smoke test confirming each fixture actually produces a real, working authenticated session (not a mock).
  - **Runtime acceptance condition**: four working, reusable authenticated fixtures exist alongside the existing anonymous baseline.
  - **Out of scope**: any change to the sign-in logic itself (already delivered in Phase 3).

- [ ] P12-T03 Automate the full five-persona journey matrix
  - **Goal**: Automate every journey in the master plan's Persona Matrix that does not require a real inbox click — public discovery, price absent/present, favorites, sample request, account, sign-in, Admin entry/workspace, locale/theme/path preservation — for all five personas.
  - **Dependencies**: P12-T02.
  - **Files/modules**: `tests/e2e/**`, new persona-specific spec files.
  - **KEEP**: the existing anonymous-only specs as the base being extended with authenticated variants.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: reads/writes only against P12-T01's staging fixtures.
  - **Auth/security**: this is the direct evidence-production step for every Auth/authorization requirement in `spec.md`.
  - **Realtime**: any Realtime subscription built in earlier phases is exercised here under real concurrent staging sessions.
  - **EN/AR/RTL**: every journey run in both languages.
  - **Tests required**: this task is the test-authoring-and-running task.
  - **Runtime acceptance condition**: the full Persona Matrix passes for every automatable cell; any cell requiring a real inbox click is explicitly marked, not silently skipped or falsely passed.
  - **Out of scope**: the one manual email-click step (P12-T06's sign-off).

- [ ] P12-T04 [P] Apply the console/overlay failure gate to every authenticated test
  - **Goal**: Every test added in P12-T03 fails on any unexpected `console.error`, `pageerror`, React hydration/reconciliation warning, failed critical response, or Dev Overlay — the same gate already applied to the anonymous suite, now covering authenticated sessions and repeated locale switching within them.
  - **Dependencies**: P12-T03.
  - **Files/modules**: `tests/e2e/helpers.ts`, every P12-T03 spec.
  - **KEEP**: the existing console-gate helper from the anonymous suite, reused not duplicated.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: none.
  - **Auth/security**: none beyond what P12-T03 already covers.
  - **Realtime**: confirms no orphaned subscription produces a console warning after sign-out.
  - **EN/AR/RTL**: EN→AR→EN repeated inside an authenticated session (account, Admin) exercises the Phase 2 script-tag fix under authenticated state too, not only anonymously.
  - **Tests required**: this task is the gate-wiring task.
  - **Runtime acceptance condition**: zero unexplained console/overlay events across the entire authenticated matrix.
  - **Out of scope**: any product code change to fix a finding here (route back to the relevant earlier phase instead).

- [ ] P12-T05 [P] Capture and review the authenticated visual-regression baseline
  - **Goal**: Extend the Phase 9 visual-regression matrix to authenticated screens (account, Admin dashboard/users/Lead Inbox, block/unblock dialog) using `toHaveScreenshot`, with human review of the initial baseline (not auto-accepted).
  - **Dependencies**: P12-T01–T02.
  - **Files/modules**: `tests/e2e/**`.
  - **KEEP**: the existing public visual-regression baseline from Phase 9.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: staging fixtures only.
  - **Auth/security**: none beyond ensuring no price value is ever visible in a Verified-USER screenshot baseline being committed to a shared artifact store without appropriate access control.
  - **Realtime**: none.
  - **EN/AR/RTL**: authenticated screens captured in both themes and both locales.
  - **Tests required**: this task is the baseline-capture task.
  - **Runtime acceptance condition**: a human has reviewed and approved the initial authenticated baseline; it is not auto-accepted.
  - **Out of scope**: any UI change made solely to "fix" a screenshot diff without understanding why it changed.

- [ ] P12-T06 Verify fixture cleanup and sign off manual email acceptance
  - **Goal**: Confirm the staging fixture cleanup removes exactly what P12-T01 created (reverse FK order, run-manifest-driven) with no residue, and record the one manual step — a real confirmation-email click-through — as a signed acceptance rather than an assumed pass.
  - **Dependencies**: P12-T01 through P12-T05.
  - **Files/modules**: the cleanup script from P12-T01.
  - **KEEP**: nothing beyond what P12-T01 already established.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: a cleanup-verification query confirming zero remaining `E2E-HILLS-` prefixed rows after a full run.
  - **Auth/security**: no fixture secret or PII remains in any log/screenshot artifact after cleanup.
  - **Realtime**: none.
  - **EN/AR/RTL**: the manual email test is performed once per locale (an EN and an AR confirmation email, if the email template is locale-aware) or explicitly noted if only one locale's template exists.
  - **Tests required**: a post-cleanup query confirming zero residue; a recorded, signed observation of the manual email click producing a genuinely `email_confirmed_at`-set account.
  - **Runtime acceptance condition**: zero unexplained failures/skips in the required automated matrix; the manual case is explicitly identified and signed, not silently treated as passing; no leaked fixture data or secret in any artifact; visual diffs reviewed and approved; console clean across every persona.
  - **Out of scope**: any production data or account; any relaxation of a security control "for test convenience."

- [ ] P12-T07 **PHASE 12 ACCEPTANCE GATE**
  - **Goal**: Confirm every product journey is proven with real, authenticated, staging-backed evidence before the final production-readiness audit (Phase 13).
  - **Dependencies**: P12-T01 through P12-T06.
  - **Runtime acceptance condition** (per `plan.md` Phase 12): all conditions in P12-T06 hold with recorded evidence.
  - **Out of scope**: any Phase 13 task beginning before this gate passes.

---

## Phase 13 — SEO, performance, security, and production-readiness audit

- [ ] P13-T01 [P] Validate canonical host, redirects, sitemap, robots, and schema against the final hostname decision
  - **Goal**: Confirm `src/lib/seo/**`, `src/app/robots.ts`, `src/app/sitemap.ts` are correct against whatever production canonical host the business owner has now confirmed (or explicitly re-confirm the fail-fast behavior remains correct if the host is still undecided at this point).
  - **Dependencies**: Phase 12 complete; an owner decision on the production hostname (or explicit confirmation it remains pending).
  - **Files/modules**: `src/lib/seo/**`, `src/app/robots.ts`, `src/app/sitemap.ts`.
  - **KEEP**: the existing fail-fast `NEXT_PUBLIC_SITE_URL` validation, the existing trailing-slash-free robots/sitemap fix from the prior completion pass, the existing private-route exclusions.
  - **REFACTOR/MOVE/REMOVE**: refactor the sitemap to a segmented structure only if real data volume from Phase 12's fixtures (or beyond) now warrants it, per `research.md`'s conditional guidance — not automatically.
  - **Supabase/DB contract**: read-only (published/visible content only appears in the sitemap).
  - **Auth/security**: private routes (`/account/*`, `/admin/*`, `/dashboard-admin`, Auth utility pages) confirmed `noindex,nofollow` and absent from the sitemap (FR-062).
  - **Realtime**: none.
  - **EN/AR/RTL**: canonical/hreflang/`x-default` verified for every indexable page in both languages.
  - **Tests required**: a full crawl simulation confirming every indexable page's canonical/hreflang, and confirming every private route is excluded.
  - **Runtime acceptance condition**: `spec.md` SC-011 holds.
  - **Out of scope**: choosing the production hostname itself (a business decision, not this task's to make).

- [ ] P13-T02 [P] Run the performance budget and Core Web Vitals review
  - **Goal**: Measure bundle size, image/font delivery, cache/query behavior, and Core Web Vitals against the "good" thresholds established in `plan.md`'s Technical Context, using whatever real or fixture data exists by this point.
  - **Dependencies**: Phase 12 complete.
  - **Files/modules**: image/font/cache configuration, any query identified as slow.
  - **KEEP**: the existing `next/image` usage, explicit `sizes`, AVIF/WebP delivery already in place.
  - **REFACTOR/MOVE/REMOVE**: any evidence-backed index proposed in Phase 6/10 is applied here only as a separate, owner-approved unit — never silently bundled into this audit.
  - **Supabase/DB contract**: query-plan review only; no migration applied by this task.
  - **Auth/security**: none beyond confirming protected/private pages remain correctly dynamic (`no-store`) rather than accidentally publicly cached during a caching optimization.
  - **Realtime**: none.
  - **EN/AR/RTL**: performance measured in both locales (font subsets differ for Arabic).
  - **Tests required**: a Lighthouse/WebPageTest-equivalent pass; a DB query-count/latency review.
  - **Runtime acceptance condition**: recorded, dated LCP/CLS/INP/query evidence exists — not an assumed or historical number.
  - **Out of scope**: any late visual redesign motivated by a performance finding (fix the specific regression, not the design).

- [ ] P13-T03 Run the security/OWASP-style boundary review and secret-exposure scan
  - **Goal**: Final review of RLS, service-role usage, headers, cookies, redirect allow-lists, and cache boundaries against the master plan's Security Plan table; confirm `SUPABASE_SERVICE_ROLE_KEY` never reaches a browser bundle or log.
  - **Dependencies**: Phase 12 complete.
  - **Files/modules**: the service-role module from Phase 5, `next.config.ts` headers, redirect configuration.
  - **KEEP**: every already-verified boundary from earlier phases — this is a final confirmation pass, not a redesign.
  - **REFACTOR/MOVE/REMOVE**: refactor only a specific finding, if one is found.
  - **Supabase/DB contract**: a final RLS regression pass across all five personas.
  - **Auth/security**: this task's entire purpose — the complete boundary table from `docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md`'s Security Plan, re-verified end to end.
  - **Realtime**: final confirmation `offer_price_tiers`/`audit_logs` remain outside the publication and no subscription anywhere violates its documented scoping.
  - **EN/AR/RTL**: none specific to this task.
  - **Tests required**: a bundle scan for the service-role key; an RLS regression suite; a redirect-allow-list fuzz test.
  - **Runtime acceptance condition**: zero findings, or every finding has a recorded fix or owner-approved exception.
  - **Out of scope**: any new security control not already specified in the Security Plan.

- [ ] P13-T04 [P] Run the final no-price scan across every public route
  - **Goal**: A last, comprehensive scan of all public page HTML, structured data, metadata, and sitemap output for any price-shaped token, across the now-more-complete public surface from Phases 6 and 9.
  - **Dependencies**: Phase 12 complete.
  - **Files/modules**: none changed — a scan/report task.
  - **KEEP**: the existing price-isolation boundary from Phase 6, unchanged.
  - **REFACTOR/MOVE/REMOVE**: none expected; if this scan finds a leak, it is a Phase 6/9 regression to be fixed there, not patched here.
  - **Supabase/DB contract**: none.
  - **Auth/security**: this is the final enforcement of Constitution Principle VIII / SC-008.
  - **Realtime**: none.
  - **EN/AR/RTL**: scan runs across both locales' rendered output.
  - **Tests required**: an automated scan of every public route's rendered HTML/JSON-LD/sitemap for price-shaped patterns, returning zero hits.
  - **Runtime acceptance condition**: `spec.md` SC-008 holds with a final, dated scan result.
  - **Out of scope**: any fix beyond confirming the boundary holds (a finding here reopens the relevant earlier phase).

- [ ] P13-T05 Perform the deployment smoke test, rollback rehearsal, and release checklist
  - **Goal**: Confirm the production build deploys cleanly, a rollback to the last known-good build is rehearsed and works, and every Final Acceptance Gate from `docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md` has current, dated evidence attached (or an explicit, owner-approved exception).
  - **Dependencies**: P13-T01 through P13-T04.
  - **Files/modules**: deployment/environment documentation, the final execution report.
  - **KEEP**: nothing changed by this task beyond documentation.
  - **REFACTOR/MOVE/REMOVE**: none.
  - **Supabase/DB contract**: no migration applied; all database-adjacent changes made across this entire task list remain additive and backward compatible, so no data rollback is anticipated.
  - **Auth/security**: a rollback must not silently reopen an access boundary that was closed during this plan's execution.
  - **Realtime**: confirmed unaffected by the rollback rehearsal.
  - **EN/AR/RTL**: release checklist confirms both locales were part of every gate's evidence, not just English.
  - **Tests required**: a production-like build/deploy/rollback rehearsal.
  - **Runtime acceptance condition**: every Final Acceptance Gate (Product/data, Architecture/runtime, Auth/security, UX/design, SEO/performance/quality) has current, dated evidence attached, per `plan.md` Phase 13.
  - **Out of scope**: any product-scope change, any URL/schema change without a fresh migration-approval cycle, any production DB/Auth-record action during the audit itself, lowering an acceptance threshold to force a pass.

- [ ] P13-T06 **PHASE 13 ACCEPTANCE GATE — FINAL PROJECT GATE**
  - **Goal**: Confirm the entire 14-phase plan is complete, evidenced, and ready for a release decision.
  - **Dependencies**: P13-T01 through P13-T05, and every prior phase gate (P0-T04 through P12-T07) having already passed.
  - **Runtime acceptance condition** (per `plan.md` Phase 13 and `spec.md`'s Success Criteria in full): every SC-001 through SC-011 holds with recorded evidence; every Final Acceptance Gate has current evidence or an explicit owner-approved exception.
  - **Out of scope**: declaring readiness without every referenced piece of evidence actually attached.

---

## Dependencies & Execution Order

Matches `plan.md`'s corrected Dependency Graph (corrected during consistency
analysis — the previous version of this section presented Phases 4, 5, and 6
as freely parallel, which contradicted Phase 5's own stated dependency on
Phase 4 and P5-T01/P5-T04's explicit task-level dependencies; that
contradiction is fixed here and does not change any individual task's own
`Dependencies` field, which were already correct):

```text
Phase 0 → Phase 1 → Phase 2 → Phase 3 → {Phase 4, Phase 6} → Phase 5 → {Phase 7, Phase 8} → {Phase 9, Phase 10} → Phase 11 → Phase 12 → Phase 13
```

- **Phase 0/1**: sequential, no parallelism — both are read-only/verification,
  plus Phase 1's owner-approved RLS/storage hardening (`P1-T04`), which must
  complete and pass its gate (`P1-T05`) before Phase 3 can honestly claim
  blocked-session capability loss is proven end to end.
- **Phase 2**: sequential after Phase 1; P2-T01 and P2-T04 may run in
  parallel with each other and with P2-T02/T03 (different files), but
  P2-T05 (the script-tag fix) must wait for all of P2-T01–T04 since it must
  be verified against the final route locations.
- **Phase 3**: sequential after Phase 2. P3-T01 first (shared type), then
  P3-T02/T03/T04/T05 may proceed with P3-T05 in parallel with P3-T02/T03
  (different files).
- **Phase 4 and Phase 6**: may run in parallel once Phase 3 is gated, with
  clear file ownership — Phase 4 owns `src/actions/account.ts` and the
  header; Phase 6 owns `src/lib/data/catalog.ts`. Neither has a dependency
  on the other.
- **Phase 5 is NOT parallel with Phase 4** — this corrects the prior version
  of this document. Phase 5's own dependency is "Phases 1–4" (see `plan.md`),
  and concretely `P5-T01` requires "Phase 4 complete" and `P5-T04` requires
  `P4-T01`. Phase 5 therefore starts only after Phase 4's gate (`P4-T08`)
  passes. Phase 5 additionally depends on Phase 1's `admin_list_users()`
  extension decision (`P1-T02`/`T03`) and on Phase 1's gate (`P1-T05`) for
  the blocked-user hardening its block/unblock work (`P5-T03`) relies on.
  Only `P5-T05` (Site/Profile/Account settings) has no real dependency on
  Phase 4, but Phase 5 as a whole is scheduled after Phase 4, not alongside
  it, since splitting one task out for parallelism is not worth the
  ownership complexity it would add.
- **Phases 7, 8**: Phase 7 depends on Phases 3, 4 (specifically `P7-T04`'s
  dependency on `P4-T06`), 5, and 6; Phase 8 depends on Phase 2 and (for
  reference-checking) Phase 5. They touch disjoint files and may run in
  parallel with each other once their respective phase dependencies close.
- **Phases 9, 10**: Phase 9 depends on Phases 2, 4, 6, 8; Phase 10 depends
  on Phases 5, 7. Disjoint files (public vs. Admin) — may run in parallel.
- **Phase 11**: depends on Phases 3–10 all being gated closed.
- **Phase 12**: depends on Phase 11 gate plus an approved staging
  environment.
- **Phase 13**: depends on Phase 12 gate; final gate (P13-T06) is the
  project's overall completion checkpoint.

### Parallel execution examples

```text
# After Phase 1's gate (P1-T05) and Phase 3's gate (P3-T06) pass:
Track A (Phase 4): P4-T01 → P4-T02/T03/T04/T05 [P] → P4-T06 → P4-T07 → P4-T08 gate
Track C (Phase 6): P6-T01 → P6-T02/T04 [P] → P6-T03 → P6-T05 → P6-T06 gate

# After Phase 4's gate (P4-T08) passes (Phase 5 is sequential after Phase 4,
# not parallel with it — see correction above):
Track B (Phase 5): P5-T01 [P] → P5-T02 → P5-T03 → P5-T04/T05 [P] → P5-T06 gate

# After Phase 6's gate (P6-T06) and Phase 5's gate (P5-T06) pass:
Track D (Phase 7): P7-T01 → P7-T02 [P] → P7-T03 → P7-T04/T05 [P] → P7-T06 → P7-T07 gate
Track E (Phase 8): P8-T01 → P8-T02/T03 [P] → P8-T04 → P8-T05 gate
```

## Implementation Strategy

**No MVP-slice reordering is proposed** — unlike a typical user-story-first
breakdown, this plan's own dependency graph (security/auth before public
polish, per Constitution Principle XVI) is the intended delivery order, and
the planning brief explicitly asks to preserve it. If a smaller demonstrable
slice is needed before the full 14 phases complete, the natural checkpoint
is **after Phase 5's gate**: at that point, the full authorization state
machine (Phase 3), customer account/avatar (Phase 4), and Admin
authorization/blocking (Phase 5) are all proven — the "backbone" the rest of
the product depends on — even though the public catalog (Phase 6) and
content (Phase 8/9) are not yet rebuilt.

## Notes

- `[P]` tasks touch different files and have no dependency on an incomplete
  sibling task in the same phase.
- Every phase's gate task is the sole authority on whether that phase is
  "done" — a task list being checked off is not sufficient without its
  gate's runtime acceptance condition being met with actual evidence, per
  Constitution Principle XIV.
- No task in this document authored or executed a database migration,
  wrote application source code, or ran a test — this is the task
  breakdown only, as instructed. `P1-T04` describes an owner-approved
  RLS/storage hardening at a conceptual level only (which policies, which
  predicate); the SQL itself is authored, reviewed, and applied by the
  database owner as its own migration unit when that task is executed,
  never by this planning document.
