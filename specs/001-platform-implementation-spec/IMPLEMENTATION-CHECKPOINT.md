# Implementation Resume Checkpoint

**Last updated**: 2026-09-01

## Current Phase

**Phase 1 — Database/storage contract verification and Admin read-path
completion — COMPLETE, GATE PASSED.**

Phase 2 (route architecture, proxy, locale stabilization) is next and **has
not been started**.

Both approved migrations were applied by the owner and re-verified against the
**live** database rather than against the migration files. `P1-T04` was applied
as authored; `P1-T02` was applied with two safety-preserving corrections — the
DROP/CREATE/grants wrapped in one transaction, and the `SECURITY DEFINER`
`search_path` hardened to `pg_catalog, public, auth`. Both are improvements and
neither changes the approved contract.

## Completed Task IDs

### Phase 0 — COMPLETE, gate PASSED

`P0-T01` PASS · `P0-T02` PASS · `P0-T03` PASS · `P0-T04` PASS
Evidence: `evidence/phase-0-baseline.md`

### Phase 1 — COMPLETE, gate PASSED

| Task                                    | Status   | Notes                                                                                                                  |
| --------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `P1-T01` characterization tests         | **PASS** | full contract proven live; harness at `tests/integration/**`                                                           |
| `P1-T02` `admin_list_users()` extension | **PASS** | applied; all 7 extension assertions now run and pass                                                                   |
| `P1-T03` sync generated types           | **PASS** | derived from the live OpenAPI document (no CLI credentials); `Profile` row type also gained its 5 missing live columns |
| `P1-T04` RLS/storage hardening          | **PASS** | C1/FR-067 closed; FR-068 controls all green                                                                            |
| `P1-T05` **PHASE 1 GATE**               | **PASS** | all six criteria met                                                                                                   |

Evidence: `evidence/phase-1-authorization-contract.md` (see the post-migration
addendum for the live re-verification).

## Current / Next Task

**Next**: `P2-T01` — confirm the root/locale layout ownership boundary, first
task of Phase 2.

Phase 2 carries three defects reproduced in Phase 0, all traced to
`src/components/navigation/locale-switcher.tsx:16`
(`router.replace(pathname, { locale })`, a client soft navigation that also
drops `searchParams`): **D1** the script-tag console error, **D2** stale
`<html lang>`/`dir` leaving Arabic rendered LTR, and **D3** the dropped query
string. `P2-T05` has already been updated to require assertions for all three.

## Tests Passed

| Suite                                                        | Result                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `HILLS_ADMIN_LIST_USERS_EXTENDED=1 npm run test:integration` | **50/50, 0 skipped**, 3 files                                       |
| `npm test` (hermetic)                                        | **30/30**, 5 files                                                  |
| `npm run typecheck`                                          | PASS, 0 errors                                                      |
| `npm run lint`                                               | PASS, 0/0                                                           |
| `npm run build`                                              | PASS, **51/51** static pages                                        |
| `npm run format:check`                                       | 31 files — exactly the Phase 0 baseline; 0 in `src/`, 0 in `tests/` |

Set `HILLS_ADMIN_LIST_USERS_EXTENDED=1` when running the integration suite;
without it the seven `admin_list_users()` extension assertions skip.

## Known Pending

