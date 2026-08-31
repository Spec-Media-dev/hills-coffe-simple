# Implementation Resume Checkpoint

**Last updated**: 2026-09-01

## Current Phase

**Phase 2 — Route architecture, proxy, and locale stabilization — COMPLETE,
GATE RECONFIRMED PASS after residual runtime remediation (2026-09-01).**

Phase 3 (Auth state machine) is next and **has not been started**.

> **Residual remediation outcome.** The owner reproduced the script-tag error in
> a browser served by a stale Turbopack runtime. A controlled A/B on a fresh
> server proved causation: the pre-fix switcher reproduces it, the shipped fix
> does not. **No application source changed.** The genuine defect was in the
> tests — `playwright.config.ts` runs `npm run start`, and the script-tag
> message is a React _development_ warning that a production build never emits,
> so the suite could not have caught it. Closed by
> `playwright.dev.config.ts` + `tests/e2e/dev-runtime.spec.ts`
> (`npm run test:e2e:dev`), demonstrated to fail when the defect is
> reintroduced. See finding **N12**.

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

## Current / Next Task

**Next**: `P3-T01` — first task of Phase 3 (Auth state machine).

Phase 3 owns **N1 (HIGH)**, the top open risk: `requireVerifiedUser()`
(`src/lib/auth/session.ts:48`) checks only `emailVerified`, not unblocked and
not `role === 'USER'`, and `getViewer()` does not select `is_blocked`. The
generated types needed for the fix were put in place by P1-T03. Phase 3 also
owns **N6** (an `auth.users` row with no `profiles` row behaves as signed-out)
and should reconcile **N11** (the `knownRoots` allow-list in
`src/lib/auth/redirects.ts`).

## Tests Passed

| Suite                                                        | Result                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `npm run test:e2e` (production, desktop + mobile)            | **134 passed, 20 skipped, 0 failed**                          |
| `npm run test:e2e:dev` (**development server**)              | **73 passed, 0 failed**                                       |
| `tests/e2e/locale-switch.spec.ts` (new in Phase 2)           | **44/44** production, and re-run under the dev config         |
| `HILLS_ADMIN_LIST_USERS_EXTENDED=1 npm run test:integration` | **50/50, 0 skipped**                                          |
| `npm test` (hermetic)                                        | **30/30**, 5 files                                            |
| `npm run typecheck`                                          | PASS, 0 errors                                                |
| `npm run lint`                                               | PASS, 0/0                                                     |
| `npm run build`                                              | PASS, **51/51** static pages                                  |
| `npm run format:check`                                       | 31 files — the unchanged baseline; 0 in `src/`, 0 in `tests/` |

Set `HILLS_ADMIN_LIST_USERS_EXTENDED=1` for the integration suite, or its seven
`admin_list_users()` extension assertions skip.

## Known Pending

