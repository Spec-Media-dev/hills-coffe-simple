# Executive Summary

This document is the implementation contract for completing Hills Coffee as a premium bilingual B2B green-coffee sourcing product. It is based on the current working tree, current route and component architecture, the Post-DB0 Supabase snapshot, all repository reports, the Brand Guidelines, the SEO specification, the complete `public/images` inventory, the current automated tests, and a live desktop/mobile review of [Sucafina EMEA](https://sucafina.com/emea). Historical reports were treated as evidence, not proof; where a report conflicts with current source or the database snapshot, current source and snapshot win.

The repository already contains useful domain logic that should be retained: server-resolved inquiry context, verified-email gates, one-active-sample-per-user-and-coffee application logic, real database-backed catalog/CMS/Admin readers, RLS, inquiry history, localized messages, metadata helpers, and a broad public QA suite. The rebuild is therefore a controlled migration, not a greenfield rewrite.

The target separates three concerns cleanly:

- one global document layout;
- one localized public/auth/account application under a site route group;
- one canonical Admin implementation outside `[locale]`, localized by proxy headers/cookie and internal Arabic rewrites.

Four changes form the critical path: approved database/storage migrations, route/proxy stabilization, an explicit Auth/blocked-user authorization model, and staging personas/data for real E2E. Public visual work and richer motion follow those foundations, not precede them.

No source-code implementation, database mutation, migration execution, dependency installation, or fixture creation is part of this planning pass.

# Product Scope

Hills Coffee is a premium wholesale green-coffee discovery and sourcing website for commercial buyers. The primary journey is:

`Discover -> Register -> Verify email -> Sign in -> View protected pricing -> Favorite coffee -> Request sample/contact -> Admin manual review -> Track request status`

In scope:

- bilingual English/Arabic discovery, catalog, origin, warehouse, and knowledge experiences;
- authenticated, verified `USER` access to protected prices and favorites;
- manual product inquiries and sample requests;
- a simple customer account with profile, avatar, favorites, requests, and security;
- a localized, role-protected Admin workspace for data, content, users, inquiries, settings, media, and audit;
- Egypt and Dubai warehouse contexts;
- WCAG 2.2 AA, light/dark themes, responsive layouts, SEO, measured motion, and reliable QA.

Explicitly out of scope:

- marketplace, seller, multi-vendor, exchange, custody, or settlement behavior;
- cart, checkout, payment gateway, automated shipping, inventory reservation, or sample fulfillment;
- KYC, national ID, passport, company approval, or identity-document storage;
- public protected prices or price-bearing structured data;
- copied Sucafina assets, content, brand styling, or business flows.

“B2B” describes the audience, wholesale sourcing proposition, commercial SEO, and protected-price model. It does not authorize commerce automation.

# Current State / Problems Found

## Evidence baseline

- Framework: Next.js 16.3.3, React 19.2.8, next-intl 4.14.1, Supabase SSR/JS, Motion, Sonner, Tailwind 4, Base UI/shadcn patterns, npm 11.11.1.
- Current routes are predominantly under `src/app/[locale]`; Admin is also under that tree and the Admin entry is inside the public site shell.
- The global layout reads `x-next-intl-locale`; the locale layout provides messages; public pages use a site layout.
- Proxy visibly removes `/en`, internally rewrites unprefixed routes to `/en`, passes `/ar`, and refreshes the Supabase session. It has no durable locale cookie strategy.
- Post-DB0 snapshot: existing `profiles`, catalog/taxonomy, warehouses/offers/prices, favorites, inquiries/history, articles, CMS, media, settings, audit, RLS, triggers, and helper functions. Only `hills-public` storage exists.
- `site_settings.org_logo_media_id uuid NULL REFERENCES media(id) ON DELETE SET NULL` already exists.
- Inquiry statuses are currently `NEW`, `RECEIVED`, `CONTACTED`, `CLOSED`.
- Historical execution report records 30/30 unit tests, a 51-route build, and 86 passed/2 failed/22 skipped Playwright cases at that point. These are not a fresh pass and do not prove the current tree.
- The live database was reported largely empty apart from two warehouses, and no approved buyer/Admin E2E credentials were available. Authenticated behavior is therefore not runtime-proven.

## Current-state gap map

| Requirement       | Current implementation                                                                                      | Current route/file                                    | Database dependency                    | Runtime status                                   | Problem                                                                               | Severity | Recommended target                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| Architecture      | Root layout plus localized tree; site and Admin responsibilities overlap                                    | `src/app/layout.tsx`, `src/app/[locale]/**`           | None                                   | Builds historically                              | Admin entry inherits site shell; ownership is hard to reason about                    | Critical | Global root, localized site group, canonical Admin group                             |
| EN routing        | Unprefixed URL internally rewritten to `/en`                                                                | `src/proxy.ts`, `src/i18n/routing.ts`                 | Session cookies                        | Broad public tests                               | Custom recursion header but no locale cookie; README is stale                         | High     | One documented algorithm, unprefixed EN, path/query stable                           |
| AR routing        | `/ar/**` passes into localized tree                                                                         | Same                                                  | None                                   | Public coverage exists                           | Root layout persistence, locale switching, and 404 behavior need runtime proof        | High     | `/ar` external contract plus document sync and transition tests                      |
| Admin routing     | Admin source lives under `[locale]`; entry lives under `(site)`                                             | `src/app/[locale]/admin/**`, `(site)/dashboard-admin` | `profiles.role`                        | Anonymous redirects covered                      | Public shell coupling; conflicts with desired canonical Admin source                  | Critical | `src/app/(admin)/**`; Arabic internal rewrite only                                   |
| Auth              | Server actions and cookie SSR client                                                                        | `src/actions/auth.ts`, `src/lib/auth/session.ts`      | Auth users, profiles                   | Partially source-tested                          | No complete state machine; role/blocked semantics are incomplete                      | Critical | Central viewer policy and typed transitions                                          |
| Verification      | Callback re-reads user and checks `email_confirmed_at`                                                      | `src/app/auth/callback/route.ts`, verify page         | Supabase Auth                          | Public screen tested                             | Current resend cooldown is 45 seconds; no three-minute UX state model                 | High     | Three-minute UI window, server cooldown, confirmed-state polling                     |
| Forgot/reset      | Neutral request, callback recovery, password update                                                         | forgot/reset pages and Auth action                    | Supabase Auth                          | Authenticated recovery not proven                | Expired/reused link and post-reset session invalidation need acceptance tests         | High     | Valid recovery session only; revoke context; return to sign-in                       |
| User account      | Overview/profile/favorites/requests/security exist                                                          | `(site)/account/**`                                   | profiles, favorites, inquiries/history | Anonymous redirect covered                       | Gate allows any authenticated role and does not consistently require verified `USER`  | Critical | Account policy = authenticated, verified, unblocked `USER`                           |
| User avatar       | No profile column, bucket, action, or UI                                                                    | Account/header/mark components                        | Missing                                | Not implemented                                  | Approved feature absent                                                               | High     | `profiles.avatar_path`, private `avatars` bucket, owner-only policies                |
| Favorites         | Real coffee-keyed favorites                                                                                 | account action/data/pages                             | favorites + published coffees          | Unit/source checks only                          | Blocked/role guard not modeled; authenticated staging not proven                      | High     | Verified unblocked `USER`; optimistic-safe typed result                              |
| Requests          | Real list/detail/history                                                                                    | account request routes                                | inquiries/history                      | Source exists                                    | Delivery states missing; verified/blocked role boundary incomplete                    | High     | Customer labels and immutable timeline for full lifecycle                            |
| Sample workflow   | Trusted offer -> coffee resolution; one active sample per user+coffee; profile completeness; no fulfillment | `src/actions/inquiries.ts`, `src/lib/inquiries/**`    | inquiries/offers/profiles              | Behavioral unit tests exist                      | Cross-instance race remains at application level; delivery states absent              | Critical | Retain rule; add lifecycle; owner-approved optional unique hardening                 |
| Admin             | Generic module router, live counts, broad mutations                                                         | `src/app/[locale]/admin/**`, admin data/actions       | Most public tables                     | Anonymous guard covered                          | Oversized generic modules; weak task-specific UX; mobile shell limited                | High     | Grouped shell and feature-owned routes/editors                                       |
| Admin users       | `admin_list_users()` display                                                                                | Admin users module                                    | Auth + profiles RPC                    | No persona test                                  | No search/filter/detail/block/unblock; RPC lacks blocked/avatar fields                | Critical | Searchable users workspace and audited block actions                                 |
| Blocking          | None                                                                                                        | Auth/session/Admin actions                            | Missing profile fields/functions       | Not implemented                                  | Active sessions and direct data access remain possible                                | Critical | Durable profile block + RLS/guards; optional Auth ban defense                        |
| CMS               | Database pages/translations/sections with generic renderer                                                  | content components/Admin content                      | site pages/sections/media              | Empty-data fallback                              | Renderer does not express the planned homepage modules richly                         | Medium   | Typed section registry; static/dynamic/mixed ownership explicit                      |
| Media             | Admin uploads public image types to `hills-public`                                                          | admin operations/data                                 | media, translations, storage           | Source only                                      | Content, logo, and avatar domains are not separated                                   | High     | Public business media, private avatar storage, purpose-aware UI                      |
| Site logo         | Static `BrandMark`; DB logo relation not consumed                                                           | brand/nav/settings                                    | Existing `org_logo_media_id`           | Static fallback works inconsistently per reports | Wiring and lifecycle missing; no migration needed for column                          | High     | Settings -> media relation -> stable optimized render -> fallback                    |
| Catalog           | Real DB data, many filters assembled in server memory                                                       | offer-list route, `src/lib/data/catalog.ts`           | 20+ catalog tables                     | Empty DB limits proof                            | Full-table multi-query assembly; not DB-level pagination/filtering                    | Critical | Query/RPC/view with DB filters, count, cursor/page, URL state                        |
| Protected pricing | Loaded only after verified viewer check                                                                     | pricing/catalog data                                  | offer_prices and RLS                   | Leak source tests exist                          | Verified Admin can currently satisfy `requireVerifiedUser`                            | Critical | Only verified, unblocked `USER`; never serialize otherwise                           |
| Origins           | Real list/detail/offers and translations                                                                    | coffee-origins routes/data                            | origins/regions/media/offers           | Empty-state only                                 | Public reader does not fully exploit origin media/editorial relations                 | High     | First-class origin cards/detail, region dependency, related knowledge                |
| Articles          | DB list/detail, sanitized Markdown, Article JSON-LD                                                         | knowledge routes/data                                 | articles/categories/media              | Empty-state only                                 | Homepage lacks latest articles; visual/editorial system limited                       | Medium   | Dynamic latest section and premium article template                                  |
| i18n/RTL          | EN/AR catalogs, next-intl links, RTL tokens                                                                 | messages, layouts, navigation                         | None                                   | Message parity tested                            | Admin source coupling; untranslated global 404; directional behavior incomplete       | High     | Single catalog, localized Admin provider, logical CSS, parity gate                   |
| Dark/light        | Theme provider and tokens                                                                                   | providers, globals, toggle                            | Cookie/local preference                | Public tests exist                               | State-by-state parity and stable logo/image treatment unproven                        | Medium   | Semantic tokens for every interaction state; no image inversion                      |
| Motion            | `Reveal`, `Stagger`, global view transition                                                                 | motion component/globals/navigation                   | None                                   | Basic coverage                                   | All links request forward transitions; no complete primitive system                   | High     | Typed motion primitives, correct direction, reduced-motion equivalence               |
| Locale overlay    | Native JSON-LD scripts present; locale switch is client navigation                                          | SEO components/layout/navigation                      | None                                   | Known dev overlay                                | React reports script tag during client reconciliation                                 | Critical | Reproduce/isolate; stable server JSON-LD outside animation; locale hard-nav fallback |
| Responsive        | Public mobile menu; card variants; Admin horizontal nav                                                     | navigation/catalog/Admin CSS                          | None                                   | iPhone public tests                              | Admin drawer/table/short-height behavior not production-ready                         | High     | Explicit 375–1440+ contracts and short-height Admin shell                            |
| Accessibility     | skip link, landmarks, axe suite, custom focus handling in mobile menu                                       | layouts/navigation/tests                              | None                                   | Public pages scanned                             | Custom inquiry dialog lacks proven focus trap/restore; authenticated screens skipped  | High     | Base accessible dialog/menu primitives; full persona axe/keyboard tests              |
| SEO               | metadata helpers, canonical/hreflang, sitemap/robots, JSON-LD                                               | `src/lib/seo/**`, metadata routes                     | site settings/content                  | Public checks exist                              | Monolithic sitemap, filters/pagination strategy incomplete; canonical host unresolved | High     | Segmented sitemap, canonical filter policy, stable schema graph                      |
| Toast/error UX    | Sonner and action helpers exist                                                                             | providers/forms/actions                               | None                                   | Inconsistent paths                               | Not every action uses one domain code/translation contract                            | High     | One typed result and centralized localized error mapping                             |
| Tests             | Vitest plus public Playwright desktop/mobile                                                                | `tests/e2e/**`, Vitest files                          | Safe staging data/creds                | Auth persona tests skipped                       | No Unverified/Verified/Blocked/Admin end-to-end proof; no true visual baselines       | Critical | Five personas, seed lifecycle, console gate, snapshot matrix                         |

# Architecture Diagnosis

The principal issue is not the number of files; it is that URL localization, document state, public shell composition, Admin authorization, and feature logic cross boundaries inconsistently.

Keep:

- root document layout, message catalogs, Supabase SSR cookie pattern, database types, domain data modules, metadata utilities, audit and history tables, safe inquiry context resolution, current static image inventory, and working UI primitives;
- native server-rendered JSON-LD, with safe `<` escaping and stable identity;
- existing `site_settings.org_logo_media_id`, public media relation model, and official static logo fallback.

Refactor:

- route ownership, proxy locale algorithm, viewer authorization helpers, Admin navigation/editors, public query boundaries, motion primitives, error contract, and responsive shells.

Replace only where the current abstraction blocks product behavior:

- the generic Admin list/detail experience for Lead Inbox and Users;
- memory-assembled catalog filtering/pagination with a DB-backed query contract;
- custom dialog behavior where an established accessible primitive provides focus management;
- the two-primitive motion layer with a documented primitive set.

Delete after parity is proven:

- localized Admin source routes and the site-shell Admin entry;
- obsolete redirects/components made redundant by target routes;
- duplicate or stale Auth/session gates and docs.

Do not rewrite working server mutations, DB readers, SEO helpers, or translation data merely to change folder aesthetics. Each move requires characterization tests before migration and route-level tests after it.

# Proposed Final Architecture

## Boundary model

1. `src/app/layout.tsx` owns `<html>`, `<body>`, global CSS, root metadata defaults, early theme script/provider, global toaster, and a minimal document-locale synchronization bridge.
2. `src/app/(site)/[locale]/layout.tsx` validates locale, loads messages, provides next-intl, and owns the public site shell only where appropriate.
3. Auth and account pages remain in the localized site feature because their external URL is localized, but route groups should allow Auth pages to omit the marketing header/footer if desired without moving callback logic.
4. `src/app/(admin)/layout.tsx` owns localized Admin messages/context, authorization-neutral Admin frame concerns, and document sync. Protected `/admin/**` layout owns the `ADMIN` gate and workspace shell. `/dashboard-admin` is the dedicated login entry and must not inherit the public shell.
5. `src/app/auth/callback/route.ts` remains global and outside locale routing.
6. `src/features/**` owns use cases, policies, queries, actions, and feature-specific components. `src/components/**` contains genuinely reusable UI/design-system pieces only.
7. `src/lib/**` owns infrastructure: Supabase clients, env parsing, shared validation, SEO serialization, and cross-feature domain result types.

## Proposed feature ownership

```text
src/features/
  auth/        state, actions, redirects, forms, verification/recovery UI
  account/     viewer dashboard, profile, avatar, favorites, request history
  catalog/     public filters/query, protected-price projection, cards/details
  origins/     origin/region query and editorial presentation
  inquiries/   PRODUCT/SAMPLE_REQUEST policies, forms, customer timeline
  admin/       authorization, shell, dashboard, users, lead inbox, CRUD editors
  cms/         typed section registry, public page composition, editor schemas
  media/       business-media selection/upload and logo resolution
```

Feature modules may import `components` and `lib`; they must not import App Router page files. Server-only query/policy modules must start with `server-only`. Browser components never receive service-role credentials or unrestricted price records.

# Route Tree

```text
src/app/
  layout.tsx
  error.tsx
  not-found.tsx
  globals.css
  robots.ts
  sitemap.ts
  manifest.ts
  auth/callback/route.ts

  (site)/
    [locale]/
      layout.tsx
      (marketing)/
        layout.tsx
        page.tsx
        about/page.tsx
        contact/page.tsx
        request-a-quote/page.tsx
        green-coffee-offer-list/page.tsx
        green-coffee-offer-list/[slug]/page.tsx
        coffee-origins/page.tsx
        coffee-origins/[slug]/page.tsx
        knowledge/page.tsx
        knowledge/[slug]/page.tsx
        [page]/page.tsx
      (auth)/
        layout.tsx
        sign-in/page.tsx
        sign-up/page.tsx
        verify-email/page.tsx
        forgot-password/page.tsx
        reset-password/page.tsx
      account/
        layout.tsx
        page.tsx
        favorites/page.tsx
        requests/page.tsx
        requests/[code]/page.tsx
        settings/page.tsx
        security/page.tsx

  (admin)/
    layout.tsx
    dashboard-admin/page.tsx
    admin/
      layout.tsx
      page.tsx
      products/page.tsx
      products/[id]/page.tsx
      offers/page.tsx
      offers/[id]/page.tsx
      pricing/page.tsx
      lead-inbox/page.tsx
      lead-inbox/[id]/page.tsx
      origins/page.tsx
      origins/[id]/page.tsx
      regions/page.tsx
      warehouses/page.tsx
      taxonomy/[module]/page.tsx
      varieties/page.tsx
      media/page.tsx
      articles/page.tsx
      articles/[id]/page.tsx
      article-categories/page.tsx
      users/page.tsx
      users/[id]/page.tsx
      content/page.tsx
      content/[id]/page.tsx
      settings/site/page.tsx
      settings/profile/page.tsx
      settings/account/page.tsx
      audit/page.tsx
```

The source has one Admin tree. English Admin requests render it directly. Arabic Admin requests internally rewrite to the same tree with an Arabic locale header; no Arabic source duplicate exists.

# Proxy / Locale Architecture

## External URL contract

- English public/auth/account: unprefixed (`/`, `/about`, `/account`).
- Arabic public/auth/account: `/ar` prefixed.
- English Admin: `/dashboard-admin`, `/admin/**`.
- Arabic Admin: `/ar/dashboard-admin`, `/ar/admin/**`.
- `/en` and `/en/**`: permanent 308 to the equivalent unprefixed path, preserving query.
- `/auth/callback`, framework internals, static assets, icons, images, sitemap, robots, and API handlers: never locale-prefixed or locale-rewritten.

## Exact request algorithm

1. Clone the incoming URL so path and query are retained independently.
2. Exclude callback/static/system paths using a narrow matcher and explicit guard.
3. If path is `/en` or starts `/en/`, strip only that segment and 308 redirect; preserve query and fragment where browser-controlled.
4. If path is `/ar/dashboard-admin` or starts `/ar/admin`, set request headers `x-hills-locale=ar` and `x-next-intl-locale=ar`, set `NEXT_LOCALE=ar`, mark `x-hills-admin-rewrite=1`, and internally rewrite to the same path without `/ar`. Query remains unchanged.
5. If path is `/dashboard-admin` or starts `/admin`, set both locale headers to `en`, set `NEXT_LOCALE=en`, and continue without rewrite.
6. If path is `/ar` or starts `/ar/`, set locale headers/cookie to `ar` and route through the localized site tree.
7. Otherwise set locale headers/cookie to `en` and internally rewrite the public route into the site `[locale]` source as `/en{pathname}`. A private rewrite marker prevents recursion.
8. Refresh Supabase cookies without making proxy the final authorization authority. Page/layout/server action guards still verify the user and role.
9. Every rewrite/redirect copies Supabase response cookies and locale cookie deliberately; no response object is discarded.

## Locale switching

- Convert only the locale prefix; preserve pathname, search parameters, pagination, filters, and record identifiers.
- Site EN -> AR: `/green-coffee-offer-list?origin=x` -> `/ar/green-coffee-offer-list?origin=x`.
- Admin EN -> AR: `/admin/products?page=2` -> `/ar/admin/products?page=2`.
- AR -> EN strips only `/ar`.
- Until the script-reconciliation defect is proven fixed by React/Next behavior, the language control should perform a document navigation for locale changes. Normal same-locale links remain client transitions. This is a narrow correctness measure that updates `<html lang dir>`, server schemas, theme bootstrap, and locale cookie together.

## Known script-tag overlay investigation

1. Reproduce in development on homepage, catalog detail, origin, article, account, and Admin using EN -> AR -> EN, logging `console.error`, `pageerror`, RSC requests, and the exact component stack.
2. Compare client locale switch with direct navigation. Temporarily isolate `AppProviders`, view-transition link options, root/locale layout persistence, and each JSON-LD boundary without deleting schema.
3. Keep JSON-LD server-rendered as native `<script type="application/ld+json">`; escape `<` as `\u003c`; give each schema a stable `id`/React key formed from schema type + entity id + locale; emit a deterministic count/order.
4. Never place JSON-LD inside Motion, `AnimatePresence`, `ViewTransition`, or a client component that conditionally remounts it.
5. Ensure locale navigation does not reuse a client subtree containing server script elements. If hard navigation removes the framework reconciliation warning, retain that approach until a verified Next/React fix permits safe soft navigation.
6. Add Playwright repetition tests that fail on the exact warning, any hydration warning, any overlay, missing/duplicated schema, path loss, query loss, theme reset, or logo disappearance.

## SEO and errors

The internal `/en` and canonical Admin source rewrites must never appear in canonical URLs. Locale-aware `notFound()` must return a real 404 status. Private/Admin/auth/account routes emit `noindex,nofollow`; public filtered catalog URLs follow the canonical rules in the SEO section.

# Database Changes Required

No migration is executed by this plan. Migration names below are proposed and must be reviewed against a new preflight snapshot immediately before implementation.

## Existing schema that must be reused

- `profiles`: `id`, `full_name`, `phone`, `company_name`, `address`, `country_code`, `role`, timestamps.
- `inquiries`: trusted `user_id`, `coffee_id`, optional `offer_id`, snapshots, `type`, `status`, request code, contact snapshot, timestamps.
- `inquiry_status_history`: old/new status, actor, timestamp, populated by current triggers.
- `site_settings.org_logo_media_id uuid NULL` already references `media(id) ON DELETE SET NULL`; do not add a duplicate logo column.
- `media(storage_bucket, storage_path)` is unique; content entities already use media relations.

## REQUIRED — migration R1: profile avatar and durable block state

Proposed affected table: `public.profiles`.

| Column         | Type          | Default | Nullability | FK/check                                                          | Why                                               |
| -------------- | ------------- | ------- | ----------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| `avatar_path`  | `text`        | none    | NULL        | path format/length validation in action; optional DB length check | Stores a storage path, never a mutable public URL |
| `is_blocked`   | `boolean`     | `false` | NOT NULL    | —                                                                 | Durable product authorization state               |
| `blocked_at`   | `timestamptz` | none    | NULL        | consistency check with `is_blocked`                               | Audit-friendly business timestamp                 |
| `blocked_by`   | `uuid`        | none    | NULL        | FK `profiles(id) ON DELETE SET NULL`                              | Trusted Admin actor                               |
| `block_reason` | `text`        | none    | NULL        | length check, e.g. <= 1000                                        | Optional internal reason; never exposed publicly  |

Also required:

- extend/replace `prevent_profile_role_escalation()` so a normal user cannot change `role`, `is_blocked`, `blocked_at`, `blocked_by`, or `block_reason`; allow own safe fields including `avatar_path` only through validated paths;
- add `is_current_user_blocked()` as a stable security-definer helper with fixed search path;
- update `is_admin()` to require role `ADMIN` and not blocked;
- update user mutation/read policies that grant protected capabilities—favorites, protected pricing access, inquiry creation, and account-private reads—to enforce the block policy at the database boundary where practical;
- update `admin_list_users()` return contract to include block state and avatar path, or replace it with a paginated/searchable Admin RPC;
- add an Admin-only `admin_set_user_blocked(target_user_id, blocked, reason)` function or equivalent server-only transaction that writes state and audit atomically. It must reject self-block, non-Admin actors, and invalid target roles.

Backfill: existing profiles receive `is_blocked=false`; all other new fields remain NULL. Verify no missing profile row for Auth users before migration. Frontend dependency: phases 3–5. Rollback: remove new policies/functions first, restore prior helpers, then remove columns only if no blocking/avatar data must be retained. Security rollback must never reopen access accidentally.

## REQUIRED — migration R2: sample delivery statuses and transition enforcement

- Append `SAMPLE_SENT` and `DELIVERED` to `public.inquiry_status`. PostgreSQL enum values are additive; rollback cannot safely remove them once used.
- Add `validate_inquiry_status_transition()` plus a `BEFORE UPDATE OF status` trigger, or an equivalent Admin RPC that is the sole status mutation path.
- Allowed SAMPLE_REQUEST progression: `NEW -> RECEIVED|CLOSED`, `RECEIVED -> CONTACTED|CLOSED`, `CONTACTED -> SAMPLE_SENT|CLOSED`, `SAMPLE_SENT -> DELIVERED|CLOSED`, `DELIVERED -> CLOSED`. Same-value update is a no-op. No backward transition.
- PRODUCT/GENERAL must never enter `SAMPLE_SENT` or `DELIVERED`; their progression remains `NEW -> RECEIVED -> CONTACTED -> CLOSED`, with explicit early close from open states.
- Retain the current history triggers. Confirm a status update creates exactly one history row and records `auth.uid()`.
- Update status indexes only if query analysis shows need; the current `idx_inquiries_status` exists. Add a composite Lead Inbox index such as `(type,status,created_at desc)` only after `EXPLAIN` evidence.

Backfill: none; existing values remain valid. Frontend dependency: Lead Inbox and account timelines. Rollback: prevent new transitions, backfill `SAMPLE_SENT`/`DELIVERED` rows to an owner-approved prior status, then consider enum reconstruction in a maintenance window. Never promise a simple enum down migration.

## REQUIRED — migration R3: avatar storage objects/policies

This is a Storage migration, described in the next section. It creates no public media rows by default and uses `profiles.avatar_path`.

## REQUIRED — migration R4: RLS/auth boundary review

This may ship with R1/R2 but must be independently testable:

- block protected operations for blocked accounts even when an older JWT remains active;
- require role `USER`, verified email, and not blocked for price retrieval, favorites mutation, PRODUCT/SAMPLE_REQUEST insertion, and account actions;
- require role `ADMIN` and not blocked for Admin functions/mutations;
- preserve customer access only to their own inquiries/history/favorites/profile;
- keep media/CMS writes Admin-only and audit privileged writes;
- pin every security-definer function `search_path`, revoke broad execute grants, and grant only the needed authenticated role.

## RECOMMENDED — race-safe sample duplicate hardening

Current application logic correctly keys active sample duplication on `(user_id, coffee_id, type='SAMPLE_REQUEST')`, not `offer_id`, and treats `NEW`, `RECEIVED`, `CONTACTED` as active. It is not fully race-safe across concurrent server instances.

`DATABASE HARDENING DECISION REQUIRED`: after a duplicate preflight, add a partial unique index over `(user_id, coffee_id)` where `type='SAMPLE_REQUEST'` and `status IN ('NEW','RECEIVED','CONTACTED','SAMPLE_SENT','DELIVERED')`. The new physical-progress states remain active. A unique violation must be caught and mapped to the existing typed duplicate result, followed by a query for the winning request code. If owner declines this index, retain the application check and idempotent UI submission guard but document the residual race.

This decision is separate from the delivery-status migration and does not use `offer_id`.

## RECOMMENDED — Admin search/query indexes

Only after representative fixtures and `EXPLAIN ANALYZE`, consider trigram/lowercase indexes for Admin user email/name search and catalog text search. Auth email lives in `auth.users`; a security-definer RPC may be preferable to exposing/joining it. Specify each observed slow query before adding an index.

## OPTIONAL

- `site_settings.org_dark_logo_media_id` and `org_favicon_media_id` only if design review approves separate assets. The primary logo column already exists.
- A normalized status-transition table only if business users need configurable workflows; hardcoded trusted transitions are simpler now.
- A media-purpose enum/column only if Admin media volumes make bucket/path-derived filtering insufficient.

## Migration order and validation

1. Fresh schema/policy/function snapshot and backup; production change window.
2. R1 columns/checks/FK/backfill, helper functions, protected-field trigger, RLS, RPC, and grants in one reviewed unit.
3. R3 bucket and storage policies; upload/delete/signed-read smoke tests.
4. R2 enum additions, transition guard, and history verification.
5. Optional duplicate hardening after duplicate query returns zero rows.
6. Optional evidence-backed indexes.
7. Regenerate `types.generated.ts`, run schema contract tests, then enable dependent UI.

# Storage Changes Required

## Storage domains

| Domain                          | Bucket                     | Visibility   | Writers                                                        | Readers                                                    | Path model                                                            |
| ------------------------------- | -------------------------- | ------------ | -------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Customer/Admin avatar           | new `avatars`              | private      | authenticated owner; controlled Admin support only if approved | owner and authorized Admin via signed/authenticated access | `<auth.uid()>/avatar.<ext>`                                           |
| CMS/catalog/origin/article/logo | existing `hills-public`    | public       | Admin only                                                     | public                                                     | purpose folders such as `logos/`, `coffees/`, `origins/`, `articles/` |
| Static editorial fallback       | repository `public/images` | build-public | code/content release only                                      | public                                                     | immutable versioned filenames where possible                          |

## Avatar bucket contract

- Private bucket, maximum 5 MiB, allowed MIME types JPEG/PNG/WebP. Validate file signature server-side; do not trust extension or browser MIME.
- Storage policies use `bucket_id='avatars'` and first folder segment `(storage.foldername(name))[1]=auth.uid()::text` for SELECT/INSERT/UPDATE/DELETE. Admin read support, if required for customer inspection, must use `is_admin()` or short-lived signed URLs—not public access.
- The upload action derives the path from `auth.uid()`, generates the extension from validated content, uploads with a cache-control value, updates `profiles.avatar_path`, and removes a prior different-extension object only after the new object/profile update succeeds.
- Deletion clears the profile path and deletes only the previously stored path after verifying its owner prefix. Operations are idempotent.
- Use image dimensions/decoding checks, strip metadata if the chosen image pipeline supports it, and render a stable default person icon on any missing/failed URL.
- Cache bust with the profile `updated_at` or a version query on signed/publicly transformed URLs. Never store signed URLs in the profile.

## Business media and logo

Keep `hills-public` for public business assets and existing `media` rows/translations. Admin upload remains limited to validated image types and size. Logo selection points `site_settings.org_logo_media_id` at an active public `media` record. Archive/delete must warn when a media row is referenced and preserve the official static fallback.

# Authentication State Machine

| State                  | Entry condition                                                                 | Allowed capabilities                                   | Main exits                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `ANONYMOUS`            | No valid session                                                                | Public discovery, sign-in/up, neutral recovery         | signup -> `SIGNUP_PENDING`; login -> role/verification evaluation                                                |
| `SIGNUP_PENDING`       | Valid signup submission in progress                                             | No protected capability                                | Auth accepted -> `UNVERIFIED`; generic failure -> `ANONYMOUS`                                                    |
| `UNVERIFIED`           | Auth user exists; `email_confirmed_at` absent                                   | Public pages, resend through safe flow                 | show waiting -> `VERIFICATION_WAITING`; valid callback -> `VERIFIED`; sign-out/timeout UI -> `SIGNED_OUT`        |
| `VERIFICATION_WAITING` | Three-minute application waiting view                                           | Poll safe session state, resend subject to cooldown    | confirmed -> `VERIFIED`; timer end -> Auth entry; no user deletion                                               |
| `VERIFIED`             | Supabase confirms email; role/profile not yet routed                            | Transitional only                                      | unblocked USER -> `AUTHENTICATED_USER`; ADMIN through Admin entry -> `AUTHENTICATED_ADMIN`; blocked -> `BLOCKED` |
| `AUTHENTICATED_USER`   | Valid session, confirmed email, `profiles.role=USER`, not blocked               | Prices, favorites, sample/contact, account             | block -> `BLOCKED`; recovery/sign-out -> respective state                                                        |
| `AUTHENTICATED_ADMIN`  | Valid session, confirmed email, `profiles.role=ADMIN`, not blocked, Admin entry | Admin workspace only; no customer-price entitlement    | sign-out -> `SIGNED_OUT`; lost role/block -> denied                                                              |
| `PASSWORD_RECOVERY`    | Valid recovery callback/session                                                 | Reset-password form only                               | update success -> revoke recovery/session -> `SIGNED_OUT`; invalid/expired -> Auth entry                         |
| `BLOCKED`              | Profile block flag true, regardless of extant session                           | Localized explanation and sign-out only                | Admin unblock then new login; session cleared -> `SIGNED_OUT`                                                    |
| `SIGNED_OUT`           | Session cookies cleared                                                         | Same as anonymous; explicit outcome after logout/reset | navigate home/Auth -> `ANONYMOUS`                                                                                |

Every protected server page, action, query, and price projection evaluates the same central policy. Proxy refreshes cookies but does not authorize. Client-visible role or metadata is never an authority.

# Sign-Up & Verification Flow

1. `/sign-up` fields: full name, email, phone, password, confirm password. No role or Admin path.
2. Validate and normalize server-side; require password confirmation and approved strength; rate-limit by safe infrastructure signals. Send only `full_name` and `phone` as signup metadata for the existing profile trigger. Public signup always produces `USER`.
3. Return a neutral success/waiting response that does not reveal whether an email already exists. Provide prominent “Sign in”, “Forgot password”, and “Resend verification” paths rather than an email-existence endpoint.
4. Navigate to `/verify-email` (or `/ar/verify-email`) with only a masked email or short-lived non-sensitive UI state. Do not expose an address in durable query strings if avoidable.
5. Start a three-minute application countdown. Poll by safely re-reading the current Auth user at a conservative interval; never treat the timer as the email token expiry.
6. Resend uses a server-enforced cooldown/rate limit and a generic result. The client countdown is presentation, not enforcement. Current 45-second UI cooldown should be reconciled with the owner-approved server value.
7. Callback exchanges PKCE code or verifies token hash, then calls `getUser()` and explicitly requires `email_confirmed_at`. Callback arrival alone never grants access.
8. On confirmation, evaluate profile role/block state. A USER reaches home with avatar header; an Admin verification cannot enter through customer sign-in and is directed to the Admin portal.
9. At three minutes without confirmation, clear only temporary UI/session state as appropriate, show “Your email is still awaiting verification,” and return to Auth entry. Never delete the Auth user and never encourage blind duplicate signup.
10. Unverified password login signs out any partial customer session, returns the verification-required domain result, and enters the waiting view with resend.

Acceptance includes reused/expired callback behavior, email-change callback separation, no enumeration, correct EN/AR text, and no protected query before confirmation.

# Forgot / Reset Password Flow

1. `/forgot-password` always returns a neutral “If an account can be recovered, an email has been sent” response.
2. The recovery redirect targets global `/auth/callback` with a validated locale/return hint, not an arbitrary URL.
3. Callback verifies a real recovery code/token and session before redirecting to localized `/reset-password`; an ordinary logged-in session is not sufficient evidence of recovery.
4. Reset page refuses access without the recovery marker/session. Expired, reused, malformed, and wrong-purpose links return a localized safe state with a new recovery CTA.
5. Password validation is server-side; do not store or log passwords. After `updateUser({password})` succeeds, revoke/clear the recovery session and return to sign-in with a localized success message.
6. Re-authenticate for an in-account password change using the current password where Supabase semantics permit; otherwise use a fresh recovery/reconfirmation flow. Do not pretend the current password was checked if it was not.
7. Test that the old password fails, new password succeeds, the recovery link cannot be reused, and protected pages do not remain open in the recovery context.

# User Account & Dashboard

All account routes require authenticated + verified + unblocked `USER`; Admin is not treated as a customer. Preserve the requested simple navigation: Overview, Favorites, Requests, Settings. Security may be a subsection/tab of Settings while its URL remains available during migration.

Overview:

- avatar/default icon, name, verified email, phone/address/country completeness;
- favorite count, active sample count (all non-`CLOSED` SAMPLE_REQUEST states), recent sample requests, and localized status labels;
- quick links to catalog, favorites, requests, and settings;
- no fake revenue, order, shipping, or fulfillment metrics.

Settings:

- avatar and phone as primary edits;
- existing full name, company, delivery address, and country may remain editable because sample eligibility depends on them;
- password through secure Auth semantics;
- field-level and summary validation, typed action results, pending lock, localized toast;
- never expose role/block/audit fields as editable inputs.

Requests:

- list request code, type, coffee, offer/warehouse snapshot, submitted date, and current status;
- detail reads only the owner’s inquiry and history and renders an immutable chronological timeline;
- communicate that sample submission is manual review and does not guarantee physical fulfillment.

# Avatar Flow

1. Viewer loads `avatar_path` from `profiles`; a server helper creates a short-lived signed URL or authenticated image response for the private bucket.
2. Empty or failed path renders a professional default person icon with the user’s accessible name context; do not use initials where Arabic shaping/identity privacy creates ambiguity unless design approves.
3. Upload control accepts `.jpg/.jpeg/.png/.webp`; client validation is convenience only. Server revalidates auth policy, byte size, signature, decodability, dimensions, and owner path.
4. Upload new object -> update profile path -> invalidate viewer/profile caches -> render cache-busted image -> delete obsolete prior object. If profile update fails, remove the new orphan. If old delete fails, record/retry cleanup without losing the new avatar.
5. Delete uses a confirmation dialog, clears the relation safely, deletes only the owner path, and returns to fallback.
6. Header, account overview/settings, and Admin profile use the same `Avatar` component/resolver. Customer avatars and project logo must never share path or mutation actions.

# Header Auth State

Logged out: primary navigation, search, locale, theme, and a clear Sign In/account CTA. Logged-in verified USER: replace that CTA with the resolved avatar/default icon and an accessible menu containing Dashboard and Sign Out.

The menu uses a real accessible menu primitive: button name, `aria-expanded`, keyboard arrows/Escape, focus return, outside click, RTL placement, and 44px mobile targets. Sign Out opens a localized theme-aware confirmation dialog with Cancel and Sign Out. Success clears the session, invalidates viewer caches, closes menus, and navigates home. Admin portal does not appear in public navigation.

Logo stability tests cover first load, refresh, client navigation, locale and theme changes, mobile menu, and Auth state changes. The logo container has stable dimensions; dynamic media loads through an optimized component with static fallback and no destructive dark-mode inversion.

# Admin Authentication

- Dedicated entry: `/dashboard-admin` and `/ar/dashboard-admin`; it owns no public site shell.
- Authenticate with Supabase password flow, then retrieve the profile server-side. Only confirmed, unblocked `profiles.role=ADMIN` reaches `/admin`.
- USER credentials at the Admin entry are signed out and receive a localized access-denied result. No role enumeration beyond the fact that this session cannot access Admin.
- Admin credentials entered at normal `/sign-in` must not silently become a customer or enter `/admin`. Clear that customer-entry session and show “Administrator accounts must use the Admin portal” with a `/dashboard-admin` link preserving locale.
- No Admin signup. Role is never sourced from editable user metadata or client state.
- Every Admin layout, action, RPC, media mutation, and server query repeats the trusted Admin guard; the layout guard is not the only boundary.
- Admin sign-out uses confirmation, clears the session, and returns to localized home unless security review chooses the Admin entry for an explicit reason.

# User Blocking

Recommended design combines two layers, subject to owner approval:

1. `profiles.is_blocked` and audit fields are the durable Hills business state and immediate application/RLS authority.
2. Supabase Auth Admin ban is defense in depth against future authentication/refresh. It requires a server-only service-role client and must never be called from the browser.

Block action sequence:

- Admin server action validates actor role/not-blocked and prevents self-block/Admin-target block in the customer tool.
- Transactional DB RPC changes durable state and writes audit details without exposing reason to the customer.
- If Auth-ban integration is approved, server-only Admin API applies a ban. Failure is reported as a partial operational error; durable application blocking remains effective and a retry/audit task is visible.
- All server guards and relevant RLS immediately deny protected behavior, so a pre-existing access token cannot continue to view prices or mutate data.
- Clear the blocked user’s active Hills session on next request; show a localized generic blocked-account support message. Do not disclose internal reason.

Unblock reverses durable state with actor/time audit and removes the Auth ban if used. It does not automatically sign the user in. A new login is required.

Owner must choose profile-only vs combined Auth ban, reason requirements, who may block, whether Admin accounts can be blocked through a separate super-admin process, ban duration, and support contact wording.

# Admin Workspace

## Information architecture

- Overview: dashboard.
- Leads: Lead Inbox.
- Catalog: products, offers, pricing.
- Origins & logistics: origins, regions, warehouses.
- Taxonomy: coffee types, processes, certifications, sensory notes, packaging, varieties.
- Editorial: articles, article categories, content pages/sections, media.
- People: users.
- System: Site Settings, Profile Settings, Account Settings, Audit Log.

Desktop uses a fixed/collapsible logical-side sidebar with an independently scrolling content region and a short-height-safe header/footer. Tablet/mobile uses a sticky top bar and modal drawer from the logical start side (left EN, right AR). Tables have semantic headers, horizontal scroll only when necessary, card/detail fallbacks for key mobile workflows, sticky primary actions, and no clipped status chips.

Dashboard metrics are real: published coffees, visible offers, active leads, low-stock threshold, articles/content state, and recent audit activity. No invented business KPIs.

Retain working generic CRUD action/data utilities behind feature-specific pages where useful. Split the 1,000+ line Admin action module by domain only after characterization tests. Mutations remain server actions/RPCs with allow-lists, validation, authorization, audit, revalidation, and domain results.

# Lead Inbox

Replace the generic inquiries table with a task-focused workspace:

- server-side search by request code, customer/email where permitted, coffee, or offer reference;
- filters for type, status, date, warehouse, and assignment only if assignment exists later;
- URL-persisted page, sort, and filters; DB pagination and total count;
- list columns/card fields: code, type, customer, coffee, warehouse, submitted time, status;
- detail route showing contact snapshot, user/profile context, coffee/offer links, prior same-coffee sample history, message, current state, and immutable status timeline;
- allowed actions derived from inquiry type/current status, not a free-form select;
- action confirmation for physical state changes, typed conflict handling, localized success/error toast, and audit entry.

For a repeated sample after a CLOSED request, display the prior request prominently. Submission is still only manual review and never auto-approves or creates shipment/reservation.

# Admin Site / Profile / Account Settings

Separate settings by ownership:

- Site: brand/legal display name, real contact fields, social links, default SEO, low-stock threshold, primary logo, default OG media. Use existing `site_settings` and translations/media relations.
- Profile: current Admin’s own full name, phone/company where supported, and avatar using the same owner-safe avatar flow.
- Account: Auth email and password, with confirmation/recovery semantics and no password storage in public tables.

Each area has an independent form/action/result so one failed concern cannot discard another. Site settings require Admin authorization and audit. Profile/account actions may affect only `auth.uid()`. Do not invent unsupported address, legal, newsletter, or social data; leave fields empty or owner-supplied.

# Catalog & Pricing

Public catalog identity and availability remain indexable; protected price is a separate projection.

Price policy is exactly: `session exists AND email_confirmed_at exists AND profiles.role='USER' AND profiles.is_blocked=false`. ADMIN, anonymous, unverified, blocked, and missing-profile sessions receive no price. Enforce in the server query/RPC and again in the projection type.

Never include protected price in anonymous/unverified HTML, RSC payload, client state, search parameters, metadata, JSON-LD, cache entries, logs, error details, prefetch payloads, or public database grants. Public `Product` schema must omit `offers.price` entirely. Protected responses use private/no-store or user-scoped caching; never shared caching.

Catalog filters must move from full-table assembly to a DB-level query/RPC/view supporting localized search, origin, region, type, process, certification, sensory, warehouse, availability, sort, page/cursor, limit, and total count. Only expose dimensions backed by populated schema. Region options depend on selected origin. Use stable ordering with an ID tie-breaker.

# Origins Model & UX

`origins` remains the first-class country entity; `regions.origin_id NOT NULL` is dependent and must be selected/validated under its origin. Coffees reference the appropriate schema relationships; Admin must prevent cross-origin region assignment (retain the existing validation trigger).

Origin listing uses active origins, localized translation, first-class hero media from `origin_media`, and an efficiently aggregated published-coffee count. It may group by continent but must not mimic the reference’s region model blindly.

Origin detail includes media hero, localized overview/facts, harvest information only where real, dependent regions, visible coffees/offers, and related published articles where the schema can relate them. Missing data produces a deliberate compact layout, not fabricated facts. Motion remains presentational and does not hide content from crawlers or reduced-motion users.

# Sample Request Lifecycle

## Creation policy to retain

- Requires authenticated, confirmed, unblocked `USER`.
- Requires completed phone, delivery address, and country.
- Requires a visible trusted offer context; server/database resolves coffee ID from offer.
- Stores `type=SAMPLE_REQUEST`, never PRODUCT; no quantity field exists.
- Checks existing active request by authenticated `user_id + trusted coffee_id + SAMPLE_REQUEST`, never by `offer_id`. Egypt/Dubai offer switching cannot bypass it.
- Active statuses include `NEW`, `RECEIVED`, `CONTACTED`, and after R2, `SAMPLE_SENT`, `DELIVERED`.
- Duplicate returns a safe typed result with existing request code and “You already have an active sample request for this coffee.”
- A previous CLOSED request permits a new submission for manual review and surfaces prior history to Admin. It does not guarantee another physical sample.

## Fulfillment boundary

Database inquiry creation never creates/approves shipment, reserves inventory, marks a sample sent, or triggers automatic fulfillment. Only an authorized Admin manually advances state after real business action. Even `SAMPLE_SENT`/`DELIVERED` are communication states, not logistics entities.

## Customer wording

| Internal      | EN customer label  | AR customer label |
| ------------- | ------------------ | ----------------- |
| `NEW`         | Submitted          | تم الإرسال        |
| `RECEIVED`    | Request received   | تم استلام الطلب   |
| `CONTACTED`   | Team contacted you | تواصل معك الفريق  |
| `SAMPLE_SENT` | Sample sent        | تم إرسال العينة   |
| `DELIVERED`   | Sample delivered   | تم تسليم العينة   |
| `CLOSED`      | Closed             | مغلق              |

Translations require native-language review. Invalid transition returns a conflict domain code, makes no row/history change, and tells Admin to refresh.

# CMS / Media

Keep the existing page/translation/section/media model and Admin mutations. Add a typed section registry mapping existing section types (`HERO`, `RICH_TEXT`, `CARD_GRID`, `MEDIA_SPLIT`, `CTA`, `STAT_ROW`, `FAQ`, `ENTITY_LIST`) to validated rendering props. Unknown or invalid sections fail safely in Admin preview and do not crash public pages.

Static editorial imagery remains appropriate for homepage hero, sourcing story, general About, and controlled brand sections. Database media relations remain mandatory for coffee, origin, article, CMS section, logo, and OG images. Do not hardcode business-data imagery from `public/images`.

Media Admin needs search, purpose/context, dimensions/MIME/size, translations/alt text, reference warnings, replace/archive behavior, and a picker reusable by coffees/origins/articles/CMS/settings. Never copy Sucafina imagery. Any new asset is an owner-provided/licensed/public-domain requirement with recorded source/license.

## Inspected static asset map

- Brand fallback: `logo-mark.png`.
- Hero candidates: `hero-banner.jpg`, `hills-hero.png`.
- General sourcing/editorial candidates: `coffee-cherry.jpg`, `farm-landscape.jpg`, `farmer-partnership.jpg`, `cupping-lab.jpg`, `roasting-profile.jpg`, `warehouse-bags.jpg`.
- Warehouse-specific editorial assets: `warehouse-egypt.jpg`, `warehouse-dubai.jpg` (confirm the final filenames remain present before implementation).
- Existing origin fallbacks: `origin-brazil.jpg`, `origin-colombia.jpg`, `origin-ethiopia.jpg`, `origin-guatemala.jpg`, `origin-kenya.jpg`, `origin-yemen.jpg`.
- Existing coffee-lot editorial set: `coffee-lot-1.jpg` through `coffee-lot-7.jpg`.

Hero, sourcing, general About, and controlled warehouse editorial sections may use these static assets after crop/quality review. Coffee, origin, article, CMS section, logo, and OG media should resolve from database relations whenever they represent a managed business entity. Static origin/lot images may be explicit temporary fallbacks, never a second hidden source of truth. Phase 0 must reconcile this list against the actual directory because the current working tree contains many untracked assets and filenames can change before execution.

# Project Logo Management

No logo column migration is required: `site_settings.org_logo_media_id` and its `media(id)` FK already exist in Post-DB0.

Implementation flow:

1. Site Settings selects an active public media item validated as a supported logo image.
2. Save existing `org_logo_media_id` through the audited settings action.
3. Shared server resolver joins the active media row and produces the public storage URL plus intrinsic dimensions/alt translation where present.
4. `BrandMark` renders a stable-size optimized image in header, footer, Auth, and Admin; errors or missing references fall back to `/images/logo-mark.png`/official approved lockup.
5. Media archive/delete warns about current site-settings references. `ON DELETE SET NULL` preserves fallback behavior.
6. Test light/dark, EN/AR, route transitions, Auth changes, first paint, failed media, and cache invalidation. Do not invert the logo in dark mode.

# Sucafina Live UX Study

The live study is inspiration for information hierarchy and interaction maturity, not a cloning brief.

| Element/page      | Observed behavior                                                                           | Motion/interaction observed                     | Hills interpretation                                                                                | Do / Don’t                                                                                             | Complexity |
| ----------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| Header            | Desktop utility bar plus large nav, logo, search, region, login; sticky behavior            | restrained dropdown/reveal                      | One cleaner Hills header; no global region selector because warehouse filters serve Egypt/Dubai     | Do stable sticky hierarchy; don’t copy brand/nav labels                                                | Medium     |
| Mega menus        | Offerings/Origins/About/News expose grouped destinations                                    | short fade/slide and hover states               | Use only when Hills information volume justifies it; keyboard-accessible compound menu              | Do semantic buttons/focus; don’t use hover-only access                                                 | Medium     |
| Hero              | Full-bleed editorial image, “SOURCE SMART,” selectable value statements, over-image copy    | staged text and active highlight                | Full-impact Hills static hero with one clear sourcing proposition and restrained progressive reveal | Do maintain contrast/crop; don’t copy slogan/content                                                   | Medium     |
| Offerings filters | Search, segment, origin/filter rail, top filters, protected-price notice, table, pagination | filter state transitions                        | DB-backed Hills filters, URL state, price gate; warehouse as a real dimension                       | Do preserve state; don’t query/filter full dataset in memory                                           | High       |
| Mobile offerings  | Card list; filter button opens full-screen categorized drawer with Clear/Apply              | drawer slide and fixed actions                  | Accessible modal filter drawer, logical direction in RTL, safe card status wrapping                 | Do 44px targets; don’t copy observed clipped status edge                                               | High       |
| Coffee detail     | Breadcrumb, origin/name, summary, facts, offer table, narrative, related origin             | subtle content reveal                           | Hills identity/facts/offers/story; protected price kept server-only                                 | Do use real DB data; don’t add commerce actions                                                        | Medium     |
| Origin discovery  | Countries grouped by broad world regions; detail mixes facts/offers/story                   | accordion/list and hover cues                   | Localized visual origin grid grouped by actual continent data; first-class region relations         | Do support empty/missing data; don’t copy taxonomy                                                     | Medium     |
| Cards             | Editorial image, category/date/title, strong image/copy balance                             | modest lift/image movement/underline            | Shared Hills cards for coffee/origin/article with distinct content semantics                        | Do use consistent focus state; don’t overanimate                                                       | Low–Medium |
| News listing      | Large featured story, supporting cards, filters, grid, pagination                           | restrained card/filter changes                  | Featured + latest Hills knowledge from DB; server pagination/search                                 | Do connect filters to DB; don’t hardcode reference stories                                             | High       |
| Article detail    | Category/date/title/deck, rich media/body, tags/share, prev/next/related                    | reading-first, low motion                       | Premium Hills editorial template and related published articles                                     | Do prioritize readability/SEO; don’t add unsupported social features                                   | Medium     |
| Footer            | Multiple useful link/account/legal/contact columns, newsletter/social, bottom legal bar     | minimal                                         | Hills brand/explore/account/contact/legal structure plus contrasting bottom bar                     | Do use real settings/pages; don’t invent newsletter/legal links                                        | Medium     |
| Region selector   | Popover switches NA/EMEA/APAC site context                                                  | compact popover                                 | Not needed. Egypt/Dubai belong in offers/warehouse availability, not global site region             | Do omit; don’t confuse locale and warehouse                                                            | None       |
| Buttons/hover     | Underlines, color changes, image/card affordances                                           | usually short, approximately 200–300ms visually | Hills tokens, visible focus, 160–240ms microinteractions                                            | Do keep state obvious; don’t claim exact copied timing                                                 | Low        |
| Responsive nav    | Compact bar with hamburger/search/region                                                    | drawer/menu reveal                              | Hills modal drawer with semantic trigger and focus management                                       | Do expose accessible name; don’t copy the reference hamburger’s weak semantic exposure observed in DOM | Medium     |

# Hills Public Design System

## Brand foundations

- Primary forest: `#173C32`.
- Warm canvas: `#EEE4D1`.
- Amber: `#CE8A39`.
- Terracotta: `#A44819`.
- Build semantic roles (`surface`, `surface-raised`, `text`, `muted`, `brand`, `accent`, `danger`, `success`, `focus`) rather than using raw colors in feature components.
- Brand Guidelines specify Benito as primary and Manrope as secondary. Benito is not currently supplied; retain Manrope as an explicit fallback until the owner supplies a licensed webfont. Arabic uses the approved/current Cairo/Readex stack after native review.
- Respect approved horizontal/stacked logo variants, clear space, and minimum sizes (brand guide: 150px horizontal, 100px stacked where applicable).

## Core components

Buttons, links, icon buttons, inputs, selects, comboboxes, menus, dialogs, drawers, tabs, breadcrumbs, cards, table/card-list, pagination, filter chips, status badges, skeletons, empty states, toast, and media must share tokens and state contracts. Prefer composition/slots/variants over proliferating boolean props.

Every component documents default, hover, focus-visible, active, selected, disabled, loading, success, and error in both themes and both directions. Minimum touch target is 44x44px for essential controls.

# Motion System

Motion supports hierarchy and state, never hides server content or delays work.

| Primitive          | Use                                 | Duration/easing                    | Key behavior                                                     |
| ------------------ | ----------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `PageReveal`       | Page content after route resolution | 260ms, `cubic-bezier(.22,1,.36,1)` | opacity 0->1, logical Y 10->0; page-level, not persistent layout |
| `SectionReveal`    | Viewport editorial section          | 420ms same ease                    | opacity + Y 18; once; content present without JS                 |
| `Stagger`          | Small groups, max 8 children        | 50ms interval, child 300ms         | deterministic DOM order; no long cascade                         |
| `ImageReveal`      | Hero/editorial media                | 500ms same ease                    | clip/scale 1.025->1; no CLS                                      |
| `HoverLift`        | Cards only                          | 180ms `ease-out`                   | Y -3, shadow change; focus parity; touch disabled                |
| `NavUnderline`     | Nav/link state                      | 160ms `ease-out`                   | logical-inline scale; active state persistent                    |
| `MegaMenuReveal`   | Desktop menu                        | 180ms open / 140ms close           | opacity + Y 6; focus-controlled                                  |
| `DrawerReveal`     | Mobile nav/filter/Admin             | 240ms same ease                    | logical X direction; backdrop 180ms                              |
| `AccordionExpand`  | FAQ/origin/filter group             | 220ms same ease                    | measured height + opacity; accessible state immediate            |
| `FilterTransition` | Results status/chips                | 180ms                              | no entire-list exit blocking; announce result count              |
| `Toast`            | Outcome feedback                    | library motion <= 220ms            | live region, pause on hover/focus                                |
| `Modal`            | Confirmation/detail                 | 180ms panel, 140ms backdrop        | scale .985 + opacity; focus trap not delayed                     |
| `Status`           | Badge/state change                  | 160ms                              | color/opacity only; never color alone                            |

Route direction is not “forward” for every link. Page navigation uses neutral transition unless the product knows hierarchy/back direction. Locale switch uses document navigation until the script-tag defect is eliminated. Reduced motion removes translation, scale, parallax, stagger delay, smooth scroll, and crossfade duration while preserving state visibility and focus movement. Avoid animation wrappers around JSON-LD, tables with frequent data updates, and core form errors.

# Homepage Plan

| Order | Section                    | Ownership                         | Content/data                                                            | Responsive/motion notes                                                               |
| ----- | -------------------------- | --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1     | Header                     | Mixed                             | Settings logo/contact where needed; static nav model; viewer state      | Sticky, stable height; accessible desktop menu/mobile drawer                          |
| 2     | Full-impact hero           | Static asset + localized copy/CMS | Existing Hills hero/farm/green-coffee imagery; no fake statistics       | Art-directed desktop/mobile crop, strong overlay, `ImageReveal` + concise text reveal |
| 3     | Sourcing proposition       | Static/CMS                        | Hills value proposition and buyer benefits                              | Editorial split/statement blocks; no Sucafina wording                                 |
| 4     | Featured coffees           | Database                          | Published featured coffees, visible offers, media/translations          | Server-rendered cards; price shown only after USER policy; small stagger              |
| 5     | Origin discovery           | Database                          | Featured active origins, media, localized name, efficient count         | Visual grid/carousel only if fully keyboard accessible                                |
| 6     | Sourcing/quality story     | Static/CMS                        | Hills-approved story using static editorial assets or typed CMS section | Media split, restrained section/image reveal                                          |
| 7     | Egypt and Dubai warehouses | Database/CMS                      | The two real active warehouses and approved explanatory copy            | Two distinct sections/cards as requested; no invented service claims                  |
| 8     | Customer/account CTA       | Mixed                             | Viewer-aware path to sign in, catalog, or dashboard                     | One primary action; theme/locale correct                                              |
| 9     | Latest Knowledge           | Database                          | Latest published articles with image/category/date/title                | Before footer; 3-card desktop, stacked mobile; server data                            |
| 10    | Footer                     | Mixed                             | Settings, real pages, auth-aware account links                          | Contrasting bottom bar; minimal motion                                                |

The hero uses `next/image` with explicit sizes, priority only for the LCP image, a focal-point crop plan, readable overlay in both themes, and no client-only text. Keep the database-empty fallback honest: hide dynamic grids or show an editorial empty state, never substitute fake offers/articles.

Homepage query work should be consolidated so it does not make the catalog’s current many-table full scan. Fetch each bounded module independently with cache tags and explicit limits. Protected price is a separate user-only request/projection and must not contaminate a public cached page.

# Catalog Plan

## Query contract

Proposed server input:

```text
locale, q, origin_slug, region_slug, coffee_type, process,
certification[], sensory[], warehouse[], availability[], sort,
page/cursor, page_size
```

Normalize/default/remove empty values before query. Validate against allow-lists and cap page size. The database returns only visible published identity/offer metadata, localized display fields, stable sort values, total count/next cursor, and filter facets where efficient. Protected prices are fetched only for the visible result offer IDs after the verified unblocked USER policy.

## Desktop

- Breadcrumb and concise indexable heading/intro.
- Search and sort in a stable top bar.
- Left filter rail or compact filter panel depending width; active chips and Clear All.
- Accessible results table for dense B2B comparison at wide widths, with a card alternative where content becomes too rich.
- Pagination with crawlable parent/page links; no infinite-scroll-only access.
- Locked-price message with Sign In/Create Account paths; it never reveals values.

## Mobile/tablet

- Search/sort remain visible; Filter opens a full-height modal drawer.
- Logical-side category rail or accordion with scrollable values, count, Clear All, and fixed Apply.
- Result cards show origin/name/reference/bags/location/status and price gate without clipping.
- Applying filters updates URL, closes drawer, focuses results heading, and announces count.

## SEO/filter behavior

Primary collection and approved pagination are indexable. Arbitrary filter combinations are `noindex,follow` with canonical to the unfiltered collection unless the SEO owner approves a dedicated landing page. Search parameters must never create protected data or uncontrolled schema variants.

# Origin Pages Plan

Listing:

- server-render all active origins or DB-paginate if volume requires it;
- localized name, continent grouping, origin hero media/fallback, efficient published coffee count, and meaningful link label;
- do not show flags as the sole country identification or fabricate country facts;
- support keyboard/focus parity for hover overlays and restrained image movement.

Detail:

- breadcrumb, localized H1, media hero, editorial overview, real harvest facts, dependent regions, available coffees/offers, and related knowledge;
- filter coffees by origin at the DB layer and paginate when needed;
- use `origin_media` HERO/GALLERY and translations; fall back to existing approved static origin images only through an explicit mapping until CMS media is populated;
- preserve canonical/hreflang/BreadcrumbList; structured data must reflect only supplied facts;
- Arabic logical layout, arrow direction, fact ordering, and motion direction receive native review.

Admin creation order is Origin -> origin translation/media -> Region under selected Origin -> Coffee assignment. Region selectors clear invalid values when Origin changes, and the server/database revalidates the dependency.

# Knowledge / Article Plan

Knowledge index uses a featured published article followed by searchable/filterable article cards and DB pagination. Filters are category and other fields actually present in the schema; do not add tags/subcategories/share tools unless supported and approved. Cards show featured image, category, localized publication date, title, and summary where available.

Article detail uses a reading-width column with optional wide media, category/date, H1, deck/summary, sanitized Markdown/content, accessible headings, image captions/alt, related published articles, and previous/next only when query semantics are stable. Preserve Article, BreadcrumbList, Organization, canonical, and hreflang schema. Related content must not cause N+1 queries.

Homepage “Latest Knowledge” selects a small bounded set of current published articles before the footer. Empty data hides the section or shows an owner-approved editorial CTA; it does not use copied reference news.

# Footer Plan

Structure:

- Brand: resolved project logo with fallback and one approved company description.
- Explore: Coffees, Origins, Knowledge, About.
- Account: Sign In when anonymous; Dashboard, Favorites, Requests when eligible USER. No Admin portal link.
- Contact: only real site-settings email/phone and warehouse/contact paths.
- Legal: only routes with real approved content. Do not invent Privacy/Terms pages merely to fill a column.
- Optional newsletter: omit until an actual consent, provider, privacy, success, and unsubscribe feature is approved.
- Bottom bar: contrasting Hills color, dynamic year/copyright, approved legal links, optional accessible back-to-top control.

On mobile, columns become semantic disclosure groups only if all links remain reachable without JavaScript and disclosure states are accessible. Footer contrast, focus, RTL order, and long Arabic wrapping are acceptance gates.

# Responsive Plan

| Width/condition                      | Public shell                                   | Catalog/content                                             | Account                                 | Admin                                                            |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| 375                                  | Compact logo/actions, modal nav                | Single-column cards; full-screen filters; safe 16px gutters | Stacked summary/nav, full-width forms   | Top bar + logical-side modal drawer; action cards                |
| 430                                  | Same with larger gutters                       | Cards may expose secondary facts                            | Two-up metrics only if labels fit       | Same drawer; no compressed desktop table                         |
| 768                                  | Tablet nav decision based on measured fit      | Two-column cards/filter drawer                              | Side or horizontal nav based on content | Drawer plus adaptive table/card list                             |
| 1024                                 | Desktop header/menus                           | Rail + results; 2–3 cards                                   | Side navigation                         | Collapsible sidebar, horizontally safe tables                    |
| 1280                                 | Full editorial proportions                     | Dense B2B table/grid and rail                               | Comfortable content width               | Full grouped sidebar and detail panes                            |
| 1440+                                | Capped max width, intentional full-bleed media | More whitespace, not uncontrolled line length               | Capped dashboard                        | Capped content; sidebar stable                                   |
| Short desktop height (e.g. 1280x650) | Header must not consume content                | Sticky bars cannot cover results                            | Navigation scroll safe                  | Sidebar groups and sign-out remain reachable; independent scroll |

Per-component QA includes 320–200% zoom stress where relevant, long English/Arabic labels, browser text enlargement, landscape mobile, onscreen keyboard forms, safe-area insets, tables, dialogs, menus, status badges, and no horizontal page overflow.

# Dark / Light Plan

Use class-driven semantic tokens initialized before paint from the stored/system preference. Root theme bootstrap must avoid a wrong-theme flash and locale switching must preserve theme.

- Warm canvas and forest remain brand anchors but are mapped to readable light/dark surfaces rather than inverted mechanically.
- Define contrast-tested text, muted text, border, input, focus, brand button, destructive, warning, success, overlay, skeleton, chart/stat, and code/editor tokens.
- Static and CMS images retain natural pixels. Use overlays/borders/backgrounds, never CSS inversion.
- Dynamic logo uses the approved primary asset; a separate dark logo is optional only after owner approval and schema decision.
- Test every state named in the design-system section, including disabled contrast, selected filter chips, validation, dialogs, toasts, table rows, status badges, and chart-free dashboard stats.

# EN / AR / RTL Plan

- One message catalog namespace model shared by site and Admin; message parity is a required unit test.
- English external routes remain unprefixed; Arabic remains `/ar`. Locale switch preserves path/query and uses a document navigation while required for script/document correctness.
- Root/document sync sets `lang` and `dir`; CSS uses logical properties (`margin-inline`, `inset-inline`, logical borders/radii) rather than scattered locale conditionals.
- Sidebar and drawers originate from logical start: left EN, right AR. Directional arrows, breadcrumbs, chevrons, progress direction, and entrance motion mirror when meaning is directional; universal icons do not.
- Use locale-aware date/number formatting. Preserve Latin identifiers such as request codes, offer references, emails, and technical units with appropriate `dir="ltr"`/bidi isolation.
- Tables retain semantic column order where data comparison benefits, while alignment and action placement follow direction.
- Forms, dialogs, toasts, menus, validation summaries, empty states, metadata, alt text, CMS translations, status labels, and error pages require both locales.
- Arabic copy receives native editorial review; machine symmetry is not sufficient acceptance.

# Toast & Error Architecture

Standardize one serializable result shape:

```ts
type ActionResult<T = undefined> =
  | { ok: true; code: "OK"; data?: T; messageKey?: MessageKey }
  | {
      ok: false;
      code: DomainErrorCode;
      messageKey: MessageKey;
      fieldErrors?: Record<string, string[]>;
      conflict?: { requestCode?: string };
    };
```

Domain codes include `VALIDATION`, `AUTH_REQUIRED`, `VERIFICATION_REQUIRED`, `ADMIN_PORTAL_REQUIRED`, `FORBIDDEN`, `BLOCKED`, `NOT_FOUND`, `DUPLICATE_SAMPLE`, `CONFLICT`, `RATE_LIMITED`, `STORAGE_INVALID`, `STORAGE_FAILED`, `CONFIGURATION`, and `UNEXPECTED`. The server logs a correlation ID and redacted operational detail; the browser receives no Postgres/Supabase text, stack, UUID parse detail, policy/constraint name, or secret.

One global Sonner provider uses Hills theme tokens and direction. UI translates `messageKey` in the current locale; server actions do not return prelocalized arbitrary strings. Toasts are for submission outcomes, not field guidance. Forms render field errors and an accessible summary/focus target; success may toast and revalidate/navigate. Expected authorization states render stable page messaging rather than repeated toasts.

Every mutation disables/reconciles duplicate submission, shows pending state without layout shift, survives navigation appropriately, and maps unique/conflict errors to domain outcomes. Sample duplicate includes the existing request code.

# Accessibility Plan

Target WCAG 2.2 AA for all core journeys.

- Semantic landmarks, one H1, skip link, real buttons/links, named navigation, correct heading order, meaningful page titles.
- Visible 3:1 focus indicators, logical focus order, no focus obscured by sticky UI, 44px essential targets, and keyboard-only completion.
- Accessible menu/dialog/drawer primitives with focus trap, Escape, outside behavior, initial focus, focus restore, inert background, and scroll lock. Replace or harden the current custom inquiry modal.
- Form labels/instructions, `autocomplete`, error association, summary, focus to first error, pending announcement, no timeout without explanation/control.
- Status changes/result counts/toasts use appropriate non-duplicative live regions. Status is never color-only.
- Semantic data tables with captions/headers and mobile alternatives that retain relationships.
- Image alt comes from localized content; decorative images use empty alt; logo has the brand name; avatar alt avoids unnecessary sensitive detail.
- Reduced-motion path is functionally equivalent; no parallax/auto movement. Respect zoom/reflow at 200–400% and text spacing.
- Automated axe is a gate, not proof. Add keyboard/screen-reader manual scripts for header menu, filters, sample dialog, sign-out confirm, account, Admin drawer, CRUD form, and Lead Inbox transition.

# SEO Preservation Plan

The SEO target follows the supplied Hills B2B green-coffee specification while preserving the current URL contract.

- Confirm the production canonical host with the owner. The specification references `https://www.hillscoffees.com/`, while runtime uses `NEXT_PUBLIC_SITE_URL`; do not hardcode until ownership/redirects are verified.
- Choose one trailing-slash policy and enforce it once at edge/server. Current routes are non-trailing; retain unless migration evidence supports a change.
- EN canonical is unprefixed, AR is `/ar`; every indexable page emits self-canonical, reciprocal `hreflang=en/ar`, and appropriate `x-default`.
- Preserve Organization, WebSite, BreadcrumbList, Article, and Product identity schemas. Product schema omits protected price/Offer price. JSON-LD is server-rendered, safely escaped, stable, and connected to canonical entity IDs.
- Private Auth/account/Admin paths are `noindex,nofollow` and absent from sitemap. Filter/search combinations are `noindex,follow` canonicalized to the collection unless intentionally approved landing pages exist.
- Replace monolithic sitemap if scale warrants segmented, bounded sitemaps for public pages, coffees, origins, and knowledge; include only published/visible canonical URLs and localized alternates.
- Robots must not be used as the security boundary. Keep private data inaccessible regardless of crawl directives.
- Route migration preserves existing public slugs through redirects. No soft 404; missing localized/entity pages return real 404 and no indexable placeholder.
- Measure Core Web Vitals and validate schema/canonicals after architecture changes. Preserve HTML-first headings/content and crawlable pagination.

# Security Plan

| Asset/boundary           | Control                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public Supabase config   | Require base project URL and publishable key; reject `/rest/v1` and unexpected path rather than silently normalizing                                       |
| Service role             | `SUPABASE_SERVICE_ROLE_KEY` server-only module with `server-only`; no `NEXT_PUBLIC_`, props, logs, browser imports, or proxy use unless strictly necessary |
| Admin role               | Read `profiles.role` server-side/RLS; not user metadata/client state; require not-blocked; guard every mutation/query                                      |
| Profile protected fields | Trigger/RPC prevents owner editing role/block/audit fields; allow-list normal profile updates                                                              |
| Protected prices         | Verified unblocked USER only; separate query/projection; no public grants/schema/cache/payload/log                                                         |
| Inquiries                | Auth user bound server/trigger; trusted offer -> coffee; owner-only read; Admin update; status transition guard                                            |
| Sample duplicate         | App rule retained; optional partial unique index for concurrency; map conflict safely                                                                      |
| Other users’ data        | RLS + explicit `.eq(user_id, auth.uid())`; random request codes are not authorization                                                                      |
| Block/unblock            | Admin-only audited RPC; self/role restrictions; application/RLS immediate block; optional Auth ban via service key                                         |
| Avatars                  | Private bucket, owner folder policy, signature/size validation, stored path only, safe replace/delete                                                      |
| CMS/media/logo           | Admin-only writes, active/public reads, reference-aware archive, sanitized content, MIME validation                                                        |
| Server actions           | CSRF-origin protections provided by framework plus validation, auth recheck, allow-list, rate limits, typed errors                                         |
| Redirects                | Allow-listed internal paths/locale; no arbitrary callback/return URL                                                                                       |
| Audit                    | Admin read only, append through trusted triggers/actions, redact secrets/passwords/tokens/block details as policy dictates                                 |

Environment validation has four explicit clients:

- Browser: base `NEXT_PUBLIC_SUPABASE_URL` + publishable key.
- Server user client: same public values plus request cookies; honors RLS.
- Proxy session-refresh client: same public values only; refreshes Auth cookies, does not use service role.
- Service/Admin client: base URL + `SUPABASE_SERVICE_ROLE_KEY`, constructed only in a server-only module for approved Auth Admin operations. Prefer user/RPC client for normal Admin data so RLS remains active.

Any direct REST usage must use a separately constructed `/rest/v1` endpoint and be documented; it must never be passed as `createClient()`’s project URL.

# Performance Plan

- Replace the catalog’s many full-table reads/in-memory filtering with bounded DB query/RPC, selective columns, stable pagination, and evidence-backed indexes.
- Avoid N+1 on origin counts, related articles, media, favorites, and price projections; aggregate/join in server queries.
- Public data uses explicit Next cache tags/revalidation by entity; Admin/account/Auth/protected price use dynamic private/no-store semantics. Never let one user’s price cache serve another or public traffic.
- Keep Server Components by default. Client islands are limited to menus, theme/locale controls, forms, filters, dialogs, avatar upload, and motion triggers.
- Use `next/image`, explicit `sizes`, intrinsic dimensions/aspect ratio, AVIF/WebP delivery where supported, one LCP priority image, lazy loading below fold, and stable placeholders without shipping huge source images.
- Load Motion features lazily/minimally and keep most microinteraction CSS-native. Measure bundle impact per route.
- Font plan avoids unlicensed Benito fetches, excessive weights, and layout shift; self-host approved fonts with preload only for critical subsets.
- Track LCP, INP, CLS, JS, RSC payload, DB query count/time, cache hit behavior, and mobile network/CPU. Set budgets in Phase 13 after baseline, not arbitrary claims.

# Test Data Strategy

Use an approved staging Supabase project only. Local UI tests may mock deterministic domain adapters; real Auth/RLS/storage/DB flows require staging. Never seed production casually.

Fixture namespace/prefix: `E2E-HILLS-<run-id>` in slugs/references/emails where possible. Provision with a privileged test-only script/CI secret outside browser bundles, and clean in reverse FK order in `finally`/scheduled janitor. Record fixture IDs in a run manifest; fail closed if the target project is not explicitly marked staging.

Minimum dataset:

- 3 origins with EN/AR translations and media; dependent regions;
- populated coffee types, processes, sensory notes, certifications, packaging, and varieties;
- 4–6 published coffees plus one draft/archived boundary record;
- Egypt and Dubai visible offers, statuses, quantities, and protected price tiers;
- 2 published localized articles/categories and CMS Home/About sections;
- public media and a temporary logo asset;
- Anonymous (no record), Unverified USER, Verified USER, Blocked USER, ADMIN; unique mailboxes or Supabase test-email strategy approved by owner;
- sample inquiries spanning each status plus a prior CLOSED same-coffee request.

Fixture creation must not automate a real Gmail inbox unless access is approved. Token/email callback validation is split into automated provider/test-hook coverage and live staging/manual acceptance. Keep fixture passwords/secrets in CI secret storage and redact logs/screenshots.

# Playwright E2E Matrix

## Persona matrix

| Journey                                      |    Anonymous | Unverified USER |            Verified USER |     Blocked USER |                      ADMIN |
| -------------------------------------------- | -----------: | --------------: | -----------------------: | ---------------: | -------------------------: |
| Public EN/AR discovery/SEO/no console errors |         Auto |            Auto |                     Auto |             Auto |                       Auto |
| Price absent/present                         |       absent |          absent |                  present |           absent |                     absent |
| Favorites                                    | sign-in path |     verify path |          add/remove/list |          blocked | denied/customer-ineligible |
| Sample request                               | sign-in path |     verify path | create/duplicate/history |          blocked | denied/customer-ineligible |
| Account                                      |     redirect |          verify |             full journey | blocked/sign-out |                     denied |
| Customer sign-in                             |    available |         waiting |              home/avatar |          blocked |       Admin-portal message |
| Admin entry/workspace                        |        login |          denied |                   denied |           denied |               full journey |
| Locale/theme/path preservation               |       public |    Auth waiting |           public/account |   blocked screen |                entry/Admin |

## Automated Auth journeys

- Signup validation, generic privacy-safe response, no role input, verify waiting, three-minute timer behavior with controlled clock, resend cooldown, unverified login path.
- Callback unit/integration tests for confirmed vs unconfirmed, malformed, expired/reused, recovery vs signup/email-change.
- Verified USER login -> localized home -> avatar/default menu -> sign-out confirm cancel/confirm.
- ADMIN at customer sign-in -> Admin portal message and no customer session capability.
- Forgot-password neutral response -> valid test recovery callback -> reset -> recovery session cleared -> new sign-in; invalid link path.
- Admin login, wrong-role denial, blocked denial, and no role metadata trust.

Live staging/manual email acceptance separately verifies actual provider delivery, link host/redirect, email template/locale if supported, confirmation timestamp, resend, token lifetime, recovery delivery, spam/domain configuration, and reused-link behavior.

## Verified USER journeys

- Default avatar, valid upload/change/delete, invalid MIME/signature/oversize, cross-user path denial.
- Dashboard counts and recent requests; phone/profile update; password change/re-auth behavior.
- Favorite/unfavorite and cross-user isolation.
- Sample Coffee A succeeds; Coffee B succeeds; Coffee A again blocked at NEW/RECEIVED/CONTACTED/SAMPLE_SENT/DELIVERED; Coffee A through other warehouse blocked; another user Coffee A succeeds; CLOSED allows new manual review.
- Missing phone/address/country produces clear errors; no quantity control/data; row type remains SAMPLE_REQUEST; no shipment/reservation/fulfillment side effect.
- Account request timeline reflects Admin updates after reload/revalidation.

## Admin journeys

- Login and real dashboard counts; grouped nav and mobile/RTL drawer.
- User search/detail/block/unblock/audit; blocked session loses protected capability immediately.
- Create/edit/archive coffee; valid Origin/Region dependency; offer and protected price; taxonomy/variety/warehouse.
- Article/category/media/CMS operations; site logo change, all-shell visibility, and restoration; reference-safe media archive.
- Lead Inbox filters/detail/prior sample history/allowed status transitions; invalid transition rejected; SAMPLE_SENT/DELIVERED visible to customer.
- Site/Profile/Account settings with role and ownership boundaries; audit filtering/detail; safe sign-out.

## Cross-cutting gates

Every core test installs listeners that fail on unexpected `console.error`, `pageerror`, React hydration/reconciliation warning, failed critical response, or Dev Overlay. Locale switching repeats EN -> AR -> EN while preserving query/path/theme/Auth and checks the exact script-tag warning is absent. Accessibility scans supplement keyboard assertions. Destructive staging tests use isolated fixtures and cleanup.

# Visual Regression Matrix

Use stable staging fixtures, disable nondeterministic timestamps/animations through the official test preference, keep reduced-motion visual baselines separately where useful, mask only truly volatile external values, and review diffs rather than auto-accept.

| Screen                              | EN light | EN dark | AR light | AR dark | Required viewports        |
| ----------------------------------- | -------: | ------: | -------: | ------: | ------------------------- |
| Home                                |      Yes |     Yes |      Yes |     Yes | 375, 768, 1280, 1440      |
| Catalog + filters/drawer            |      Yes |     Yes |      Yes |     Yes | 375, 430, 1024, 1440      |
| Coffee detail                       |      Yes |     Yes |      Yes |     Yes | 375, 1280                 |
| Origins listing/detail              |      Yes |     Yes |      Yes |     Yes | 375, 768, 1280            |
| Knowledge index/article             |      Yes |     Yes |      Yes |     Yes | 375, 1280                 |
| Sign In/Admin entry/verify          |      Yes |     Yes |      Yes |     Yes | 375, 1280                 |
| Account overview/settings/requests  |      Yes |     Yes |      Yes |     Yes | 375, 768, 1280            |
| Header menus/avatar/sign-out dialog |      Yes |     Yes |      Yes |     Yes | 375, 1280                 |
| Admin dashboard/users               |      Yes |     Yes |      Yes |     Yes | 375, 1024, 1280x650, 1440 |
| Lead Inbox/detail/status modal      |      Yes |     Yes |      Yes |     Yes | 375, 1024, 1280x650       |
| Admin Site Settings/logo/media      |      Yes |     Yes |      Yes |     Yes | 375, 1280                 |
| 404/error/empty/loading/error forms |      Yes |     Yes |      Yes |     Yes | 375, 1280                 |

Add focused component baselines only for high-risk primitives (header/logo, dialog, drawer, filter controls, status badges) to avoid an unmaintainable snapshot volume. Visual QA also checks no horizontal overflow, clipped text/status, missing logo/image, wrong direction, content jump, or obscured focus.

# Implementation Phases

## Phase 0 — Safety baseline, decisions, and environment proof

- Goal: freeze a trustworthy pre-change baseline and resolve decisions that alter schema, URLs, Auth, assets, or QA.
- Why now: the working tree is large and historical reports are stale; every later phase needs a current reference and safe staging target.
- Dependencies: human approval to observe environments; no code dependency.
- Exact files/modules likely affected: test/report artifacts and decision log only during execution; inspect `package.json`, `next.config.ts`, `src/proxy.ts`, `src/app/**`, `src/lib/**`, `src/actions/**`, `tests/**`, `messages/**`, `public/images/**`, `src/support/**`, `.env.example`. Do not rewrite them in this phase except an approved baseline test fix.
- Database impact: read-only current snapshot, row counts, policies/functions, duplicate preflight, backup/restore plan. No migration.
- Auth/security impact: identify safe staging project, redirect allow-list, test personas, secret owners, rate limits, and service-role custody.
- EN/AR impact: inventory every route/message and reproduce locale switching in both directions.
- UI impact: capture baseline screenshots at required widths/themes, including short desktop Admin.
- Tests required BEFORE change: clean `npm install`; format, typecheck, lint, unit, production build, public Playwright, console capture, current route crawl; record exact pass/fail/skip rather than fixing opportunistically.
- Implementation tasks: compare source to reports; confirm canonical host/trailing slash; record current git SHA/status; validate base Supabase URL; create issue/decision IDs; reproduce script-tag overlay; baseline DB query timings; approve staging cleanup rules.
- Tests required AFTER change: none beyond verifying the baseline/decision artifacts are complete and repeatable.
- Acceptance criteria: owner decisions needed for Phase 1 are explicit; current failures have reproduction/evidence; staging and rollback owners are known; no production write occurred.
- Rollback strategy: delete only generated local test artifacts; baseline is read-only.
- Risks: accidentally treating historic pass counts as current, exposing secrets in logs, using production for QA, or overwriting the dirty tree.
- What must NOT be changed: application behavior, schema, Auth users, production data, URLs, or assets.

## Phase 1 — Approved database and storage foundations

- Goal: add avatar/block state, avatar storage, sample delivery statuses, and approved security/concurrency hardening.
- Why now: later Auth, account, Admin, and request UI cannot be correct without durable state and generated types.
- Dependencies: Phase 0 decisions/backup; migration review; safe staging.
- Exact files/modules likely affected: new ordered Supabase migration files in the repository’s approved migration location; `src/lib/supabase/types.generated.ts`; schema contract tests; `.env.example` only if service-role use is approved.
- Database impact: execute R1–R4 in approved order; optional partial unique/indexes only with owner approval; regenerate types.
- Auth/security impact: protected profile fields, blocked-user helper/RLS, Admin RPC/grants, service-role boundary, owner-only avatar policies.
- EN/AR impact: add status/block/storage domain message keys after schema names are final.
- UI impact: none enabled until clients are compatible; old app must remain functional through nullable/default additions.
- Tests required BEFORE change: fresh snapshot, duplicate-active-sample query, missing-profile query, migration lint/dry-run, backup restore rehearsal, current RLS tests.
- Implementation tasks: apply additive columns/checks/FK/backfill; update triggers/helpers/RLS/RPC; create private bucket/policies; add enum values/transition guard; optionally add unique hardening; verify grants; regenerate types.
- Tests required AFTER change: migration up test on blank and snapshot-like DB; RLS matrix for five personas; storage cross-user tests; transition/history tests; duplicate race test if index approved; rollback rehearsal where feasible.
- Acceptance criteria: blocked JWT cannot use protected features; user cannot edit protected profile fields; avatar owner isolation holds; valid transitions create one history row; existing data is intact.
- Rollback strategy: feature flags keep new UI off; restore policies/functions first; nullable columns can remain harmless; enum rollback follows the explicit data-conversion plan, never blind down migration.
- Risks: policy lockout, security-definer grants, self-FK behavior, enum irreversibility, duplicate data, Auth Admin API mismatch.
- What must NOT be changed: existing business rows beyond explicit backfill; role values; inquiry type; logo column; shipment/inventory schema.

## Phase 2 — Route architecture, proxy, and locale stabilization

- Goal: establish the global/site/Admin boundaries and exact external URL contract with one Admin source.
- Why now: Auth redirects, Admin localization, document direction, SEO, and visual shells depend on stable routing.
- Dependencies: Phase 0 reproduction and canonical decisions; Phase 1 not strictly required for file moves.
- Exact files/modules likely affected: `src/app/layout.tsx`, localized layouts/pages under `src/app/[locale]`, new `src/app/(site)/[locale]/**`, new `src/app/(admin)/**`, `src/proxy.ts`, `src/i18n/routing.ts`, `src/i18n/navigation.ts` if present/created, `next.config.ts`, root/locale error and not-found files, navigation locale switch, JSON-LD components.
- Database impact: none.
- Auth/security impact: callback stays excluded; existing guards preserved exactly while routes move; proxy remains refresh-only.
- EN/AR impact: headers/cookie/internal rewrites, Admin provider, document `lang/dir`, path/query preserving switch.
- UI impact: shell boundaries change; no intentional redesign in this phase.
- Tests required BEFORE change: route manifest, redirect/rewrite matrix, callback tests, metadata snapshots, exact overlay reproduction, screenshot baseline.
- Implementation tasks: create target groups; move pages in small slices; create Admin locale provider; implement proxy algorithm/markers/cookie; harden native JSON-LD identity; use locale document navigation if required; update redirects and route helpers; remove old source only after parity.
- Tests required AFTER change: every URL in Route Migration Map; `/en` canonical redirects; queries preserved; repeated EN/AR switch; callback; 404 status; no loop/soft 404/overlay; anonymous Admin/account guards; sitemap/robots/canonicals.
- Acceptance criteria: one Admin implementation serves four external Admin roots; URL bar never shows `/en`; Admin path/filter survives locale change; no console/hydration/script error.
- Rollback strategy: keep moves in separable commits; restore old route tree and proxy together; do not leave both trees active with conflicting routes.
- Risks: rewrite recursion, root layout persistence, RSC script reconciliation, conflicting App Router routes, cookie loss, SEO duplication.
- What must NOT be changed: business queries/actions, schema, visual brand, Auth policy, public slugs.

## Phase 3 — Auth state machine and authorization policy

- Goal: implement the explicit Auth states, verified USER/Admin separation, recovery, and blocked-session handling.
- Why now: all protected features and Admin work depend on one authoritative viewer policy.
- Dependencies: Phases 1–2.
- Exact files/modules likely affected: `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, target Auth pages/layout, `src/lib/auth/session.ts`, `src/lib/auth/redirects.ts`, new `src/features/auth/**`, Supabase browser/server/service clients, env validation, messages, Auth tests.
- Database impact: consume block fields/helpers; optional Auth ban calls, no further schema.
- Auth/security impact: central policies for anonymous/unverified/verified USER/Admin/blocked/recovery; neutral enumeration; redirect allow-list; base URL validation; service role server-only.
- EN/AR impact: every state/error/countdown/resend/Admin-entry message and RTL form behavior.
- UI impact: revised sign-up, verify waiting, sign-in, Admin entry, forgot/reset, blocked and access-denied states.
- Tests required BEFORE change: characterize current callback/signup/login/recovery actions and redirects; confirm Supabase project email/token settings.
- Implementation tasks: define state/policy/result types; reject `/rest/v1` client URL; implement safe signup/wait timer/server resend cooldown; check confirmed state; separate customer/Admin entry; validate recovery marker; clear sessions on role/blocked/reset outcomes; update route guards.
- Tests required AFTER change: unit/integration state transition matrix; enumeration tests; callback purpose tests; E2E personas for available automated states; manual live email acceptance; secret bundle scan.
- Acceptance criteria: only verified unblocked USER gets customer capability; only verified unblocked ADMIN through Admin entry gets Admin; blocked and recovery contexts cannot leak access.
- Rollback strategy: keep old Auth behavior behind a short-lived branch/commit boundary; revert actions/pages/helpers as a unit while retaining additive DB fields.
- Risks: locking legitimate users out, callback locale loss, false enumeration, resend abuse, stale sessions, service-role leakage.
- What must NOT be changed: public signup role, automatic user deletion, token lifetime claims, identity requirements, or password storage model.

## Phase 4 — Customer account, avatar, and header identity

- Goal: deliver the simple verified USER dashboard, settings, avatar, request history, and confirmed sign-out.
- Why now: Auth/storage foundations are ready and header state must be stable before public redesign.
- Dependencies: Phases 1–3.
- Exact files/modules likely affected: account routes/layout, `src/actions/account.ts`, account data modules, new `src/features/account/**`, `src/components/navigation/site-header.tsx`, avatar/menu/dialog components, providers/messages.
- Database impact: reads/writes `profiles.avatar_path`, favorites, inquiries/history; no schema.
- Auth/security impact: every route/action requires verified unblocked USER; object path is server-derived; owner-only reads/writes; Admin denied as customer.
- EN/AR impact: dashboard/status/settings/upload/sign-out strings; bidi-safe request codes; RTL menu/dialog.
- UI impact: overview cards, account navigation, avatar upload/delete, header avatar menu, sign-out confirmation, polished request timeline.
- Tests required BEFORE change: current account/favorite/request action tests; avatar Storage policy tests from Phase 1; header screenshot baseline.
- Implementation tasks: consolidate account query; build signed avatar resolver/actions; simplify nav to Overview/Favorites/Requests/Settings; integrate profile completeness; add menu/dialog; cache invalidation; retain security URL compatibility.
- Tests required AFTER change: five-persona gates; cross-user request/avatar denial; upload variants/rollback; favorite behavior; sign-out cancel/confirm; responsive/RTL/a11y/visual tests.
- Acceptance criteria: default/uploaded avatar is stable across navigation/theme/locale; counts/timeline are real; no unauthorized account or object access.
- Rollback strategy: fall back to default avatar and old account pages; keep avatar column/bucket unused; revert header viewer menu independently if needed.
- Risks: signed URL expiry, orphan objects, stale cached avatar, focus/menu defects, count query cost.
- What must NOT be changed: sample creation rules, Admin account semantics, password storage, or commerce scope.

## Phase 5 — Admin authorization, users, blocking, and settings

- Goal: establish a secure localized Admin shell plus real user management and separated settings.
- Why now: uses the final route/Auth/blocking foundation and enables safe later editorial/workflow administration.
- Dependencies: Phases 1–4.
- Exact files/modules likely affected: target Admin layout/dashboard/users/settings routes, `src/components/admin/**`, `src/actions/admin-operations.ts` split by feature as justified, `src/lib/admin/**`, new `src/features/admin/users/**`, settings/profile/account features, service/Admin client if approved, messages.
- Database impact: consume Admin user RPC/block audit/site settings; no unapproved schema.
- Auth/security impact: ADMIN/not-blocked guard on layout and every action; audited block/unblock; USER denial; sign-out confirmation.
- EN/AR impact: fully localized shell, grouped navigation, user/filter/action/settings messages; RTL drawer.
- UI impact: grouped sidebar/drawer, real dashboard, user search/detail/block modal, Site/Profile/Account settings.
- Tests required BEFORE change: characterize all 18 current Admin mutations/readers and current audit behavior; verify RPC outputs.
- Implementation tasks: build shell; paginate/search user RPC; user detail; block/unblock flows and partial Auth-ban recovery; separate settings actions/forms; split generic code only along tested domain seams.
- Tests required AFTER change: Admin and wrong-role E2E; block/unblock immediate enforcement; audit; short-height/mobile/RTL; settings ownership; service-key client scan.
- Acceptance criteria: one localized workspace, no public Admin link, real data/search, audited durable blocking, no cross-user/self/role escalation.
- Rollback strategy: keep old generic Admin pages available only on the branch until new parity; revert feature route while keeping security schema; manually reconcile partial Auth bans using audit.
- Risks: RPC search exposure, partial DB/Auth ban state, Admin self-lockout, huge generic-module refactor, mobile table complexity.
- What must NOT be changed: public/customer navigation, role assignment process, unrelated CRUD semantics, production users without explicit test plan.

## Phase 6 — Catalog, protected pricing, and Origins query layer

- Goal: make catalog/origin discovery database-filtered, paginated, performant, and price-safe.
- Why now: architecture/Auth policy is stable; public redesign needs reliable data contracts.
- Dependencies: Phases 1–3; fixture subset from Test Data Strategy.
- Exact files/modules likely affected: `src/lib/data/catalog.ts`, pricing/site-content/editorial data, target catalog/origin pages, new `src/features/catalog/**` and `src/features/origins/**`, filter components, metadata/schema helpers, possibly approved DB RPC/view migration.
- Database impact: approved query RPC/view/indexes only after explain evidence; no business data rewrite.
- Auth/security impact: server price policy requires verified unblocked USER; public query selects no protected columns.
- EN/AR impact: localized search/sort/facets, region dependency, URLs, empty states, metadata.
- UI impact: desktop rail/table/cards, mobile filter drawer, origin cards/detail.
- Tests required BEFORE change: price leak/source/RLS tests, query-count baseline, filter URL/canonical tests, existing catalog/origin snapshots.
- Implementation tasks: define query contract; implement DB filtering/count/pagination; separate price projection; aggregate origin counts/media; build URL state; replace in-memory path incrementally.
- Tests required AFTER change: filter combinations/facets/pagination/sort stability; price persona matrix and payload/schema scans; DB query/performance tests; mobile/RTL/a11y; SEO canonicals.
- Acceptance criteria: bounded DB query, stable URL state, no shared protected cache, correct region/origin dependency, responsive usable results.
- Rollback strategy: retain old reader behind internal adapter during validation; revert query adapter without changing URLs; remove speculative indexes only after observing no dependency.
- Risks: RPC complexity, localization search quality, count cost, cache leakage, filter SEO explosion, empty production data.
- What must NOT be changed: public price restriction, catalog taxonomy meaning, slugs, warehouse business data, or marketplace scope.

## Phase 7 — Inquiry and sample delivery workflow

- Goal: integrate the new lifecycle into Admin Lead Inbox and customer tracking without changing the manual-review boundary.
- Why now: Auth, status schema, account, and Admin shell are ready.
- Dependencies: Phases 1, 3–6.
- Exact files/modules likely affected: `src/actions/inquiries.ts`, `src/lib/inquiries/**`, inquiry forms/panel, account request routes/components, Admin Lead Inbox routes/actions/data, status components/messages/tests.
- Database impact: consume R2 transition guard/history and optional duplicate unique index; no shipment tables.
- Auth/security impact: verified unblocked USER creation; Admin-only transitions; trusted offer/coffee context; owner-only history.
- EN/AR impact: status labels, duplicate/profile validation, manual-review disclaimer, Admin confirmations/conflicts.
- UI impact: accessible sample/product dialogs, prior-request warning, Lead Inbox detail/actions, customer timeline.
- Tests required BEFORE change: current sample behavioral suite and database trigger/RLS tests; capture current form accessibility.
- Implementation tasks: extend active statuses; map transition graph by inquiry type; catch unique conflict; build task-specific Inbox; update account timeline; replace/harden dialog focus; audit status changes.
- Tests required AFTER change: every sample case specified in Playwright matrix; concurrency if hardening approved; invalid/backward/cross-type transitions; history count; no fulfillment side effects; EN/AR/a11y.
- Acceptance criteria: warehouse switch cannot bypass; CLOSED permits manual re-review; physical states are Admin-only and customer-visible; no quantity or automatic fulfillment.
- Rollback strategy: disable new transition actions; map outstanding new statuses using owner-approved operational plan before any enum rollback; retain history.
- Risks: enum permanence, duplicate predicate omission of new active states, misleading customer language, double history writes, accidental fulfillment implication.
- What must NOT be changed: duplicate key to offer, SAMPLE_REQUEST type, identity requirement, inventory/shipment behavior.

## Phase 8 — CMS, media, articles, and project logo

- Goal: make business content and branding safely manageable through existing schema.
- Why now: query/route shells are stable; public redesign needs real typed content and media.
- Dependencies: Phases 2, 5–7; owner assets/content.
- Exact files/modules likely affected: `src/components/content/**`, Admin content/media/articles/settings routes, `src/lib/data/editorial.ts`, site-content/media helpers, `src/components/brand/mark.tsx`, header/footer/Auth/Admin brand consumers, feature modules/messages.
- Database impact: reuse existing media/CMS/logo relations; optional dark/favicon columns only if separately approved.
- Auth/security impact: Admin-only upload/write/archive; public active reads; sanitize content; reference checks.
- EN/AR impact: translation editor parity, localized alt/copy/article fields, fallback policy.
- UI impact: typed section renderer/editor, media library/picker, premium article template, dynamic logo preview/fallback.
- Tests required BEFORE change: current Admin mutation characterization, media policy/MIME tests, logo navigation reproduction, sanitized Markdown tests.
- Implementation tasks: section registry; media picker/reference graph; wire `org_logo_media_id`; article/home queries; logo cache invalidation; fallback/error handling.
- Tests required AFTER change: CRUD/publish/archive; invalid media; XSS; logo change/restore across shells/themes/locales; missing translation/media; visual/SEO schema.
- Acceptance criteria: real content drives appropriate sections, logo never disappears, no copied/unlicensed assets, existing relations are reused.
- Rollback strategy: point logo to NULL/static fallback; switch renderer to prior generic path; retain DB content/media; revert feature UI without deleting assets.
- Risks: referenced-media deletion, cache staleness, invalid section JSON, missing Arabic content, logo aspect/contrast.
- What must NOT be changed: business data imagery into static hardcodes, unapproved legal/contact content, or existing logo column.

## Phase 9 — Public design and motion rebuild

- Goal: implement the Hills-specific premium homepage/header/footer/public templates and restrained motion.
- Why now: stable routes/data/content/logo prevent visual work from embedding temporary assumptions.
- Dependencies: Phases 2, 4, 6, 8.
- Exact files/modules likely affected: public marketing pages/layout, navigation/header/footer/mobile menu, design-system components, `src/app/globals.css`, motion feature/primitives, image configuration, messages.
- Database impact: read-only dynamic sections.
- Auth/security impact: header viewer state and price gates must remain unchanged; no client price expansion.
- EN/AR impact: complete copy/layout/motion direction and text expansion.
- UI impact: homepage ten-section sequence, improved header/menus, footer, cards, public details, full theme/responsive treatment.
- Tests required BEFORE change: screenshot/axe/performance baselines; content/data empty states; price payload checks.
- Implementation tasks: finalize tokens/type; build primitives; compose static/CMS/DB homepage; rich nav where justified; article/origin/catalog cards; responsive art direction; reduced motion.
- Tests required AFTER change: full public visual matrix; keyboard/axe; route/locale/theme/logo; console gate; LCP/CLS/image checks; empty and loaded data.
- Acceptance criteria: visually distinctive Hills system, real content, no reference copy/assets, usable 375–1440+, both themes/locales, restrained motion.
- Rollback strategy: component-by-component commits/feature flags; preserve data/routes; revert visual shell without touching domain logic.
- Risks: visual scope expansion, LCP regression, motion bundle, contrast, crop failures, design divergence from brand guide.
- What must NOT be changed: data/Auth/DB policy, public URLs, business facts, or protected price behavior.

## Phase 10 — Admin interaction and responsive redesign

- Goal: complete task-specific Admin UX across all existing modules and devices.
- Why now: secure shell, Lead Inbox, settings, and design tokens already exist.
- Dependencies: Phases 5, 7–9.
- Exact files/modules likely affected: remaining Admin module routes/editors, Admin navigation/action/form/table components, admin data/actions feature split, messages/styles.
- Database impact: no schema unless an independently approved CRUD gap is proven.
- Auth/security impact: preserve per-action Admin guard/audit; no client trust.
- EN/AR impact: all modules/forms/tables/drawers/statuses localized and RTL-safe.
- UI impact: grouped nav, responsive list/detail/edit, sticky actions, clear empty/loading/error/conflict states.
- Tests required BEFORE change: mutation inventory and per-module CRUD characterization; current mobile/short-height screenshots.
- Implementation tasks: replace generic UX selectively; unify editor form patterns; add search/filter/page state; accessible confirmations; mobile cards/drawers; surface audit links.
- Tests required AFTER change: each Admin CRUD path with fixtures; validation/conflict/archive; keyboard/axe; theme/RTL; 375/768/1024/1280x650/1440 visual checks.
- Acceptance criteria: all supported modules are operable on mobile/tablet/short desktop and preserve existing business semantics.
- Rollback strategy: retain tested generic editor adapters; revert module route independently; never roll back authorization/audit.
- Risks: regression across many modules, oversized forms, table overflow, translation volume, inconsistent generic/specific behavior.
- What must NOT be changed: role model, catalog semantics, unsupported modules/features, or production records during QA.

## Phase 11 — Cross-cutting accessibility, i18n, theme, and domain errors

- Goal: close systemic quality gaps after major UI paths stabilize.
- Why now: fixing primitives once is more efficient than patching every page during churn.
- Dependencies: Phases 3–10.
- Exact files/modules likely affected: providers, design-system primitives, messages/tests, global styles, form/action helpers, error/not-found/loading boundaries, every feature using outlier feedback/dialogs.
- Database impact: none.
- Auth/security impact: errors redact internals; unauthorized states remain distinct and safe.
- EN/AR impact: full parity/native review, logical layout, bidi formats, metadata/errors.
- UI impact: standardized toast/forms/focus/loading/empty/error/theme states and reduced motion.
- Tests required BEFORE change: message parity, axe/keyboard inventory, contrast audit, raw error scan, theme screenshots.
- Implementation tasks: finalize `ActionResult`; map domain errors; migrate forms/toasts; replace inaccessible dialogs; audit focus/targets/contrast/logical CSS; complete 404/error pages.
- Tests required AFTER change: message parity zero diff; axe core persona pages; keyboard scripts; contrast/reflow/reduced-motion; raw error leakage tests; theme/RTL visual matrix.
- Acceptance criteria: WCAG 2.2 AA target met for core journeys; no raw backend error; every action state is localized and theme-safe.
- Rollback strategy: migrate feature by feature with compatibility adapter for old result shape; revert a primitive only with consumers together.
- Risks: translation errors, live-region noise, focus regressions, inconsistent mixed contracts, late design token changes.
- What must NOT be changed: business outcomes, authorization distinctions, or error logging needed server-side.

## Phase 12 — Authenticated E2E, visual regression, and staging acceptance

- Goal: prove real five-persona flows, DB/RLS/storage behavior, and visual/console quality in safe staging.
- Why now: all product journeys are implemented and fixtures can validate integration rather than mocks.
- Dependencies: Phases 0–11 and approved staging email/test strategy.
- Exact files/modules likely affected: `tests/e2e/**`, Playwright config/helpers/fixtures/global setup/cleanup, test-only seed tooling, visual baselines, QA report. Product code only for confirmed defects in separate commits.
- Database impact: isolated TEST rows/objects/users in staging; manifest-driven cleanup; no production.
- Auth/security impact: persona secrets protected; cross-user/RLS/blocked/service-role bundle tests.
- EN/AR impact: every important shell/path switch tested in both directions.
- UI impact: deterministic visual baselines; animations controlled by test preference without altering production behavior.
- Tests required BEFORE change: unit/type/lint/build, fixture target guard, cleanup dry run, public smoke.
- Implementation tasks: create personas/dataset; build reusable auth states; automate allowed flows; define manual email checklist; add console/overlay gate; capture matrix; run mobile/short desktop/a11y.
- Tests required AFTER change: full npm QA plus repeated clean fixture runs and cleanup verification; manual live email acceptance signed off.
- Acceptance criteria: zero unexplained failures/skips in required automated matrix; manual-only cases identified/signed; no leaked fixture/secret; visual diffs approved; console clean.
- Rollback strategy: cleanup by run manifest; remove only new test rows/objects/users after target verification; revert defective product commit, not baseline expectations.
- Risks: flaky email/provider timing, fixture pollution, destructive cleanup target, screenshot churn, parallel race, rate limits.
- What must NOT be changed: production data, security controls for test convenience, ignored console errors, or fake email-success claims.

## Phase 13 — SEO, performance, security, and production-readiness audit

- Goal: validate the final system against acceptance gates and produce an evidence-based release recommendation.
- Why now: architecture/content/routes must be stable for trustworthy crawl, performance, and security results.
- Dependencies: Phases 0–12.
- Exact files/modules likely affected: metadata/SEO helpers, sitemap/robots, cache/image/font configuration, query indexes only if approved by evidence, deployment/env docs, final execution report.
- Database impact: query tuning/indexes only after explain evidence and separate approval; no fixture data in production.
- Auth/security impact: final RLS/service-role/headers/cookies/redirect/cache review and secret scan.
- EN/AR impact: canonical/hreflang/schema/content parity and localized 404 checks.
- UI impact: only measured performance/a11y/SEO fixes; no late redesign.
- Tests required BEFORE change: complete Phase 12, production-like build, crawl and Core Web Vitals/Lighthouse baseline, DB query plans.
- Implementation tasks: validate host/redirects/canonicals/sitemaps/robots/schema; performance budgets/query count/bundle/images/fonts/cache; OWASP-style boundary review; backup/runbook/monitoring; release checklist.
- Tests required AFTER change: full npm suite, crawl, schema validators, no-price scans, Lighthouse/WebPageTest or approved equivalent, RLS regression, deployment smoke and rollback rehearsal.
- Acceptance criteria: every Final Acceptance Gate has current evidence or an explicit owner-approved exception; release/rollback owners and monitoring are ready.
- Rollback strategy: deployment rollback to last good build; additive DB compatibility retained; disable new queries/features with documented flags/adapters; execute data rollback only through reviewed runbook.
- Risks: canonical host mistakes, cache leaks, late query/index regression, false performance confidence, production env mismatch.
- What must NOT be changed: product scope, URLs/schema without migration plan, production DB/Auth records during audit, or acceptance thresholds to force a pass.

# Dependency Graph

```text
Phase 0 evidence + owner decisions
├── canonical/locale decisions ──> Phase 2 architecture/proxy ──> Phase 3 Auth redirects
│                                  ├──> Phase 6 catalog/origins
│                                  ├──> Phase 8 CMS/media/logo
│                                  └──> Phase 9 public design
├── DB backup/schema approval ──> Phase 1 database/storage
│                                ├── avatar ──> Phase 4 account ──> header avatar
│                                ├── blocked state ──> Phase 3 guards ──> Phase 5 users/blocking
│                                ├── sample statuses ──> Phase 7 Lead Inbox/timeline
│                                └── optional duplicate index ──> Phase 7 concurrency behavior
├── staging/persona approval ─────────────────────────────────────> Phase 12 real E2E
└── assets/content/license approval ──> Phase 8 ──> Phase 9

Phase 3 Auth + Phase 4 account + Phase 5 Admin
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

Critical path: `0 -> 1 -> 2 -> 3 -> 4/5/6 -> 7/8 -> 9/10 -> 11 -> 12 -> 13`. Phases 4, 5, and 6 may run in parallel only after their shared Auth/route contracts freeze and teams avoid shared-file collisions.

# File-by-File Migration Map

Paths are conceptual until Phase 2 confirms Next.js route conflicts; target URLs remain authoritative.

| Current file/path                                                                | Problem                                                      | Target path/owner                                         | Action                                              | Risk                              | Required tests                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------- | --------------------------------- | ------------------------------- |
| `src/app/layout.tsx`                                                             | Global and locale document state can persist inconsistently  | same                                                      | KEEP/REFACTOR to global-only + document sync        | Hydration/theme flash             | lang/dir/theme/locale repeat    |
| `src/app/[locale]/layout.tsx`                                                    | Currently wraps every localized concern including Admin      | `src/app/(site)/[locale]/layout.tsx`                      | MIGRATE site provider; Admin gets separate provider | Missing messages/root persistence | EN/AR route/metadata/error      |
| `src/app/[locale]/(site)/layout.tsx`                                             | Public shell also owns Admin entry path                      | `src/app/(site)/[locale]/(marketing)/layout.tsx`          | REFACTOR public marketing shell                     | Header/footer missing on routes   | shell route matrix              |
| `src/app/[locale]/(site)/page.tsx`                                               | Homepage lacks required origin/story/latest sequence         | target marketing `page.tsx` + `features/home`             | MIGRATE/REFACTOR, retain working DB modules         | Data/cache/visual regression      | empty+fixture home, SEO/visual  |
| `(site)/about`, `contact`, `request-a-quote`, `[page]`                           | Mixed static/CMS and generic paths                           | target marketing equivalents                              | MIGRATE, preserve public URL/behavior               | Slug conflict/soft 404            | route/canonical/forms           |
| `(site)/green-coffee-offer-list/page.tsx`                                        | Full-table in-memory query assembly                          | target same route + `features/catalog`                    | REFACTOR query/UI                                   | Price leak/filter regression      | persona price/filter/pagination |
| `(site)/green-coffee-offer-list/[slug]/page.tsx`                                 | Detail tied to current data projection                       | target same + catalog feature                             | MIGRATE/REFACTOR                                    | schema/offer mismatch             | detail/price/schema/404         |
| `(site)/coffee-origins/page.tsx`                                                 | Media/count/discovery limited                                | target same + origins feature                             | MIGRATE/REFACTOR                                    | N+1/empty data                    | list count/media/SEO            |
| `(site)/coffee-origins/[slug]/page.tsx`                                          | Incomplete origin media/editorial composition                | target same                                               | MIGRATE/REFACTOR                                    | relation/translation gaps         | details/offers/related/404      |
| `(site)/knowledge/**`                                                            | Functional DB article paths; limited visual/index UX         | target marketing paths + editorial feature                | KEEP behavior/MIGRATE; enhance later                | Published-state/SEO               | list/detail/schema/sanitize     |
| `(site)/sign-in`, `sign-up`, `verify-email`, `forgot-password`, `reset-password` | Public shell coupling and incomplete state model             | `src/app/(site)/[locale]/(auth)/**`                       | MIGRATE/REFACTOR                                    | callback/redirect/session errors  | full Auth matrix                |
| `src/app/auth/callback/route.ts`                                                 | Correct global position; state handling needs hardening      | same                                                      | KEEP/REFACTOR in place                              | Token-purpose mix-up              | callback matrix/live email      |
| `(site)/account/layout.tsx`                                                      | Gate not limited to verified unblocked USER                  | target localized `account/layout.tsx`                     | MIGRATE/REPLACE guard                               | Unauthorized access/loops         | five personas                   |
| `(site)/account/page.tsx`                                                        | Simple but incomplete overview                               | target + `features/account`                               | REFACTOR with real counts/avatar                    | Query cost                        | dashboard fixtures/visual       |
| `(site)/account/profile`                                                         | Separate profile while target wants simple Settings          | target `account/settings`                                 | MIGRATE behavior, redirect old path                 | Bookmark loss                     | redirect/form/security          |
| `(site)/account/security`                                                        | Password/email management separate                           | target `account/settings` or retained compatibility route | KEEP/MIGRATE selectively                            | Auth semantics                    | reauth/recovery                 |
| `(site)/account/favorites`                                                       | Working feature, guard incomplete                            | target same + account feature                             | KEEP logic/MIGRATE                                  | RLS/cache                         | owner/cross-user                |
| `(site)/account/requests/**`                                                     | Working history; statuses incomplete                         | target same + inquiries feature                           | KEEP/MIGRATE/EXTEND                                 | status wording/access             | timeline/transition             |
| `(site)/dashboard-admin/page.tsx`                                                | Dedicated entry inherits public site shell                   | `src/app/(admin)/dashboard-admin/page.tsx`                | MIGRATE/REFACTOR                                    | locale/auth routing               | USER/ADMIN/AR entry             |
| `(site)/admin/**` legacy redirect                                                | Route duplication/ambiguity                                  | `next.config.ts` redirect or minimal compatibility route  | DELETE after redirect proof                         | loop/SEO                          | redirect exactness              |
| `src/app/[locale]/admin/layout.tsx`                                              | Admin source under locale; basic shell                       | `src/app/(admin)/admin/layout.tsx`                        | MIGRATE/REFACTOR with provider/guard                | Arabic loss/security              | four Admin roots, RTL           |
| `src/app/[locale]/admin/page.tsx`                                                | Dashboard coupled to old tree                                | `src/app/(admin)/admin/page.tsx`                          | MIGRATE/KEEP real metrics                           | count regressions                 | fixtures/role/mobile            |
| `src/app/[locale]/admin/[module]/page.tsx`                                       | Giant generic switch; weak task UX                           | explicit Admin module routes                              | SPLIT/KEEP adapters; REPLACE Users/Inbox UX         | Broad CRUD regression             | per-module characterization/E2E |
| `src/app/[locale]/admin/[module]/[id]/**`                                        | Generic editor ownership                                     | explicit `[id]` routes or shared editor feature           | MIGRATE incrementally                               | deep-link loss                    | CRUD/deep link                  |
| `src/app/[locale]/admin/content/**`                                              | Functional CMS editing                                       | target Admin content routes                               | KEEP/MIGRATE, add typed registry                    | CMS regression                    | CRUD/preview/XSS                |
| `src/app/[locale]/admin/account/**`                                              | Admin account concerns mixed                                 | Admin settings/profile/account                            | MIGRATE/SPLIT                                       | user ownership                    | profile/email/password          |
| `src/proxy.ts`                                                                   | Custom locale rewrite lacks full Admin/cookie contract       | same                                                      | REPLACE algorithm, retain session refresh           | loops/cookie loss                 | exhaustive proxy table          |
| `src/i18n/routing.ts` and navigation                                             | As-needed locale but link transitions are overgeneralized    | same + locale URL helper                                  | REFACTOR                                            | path/query/theme loss             | locale repeat all shells        |
| `src/lib/auth/session.ts`                                                        | `requireVerifiedUser` admits verified ADMIN; no block/avatar | `src/features/auth/policy.ts` + thin lib adapter          | REFACTOR central policy                             | authorization regression          | persona/unit/RLS                |
| `src/actions/auth.ts`                                                            | Substantial flow exists but entries/states differ            | `src/features/auth/actions/**`                            | KEEP logic, SPLIT/REFACTOR                          | enumeration/session bugs          | action state matrix             |
| `src/actions/account.ts`                                                         | Useful mutations; avatar/block policy absent                 | `src/features/account/actions/**`                         | KEEP/SPLIT/EXTEND                                   | cross-user write                  | action/RLS/storage              |
| `src/actions/inquiries.ts`                                                       | Correct duplicate rule; lifecycle/race handling incomplete   | `src/features/inquiries/actions/**`                       | KEEP core, EXTEND statuses/conflict                 | duplicate/fulfillment regression  | full sample suite               |
| `src/actions/admin-operations.ts`                                                | ~1,000-line mixed domains                                    | `src/features/admin/*/actions.ts`                         | SPLIT only after tests                              | mutation/audit regression         | per-action contract             |
| `src/lib/data/catalog.ts`                                                        | Many queries + memory filtering                              | `src/features/catalog/queries.ts`                         | REPLACE adapter with DB query                       | performance/price                 | query plans/personas            |
| `src/lib/data/editorial.ts`, `site-content.ts`, `pricing.ts`                     | Useful domain separation                                     | matching feature query modules                            | KEEP/MIGRATE selectively                            | cache/data regression             | unit/integration/cache          |
| `src/components/brand/mark.tsx`                                                  | Static-only, reported instability                            | shared brand component + logo resolver                    | REFACTOR with existing setting/fallback             | layout shift/missing image        | shell/theme/locale/Auth         |
| `src/components/navigation/site-header.tsx`, mobile menu                         | No avatar menu; mobile focus is custom                       | shared shell + accessible primitives                      | REFACTOR                                            | a11y/responsive                   | keyboard/menu/dialog            |
| `src/components/inquiries/inquiry-panel.tsx`                                     | Custom dialog focus behavior unproven                        | inquiries feature dialog                                  | REPLACE shell, KEEP form logic                      | focus loss/double submit          | dialog a11y/sample behavior     |
| `src/components/motion/reveal.tsx`                                               | Only Reveal/Stagger                                          | `src/components/motion/**`                                | EXPAND/REFACTOR                                     | JS/perf/reduced motion            | visual/reduced motion           |
| `src/components/seo/**`, `src/lib/seo/**`                                        | Valuable schema/metadata; transition identity issue          | same or `lib/seo`                                         | KEEP/HARDEN stable server scripts                   | overlay/schema loss               | locale repeat/schema/canonical  |
| `src/app/robots.ts`, `sitemap.ts`, `manifest.ts`                                 | Useful, sitemap strategy limited                             | same                                                      | KEEP/REFACTOR after routes stabilize                | indexing regression               | crawl/private route checks      |
| `messages/en.json`, `messages/ar.json`                                           | Broad catalogs; new states/modules missing                   | same, optionally namespaced files if tooling supports     | KEEP/EXTEND with parity                             | translation drift                 | parity/native review            |
| `public/images/**`                                                               | Approved static inventory; business image misuse risk        | same                                                      | KEEP; optimize/map only approved editorial use      | licensing/crop/size               | image inventory/visual/LCP      |
| `tests/e2e/**`                                                                   | Broad public QA; authenticated personas skipped              | same with fixtures/persona helpers                        | KEEP/EXTEND                                         | flakiness/data pollution          | repeat/cleanup/console          |

# Route Migration Map

| Current URL                                                             | Target external URL                                 | Target internal source      | Locale behavior                                | Auth requirement         | SEO/indexing                     | Redirect/rewrite/backward compatibility                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------- | --------------------------- | ---------------------------------------------- | ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------ |
| `/en/**`                                                                | equivalent `/**`                                    | site EN source              | EN unprefixed                                  | route-specific           | redirect target canonical        | 308 strip `/en`, preserve query                                                      |
| `/`, `/ar`                                                              | same                                                | `(site)/[locale]/page`      | EN rewrite `/en`; AR direct                    | public                   | index, reciprocal alternates     | internal rewrite only                                                                |
| `/about`, `/ar/about`                                                   | same                                                | marketing `about`           | as above                                       | public                   | index                            | no external change                                                                   |
| `/contact`, `/ar/contact`                                               | same                                                | marketing `contact`         | as above                                       | public                   | index                            | no external change                                                                   |
| `/request-a-quote`, AR equivalent                                       | same                                                | marketing request route     | as above                                       | form policy-specific     | index/no price                   | no external change                                                                   |
| `/green-coffee-offer-list`, AR equivalent                               | same                                                | marketing catalog page      | locale prefix contract                         | public; price USER-only  | index collection; filters policy | no external change                                                                   |
| `/green-coffee-offer-list/[slug]`, AR equivalent                        | same                                                | catalog detail              | locale preserved                               | public; price USER-only  | index visible entity             | no external change; old products redirects retained if present                       |
| `/products`, `/products/[slug]` legacy                                  | canonical catalog/list detail                       | new catalog sources         | locale preserved                               | public                   | redirect only                    | keep tested 308/301 mapping where slug mapping is valid; avoid blind detail redirect |
| `/coffee-origins`, `/ar/coffee-origins`                                 | same                                                | origin listing              | locale preserved                               | public                   | index                            | no external change                                                                   |
| `/coffee-origins/[slug]`, AR equivalent                                 | same                                                | origin detail               | locale preserved                               | public                   | index visible entity             | no external change                                                                   |
| `/knowledge`, `/knowledge/[slug]`, AR equivalents                       | same                                                | knowledge index/detail      | locale preserved                               | public                   | index published                  | no external change                                                                   |
| generic `/[page]`, `/ar/[page]`                                         | same if published                                   | CMS catch-all               | locale preserved                               | public                   | per-page setting                 | ensure static route priority; real 404 if absent                                     |
| `/sign-in`, `/ar/sign-in`                                               | same                                                | site Auth group             | locale preserved                               | anonymous/role handling  | noindex                          | no external change                                                                   |
| `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password` + AR | same                                                | site Auth group             | locale preserved through callback hint         | state-specific           | noindex                          | no external change                                                                   |
| `/auth/callback`                                                        | same                                                | global route handler        | locale from validated state/cookie             | token/code               | noindex/system                   | proxy excluded; never prefix                                                         |
| `/account` + AR                                                         | same                                                | localized account overview  | locale preserved                               | verified unblocked USER  | noindex                          | no external change                                                                   |
| `/account/profile` + AR                                                 | `/account/settings` + AR                            | account settings            | locale preserved                               | verified unblocked USER  | noindex                          | temporary 308 after settings parity                                                  |
| `/account/security` + AR                                                | `/account/settings` or retained security subsection | settings/security source    | locale preserved                               | verified unblocked USER  | noindex                          | owner UX decision; redirect if merged                                                |
| `/account/favorites` + AR                                               | same                                                | account favorites           | locale preserved                               | verified unblocked USER  | noindex                          | no external change                                                                   |
| `/account/requests`, `/[code]` + AR                                     | same                                                | account requests            | locale preserved                               | owner USER               | noindex                          | no external change                                                                   |
| `/dashboard-admin`                                                      | same                                                | `(admin)/dashboard-admin`   | header EN                                      | anonymous/Admin session  | noindex                          | direct source                                                                        |
| `/ar/dashboard-admin`                                                   | same visible                                        | same Admin source           | proxy rewrites without `/ar`, header/cookie AR | anonymous/Admin session  | noindex                          | internal rewrite; query preserved                                                    |
| `/admin`, `/admin/**`                                                   | same                                                | `(admin)/admin/**`          | header EN                                      | verified unblocked ADMIN | noindex                          | direct source                                                                        |
| `/ar/admin`, `/ar/admin/**`                                             | same visible                                        | same canonical Admin source | internal rewrite; AR provider/RTL              | verified unblocked ADMIN | noindex                          | query/path/record preserved                                                          |
| legacy localized source `/en/admin/**`                                  | `/admin/**`                                         | canonical Admin source      | EN                                             | ADMIN                    | noindex                          | 308 strip `/en`; no duplicate source                                                 |

# Risk Register

| Rank | Risk                                                                                   | Likelihood/impact | Detection                                  | Mitigation/owner                                                                 |
| ---: | -------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
|    1 | Route/proxy migration creates loops, soft 404s, lost query, or duplicate canonicals    | Medium/Critical   | exhaustive URL/HTTP/crawl tests            | Phase 2 incremental move; proxy table; Architecture + SEO owners                 |
|    2 | Locale client navigation reconciles JSON-LD scripts and triggers the known Dev Overlay | High/High         | repeated console/overlay E2E               | stable server schema boundaries; locale document navigation; Next issue tracking |
|    3 | Protected price leaks through RSC payload, schema, cache, or Admin entitlement         | Medium/Critical   | persona payload/cache/source/RLS tests     | strict USER policy; separate projection/no-store; Security owner                 |
|    4 | Blocked user retains access through active JWT/direct Supabase query                   | Medium/Critical   | block while session active, RLS probes     | profile flag in every guard/RLS; optional Auth ban; DB/Auth owner                |
|    5 | DB/RLS migration locks out legitimate users/Admin or exposes protected fields          | Medium/Critical   | staging role matrix/migration rehearsal    | additive migrations, fixed grants, backup, break-glass owner                     |
|    6 | Sample duplicate races across server instances or omits new active statuses            | Medium/High       | concurrency test and duplicate audit query | owner-approved partial unique index; conflict mapping                            |
|    7 | Current empty data and missing credentials produce false QA confidence                 | High/High         | skips/empty-state reports                  | approved staging fixtures and five personas; QA owner                            |
|    8 | Large generic Admin split regresses working CRUD/audit behavior                        | Medium/High       | per-action characterization/E2E            | split only along feature seams; retain adapters; Admin owner                     |
|    9 | Logo/avatar/media lifecycle creates missing assets, orphans, or unauthorized reads     | Medium/High       | reference/storage/cross-user/visual tests  | transactional order, fallback, private avatar policies, cleanup                  |
|   10 | Public redesign/motion harms LCP, accessibility, RTL, or brand fidelity                | Medium/High       | CWV/axe/visual/native review               | data-first phases, token system, reduced motion, budgets, design owner           |
|   11 | Auth email/recovery behavior differs from assumptions/configuration                    | Medium/High       | live staging manual acceptance             | provider settings review, neutral states, no timer/token conflation              |
|   12 | Fixture cleanup damages non-test or production data                                    | Low/Critical      | target guard/run manifest/dry-run          | staging marker, namespaced IDs, explicit target validation, QA owner             |

# Database Decisions Requiring Owner Approval

1. `DATABASE HARDENING DECISION REQUIRED`: approve/reject the partial unique active-sample index. Recommended: approve after duplicate preflight; include `SAMPLE_SENT` and `DELIVERED` as active.
2. Approve durable blocked-account fields exactly: `is_blocked`, `blocked_at`, `blocked_by`, and optional `block_reason`; confirm whether reason is mandatory and retention policy.
3. Choose profile-only blocking or profile + Supabase Auth Admin ban. Recommended: both, with profile/RLS as immediate authority and a retryable audited Auth-ban side effect.
4. Confirm who may block whom, whether Admin self/other-Admin blocking is prohibited, break-glass process, and active-session handling.
5. Approve `profiles.avatar_path text NULL`, private `avatars` bucket, 5 MiB limit, accepted JPEG/PNG/WebP, and whether Admin may view customer avatars.
6. Approve enum additions `SAMPLE_SENT`, `DELIVERED` and the exact transition graph/customer wording. Confirm whether `DELIVERED` means courier confirmation or explicit customer receipt.
7. Approve transition enforcement location (recommended DB trigger/RPC plus Admin UI) and enum rollback operational rule.
8. Confirm no new logo column is wanted. Existing `site_settings.org_logo_media_id` should be used; decide only whether optional dark-logo/favicon relations are needed.
9. Approve any catalog/search RPC/view and only evidence-backed indexes after reviewing SQL/query plans.
10. Approve service-role usage and custody for Auth ban/test provisioning; identify secret owner and production operational process.

# External Inputs Required

- Human approval of this plan and phase gates before implementation.
- Confirmed production canonical host, `www` policy, HTTPS redirect ownership, and trailing-slash policy.
- Approved staging Supabase project, explicit environment marker, safe Admin/USER personas, email test strategy, and cleanup authorization.
- Supabase email confirmation/recovery settings: redirect allow-list, token lifetime, resend/rate limits, SMTP/template/domain behavior.
- Decision answers from the preceding section, especially blocking and duplicate hardening.
- Licensed Benito webfont files or approval to retain Manrope; Arabic typography/native-language reviewer.
- Approved EN/AR product copy, blocked-account support wording, sample status translations, About/sourcing/warehouse content.
- Official logo lockups/variants and confirmation that current static fallback is approved; optional favicon/dark logo decision.
- Owner-provided/licensed imagery and license/source records for any gap not covered by `public/images`; no Sucafina copying.
- Real site-settings contact/legal/social information and actual legal page content. Newsletter approval/provider/consent model if ever added.
- Performance/availability targets, analytics/monitoring consent and provider, deployment owner, backup/rollback owner, and maintenance window.
- Clarification whether “delivered” is Admin-observed courier delivery or buyer-confirmed receipt; no shipping automation is implied.

# Final Acceptance Gates

## Product and data

- The complete discover-to-track journey works with real staging DB behavior; no marketplace/cart/payment/shipping automation exists.
- Catalog/origin/article/CMS data is real, localized, and respects publish/visibility states; no fake production records/content.
- Sample duplicate rule uses user + coffee + type across warehouse offers; CLOSED re-review and active delivery states behave exactly as approved; no quantity/fulfillment side effect.

## Architecture and runtime

- Global/site/Admin boundaries match the approved tree; one Admin source serves EN/AR external URLs.
- No visible `/en`, redirect loop, path/query loss, soft 404, wrong shell, wrong document direction, or stale locale cookie.
- Repeated EN <-> AR from public/Auth/account/Admin produces no Dev Overlay, script warning, hydration error, console error, theme reset, or logo loss.

## Auth/security

- Five persona authorization matrix passes at page, action, query/RPC, RLS, storage, price-payload, and cache boundaries.
- Signup/verification/wait/resend/recovery/reset/sign-out/Admin-entry/blocking behavior is proven; email-provider-only cases have signed manual staging acceptance.
- Service role is absent from browser bundles/logs; base Supabase URL is validated; no raw backend errors or open redirects.
- Avatar owner isolation, Admin audit, other-user request isolation, protected profile fields, and active blocked-session denial pass.

## UX/design

- EN/AR, LTR/RTL, light/dark, reduced motion, and 375/430/768/1024/1280/1440+ plus short desktop work for every core shell.
- Homepage order/content ownership, latest Knowledge before footer, two warehouse contexts, catalog filters, rich origins/articles, account/avatar, Lead Inbox, and settings match approved design.
- WCAG 2.2 AA target passes automated and manual keyboard/focus/dialog/form/table/live-region checks; no essential target below 44px.

## SEO/performance/quality

- Canonical/hreflang/x-default, sitemap, robots, 404s, redirects, Organization/WebSite/Breadcrumb/Article/Product schema are validated; protected price is absent from public schema.
- DB filtering/pagination and query plans are bounded; protected caching is private; image/font/motion budgets meet Phase 13 approved thresholds; LCP/CLS/INP evidence is recorded.
- `npm install`, format check, TypeScript, ESLint, Vitest, production build, Playwright personas, accessibility, visual regression, console gate, and crawl all pass with exact current counts. Required skips are zero unless owner explicitly approves a documented external/manual case.
- Fixture cleanup leaves no staging residue; production smoke and rollback rehearsal are complete; execution report links evidence, not assertions.

Future implementation is complete only when behavior, DB permissions, locales, themes, responsiveness, error states, runtime cleanliness, and security all pass—not merely when a build or route succeeds.

# Recommended Execution Order for Claude

Claude should execute only after human approval, one phase at a time, with a reviewable commit/checkpoint and acceptance evidence before the next dependency is unlocked:

1. Phase 0: refresh baseline, reproduce the locale overlay, and collect all owner decisions.
2. Phase 1: implement reviewed additive DB/storage migrations in staging; regenerate types; pass RLS/storage/transition tests.
3. Phase 2: migrate route ownership and proxy/i18n without visual redesign; prove the entire URL and locale matrix.
4. Phase 3: centralize Auth/authorization and complete verification/recovery/customer-vs-Admin entry/blocked state.
5. Phase 4 and Phase 5: implement customer account/avatar/header and secure Admin users/blocking/settings. Parallelize only if shared Auth/header files have clear ownership.
6. Phase 6: replace catalog/origin memory filtering with the approved DB query and lock the price boundary.
7. Phase 7: integrate sample delivery states, Lead Inbox, customer timeline, and optional race hardening.
8. Phase 8: wire CMS/media/articles and the existing logo relation with stable fallback.
9. Phase 9: build the Hills public design and motion system on real data/content.
10. Phase 10: finish task-specific, responsive Admin UX without rewriting working mutations blindly.
11. Phase 11: run the cross-cutting i18n/RTL/theme/error/accessibility convergence pass.
12. Phase 12: provision isolated staging fixtures and prove five-persona E2E, visual, console, and manual email acceptance.
13. Phase 13: perform the final SEO, performance, security, deployment, and rollback audit.

At each phase Claude must: re-read the latest source/schema and this plan; inspect user changes; run pretests; implement only the phase scope; run posttests; record exact results; stop on an owner-decision boundary; and never compensate for a failed security/database gate with UI-only behavior. Human review remains the immediate next step.