| ID      | Severity   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                | Owner phase                        |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **N1**  | **HIGH**   | **Top open risk.** `requireVerifiedUser()` (`src/lib/auth/session.ts:48`) checks only `emailVerified` — not unblocked, not `role === 'USER'`; `getViewer()` does not select `is_blocked`. Constitution V and VI are unimplemented at the application layer. The database now enforces this correctly on its own, so this is a defence-in-depth gap rather than a live leak — but the app gate is a no-op. Types needed for the fix are now in place | Phase 3                            |
| N2      | **HIGH**   | An ADMIN session cannot read customer avatars; Admin view needs a server-side service-role signed URL                                                                                                                                                                                                                                                                                                                                               | Phase 5                            |
| D1      | **HIGH**   | Script-tag console error on client-side locale switch                                                                                                                                                                                                                                                                                                                                                                                               | Phase 2                            |
| D2 / F1 | **HIGH**   | `<html lang>`/`dir` stale after client-side locale switch — Arabic renders LTR                                                                                                                                                                                                                                                                                                                                                                      | Phase 2                            |
| N3      | **MEDIUM** | The service-role key is **not** an Administrator (`is_admin()` false — no `auth.uid()`); admin RPCs need the Admin's own session                                                                                                                                                                                                                                                                                                                    | Phase 5                            |
| N4      | **MEDIUM** | Blocked customers can still sign in; Auth-layer ban not implemented                                                                                                                                                                                                                                                                                                                                                                                 | Phase 5                            |
| N5      | **MEDIUM** | `protect_profile_block_fields()` refuses even the service role — `admin_set_user_blocked()` is the only path to block state                                                                                                                                                                                                                                                                                                                         | Phase 5                            |
| N6      | **MEDIUM** | An `auth.users` row (`shadyshref2001@gmail.com`) has no `profiles` row, so it behaves as signed-out                                                                                                                                                                                                                                                                                                                                                 | Phase 3                            |
| **N9**  | **MEDIUM** | **New.** A blocked customer's `UPDATE` is denied by RLS row-filtering, so it returns `204 No Content` with zero rows rather than an error. Server actions must treat "zero rows affected" as a denial — checking only the error field would report success                                                                                                                                                                                          | Phases 4 and 5                     |
| D3 / F2 | **MEDIUM** | Locale switch drops the query string                                                                                                                                                                                                                                                                                                                                                                                                                | Phase 2                            |
| F3      | **MEDIUM** | Catalog/origin/article tables empty and all 18 `site_pages` DRAFT; protected-pricing RLS still only verifiable negatively                                                                                                                                                                                                                                                                                                                           | Phase 12 before Phase 4/5 evidence |
| N7      | **LOW**    | Deleting an Admin who has blocked someone fails on the `blocked_by` FK                                                                                                                                                                                                                                                                                                                                                                              | Phase 5                            |
| N8      | **LOW**    | `admin_cannot_block_self` precedes `only_user_accounts_can_be_blocked` in the refusal order                                                                                                                                                                                                                                                                                                                                                         | Phase 5                            |
| F4      | **LOW**    | `NEXT_PUBLIC_SUPABASE_URL` carries a `/rest/v1/` suffix                                                                                                                                                                                                                                                                                                                                                                                             | Phase 13                           |
| F5      | **LOW**    | `format:check` fails on 31 docs/tooling files                                                                                                                                                                                                                                                                                                                                                                                                       | Phase 13                           |

**Closed this phase**: C1 / FR-067 / FR-068.

## Last Safe Checkpoint

- **Commit**: `a36b05f` "docs: finalize Hills Spec Kit implementation plan"
- **Branch**: `main`
- **Database**: both approved migrations applied and verified. State after
  verification is identical to before it — `profiles` holds one ADMIN row,
  `auth.users` holds the same two accounts, the `avatars` bucket is empty and
  still `public = false`. Every test fixture was deleted.
- **Uncommitted work**: Phase 0/1 Spec Kit artifacts and evidence, the two
  applied migration files, `tests/integration/**`,
  `vitest.integration.config.mts`, the `test:integration` script and
  `tests/integration/**` exclusion, the updated
  `docs/HILLS_SUPABASE_CURRENT_STATE.md`, and
  `src/lib/supabase/types.generated.ts`.
- **Only `src/` file changed across Phases 0 and 1**:
  `src/lib/supabase/types.generated.ts` (P1-T03). No application logic,
  component, route, or action was modified.
- **Database rollback**: the rollback SQL for the RLS/storage hardening is
  retained at the bottom of
  `migrations/P1-T04_blocked_user_rls_storage_hardening.sql`. The `P1-T02`
  file as applied no longer carries its rollback block; the pre-extension
  `admin_list_users()` definition is preserved in the evidence file and in git
  history if it is ever needed.
