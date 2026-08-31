# Phase 2 Evidence — Route architecture, proxy, and locale stabilization

**Recorded**: 2026-09-01
**Branch**: `main` · worktree clean at start
**Phases 0 and 1**: COMPLETE, gates PASSED — not re-run, only regression-tested.

**Phase 2 task IDs**: `P2-T01` … `P2-T06`.
**Executed in task-ID order**: T01 → T02 → T03 → T04 → T05 → T06.

---

## Owner decisions taken before any source change

The approved plan's two file-move tasks were checked against the current source
rather than against historical reports, and two facts changed their value:

1. **The Admin tree is already canonical and single-source.**
   `src/app/[locale]/admin/**` serves `/admin` and `/ar/admin` from one
   implementation with its own layout and no site chrome. There are no
   duplicated EN/AR Admin trees.
2. **`AppProviders` (ThemeProvider, MotionConfig, TooltipProvider, Toaster) and
   `NextIntlClientProvider` both live in `[locale]/layout.tsx`.** Moving Admin
   outside `[locale]` would require duplicating that stack and resolving
   Admin's locale from a header while every other route uses the route param —
   producing exactly the inconsistent locale inference Phase 2 is meant to
   eliminate.

Both were put to the owner, who chose:

- **P2-T03 — justified minimal.** Keep the Admin tree under `[locale]`. Move
  only the Admin _entry_ routes out of the `(site)` group.
- **P2-T04 — skip, deferred.** With an identical layout, splitting `(site)`
  into `(marketing)`/`(auth)` is pure file reorganisation with no routing or
  runtime effect. Deferred to the phase that owns the public redesign.

---

## P2-T01 — Root/locale layout ownership — **PASS**

Audited by reading every layout and boundary, and by grepping the whole tree
for document elements.

| Responsibility                                    | Single owner                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `<html>` / `<body>`                               | `src/app/layout.tsx` — the **only** file rendering either                                 |
| `lang` / `dir`                                    | `src/app/layout.tsx`, from the proxy's `x-next-intl-locale` header                        |
| Locale context + messages                         | `src/app/[locale]/layout.tsx` (`NextIntlClientProvider`), config in `src/i18n/request.ts` |
| Global providers (theme, motion, tooltip, toasts) | `AppProviders`, mounted once in `[locale]/layout.tsx`                                     |
| Public header/footer                              | `src/app/[locale]/(site)/layout.tsx`                                                      |
| Admin workspace shell                             | `src/app/[locale]/admin/layout.tsx`                                                       |
| Admin **entry** shell                             | `src/app/[locale]/(admin)/layout.tsx` (new — see P2-T03)                                  |
| Account shell                                     | `src/app/[locale]/(site)/account/layout.tsx`                                              |
| Error / not-found                                 | `[locale]/error.tsx`, `[locale]/not-found.tsx`, global `src/app/not-found.tsx`            |

Verified: **no nested `<html>`/`<body>`**, and no second layout competing over
document locale state. `grep` for `<html`/`<body>` across `src/` returns
`src/app/layout.tsx` and comment lines only.

**Soft-404 regression guard**: `find src/app -name "loading.tsx"` returns
nothing. The locale-level loading boundary that Phase 0 identified as the cause
of soft-404s and client-only redirects has not been reintroduced.

---

## P2-T02 — Proxy Admin branch — **PASS (no change required)**

The plan called for an Admin-specific proxy branch. That branch exists only to
support routing Admin from outside `[locale]`, which the owner's P2-T03
decision rules out. Under the chosen architecture the generic rules already
route every Admin path correctly, so `src/proxy.ts` is unchanged.

Current algorithm, verified against the live matrix below:

| Input                              | Behavior                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| `/en` or `/en/**`                  | 308 redirect, prefix stripped                             |
| `/ar` or `/ar/**`                  | pass through, `x-next-intl-locale: ar`                    |
| anything else                      | internal rewrite to `/en{path}`, `x-next-intl-locale: en` |
| `/auth/**`, `/api`, `_next`, files | excluded by the matcher — never locale-routed             |

Changing this would have added a second locale-resolution mechanism for no
routing benefit, so it was deliberately left alone.

---

## P2-T03 — Admin entry routes out of the public site group — **PASS**

