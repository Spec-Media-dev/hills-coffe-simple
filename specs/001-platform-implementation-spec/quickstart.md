# Quickstart: Validating the Hills Coffee Platform Implementation

This is a **validation guide**, not implementation code. It tells you how to
prove each required runtime capability actually works, matching the
"require real runtime evidence" list from the planning brief. It does not
replace the phase-by-phase test gates in `plan.md` — it is the fast path a
reviewer or CI run uses to confirm a phase's acceptance criteria.

## Prerequisites

- `npm install` (npm is the only supported package manager — Constitution
  Principle XIX).
- A working `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and — only for Admin-blocking and
  Auth-ban synchronization work — a server-only `SUPABASE_SERVICE_ROLE_KEY`
  that is never exposed to the browser.
- For any authenticated-persona evidence: an approved **staging** Supabase
  project (never production) with five safe test accounts — Anonymous
  (no account needed), Unverified USER, Verified USER, Blocked USER, ADMIN —
  provisioned per `docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md`'s Test Data
  Strategy. Fixture identifiers should carry the `E2E-HILLS-<run-id>` prefix
  and be cleaned up after each run.

## Static gates (fast, run before anything else)

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

All five MUST pass with zero unexplained failures before any runtime
evidence is collected — a green build is a precondition, not proof of a
working feature (per the "route/component existing ≠ complete" rule).

## Runtime evidence checklist

For each item below, "evidence" means an artifact (Playwright report,
screenshot, or a manually recorded staging observation) — not a claim.

| Capability | How to produce evidence | Automatable? |
|---|---|---|
| Signup | Playwright: submit `/sign-up` with a fresh `E2E-HILLS-` address; assert neutral success state, no role field was ever rendered, and no protected page is reachable immediately after | Yes |
| Email verification | Automated: assert the account is `UNVERIFIED` immediately after signup and that `/auth/callback` correctly denies before a real confirmation. Manual: click the actual emailed link in staging and confirm the account converts to verified only after that click | Partially — link click is manual unless an email-testing hook is approved |
| Sign-in (verified / blocked / admin) | Playwright persona suite: verified USER reaches customer destination; blocked USER is denied even mid-session; ADMIN via `/sign-in` is redirected to the Admin portal message, never granted customer capability | Yes |
| Blocked user | Playwright: as Admin, block a staging Verified-USER fixture; in a second, already-open session for that fixture, immediately retry a protected action (price read, favorite, inquiry) and assert denial without needing to sign out/in | Yes |
| Account (profile/avatar/favorites/requests) | Playwright: edit profile fields, upload/replace/delete an avatar (assert default icon before upload and after delete), add/remove a favorite, submit an inquiry and see it in the requests list with its timeline | Yes |
| Protected pricing | Playwright: as anonymous, confirm zero price occurrences in HTML/JSON-LD/metadata across every catalog/detail route; as Verified USER, confirm price appears only in the authenticated view; as Admin browsing publicly, confirm no customer price is granted through that path | Yes |
| Favorites | Covered under Account above; additionally assert cross-user isolation (one fixture cannot see/modify another's favorites) | Yes |
| Sample request | Playwright: Coffee A → succeeds; Coffee A again (any warehouse) → `DUPLICATE_SAMPLE` with the original request code; Coffee B → succeeds independently; Admin closes Coffee A's request → new Coffee A request succeeds for manual review | Yes |
| Admin login | Playwright: `/dashboard-admin` (and `/ar/dashboard-admin`) renders a localized admin-only form; wrong-role/blocked credentials are denied with a localized message | Yes |
| Admin CRUD | Playwright, per module: create → appears in list; edit invalid data → rejected with field error, no partial write; archive a referenced media item → warned before proceeding | Yes |
| CMS publish | Playwright: create/edit a CMS section as Admin, publish it, then load the corresponding public page and confirm the change is reflected; confirm a draft page 404s publicly | Yes |
| Language switching | Playwright repetition test: EN → AR → EN across homepage, catalog, coffee detail, origin, article, account, and Admin; assert zero console error/hydration warning/Dev Overlay and that path, query, theme, and logo are preserved at every hop (this is the locale-switch script-tag/runtime-overlay regression test — see `research.md` §1) | Yes |
| Dark/light | Playwright + `toHaveScreenshot`: toggle theme on each core screen in both locales; assert no contrast failure via automated axe scan and no logo inversion/disappearance | Mostly — visual diff review still needs a human approval step |
| Responsive | Playwright at 375/430/768/1024/1280/1440 and a short-height desktop viewport (e.g. 1280×650) for the Admin shell; assert no horizontal overflow and that sidebar/drawer/table behavior matches the Responsive Plan | Yes |

## Accessibility gate

Run the axe-core Playwright integration across: homepage, homepage with
mobile menu open, sign-in, sign-up, verify-email, catalog, coffee detail,
account shell, admin login, admin shell, and the Arabic equivalents of each.
Zero critical/serious violations is the gate (SC-007); this supplements, and
does not replace, the manual keyboard-only scripts named in the master
plan's Accessibility Plan for header menu, filters, sample dialog, sign-out
confirmation, account, Admin drawer, CRUD form, and Lead Inbox transition.

## SEO/no-price gate

```bash
# after `npm run build && npx next start`
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml
```

Confirm: private routes (`/account`, `/admin`, `/dashboard-admin`, auth
utility pages) are disallowed and absent from the sitemap; every sampled
public page's HTML/JSON-LD contains zero price-shaped tokens
(`priceCurrency`, `"@type":"Offer"`, a numeric `/kg` pattern) per SC-008.

## Sign-off

A phase is not "done" until: static gates are green, every applicable row
of the runtime evidence checklist above has an attached artifact (not a
description of what should happen), and any row marked manual has a signed
staging observation recorded per the master plan's Test Data Strategy.

---

## Pre-Phase 12 Owner Alignment Addendum: validation

Additional runtime evidence for FR-069–FR-083, on top of (not instead of)
the checklist above. Also anonymous, so every row here can be run with no
session at all — no persona fixture is a prerequisite.

| Capability | How to produce evidence | Automatable? |
|---|---|---|
| DB reconciliation applied correctly | Empirically probe (as in `research.md` #11, tagged and cleaned up): `SAMPLE_REQUEST` + `user_id = NULL` accepted; `PRODUCT` + `user_id = NULL` still rejected (`23514`); a normalized-email + coffee duplicate while active rejected (`23505` on `uq_inquiries_active_sample_anon_email_coffee`); the same after `CLOSED` accepted | Yes |
| Public GENERAL RFQ | Playwright: `/request-a-quote` (and `/ar/request-a-quote`) **while signed out** with only name/email/phone/message → on-screen confirmation with a request code, no account created, no session granted; separately, confirm the page's existing signed-in `RequestQuoteForm` branch still renders and still works unmodified when signed in | Yes |
| Public sample request | Playwright: coffee/offer detail page → "Request a sample" (anonymous) → name/email/phone/address/country → confirmation with a request code | Yes |
| Anonymous duplicate rule | Same normalized email + same coffee, still active → `DUPLICATE_SAMPLE` with the existing code; a **different** coffee → succeeds independently; after Admin closes it → a new request for that email+coffee succeeds | Yes |
| Authenticated rule unaffected | Repeat the existing Phase 7 authenticated duplicate-sample Playwright test unmodified; it must still pass exactly as before — this addendum must not have moved it | Yes (regression, not new) |
| PRODUCT stays authenticated-only | Confirm no public route/action exists for `type = 'PRODUCT'`; the coffee detail "Send inquiry" control still routes an anonymous visitor to `/sign-in`, unchanged | Yes |
| No protected data leaks to anonymous submitters | Across both public forms and their confirmation screens: zero price value, zero favorites/account affordance, zero marketplace/checkout control (cart, pay, "buy now") in HTML/response/error text | Yes |
| Verified USER unaffected | Re-run the existing authenticated sample-request, favorites, and protected-pricing Playwright suites unmodified; all must still pass | Yes (regression, not new) |
| Admin Lead Inbox | Submit one anonymous `GENERAL` and one anonymous `SAMPLE_REQUEST`; as Admin, confirm both appear in the existing Lead Inbox with correct name/email/phone and can be advanced through the existing status controls, using zero new Admin UI | Yes |
| Anti-abuse | Honeypot: submit either form with the hidden field populated → rejected, no row created, no distinguishing error. Rate limit: submit the same form rapidly past the configured threshold from the same source → `RATE_LIMITED`, no row created for the excess attempts | Yes |
| Direct anonymous DB write still denied | Attempt a direct `anon`-key `INSERT` into `public.inquiries` bypassing `submit_public_inquiry` entirely → still denied by RLS, proving the new function is the only anonymous write path, not a policy widening | Yes |
| Console/EN/AR/RTL/theme | Both changed surfaces (`/request-a-quote`'s new anonymous branch, the coffee/offer detail sample action) through the same locale-switch repetition, axe, and theme checks already required above — zero new console error, zero missing translation key, correct RTL | Yes |
| `/request-a-quote` is now indexable | Confirm the page's `robots` output is no longer `index: false` for the non-CMS-override case, and that it now appears in `sitemap.xml` with correct canonical + EN/AR alternates (FR-061) | Yes |

### Cleanup

Every fixture row created by the checks above uses a `[QA-...]`-prefixed name
and a `*.invalid`/disposable email; delete by that tag after the run, the
same hygiene already practiced by this project's other QA fixtures — never
leave a probe row behind, and never touch the owner-approved persistent
Phase 6 QA catalog rows while doing so.
