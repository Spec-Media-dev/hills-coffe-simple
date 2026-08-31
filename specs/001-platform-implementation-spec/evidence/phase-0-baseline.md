# Phase 0 Baseline Evidence — Hills Coffee Platform Implementation

**Recorded**: 2026-08-31
**Branch**: `main` · **HEAD**: `a36b05f` "docs: finalize Hills Spec Kit implementation plan"
**Prior checkpoint**: `7b76817` "checkpoint: pre Hills master rebuild" (190 files)
**Worktree at start and end of Phase 0**: clean (`git status --porcelain` empty both times)

This file is the "before" record required by Constitution Principle XIV
(Evidence-Based Completion). Phase 0 **documents**; it does not fix. Every
number below was produced by running the command on this date — no figure is
carried over from an earlier report.

---

## P0-T01 — Static baseline (recorded, not fixed)

**Toolchain**: node `v22.20.0`, npm `11.11.1` (npm-only per Principle XIX;
`pnpm-lock.yaml` confirmed absent, `package-lock.json` present).

| Command                | Result   | Detail                                                  |
| ---------------------- | -------- | ------------------------------------------------------- |
| `npm install`          | **PASS** | 0 vulnerabilities                                       |
| `npm run format:check` | **FAIL** | **31 files** unformatted                                |
| `npm run typecheck`    | **PASS** | 0 errors                                                |
| `npm run lint`         | **PASS** | 0 errors / 0 warnings                                   |
| `npm test`             | **PASS** | 5 files, **30/30** tests                                |
| `npm run build`        | **PASS** | compiled 22.8s, TypeScript 5.2s, **51/51** static pages |

**Formatting failure breakdown** — all 31 files are _documentation/tooling_,
**zero in `src/` or `tests/`**:

| Area        | Files |
| ----------- | ----- |
| `specs/`    | 11    |
| `.claude/`  | 10    |
| `.specify/` | 9     |
| `docs/`     | 1     |

Not fixed in Phase 0 (out of scope per the task definition). Because no
application source is affected, this does not gate Phase 1.

---

## P0-T03 — Live Supabase security objects and Realtime exclusions

Read-only confirmation against `docs/HILLS_SUPABASE_CURRENT_STATE.md`.

### `hills_security_objects` — all 8 required objects live

| Object                              | Value  |
| ----------------------------------- | ------ |
| `avatars_bucket_exists`             | `true` |
| `avatars_bucket_private`            | `true` |
| `hills_is_admin_exists`             | `true` |
| `hills_is_blocked_exists`           | `true` |
| `hills_is_verified_user_exists`     | `true` |
| `admin_set_user_blocked_exists`     | `true` |
| `active_sample_unique_index_exists` | `true` |
| `sample_transition_function_exists` | `true` |

### Sample-request integrity

- `sample_request_integrity.active_duplicates` = `[]` (empty)
- `offer_id_part_of_duplicate_identity` = `false`
  → active uniqueness is `user_id + coffee_id`, matching the approved contract.

### Realtime scope (Principles VIII and XVIII)

- Publication contains **45 tables**.
- `offer_price_tiers` — **absent** from the publication (correct)
- `audit_logs` — **absent** from the publication (correct)
- `protected_price_realtime_enabled` = `false`
- `audit_logs_realtime_enabled` = `false`

**P0-T03 verdict: PASS** — every object this plan depends on is genuinely live.

---

## P0-T03b — C1 known-defect baseline (blocked-user RLS/storage gap)

Recorded so Phase 1 `P1-T04` has a real "before" state to prove it closed.
This is the owner-approved hardening target (FR-067 / FR-068).

**UNGUARDED today** — no blocked-state predicate:

| Policy                      | Blocked predicate |
| --------------------------- | ----------------- |
| `hills_profiles_update_own` | none              |
| `avatars_owner_insert`      | none              |
| `avatars_owner_select`      | none              |
| `avatars_owner_update`      | none              |
| `avatars_owner_delete`      | none              |