**The concrete defect**: `/dashboard-admin` and `/ar/dashboard-admin` sat in
the `(site)` group, so the Admin sign-in screen rendered inside the **public
marketing header and footer**. Measured before the change:

```
/dashboard-admin      siteFooter=1
/ar/dashboard-admin   siteFooter=1
```

**Change**: created `src/app/[locale]/(admin)/` and moved both Admin entry
routes into it, with a minimal shell carrying only the theme and locale
controls the site header had provided (73px tall, matching the offset
`AuthShell` subtracts). Route groups are invisible to URLs, so no external path
changed. The legacy `admin/login` redirect moved alongside it so the two Admin
entry routes stay co-located rather than leaving a lone `admin/` directory
inside the public site group.

After:

| Route                 | HTTP | site footer | locale switcher | theme toggle |
| --------------------- | ---- | ----------- | --------------- | ------------ |
| `/dashboard-admin`    | 200  | **0**       | 1               | 1            |
| `/ar/dashboard-admin` | 200  | **0**       | 1               | 1            |
| `/sign-in` (control)  | 200  | 1           | 1               | 1            |

`/sign-in` is unchanged, confirming no collateral effect on public or auth
pages. `noindex, nofollow` is retained on both Admin entry routes.

---

## P2-T04 — `(site)` split into `(marketing)`/`(auth)` — **DEFERRED (owner decision)**

Not executed. Route groups do not affect URLs, and with an identical layout the
split would have had no routing or runtime effect. Recorded for the phase that
owns the public redesign, where giving auth pages their own chrome is a real
design decision rather than file movement.

---

## P2-T05 — Locale-switch defects — **PASS**

### Root cause

`src/components/navigation/locale-switcher.tsx:16` was:

```tsx
onClick={() => router.replace(pathname, { locale: nextLocale })}
```

An App Router **client** transition. That single line produced all three
Phase 0 defects: it re-rendered the JSON-LD `<script>` on the client (D1), it
did not re-render the root layout that owns `lang`/`dir` (D2), and it passed
`pathname` only, never `searchParams` (D3).

### Fix

The switcher is now a real **anchor** performing a **full document
navigation**. `href` carries the localized pathname (computed with next-intl's
`getPathname`, so the prefix rule stays in one place); the click handler
re-adds `search` and `hash` from `window.location` and calls
`window.location.replace`.

Deliberate choices, and why:

- **Document navigation, not a client transition.** This fixes the cause: the
  server re-renders the root layout, so `lang`/`dir` are correct by
  construction, and structured data ships as part of a fresh HTML document
  instead of being reconciled on the client. The console error is not
  suppressed — the condition that produced it no longer occurs.
- **An anchor, not a button.** Keyboard- and middle-click-friendly, announced
  as a link, and it still works with JavaScript disabled (losing only the
  query string).
- **`window.location` rather than `useSearchParams()`.** The switcher sits in
  a shared header; `useSearchParams()` there would opt every page out of
  static rendering or force a Suspense boundary around the header.
- **`replace`, not `assign`.** Preserves the previous switcher's history
  behavior, per Phase 2's "no product behavior change" scope.
- **Trade-off, recorded**: a locale switch is now a full page load rather than
  a client transition. This is the cost of correctness and was the approved
  approach in `research.md` §1.

### Runtime evidence — 58/58 assertions, real browser

| Group                                                                               | Result                                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| EN → AR across homepage, catalog, origins, knowledge, contact, sign-in, Admin entry | url + `lang=ar` + `dir=rtl` correct on all 7                 |
| AR → EN across the same 7                                                           | url + `lang=en` + `dir=ltr` correct on all 7                 |
| Query preservation, both directions                                                 | `?origin=ethiopia&sort=newest` preserved                     |
| Hash preservation                                                                   | `/contact#form` → `/ar/contact#form`                         |
| 3× EN→AR→EN repetition on the catalog with a query                                  | url + lang + dir correct at all 6 hops                       |
| JSON-LD count                                                                       | stable (1 home, 2 catalog) — not duplicated                  |
| Switcher element                                                                    | `<a>`, `href="/ar/green-coffee-offer-list"`, `hreflang="ar"` |

**Console / runtime tally across the whole pass: `console.error` 0,
script-tag 0, hydration 0, `pageerror` 0.**

### Contract examples, confirmed

