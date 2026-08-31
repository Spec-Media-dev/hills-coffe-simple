# Hills Coffee — Master Final Completion Report

**Date:** 2026-08-31
**Branch:** `main` (starting commit `ee40259`) — no commit created, per instruction.
**Mode:** primary implementation + QA agent (not a review pass).
**Package manager:** npm only (`packageManager: npm@11.11.1`).

This report records the **real** state of the product. Every claim below is backed by a command that was actually executed or a file that was actually read. Where something could not be verified, it is marked as unverified rather than assumed.

---

# Final Verdict

The blocking defects the owner personally observed are **reproduced, root-caused, and fixed**, and the fixes hold in a production build, not just in dev. The application now boots, builds, routes, and enforces its security boundaries correctly in both locales.

The product is **ready for authenticated staging QA**. It is **not ready for production**, and the remaining gap is dominated by inputs this pass cannot supply: an empty database, no admin or buyer credentials, and an unconfirmed production hostname.

---

# Evidence-Based Completion Score

## 84 / 100

| Area                        | Weight | Score | Basis                                                                                                                           |
| --------------------------- | -----: | ----: | ------------------------------------------------------------------------------------------------------------------------------- |
| Auth / Customer Account     |     15 |    13 | All flows implemented and route-verified anonymously; live authenticated proof impossible without credentials                   |
| Public Catalogue / Content  |     15 |    12 | Routes, SSR, real DB reads, empty states all correct; catalog still filters in memory with no DB pagination (§23)               |
| Sample / Inquiry Workflow   |     10 |     9 | Rule fully implemented, 16 real behavioural tests; concurrency race remains a DB decision                                       |
| Admin Operational CRUD      |     20 |    17 | 16 modules, 20 gated server actions, allow-listed writes; not exercised as a real ADMIN                                         |
| Admin CMS / Settings        |     15 |    12 | CMS + settings + media + articles implemented; taxonomy/content are grouped modules; zero CMS rows exist to prove it end-to-end |
| EN/AR + RTL + Light/Dark    |     10 |     9 | Parity enforced by test, 29 hardcoded ternaries removed, lang/dir correct, dark-mode logo fixed                                 |
| UX / Motion / Accessibility |      5 |     4 | WCAG contrast defects fixed, 44px targets, accessible mobile menu; reduced motion still untested                                |
| SEO                         |      5 |   4.5 | Real crawlability bug fixed, breadcrumbs + Article schema added, no price anywhere                                              |
| Testing / Runtime QA        |      5 |     4 | 30 unit + 110 E2E runs; no authenticated E2E possible                                                                           |

**This is below the 85 target.** The shortfall is **not** mostly fixable code — see "Why not 85" at the end.

---

# Product Scope Confirmed

Built as a **premium green-coffee sourcing website**: discover → register → verify email → sign in → view protected pricing → favourite / get in touch / request samples → admin manual review → customer request tracking.

Explicitly **not** built, and nothing of the sort was added: cart, checkout, payments, sellers/vendors, commissions, payouts, custody, trading, purchase orders, marketplace settlement. "B2B" is treated as positioning and protected wholesale pricing only.

---

# Runtime Route Audit

Measured against `next start` (production build) on a clean port. Not inferred from build output.