**GUARDED controls** — already call `hills_is_verified_user()`:

| Policy                             | Blocked predicate          |
| ---------------------------------- | -------------------------- |
| `hills_favorites_insert_own`       | `hills_is_verified_user()` |
| `hills_inquiries_insert_verified`  | `hills_is_verified_user()` |
| `hills_price_tiers_verified_users` | `hills_is_verified_user()` |

**Status: known, tracked, NOT fixed in Phase 0** (Phase 0 executes no database
change). Closing this is `P1-T04`.

---

## P0-T02 (a) — Current route / redirect matrix

Captured against a clean `npm run dev` (ready in 686ms; stale server PID 31020
killed first). Status codes are the _first_ response for each request.

### Public

| Route                         | Status  | Target / note                                                          |
| ----------------------------- | ------- | ---------------------------------------------------------------------- |
| `/`                           | 200     |                                                                        |
| `/ar`                         | 200     |                                                                        |
| `/en`                         | 308     | → `/` (correct: `localePrefix: "as-needed"`)                           |
| `/about`                      | **404** | CMS-driven — see "Content state" below; expected, not a routing defect |
| `/green-coffee-offer-list`    | 200     |                                                                        |
| `/ar/green-coffee-offer-list` | 200     |                                                                        |
| `/coffee-origins`             | 200     |                                                                        |
| `/knowledge`                  | 200     |                                                                        |
| `/contact`                    | 200     |                                                                        |
| `/request-a-quote`            | 200     |                                                                        |
| `/robots.txt`                 | 200     |                                                                        |
| `/sitemap.xml`                | 200     |                                                                        |
| `/nonexistent-xyz`            | **404** | correct — a real 404, not a soft 200                                   |

### Auth