```
/green-coffee-offer-list?origin=ethiopia&sort=newest
  -> /ar/green-coffee-offer-list?origin=ethiopia&sort=newest   lang=ar dir=rtl

/ar/green-coffee-offer-list?origin=ethiopia&sort=newest
  -> /green-coffee-offer-list?origin=ethiopia&sort=newest      lang=en dir=ltr
```

### Permanent regression test

`tests/e2e/locale-switch.spec.ts` — **44/44 passing** (desktop + mobile),
covering every item required for this phase:

| #    | Requirement                             | Covered by                                           |
| ---- | --------------------------------------- | ---------------------------------------------------- |
| 1, 2 | EN→AR and AR→EN switching               | 14 parameterized tests                               |
| 3    | pathname preservation                   | every hop                                            |
| 4    | query-string preservation               | dedicated test, both directions                      |
| 5, 6 | resulting `html[lang]` / `html[dir]`    | asserted at **every** hop                            |
| 7    | no script-tag overlay                   | filtered console assertion                           |
| 8    | no hydration error                      | filtered console assertion                           |
| 9    | Admin canonical/legacy routing          | `routing-auth.spec.ts` (pre-existing)                |
| 10   | anonymous account/auth server redirects | `routing-auth.spec.ts` (pre-existing)                |
| 11   | nonexistent route is a real 404         | `routing-auth.spec.ts` (pre-existing)                |
| 12   | no redirect loop                        | `locale entry points settle without a redirect loop` |
| 13   | no `/en` prefix generated               | `no /en-prefixed URL is ever produced`               |
| 14   | `/auth/callback` globally reachable     | `/auth/callback stays outside locale routing`        |

Asserting the URL alone was explicitly insufficient — Phase 0 proved the URL
was already correct while `lang`/`dir` were wrong — so every hop asserts the
resulting document.

---

## P2-T06 — PHASE 2 ACCEPTANCE GATE — **PASS**

### Full route matrix (production build)

| Route                                                                                      | Code         | Target                                                                   |
| ------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------ |
| `/`, `/ar`                                                                                 | 200, 200     |                                                                          |
| `/green-coffee-offer-list`, `/ar/…`                                                        | 200, 200     |                                                                          |
| `/coffee-origins`, `/ar/…`                                                                 | 200, 200     |                                                                          |
| `/knowledge`, `/ar/…`                                                                      | 200, 200     |                                                                          |
| `/contact`, `/ar/…`                                                                        | 200, 200     |                                                                          |
| `/about`, `/ar/about`                                                                      | **404, 404** | **CONTENT-BLOCKED**, not a route failure — all 18 `site_pages` are DRAFT |
| `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password` (+ `/ar/…`) | 200 (all 10) |                                                                          |
| `/auth/callback`                                                                           | 307          | `/verify-email?error=link_expired` (no valid code)                       |
| `/ar/auth/callback`                                                                        | 404          | correct — callback is global                                             |
| `/account`                                                                                 | 307          | `/sign-in?next=%2Faccount`                                               |
| `/ar/account`                                                                              | 307          | `/ar/sign-in?next=%2Far%2Faccount`                                       |
| `/dashboard-admin`, `/ar/dashboard-admin`                                                  | 200, 200     |                                                                          |
| `/admin`, `/ar/admin`                                                                      | 307, 307     | `/dashboard-admin`, `/ar/dashboard-admin`                                |
| `/admin/login`, `/ar/admin/login`                                                          | 308, 308     | `/dashboard-admin`, `/ar/dashboard-admin`                                |
| `/definitely-not-a-real-route-xyz` (+ `/ar/…`)                                             | **404, 404** | real 404, not a soft 200                                                 |
| `/en`, `/en/contact`                                                                       | 308, 308     | `/`, `/contact`                                                          |

Identical to the Phase 0 baseline in every row. No redirect loop, no soft 404,
no `/en` leakage.

### Theme / provider preservation — 34/34, 0 console errors

Initial theme, toggle, and persistence across reload verified on `/`, `/ar`,
`/dashboard-admin`, `/ar/dashboard-admin`, `/sign-in`, `/ar/sign-in` — with
correct `lang`/`dir` and both controls present on each. **Theme is preserved
across a locale switch**, confirming the new full-document navigation does not
reset provider state.