| Route                                             | Persona      | Expected               | Actual                                   | Result                   |
| ------------------------------------------------- | ------------ | ---------------------- | ---------------------------------------- | ------------------------ |
| `/`                                               | anon         | 200                    | 200                                      | PASS                     |
| `/ar`                                             | anon         | 200, `lang=ar dir=rtl` | 200, `lang="ar" dir="rtl"`               | PASS                     |
| `/green-coffee-offer-list`                        | anon         | 200                    | 200                                      | PASS                     |
| `/ar/green-coffee-offer-list`                     | anon         | 200                    | 200                                      | PASS                     |
| `/coffee-origins`                                 | anon         | 200                    | 200                                      | PASS                     |
| `/knowledge`                                      | anon         | 200                    | 200                                      | PASS                     |
| `/contact`                                        | anon         | 200                    | 200                                      | PASS                     |
| `/request-a-quote`                                | anon         | 200                    | 200                                      | PASS                     |
| `/sign-in` `/sign-up`                             | anon         | 200                    | 200                                      | PASS                     |
| `/forgot-password` `/reset-password`              | anon         | 200                    | 200                                      | PASS                     |
| `/verify-email?email=…`                           | anon         | 200                    | 200                                      | PASS                     |
| `/account`                                        | anon         | → sign-in              | 307 → `/sign-in?next=%2Faccount`         | PASS                     |
| `/account/profile\|security\|favorites\|requests` | anon         | → sign-in              | 307 → `/sign-in?next=%2Faccount`         | PASS                     |
| `/ar/account`                                     | anon         | → AR sign-in           | 307 → `/ar/sign-in?next=%2Far%2Faccount` | PASS                     |
| `/admin`                                          | anon         | → admin login          | 307 → `/dashboard-admin`                 | PASS                     |
| `/admin/products`                                 | anon         | → admin login          | 307 → `/dashboard-admin`                 | PASS                     |
| `/admin/account`                                  | anon         | → admin login          | 307 → `/dashboard-admin`                 | PASS                     |
| `/ar/admin`                                       | anon         | → AR admin login       | 307 → `/ar/dashboard-admin`              | PASS                     |
| `/admin/login`                                    | anon         | legacy → canonical     | 308 → `/dashboard-admin`                 | PASS                     |
| `/ar/admin/login`                                 | anon         | legacy → canonical     | 308 → `/ar/dashboard-admin`              | PASS                     |
| `/dashboard-admin`                                | anon         | 200 admin login        | 200                                      | PASS                     |
| `/ar/dashboard-admin`                             | anon         | 200 AR admin login     | 200                                      | PASS                     |
| `/nonexistent-xyz`                                | anon         | real 404               | 404                                      | PASS                     |
| `/about`                                          | anon         | CMS page               | 404 (no CMS row published)               | CONTENT-BLOCKED          |
| `/robots.txt` `/sitemap.xml`                      | anon         | 200                    | 200                                      | PASS                     |
| `/icon.png` `/manifest.webmanifest`               | anon         | 200                    | 200                                      | PASS                     |
| all authenticated routes                          | USER / ADMIN | render                 | —                                        | BLOCKED — no credentials |

## The three owner-reported failures — root cause

1. **`/account` and `/verify-email` returned the default Next.js 404.**
   Root cause was **not** a missing route — both files existed. `src/app/[locale]/loading.tsx` sat at the locale-layout level, so Next.js streamed a shell for _every_ route before the page could decide. Once a response is streaming its status is locked at 200, which silently converted `redirect()` into a client-side navigation and `notFound()` into a **soft 404**. Compounding it, the auth guards redirected to `` `/${locale}/sign-in` ``, producing `/en/sign-in` for English, which the proxy then 308-redirected — a doomed round trip that surfaced in the browser as a 404.
   Proof: removing that one file changed `/nonexistent-xyz` from `200` to `404` and `/account` from `200` to `307`.
   Fixed by removing the locale-level loading boundary and routing every auth redirect through `localizedPath()`.

2. **Admin routing untrusted / `/admin` 404s.** Canonical `/dashboard-admin` entry created (EN + AR), legacy `/admin/login` now 308s to it, `/admin/*` redirects anonymous users there, and an ADMIN who signs in through the customer form is detected server-side and sent to `/admin`.

3. **Console/runtime warnings.** Fixed: `next/image` `fill` without `sizes`, the `scroll-behavior` warning, and a real `FORMATTING_ERROR` thrown by an ICU placeholder on the verify-email page. The remaining `<script>` notice is the JSON-LD pattern Next.js itself documents — see "Documented, not fixed".

---

# Customer Auth