| ID      | Severity   | Item                                                                                                                                                                                                                                                                                                                              | Owner phase                        |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **N1**  | **HIGH**   | **Top open risk.** `requireVerifiedUser()` checks only `emailVerified` — not unblocked, not `role === 'USER'`; `getViewer()` does not select `is_blocked`. Constitution V and VI unimplemented at the application layer. The database enforces this correctly on its own, so it is a defence-in-depth gap rather than a live leak | Phase 3                            |
| N2      | **HIGH**   | An ADMIN session cannot read customer avatars; Admin view needs a server-side service-role signed URL                                                                                                                                                                                                                             | Phase 5                            |
| N3      | **MEDIUM** | The service-role key is **not** an Administrator (`is_admin()` false — no `auth.uid()`); admin RPCs need the Admin's own session                                                                                                                                                                                                  | Phase 5                            |
| N4      | **MEDIUM** | Blocked customers can still sign in; Auth-layer ban not implemented                                                                                                                                                                                                                                                               | Phase 5                            |
| N5      | **MEDIUM** | `protect_profile_block_fields()` refuses even the service role — `admin_set_user_blocked()` is the only path to block state                                                                                                                                                                                                       | Phase 5                            |
| N6      | **MEDIUM** | An `auth.users` row (`shadyshref2001@gmail.com`) has no `profiles` row, so it behaves as signed-out                                                                                                                                                                                                                               | Phase 3                            |
| N9      | **MEDIUM** | An RLS-denied `UPDATE` returns `204 No Content` with zero rows rather than an error. Server actions must treat "zero rows affected" as a denial                                                                                                                                                                                   | Phases 4 and 5                     |
| F3      | **MEDIUM** | Catalog/origin/article tables empty and all 18 `site_pages` DRAFT; `/about` 404 is content-blocked, not a route failure; protected-pricing RLS still only verifiable negatively                                                                                                                                                   | Phase 12 before Phase 4/5 evidence |
| N7      | **LOW**    | Deleting an Admin who has blocked someone fails on the `blocked_by` FK                                                                                                                                                                                                                                                            | Phase 5                            |
| N8      | **LOW**    | `admin_cannot_block_self` precedes `only_user_accounts_can_be_blocked` in the refusal order                                                                                                                                                                                                                                       | Phase 5                            |
| **N10** | **LOW**    | **New.** A locale switch is now a full page load, the deliberate cost of correctness. A later performance pass must not turn it back into a client transition without keeping `locale-switch.spec.ts` green                                                                                                                       | Phase 13                           |
| **N11** | **LOW**    | **New.** `knownRoots` in `src/lib/auth/redirects.ts` omits `/dashboard-admin`, `/sign-in`, `/knowledge`, `/coffee-origins`, so `assertSafeRedirect` falls back to `/account` for those. Not reachable today                                                                                                                       | Phase 3                            |
| P2-T04  | —          | `(marketing)`/`(auth)` route-group split deferred by owner decision                                                                                                                                                                                                                                                               | phase owning the public redesign   |
| F4      | **LOW**    | `NEXT_PUBLIC_SUPABASE_URL` carries a `/rest/v1/` suffix                                                                                                                                                                                                                                                                           | Phase 13                           |
| F5      | **LOW**    | `format:check` fails on 31 docs/tooling files                                                                                                                                                                                                                                                                                     | Phase 13                           |

**Closed in Phase 1**: C1 / FR-067 / FR-068.
**Closed in Phase 2**: D1 (script-tag), D2 / F1 (stale `lang`/`dir`), D3 / F2
(dropped query string).

## Last Safe Checkpoint

- **Branch**: `main`; Phase 0/1 work already committed.
- **Database**: unchanged by Phase 2 — no migration, no policy, no schema
  change. Phase 1's contract re-verified green at 50/50.
- **Uncommitted work (Phase 2 only)**:
  - moved: `(site)/dashboard-admin/page.tsx` → `(admin)/dashboard-admin/page.tsx`
  - moved: `(site)/admin/login/page.tsx` → `(admin)/admin/login/page.tsx`
  - new: `src/app/[locale]/(admin)/layout.tsx`
  - modified: `src/components/navigation/locale-switcher.tsx`
  - new: `tests/e2e/locale-switch.spec.ts`
  - new: `playwright.dev.config.ts`, `tests/e2e/dev-runtime.spec.ts`
  - modified: `tests/e2e/helpers.ts` (runtime collector + overlay reader),
    `playwright.config.ts` (`testIgnore`), `package.json` (`test:e2e:dev`)
  - removed: empty `(site)/products/` leftover directories
- **Unchanged**: `src/proxy.ts`, `src/i18n/**`, `src/app/layout.tsx`,
  `src/app/[locale]/layout.tsx`, and the entire Admin workspace tree.
- **Rollback**: revert the locale-switcher file and `git mv` the two entry
  pages back into `(site)`, deleting `(admin)/layout.tsx`. No database or
  configuration state to undo.