### SEO preservation

- `canonical` + `hreflang` `en`/`ar`/`x-default` correct on `/`, `/ar`,
  `/green-coffee-offer-list`, `/ar/green-coffee-offer-list`.
- Admin entry keeps `<meta name="robots" content="noindex, nofollow">` after
  the move.
- `sitemap.xml` contains **zero** admin URLs; `robots.txt` carries 6
  admin/account disallow rules.
- JSON-LD emitted once per document; no duplication after switching.

### Gate criteria

| Criterion                                                              | Result                             |
| ---------------------------------------------------------------------- | ---------------------------------- |
| One Admin implementation serves all four external Admin roots          | **PASS**                           |
| No visible `/en` in the browser bar                                    | **PASS** — plus an automated guard |
| Admin path/query survives a locale switch                              | **PASS**                           |
| Script-tag repetition test green                                       | **PASS** — 0 across 3 full cycles  |
| Anonymous guards to `/admin`, `/dashboard-admin`, `/account` unchanged | **PASS**                           |
| No soft 404, no redirect loop                                          | **PASS**                           |

---

## Regression tests re-run

| Suite                                                                           | Result                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `npx playwright test` (full e2e, desktop + mobile)                              | **134 passed, 20 skipped, 0 failed**                          |
| `tests/e2e/locale-switch.spec.ts` (new)                                         | **44/44**                                                     |
| `HILLS_ADMIN_LIST_USERS_EXTENDED=1 npm run test:integration` (Phase 1 security) | **50/50**                                                     |
| `npm test` (hermetic)                                                           | **30/30**                                                     |
| `npm run typecheck`                                                             | PASS, 0 errors                                                |
| `npm run lint`                                                                  | PASS, 0/0                                                     |
| `npm run build`                                                                 | PASS, **51/51** static pages                                  |
| `npm run format:check`                                                          | 31 files — the unchanged baseline; 0 in `src/`, 0 in `tests/` |

The 20 skipped e2e tests are the pre-existing project/persona skips
(desktop-only, mobile-only, and the staging-credential persona block), not new.

**Phase 1 database and security contract is untouched and still green.** Phase 2
executed no migration and modified no policy, function, or RLS rule.

---

## Exact file changes

| File                                                                                                     | Change                                       |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `src/app/[locale]/(site)/dashboard-admin/page.tsx` → `src/app/[locale]/(admin)/dashboard-admin/page.tsx` | moved (`git mv`, content unchanged)          |
| `src/app/[locale]/(site)/admin/login/page.tsx` → `src/app/[locale]/(admin)/admin/login/page.tsx`         | moved (`git mv`, content unchanged)          |
| `src/app/[locale]/(admin)/layout.tsx`                                                                    | **new** — minimal Admin-entry shell          |
| `src/components/navigation/locale-switcher.tsx`                                                          | rewritten: anchor + full document navigation |
| `tests/e2e/locale-switch.spec.ts`                                                                        | **new** — 22 tests × 2 projects              |
| `src/app/[locale]/(site)/products/`, `products/[slug]/`                                                  | removed (empty leftover directories)         |

`src/proxy.ts`, `src/i18n/routing.ts`, `src/i18n/navigation.tsx`,
`src/app/layout.tsx`, `src/app/[locale]/layout.tsx` and every Admin workspace
file are **unchanged**.

---

## Final route architecture

```
src/app/
  layout.tsx                      <- sole owner of <html lang dir> / <body>
  not-found.tsx                   <- global 404
  robots.ts  sitemap.ts  manifest.ts
  auth/callback/route.ts          <- OUTSIDE locale routing (proxy matcher excludes /auth)
  [locale]/
    layout.tsx                    <- NextIntlClientProvider + AppProviders (once)
    error.tsx  not-found.tsx
    (site)/                       <- public + auth + account, with site header/footer
      layout.tsx
      page.tsx  [page]/  about/  contact/  knowledge/  coffee-origins/
      green-coffee-offer-list/  request-a-quote/
      sign-in/  sign-up/  verify-email/  forgot-password/  reset-password/
      account/                    <- account shell + guard
    (admin)/                      <- NEW: Admin entry, no public chrome
      layout.tsx
      dashboard-admin/            <- canonical Admin sign-in
      admin/login/                <- legacy 308 -> canonical
    admin/                        <- authenticated Admin workspace (unchanged)
      layout.tsx  page.tsx  [module]/  account/  content/
```