- **Signup** — exact fields (full name, email, phone, password, confirm). No company field, no role selector, always creates USER.
- **Sign-in** — verified users go to a safe destination; **unverified users are routed to `/verify-email`**; **ADMINs are detected server-side and sent to `/admin`** instead of a customer page.
- **Verification** — `/verify-email` now has real states: pending, already-verified (redirects to `/account` or `/admin` rather than faking a wait), expired/invalid link, masked email display, and a resend action with a 45-second cooldown and disabled/pending state. It states plainly that **registered ≠ verified**.
- **Callback** — `/auth/callback` no longer assumes success because it was reached. It exchanges the code or token hash, then **re-reads the user and checks `email_confirmed_at`** before granting a verified destination; recovery links go to `/reset-password`; failures land on a safe expired-link state.
- **Forgot/reset** — neutral responses (no account enumeration); reset requires a real recovery session.
- **Account area** — overview, profile, favourites, requests, **request detail (`/account/requests/[code]`, newly added)**, security. Auth is enforced by redirect, never by `notFound()`.
- **Security page** — previously a read-only stub. Now real **change email** (Supabase confirmation link to the new address) and **change password** (reauthenticates with the current password first). No passwords are written to the database.

**Not proven:** no live sign-up, no real inbox click, no authenticated session. Deliberately not attempted — creating a real auth user in the owner's live Supabase project and sending real email is outward-facing and not cleanly reversible without approval.

---

# Admin

- **Dashboard** — real counts only, no invented analytics; hierarchy and empty state improved.
- **Sidebar (the reported visual bug)** — root cause was `lg:h-screen` on a non-scrollable `<aside>`: content past roughly the Audit Log item rendered outside the coloured panel. Restructured to `lg:h-dvh` + `lg:sticky lg:top-0` with a `shrink-0` header, an `overflow-y-auto` nav, and a pinned footer, with `lg:items-start` on the parent so the sticky element can move. It now fills the viewport and scrolls internally on short screens.
- **Navigation** — regrouped into Overview / Catalog / Coffee data / Content / Customers / System, fully localized.
- **Modules** — 16 (`products, offers, pricing, inquiries, origins, taxonomy, users, content, settings, regions, warehouses, media, articles, article-categories, varieties, audit`) plus the dashboard and the new `/admin/account`.
- **CRUD** — 20 exported server actions. Every mutating action independently calls `requireAdmin()`; writes use explicit field allow-lists (no mass assignment); table/entity selectors are fixed Zod enums, not client strings; archives are soft (`deleted_at` / `is_active`), with hard delete only for price tiers.
- **Admin account settings** — new `/admin/account`: own name/phone/company/address, email change, password change.
- **Sample history** — verified already correct: each prior same-user/same-coffee request renders as an actual row with request code, status and timestamp, not a bare count.

**Not proven:** no ADMIN credentials exist, so no admin screen was rendered authenticated and no CRUD write was executed. This is the single largest unverified area.

---

# CMS

Pages, sections, ordering, visibility, CTAs, EN/AR translations, archive, media, and site/organization settings are implemented and gated. Public pages read live CMS data at request time (`status=PUBLISHED`, `is_active`, not deleted, `published_at` not in the future), so an admin edit does reach the public page.

No arbitrary HTML/JS/CSS field, no raw JSON-LD editor, and no free-text canonical override exists. Markdown is sanitized (`rehype-sanitize`, `skipHtml`).

**Reality check:** `site_pages` currently contains **0 rows**, so every CMS route — including `/about` — returns a real 404 and is excluded from the sitemap. That is the honest behaviour given §83 forbids inventing content, but it means the CMS is unproven end-to-end.

---

# SAMPLE_REQUEST

Implemented to the approved rule and covered by 16 real behavioural tests (mocked repository, not source-text greps):

- Duplicate identity is `user_id + coffee_id + type` — **not** `offer_id`, so Coffee A/Egypt and Coffee A/Dubai correctly count as the same coffee.
- Blocked while `NEW`, `RECEIVED`, or `CONTACTED`; allowed again after `CLOSED`; a duplicate returns the existing request code.
- Requires authentication, verified email, phone, address, country, and a valid trusted offer; `coffee_id` is derived server-side.
- No quantity field, none hidden in `message`; creates no shipment, reservation, or fulfillment.
- Inserts omit trigger-owned columns and let `hills_hydrate_inquiry_context` populate them.