| Route                                                         | Status |
| ------------------------------------------------------------- | ------ |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` | 200    |
| `/verify-email` and `/verify-email?email=…`                   | 200    |

### Account (unauthenticated)

| Route                       | Status | Target                               |
| --------------------------- | ------ | ------------------------------------ |
| `/account` (and sub-routes) | 307    | → `/sign-in?next=%2Faccount`         |
| `/ar/account`               | 307    | → `/ar/sign-in?next=%2Far%2Faccount` |

Locale-correct `next=` preservation confirmed in both languages.

### Admin

| Route                                         | Status | Target                           |
| --------------------------------------------- | ------ | -------------------------------- |
| `/dashboard-admin`                            | 200    | canonical Admin entry            |
| `/ar/dashboard-admin`                         | 200    |                                  |
| `/admin`, `/admin/products`, `/admin/account` | 307    | → `/dashboard-admin`             |
| `/ar/admin`                                   | 307    | → `/ar/dashboard-admin`          |
| `/admin/login`                                | 308    | → `/dashboard-admin` (permanent) |
| `/ar/admin/login`                             | 308    | → `/ar/dashboard-admin`          |

**Regression note**: the soft-404 / broken-redirect symptom from earlier
reports does **not** reproduce. `/account` and `/verify-email` resolve
correctly and `/nonexistent-xyz` returns a true 404 — consistent with the
removal of `src/app/[locale]/loading.tsx`, whose streamed shell had been
locking the HTTP status at 200.

---

## P0-T02 (b) — Locale-switch defect: REPRODUCED

Driven with a real Chromium browser against the dev server, capturing
`console` and `pageerror` events. Observation only; no repo test file was
added (Phase 2 writes the automated repetition test).

### Hard document loads — clean in both languages

Every route below was loaded directly as EN, then AR, then EN again
(21 document loads total):

| Route       | EN                    | AR                    | EN-return             |
| ----------- | --------------------- | --------------------- | --------------------- |
| homepage    | 200 `lang=en dir=ltr` | 200 `lang=ar dir=rtl` | 200 `lang=en dir=ltr` |
| catalog     | 200 `lang=en dir=ltr` | 200 `lang=ar dir=rtl` | 200 `lang=en dir=ltr` |
| origins     | 200 `lang=en dir=ltr` | 200 `lang=ar dir=rtl` | 200 `lang=en dir=ltr` |
| knowledge   | 200 `lang=en dir=ltr` | 200 `lang=ar dir=rtl` | 200 `lang=en dir=ltr` |
| contact     | 200 `lang=en dir=ltr` | 200 `lang=ar dir=rtl` | 200 `lang=en dir=ltr` |
| sign-in     | 200 `lang=en dir=ltr` | 200 `lang=ar dir=rtl` | 200 `lang=en dir=ltr` |
| admin entry | 200 `lang=en dir=ltr` | 200 `lang=ar dir=rtl` | 200 `lang=en dir=ltr` |

**Zero** console errors, warnings, or page errors across all 21 hard loads.
`<html lang>` and `dir` are correct on every hard load.

### Client-side switch (the actual defect path) — three failures

The switcher is `src/components/navigation/locale-switcher.tsx:16`:

```tsx
onClick={() => router.replace(pathname, { locale: nextLocale })}
```

This is a **client-side soft navigation**, and it is the trigger. Isolated run:

| Step                      | URL   | `lang`           | `dir`             | Console                            |
| ------------------------- | ----- | ---------------- | ----------------- | ---------------------------------- |
| 1. hard-load EN `/`       | `/`   | `en`             | `ltr`             | clean (DevTools notice + HMR only) |
| 2. **click switch EN→AR** | `/ar` | **`en`** (wrong) | **`ltr`** (wrong) | **1 error**                        |
| 3. click switch AR→EN     | `/`   | `en`             | `ltr`             | 0                                  |
| 4. hard-load AR `/ar`     | `/ar` | `ar` (correct)   | `rtl` (correct)   | clean                              |

**D1 — script-tag error (the reported defect).** Emitted on the client
transition only:

> `Encountered a script tag while rendering React component. Scripts inside
React components are never executed when rendering on the client. Consider
using template tag instead.`

Independently confirmed server-side: the dev log forwards it three times as
`[browser] Encountered a script tag while rendering React component…`, each
immediately following an `/ar` client navigation. It never appears after a
hard load. Cause: the locale soft-navigation re-renders the subtree containing
the JSON-LD `<script type="application/ld+json">` on the client, and React
does not execute script tags rendered on the client.

**D2 — `<html lang>` / `dir` go stale on client switch.** After step 2 the URL
is `/ar` but the document is still `lang="en" dir="ltr"`. Arabic content is
therefore rendered **LTR** until a hard reload. This violates Constitution
Principle XI (EN/AR, LTR/RTL parity) at runtime and is a WCAG 2.2 failure
(`html[lang]` misidentifies the content language). Root cause: the root layout
owns `<html lang dir>` from the proxy header, and a soft navigation does not
re-render the root layout.

**D3 — query string is dropped on locale switch.** The switcher passes
`pathname` only, never `searchParams`:

```
before: /green-coffee-offer-list?origin=ethiopia&sort=newest
after:  /ar/green-coffee-offer-list          <- filters lost
```

Confirmed in the dev log:
`GET /green-coffee-offer-list?origin=ethiopia&sort=newest 200` followed by
`GET /ar/green-coffee-offer-list 200`. This is exactly the
"pathname/query preservation" requirement the task list calls for.

All three are Phase 2's to fix. Phase 0 records them only.

**Dev Overlay caveat**: the `nextjs-portal` element is present on _every_ dev
page including clean ones with zero errors, so its presence alone is not an
error signal. The console and `pageerror` counts above are the real signal.

### Server-side log

Zero server errors, warnings, exceptions, or unhandled rejections across the
whole session. The only `[browser]`-forwarded entries are the three script-tag
errors described above.

---

## Content state (context for interpreting the route matrix)

Read-only row counts taken this date:

| Table               | Rows                                             |
| ------------------- | ------------------------------------------------ |
| `coffees`           | **0**                                            |
| `origins`           | **0**                                            |
| `articles`          | **0**                                            |
| `offer_price_tiers` | 0                                                |
| `inquiries`         | 0                                                |
| `favorites`         | 0                                                |
| `audit_logs`        | 0                                                |
| `profiles`          | 1                                                |
| `site_settings`     | 1                                                |
| `site_pages`        | 18 — **all 18 `status = DRAFT`, zero published** |

Consequences that later phases must plan around:

1. `/about` returning 404 is **correct behavior**, not a defect: all 18 CMS
   pages are DRAFT. The `page_key`s present are `home`, `about`, `contact`,
   `help`, `privacy`, `cookies`, `shipping`, `terms`, `returns`, plus nine SEO
   landing keys (`green-coffee-beans-supplier`, `coffee-beans-supplier`,
   `wholesale-coffee-beans`, `specialty-coffee-beans`,
   `arabica-coffee-beans-wholesale`, `robusta-coffee-beans-wholesale`,
   `raw-coffee-beans-for-roasters`, `bulk-coffee-beans`,
   `coffee-beans-wholesale-price`).
2. Detail routes (`green-coffee-offer-list/[slug]`, `coffee-origins/[slug]`,
   `knowledge/[slug]`) **exist as route files but cannot be runtime-verified
   today** — the index pages render zero links because the source tables are
   empty. P0-T02's "coffee detail / origin / article" walk is therefore
   recorded as **NOT VERIFIABLE (no content)**, not as pass or fail.
3. Any phase whose acceptance depends on real catalog rows needs the Phase 12
   staging fixture lifecycle to run first, or it cannot produce evidence.

---

## New findings from Phase 0

| #   | Severity   | Finding                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | **HIGH**   | **D2** — `<html lang>`/`dir` stale after a client-side locale switch; Arabic renders LTR until reload. Not previously itemised. Phase 2 must cover it, and its acceptance test must assert `lang`/`dir`, not just the URL.                                                                                                                                                           |
| F2  | **MEDIUM** | **D3** — the locale switch drops the query string, losing catalog filters. Already a task-list requirement; now confirmed as a live defect with a reproduction.                                                                                                                                                                                                                      |
| F3  | **MEDIUM** | Catalog, origins, and articles tables are empty, so detail routes, DB-level filtering/sorting/pagination, and protected pricing **cannot be proven** until fixtures exist. Affects the ordering of Phase 4/5 evidence relative to Phase 12.                                                                                                                                          |
| F4  | **LOW**    | `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` is set to `https://<ref>.supabase.co/rest/v1/` rather than the bare project URL. Harmless today — `getSupabaseConfig()` (`src/lib/supabase/config.ts:16`) strips the path, and every client goes through that helper — but a future raw `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, …)` would break. Worth normalising the value. |
| F5  | **LOW**    | `npm run format:check` fails on 31 documentation/tooling files (0 in `src/`, 0 in `tests/`). Cosmetic; fix in a Phase 13 polish pass, not now.                                                                                                                                                                                                                                       |

**Confirmed non-defects** (previously suspected, disproven this date): the
soft-404 on `/account` and `/verify-email`; broken locale redirects on hard
loads; the `/about` 404 (correct CMS gating).

---

## P0-T04 — PHASE 0 ACCEPTANCE GATE

| Gate criterion (from `plan.md` Phase 0)                    | Result                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Current build is green, or its exact failures are recorded | **PASS** — build PASS (51/51); the one failing gate (`format:check`, 31 doc/tooling files) is recorded exactly |
| Current DB security objects are confirmed live             | **PASS** — all 8 `true`; Realtime exclusions confirmed                                                         |
| Script-tag symptom reproduction is recorded either way     | **PASS** — reproduced, root cause located, plus two further defects (D2, D3)                                   |
| No production data was touched                             | **PASS** — all database access was read-only (`SELECT`/count); zero writes, zero migrations                    |
| No source file was changed by this phase                   | **PASS** — `git status --porcelain` empty at start and end; HEAD unchanged at `a36b05f`                        |

**PHASE 0 GATE: PASS.**