One document owner, one locale mechanism (the `[locale]` route param, fed by
the proxy header), one provider tree, one Admin implementation.

---

## New findings

| #       | Severity | Finding                                                                                                                                                                                                                                                                                                                                                   |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N10** | **LOW**  | A locale switch is now a full page load rather than a client transition. This is the deliberate cost of correctness (`research.md` §1) and is recorded so a later performance pass does not "optimise" it back into the defect. Any future return to a client transition must keep the D1/D2/D3 assertions in `locale-switch.spec.ts` green.              |
| **N11** | **LOW**  | `src/lib/auth/redirects.ts`'s `knownRoots` allow-list does not include `/dashboard-admin`, `/sign-in`, `/knowledge` or `/coffee-origins`. `assertSafeRedirect` therefore falls back to `/account` for those targets. Not reachable as a defect today (no flow passes them), but Phase 3 should reconcile the list when it touches the Auth state machine. |

Findings preserved untouched for their owning phases: **N1** (HIGH,
`requireVerifiedUser()` lacks the unblocked + `role = 'USER'` check — Phase 3),
**N9** (MEDIUM, RLS denial surfaces as zero rows / 204 — Phases 4/5), plus
N2–N8 and F3–F5.

## Database

**No migration, no policy change, no schema change.** Phase 2 is routing and
layout only. `profiles` role model, blocked-user RLS, avatar RLS,
`admin_list_users()`, price policies, inquiry policies, the sample unique index
and Realtime publication membership are all untouched, and the Phase 1
integration suite re-ran green at 50/50 to prove it.

---

# ADDENDUM — 2026-09-01, residual runtime remediation

The owner reproduced the script-tag error in a real browser after Phase 2 was
signed off, with the dev overlay attributing it through
`[locale]/layout.tsx` → `AppProviders` → `NextIntlClientProvider` and the
runtime marked **"(stale) Turbopack"**. That observation overrode the automated
result, and re-opening was correct: the automated result was not trustworthy,
for a reason worth recording.

## The real finding: the e2e suite was structurally blind to this defect

`playwright.config.ts` serves the app with `npm run start`. The message
"Encountered a script tag while rendering React component" is a React
**development** warning and is stripped from production builds. **A production
server can never emit it.** Phase 2's suite therefore reported 134/134 green
while the defect was still reproducible under `npm run dev`. The tests were not
wrong; they were pointed at a runtime where the failure cannot exist.

## Step 1 — stale evidence eliminated

A stale dev server was in fact still running (PID 24420, ~592 MB). It was
stopped, `.next` was deleted, and a fresh `npm run dev` was started against the
current working tree. No source file, git state or database state was touched.

## Step 2 — page-by-page reproduction on the fresh server

Across **22 direct loads** (11 EN + 11 AR), **22 locale switches** (both
directions on all 11 pages), **5 same-locale client `<Link>` navigations**, and
**back/forward history navigation**: zero script-tag errors, zero hydration
errors, zero console errors, zero page errors.

JSON-LD inventory taken at the same time — only two pages currently carry
structured data, which is why targeting them matters:

| Page                       | JSON-LD blocks                |
| -------------------------- | ----------------------------- |
| `/`                        | 1 (Organization + WebSite)    |
| `/green-coffee-offer-list` | 2 (BreadcrumbList + ItemList) |
| all other renderable pages | 0                             |

**Fast Refresh was also tested** — three edit/save cycles against a shared
component while the browser sat on each JSON-LD page — because a Fast Refresh
re-render is a client-side render of the server tree and was a plausible
trigger. **Zero reproductions**; the touched file was restored byte-for-byte.

## Step 3 — root cause proven by controlled A/B, not assumed

Rather than concluding "stale cache" from an absence of failures, the pre-fix
switcher was temporarily restored on the **same fresh server** and the same
commit, changing nothing else:

| Switcher                                                               | script-tag error                                     | `lang`/`dir` after switching to `/ar` |
| ---------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| **pre-fix** — `router.replace(pathname, { locale })` client transition | **REPRODUCED** on `/` and `/green-coffee-offer-list` | `en` / `ltr` — wrong                  |
| **post-fix** — anchor + full document navigation                       | **0**                                                | `ar` / `rtl` — correct                |