---

# Public UX / Motion

Real logo now used in header, footer, auth pages, mobile menu and admin, at its true 529×231 aspect with no distortion. Because the artwork is dark green on transparent, it is placed on a brand-cream plate so it stays legible on the dark footer and in dark mode — the previous `dark:invert` was recolouring official artwork. Favicon and apple icon are generated from the real arched emblem on brand cream, replacing a broken `icons: { icon: "/" }`.

Motion primitives and `prefers-reduced-motion` handling exist. Motion remains **untested** by automation.

---

# EN / AR / RTL

`lang` and `dir` are set from the locale at the document root. English is unprefixed, Arabic is `/ar/…`, and every auth redirect preserves the locale. **29 hardcoded `locale === "ar" ? …` ternaries were replaced with message keys**; the one remaining is the breadcrumb chevron, which is genuinely directional rather than translatable. A parity test now fails the build if the catalogues drift, if any value is empty, or if Arabic silently ships English copy.

---

# Light / Dark

Both themes are exercised by E2E. Two genuine WCAG AA failures were found and fixed at the token level:

- `.eyebrow` used brand gold `#ce8a39` on cream — **2.28:1**, far below 4.5:1. Brand gold is now decorative only; a new `--gold-text` (`#8f5a15`, **4.57:1** on cream, 5.77:1 on white) carries gold text, and dark surfaces (footer, `bg-primary`) swap in the bright variant (7.87:1 / 5.90:1).
- Muted body text `#5c6b65` was **4.44:1** — darkened to `#55645e` (**4.94:1**).

---

# SEO

- Canonical host is environment-driven; production **fails loudly** if `NEXT_PUBLIC_SITE_URL` is missing or invalid, so no wrong hostname can ship silently.
- **Real crawlability bug fixed:** every robots disallow carried a trailing slash (`Disallow: /account/`) on a site that serves non-trailing-slash URLs, leaving `/account`, `/admin` and `/sign-in` fully crawlable. Rewritten and extended to `/dashboard-admin`, `/verify-email`, `/forgot-password`, `/reset-password`, each with its `/ar` pair.
- Visible localized breadcrumbs + `BreadcrumbList` on offer list, coffee detail, origin detail, knowledge detail and commercial pages. A structured-data bug was fixed where the final crumb claimed the current page _was_ the homepage.
- `Article` schema added (no invented author entities). Organization/WebSite JSON-LD reads real `site_settings` and omits absent fields rather than faking them.
- Sitemap contains 10 URLs and **zero** private routes; drafts excluded.

---

# Accessibility

Axe now scans **14 distinct screens/states** — homepage, sign-in, sign-up, verify-email, forgot-password, catalog, origins, knowledge, contact, admin login, not-found, Arabic homepage, Arabic catalog, Arabic admin login — plus the **mobile menu open** in both locales. This replaces the previous single-page scan that was being reported as "2/2".

Mobile menu has dialog semantics, Escape-to-close, focus trap, focus restoration, scroll lock and a 44px target; the theme toggle and header icon button were raised from 40px to 44px.

---

# Automated Tests

Exact commands, exact results, all executed at the end of this pass:

| Command                         | Result                                                       |
| ------------------------------- | ------------------------------------------------------------ |
| `npm install`                   | PASS (npm 11.11.1, `package-lock.json`, no pnpm files)       |
| `npm run format:check`          | **PASS** — "All matched files use Prettier code style!"      |
| `npm run typecheck`             | **PASS** — 0 errors                                          |
| `npm run lint`                  | **PASS** — 0 errors, 0 warnings                              |
| `npm test`                      | **PASS** — 5 files, **30/30**                                |
| `npm run build`                 | **PASS** — compiled, TypeScript clean, 51/51 pages generated |
| `npx next start` + route matrix | **PASS** — 31 routes verified in production mode             |
| `npx playwright test`           | **86 passed, 2 failed, 22 skipped**                          |