The fix was then restored and re-verified clean, including with a query string.

**Root cause: the owner's browser was served pre-fix code by the stale
Turbopack runtime.** The overlay's attribution through the client provider
chain is exactly what a client transition produces — it reconciles the RSC
payload's `<script>` beneath that client boundary. The Phase 2 fix already
addressed it; the stale server did not have it.

**No source change was required for the defect itself.** The JSON-LD pattern
(a `<script type="application/ld+json">` with `dangerouslySetInnerHTML`
emitted from a Server Component) is already the correct App Router approach and
was deliberately left alone — removing or relocating structured data to silence
a warning that the current code does not produce would have been the wrong fix,
and `console.error` was not suppressed anywhere.

## Step 5 — Playwright strengthened where it actually matters

| Change                                                        | Purpose                                                                                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright.dev.config.ts` (**new**) + `npm run test:e2e:dev` | serves the app with `npm run dev`, so React development diagnostics can be observed at all                                                                  |
| `tests/e2e/dev-runtime.spec.ts` (**new**)                     | 11 page families × direct load + EN→AR + AR→EN, plus query switching, 3× repetition on a JSON-LD page, same-locale client `<Link>` navigation, back/forward |
| `collectRuntimeProblems()` in `helpers.ts` (**new**)          | captures `console.error`, `pageerror`, the exact script-tag message and hydration errors as separate channels                                               |
| `devOverlayError()` in `helpers.ts` (**new**)                 | reads the Next.js overlay's shadow root and returns error text — the `nextjs-portal` element exists on every dev page, so its presence alone proves nothing |
| `locale-switch.spec.ts` strengthened                          | now asserts `pageerror` and overlay state too, not just console errors                                                                                      |
| `playwright.config.ts` `testIgnore`                           | keeps `dev-runtime.spec.ts` out of the production run, where it would pass vacuously and imply coverage that does not exist                                 |

Two robustness fixes found while doing this:

- **The switcher selector is now element-agnostic** (`[aria-label=…]`, not
  `a[aria-label=…]`). With an anchor-only selector, reverting to a
  client-transition `<button>` failed the suite on a _selector timeout_ rather
  than naming the real defect. That the control must be an anchor is asserted
  separately.
- **`switchLocale` waits for the URL to change**, not for a load state.
  `waitForLoadState("domcontentloaded")` can resolve against the outgoing
  document after a full navigation, which raced the assertions and produced one
  intermittent failure.

### The new tests were proven to fail on the defect

A test that cannot fail is worthless, so the pre-fix switcher was reinstated and
the dev suite re-run. It failed, naming the exact defect:

```
Error: 3x EN -> AR -> EN on catalog: React must not render a <script> on the client
+   "Encountered a script tag while rendering React component. Scripts inside
     React components are never executed when rendering on the client. ..."