Unit files: `messages.test.ts` (EN/AR parity), `sample-request.test.ts` (16 rules), `security-boundaries.test.ts`, `canonical-host.test.ts`, `organization.test.ts`.

**The 2 E2E failures are one issue:** the 404 document renders as Next's `<html id="__next_error__">` with no `lang`, tripping Axe's `html-has-lang`. See below — the 404 _status_ and _branding_ are correct.

The 22 skips are legitimate and annotated: empty catalogue (detail pages, `/about`), project-specific viewports, and credential-blocked personas.

---

# Authenticated QA

**BLOCKED — staging credentials required.** No test fabricated a session; no `storageState`, no fake cookies. Anonymous guards, redirects, price non-leakage and 404 behaviour are genuinely verified. Everything behind a login — verified-user pricing, favourites, inquiry and sample writes, all admin CRUD, CMS writes, real email delivery — is **code-ready only**.

---

# Remaining BLOCKER

None. Every §86 gate is satisfied: `/account` and `/verify-email` resolve, admin login flow works, the verification callback checks real state, admin modules exist and are gated, no price leaks, SAMPLE_REQUEST works, EN/AR reach parity, and the production build passes.

# Remaining HIGH

1. **Catalog filters and paginates in memory.** `getOfferList()` issues 24 unfiltered table reads and the page filters the result in JS — §23 requires database filtering, sorting and pagination. It is _correct_ today but will not scale. I deliberately did **not** refactor it blind: the database has zero coffees, so a filtering/pagination rewrite could not be verified, and paginating before filtering is a classic correctness trap. This needs doing once real catalog data exists.

# Remaining MEDIUM

1. **404 document has no `lang` attribute.** Next.js renders `notFound()` through its internal `<html id="__next_error__">` shell because the root layout sits under the dynamic `[locale]` segment. Status (404) and branded content are correct. I tried, and rejected as ineffective, all four documented remedies: a locale `not-found.tsx`, a root `app/not-found.tsx`, moving the document into a real root `app/layout.tsx`, and the experimental `globalNotFound` flag (verified in both dev and a production build before removing it again).
2. **No route-level loading skeletons.** The locale-level `loading.tsx` was removed because it was the cause of the soft-404/redirect bug. Correct status codes were judged more important than skeletons. The safe reinstatement is an inline `<Suspense>` _inside_ page bodies, which streams only after the notFound/redirect decision.
3. **Admin taxonomy and content are grouped modules.** §32 lists Coffee Types, Processing Methods, Certifications, Tags, Sensory Notes and Packaging Types separately, but the generic `[module]` router has no per-entity filter, so they share one Taxonomy screen (and Homepage/About/Commercial share one Content screen). Adding an `?entity=` filter would let them split cleanly.
4. **Reduced motion is untested.** The CSS exists; no automated check asserts it.

# Remaining LOW

1. Brand guidelines specify a 150px minimum logo width; the 72px header renders it at 92px. Flagged rather than cropping or substituting artwork.
2. `updateSiteSettingsAction` validates `id` as `min(1)` rather than `.uuid()`, inconsistent with sibling actions.
3. `src/actions/admin.ts` is dead code, fully superseded by `admin-operations.ts` and already slightly diverged. It is unreferenced, so it is not a live risk, but it should be deleted once the Inquiries status control is repointed.
4. `/contact` is not `noindex`, which one row of the SEO spec requests while other rows leave it to business preference.

---

# Database Gaps / Decisions

No schema, migration, RLS, trigger, function or grant was changed.

1. **DATABASE HARDENING DECISION REQUIRED — sample concurrency.** Independently confirmed real: `inquiries` has unique constraints only on `id`, `inquiry_number` and `request_code`, and no serializing trigger. The application does `findActiveRequest` then `insertRequest` as two separate calls with no transaction, lock, or upsert — a genuine TOCTOU window. Impact is low (a duplicate manual-review row; no financial, inventory or security effect, since sample requests create no fulfillment). Minimum conceptual fix, **not** applied: a partial unique index on `inquiries(user_id, coffee_id)` scoped to `type = 'SAMPLE_REQUEST'` and active statuses, with the app catching the unique violation and returning the existing code.
2. **DATABASE GAP — ADMIN AVATAR.** §17 asks for an optional admin profile image. Verified there is **no** avatar column anywhere: `profiles` has only `id, full_name, phone, company_name, address, country_code, role, created_at, updated_at`, and "avatar" appears 0 times in the entire Post-DB0 snapshot. Minimum conceptual change, **not** applied: either a nullable `avatar_media_id` on `profiles` referencing `media`, or a Supabase `user_metadata` avatar URL. Not silently migrated.

---

# External Business Inputs

1. **The database is empty.** Verified counts: `coffees 0`, `coffee_offers 0`, `origins 0`, `articles 0`, `site_pages 0`, `media 0`, `inquiries 0`; only `warehouses` has 2 rows (Egypt, Dubai). Every public surface therefore renders an empty state, and `/about` and all commercial pages 404. This is the single biggest limit on demonstrable completeness — and it is content, not code.
2. **No test credentials** for unverified buyer, verified buyer, or ADMIN. An ADMIN account can only be created by setting `profiles.role = 'ADMIN'` directly in Supabase; there is deliberately no admin signup.
3. **Production hostname** unconfirmed. `NEXT_PUBLIC_SITE_URL` must be set at deploy time; the build fails loudly without it.
4. **Benito webfont** not licensed/supplied; Manrope + Cairo/Readex are in use.
5. Production rate-limit policy and credential rotation still to be decided.

_Note:_ `NEXT_PUBLIC_SITE_URL=http://localhost:3000` was added to the local, git-ignored `.env.local` because it was missing and the production build correctly refuses to run without it. No secret was created, moved, or printed.

---

# Staging Readiness

## YES

The anonymous surface is green in a production build, all guards redirect correctly in both locales, and no protected price appears in any anonymous payload, metadata, JSON-LD or sitemap (`offer_price_tiers` also returns 401 to the anon role at the database level).

To start: set `profiles.role = 'ADMIN'` on one real account, seed catalog/CMS content, then exercise the persona matrix.

# Production Readiness

## NO

Blocked on external inputs rather than known application defects: authenticated staging QA has not been run, the canonical hostname is unconfirmed, the catalogue and CMS have no content, font licensing is open, and the sample-concurrency hardening decision is outstanding. The one genuinely fixable engineering item is the catalog's in-memory filtering, which should be addressed once there is data to verify it against.

---

# Exact Remaining Work

1. Seed real catalog, origin, article, media and CMS content; publish `/about` and the nine commercial pages.
2. Provision an ADMIN account and buyer test accounts, then run the full persona matrix (A/B/C/D) including real admin CRUD and CMS writes.
3. Perform the real email test: sign up with a disposable address, confirm the user is UNVERIFIED, click the actual link, confirm `email_confirmed_at` is set and protected features unlock only then.
4. Refactor `getOfferList()` to database-level filtering, sorting and pagination, filtering **before** paginating.
5. Decide the sample-concurrency hardening (partial unique index) and the admin-avatar gap.
6. Set the production `NEXT_PUBLIC_SITE_URL`; re-verify canonical, hreflang and sitemap against the real host.
7. Reinstate loading skeletons as inline `<Suspense>` inside page bodies.
8. Split admin taxonomy/content into per-entity screens via an `?entity=` filter.
9. Delete dead `src/actions/admin.ts` after repointing the Inquiries status control.
10. Add a `prefers-reduced-motion` automated check.

---

# Why not 85

The score is held down almost entirely by things this pass could not manufacture honestly: an empty database (−3 across catalogue and CMS), and the absence of any credential to prove the authenticated half of the product (−3 across admin CRUD, CMS and auth). Only one deduction is genuinely fixable code — the catalog's in-memory filtering — and refactoring it against zero rows would have produced an unverifiable change to the one data path that currently works correctly. I chose correctness and honest reporting over a higher number.