```

The fix was then restored and the suite returned to green.

## Step 6 — full regression

| Command                                                      | Result                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| `npm run typecheck`                                          | PASS, 0 errors                                            |
| `npm run lint`                                               | PASS, 0/0                                                 |
| `npm test`                                                   | **30/30**                                                 |
| `HILLS_ADMIN_LIST_USERS_EXTENDED=1 npm run test:integration` | **50/50** — Phase 1 security contract unchanged           |
| `npm run build`                                              | PASS, **51/51** static pages                              |
| `npm run test:e2e` (production)                              | **134 passed, 20 skipped, 0 failed**                      |
| `npm run test:e2e:dev` (**development**)                     | **73 passed, 0 failed**                                   |
| `npm run format:check`                                       | 31 files — unchanged baseline; 0 in `src/`, 0 in `tests/` |

Nothing weakened: blocked-user RLS, protected pricing, Admin authorization,
avatar security and sample uniqueness are all covered by the integration suite,
which re-ran at 50/50. No migration, no schema change, no database write.

## Files changed by this remediation

| File                              | Change                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `playwright.dev.config.ts`        | **new** — development-server config                                            |
| `tests/e2e/dev-runtime.spec.ts`   | **new** — dev-mode runtime cleanliness across page families                    |
| `tests/e2e/helpers.ts`            | added `collectRuntimeProblems`, `devOverlayError`, and the two message regexes |
| `tests/e2e/locale-switch.spec.ts` | stronger assertions; element-agnostic selector; navigation race fixed          |
| `playwright.config.ts`            | `testIgnore` for the dev-only spec                                             |
| `package.json`                    | added `test:e2e:dev`                                                           |

**No application source file was modified.** `locale-switcher.tsx` is
byte-identical to the Phase 2 fix — it was restored after each A/B experiment
and verified.

## New finding

| #       | Severity           | Finding                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N12** | **HIGH (process)** | An e2e suite that runs only against a production build cannot observe React development warnings, and will report green while a real dev-mode defect is live. Any future assertion about React diagnostics, hydration, or the dev overlay must live in `dev-runtime.spec.ts` under `playwright.dev.config.ts`. This is why the Phase 2 gate passed while the owner could still reproduce the defect. |

## Phase 2 gate — RECONFIRMED PASS

The original gate criteria still hold, and are now additionally proven under a
development server on a freshly-built runtime, with tests demonstrated to fail
when the defect is reintroduced.

---

# ADDENDUM — 2026-09-01, favicon-only hotfix

**Scope**: favicon/app-icon ownership only. No routing, locale, Auth, or
database work was touched.

## Root cause

`src/app/favicon.ico` contained a **generic placeholder icon** (a black circle
with a white triangle) — not Hills Coffee artwork, and unrelated to any
Next.js/Vercel default template icon, but visually read by the owner as an
"old/default" icon showing intermittently in the browser tab. The file's
timestamp (2026-08-30) predated the correct `icon.png`/`apple-icon.png`
(2026-08-31), which had already been regenerated from the real logo emblem in
an earlier session — `favicon.ico` was simply missed in that pass.

Many browsers request `/favicon.ico` directly for the tab icon even when a
`<link rel="icon">` points elsewhere, which is why the placeholder appeared
_intermittently_ rather than consistently: which icon source "wins" for the
tab depends on browser and caching behavior when multiple valid icon
declarations exist for the same page.

## Fix

Rebuilt `src/app/favicon.ico` from the already-correct, already-approved
`src/app/icon.png` (verified visually before use). No ICO encoder was available
in `node_modules`, so the ICO container (6-byte header + one 16-byte
`ICONDIRENTRY` per frame) was constructed directly, embedding PNG-format frames
at 16×16, 32×32, 48×48 and 256×256 — matching the original file's frame count
and sizes. This is a standard, universally-supported ICO variant (PNG-compressed
frames, supported since Windows Vista and by all current browsers).

No artwork was redesigned or recolored; the source pixels are the existing
`icon.png`, only resized.

## Verification (fresh server, fresh browser context)

- Stopped the running dev server (a stale instance was again found running),
  deleted `.next`, started `npm run dev` clean.
- Confirmed exactly one `<link rel="icon">` pair (`favicon.ico` 256×256
  `image/x-icon`, `icon.png` 512×512 `image/png`) plus one
  `<link rel="apple-touch-icon">` (`apple-icon.png` 180×180) — no competing or
  duplicate declarations, no `metadata.icons` override anywhere in `src/`.
- `/favicon.ico`, `/icon.png`, `/apple-icon.png` all return `200` with correct
  `Content-Type` and byte counts matching the files on disk.
- Identical icon set confirmed, byte-for-byte, across all 8 required routes
  (`/`, `/ar`, `/knowledge`, `/ar/knowledge`, `/sign-in`, `/ar/sign-in`,
  `/dashboard-admin`, `/ar/dashboard-admin`) in a **fresh Playwright browser
  context** (no carried-over favicon cache).
- The served `/favicon.ico`, fetched fresh inside that isolated context, was
  parsed and confirmed to contain 4 valid PNG-format frames (16/32/48/256), not
  the old placeholder.
- `manifest.webmanifest` declares no `icons` array, so there is nothing there
  to conflict with the `<link>`-based strategy.
- `npm run typecheck` and `npm run lint` pass (binary-only change; no source
  code was modified).

## File changed

| File                  | Change                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/app/favicon.ico` | replaced — placeholder triangle icon → correct Hills Coffee emblem, rebuilt from `icon.png` at 16/32/48/256px |

No other file was modified by this fix.
