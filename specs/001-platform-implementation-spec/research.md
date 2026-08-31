# Phase 0 Research: Hills Coffee Platform Implementation

This document resolves the technical unknowns needed to turn
`spec.md` into an execution-ready plan. Every decision here is a
normalization of a choice already made in `docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md`
and/or already observable in `docs/HILLS_SUPABASE_CURRENT_STATE.md` and the
current repository — none of it is new product research.

## 1. Locale-switch script-tag / runtime-overlay defect

**Decision**: Treat this as two separable concerns, not one bug, and fix them
independently rather than searching for a single root cause.

1. **Server-rendered JSON-LD is not the problem** — it already follows the
   Next.js-documented pattern (`<script type="application/ld+json" dangerouslySetInnerHTML>`
   with `<` escaped). This must not be changed to `<template>` or removed.
2. **The reconciliation risk is client-side locale navigation remounting a
   subtree that contains a server-rendered `<script>` node.** React only
   warns/overlays when a `<script>` element passes through *client*
   reconciliation (a soft navigation that touches the same DOM position),
   not on a fresh document load. The fix is architectural: the locale
   switcher performs a **full document navigation** (`window.location`-style
   hard nav, not the App Router's client transition) whenever the locale
   prefix changes, while same-locale links keep normal client transitions.
   This guarantees every JSON-LD-bearing page is always a fresh SSR paint
   when the locale changes.

**Rationale**: A hard navigation on locale switch is explicitly sanctioned by
the master plan (`## Locale switching`, `## Known script-tag overlay
investigation`) as the interim, verifiable fix, to be kept until upstream
Next/React confirms safe soft-navigation reconciliation of native `<script>`
elements. It is also the cheapest fix to verify with an automated repetition
test (EN→AR→EN, assert zero console/overlay events), and it does not touch
the JSON-LD emission code that already conforms to framework guidance.

**Alternatives considered**:
- *Move JSON-LD into `<head>` via `generateMetadata` only* — rejected;
  Product/Article/Breadcrumb schema needs entity-scoped data not always
  cleanly expressible through the metadata API, and the current working
  approach already matches Next's own documented pattern.
- *Wrap JSON-LD in a client component with a stable `key`* — rejected; adds
  client JS to a payload that should stay server-only per the constitution's
  Server/Client boundary guidance and the master plan's "never place JSON-LD
  inside Motion/AnimatePresence/a client component that conditionally
  remounts it" rule.
- *Suppress the warning* — rejected; masking a reconciliation warning during
  locale switching does not verify the underlying remount is actually safe.

**Verification approach**: a Playwright repetition test that navigates
EN → AR → EN across homepage, catalog, coffee detail, origin, article,
account, and Admin, asserting zero `console.error`, `pageerror`, hydration
warning, or Dev Overlay appearance, and confirming path/query/theme/logo are
preserved across each hop.

## 2. Supabase client/server/service-role boundary model

**Decision**: Four explicit, non-interchangeable client constructions, exactly
as specified in the master plan's Security Plan:

| Client | Uses | Never |
|---|---|---|
| Browser client | base `NEXT_PUBLIC_SUPABASE_URL` + publishable key | service-role key, cookies write |
| Server (user) client | same public values + request cookies | bypassing RLS |
| Proxy session-refresh client | same public values only | service-role key, authorization decisions |
| Service/Admin client | base URL + `SUPABASE_SERVICE_ROLE_KEY`, server-only module | browser import, `NEXT_PUBLIC_` prefix, use for ordinary Admin reads |

**Rationale**: this is already partially implemented (`src/lib/supabase/browser.ts`,
`server.ts`, `config.ts`) and is a direct, non-negotiable expression of
Constitution Principle IV (authoritative role source) and the security plan's
explicit table. The service client is reserved for the one approved
defense-in-depth use — synchronizing a Supabase Auth ban when Admin blocks a
customer — and must never replace the RLS-respecting user client for ordinary
Admin data reads/writes.

**Alternatives considered**: a single client with role-switching parameters —
rejected; it re-introduces exactly the "does this request bypass RLS?"
ambiguity the constitution and master plan both forbid.

## 3. Realtime subscription ownership and scoping

**Decision**: Realtime subscriptions are opt-in, per-page, and keyed to what
the current authenticated, authorized viewer is already allowed to read
through RLS — never a blanket table subscription. Confirmed current publication
membership (from the live snapshot) includes catalog/taxonomy/editorial/CMS
tables, `favorites`, `inquiries`, `inquiry_status_history`, and `profiles`;
it explicitly **excludes** `offer_price_tiers` and `audit_logs`.

Concrete scoping rules:
- **Account/Admin inquiry views** may subscribe to `inquiries` /
  `inquiry_status_history` filtered to `user_id = auth.uid()` (customer) or
  unfiltered only for an authenticated Admin session (Admin already has full
  RLS read access to these tables).
- **Protected pricing** is never delivered over Realtime — it is not in the
  publication and must continue to be fetched through the dedicated
  server-only price query, matching FR-030/FR-031.
- **Audit log** is never subscribed to from the client — Admin views it only
  via a page-load/paginated server read.

**Rationale**: Realtime publication membership is a transport convenience,
not an authorization boundary (Constitution Principle XVIII). Because RLS
already governs row visibility, a scoped subscription is safe by
construction as long as the subscribing query includes the same predicate a
server read would use.

**Alternatives considered**: subscribing to full-table channels and filtering
client-side — rejected; this would transiently deliver rows the current
viewer should not see even if the UI later hides them, which is an
information-boundary violation independent of what the UI renders.

## 4. Catalog database-level filtering, sorting, and pagination

**Decision**: Introduce one server-side query module (no new database
migration) that composes a single filtered, paginated query against the
existing `coffees`/`coffee_offers`/taxonomy tables using PostgREST's existing
filter/`range()`/`count` capabilities — not a full-table fetch followed by
in-memory filtering (the current `src/lib/data/catalog.ts` behavior), and not
a net-new bespoke SQL view/RPC unless a later `EXPLAIN`-backed measurement
proves the composed query insufficient. Region options are constrained to the
selected origin at the query layer, not only in the UI.

**Rationale**: the master plan treats this as REQUIRED (`## Catalog Plan —
Query contract`) but explicitly gates any new RPC/index behind "approved...
only after `EXPLAIN ANALYZE`" evidence (Security Plan / Performance Plan /
Phase 6). Since the live database is currently near-empty, there is no
evidence yet to justify a bespoke RPC; starting with a composed PostgREST
query keeps the change additive-free and reversible, and the plan schedules
an evidence-gated RPC/index upgrade only if Phase 6 measurement shows the
composed query is insufficient at real data volume.

**Alternatives considered**: a dedicated Postgres RPC/view now — deferred,
not rejected outright; revisit in Phase 6 once representative fixtures exist
and a query plan can be measured, per the master plan's explicit
evidence-first rule.

## 5. Admin block/unblock synchronization with Supabase Auth ban

**Decision**: `admin_set_user_blocked()` (already live in the database) is
the sole write path for the durable `profiles.is_blocked` state and is
authoritative and immediate. A server-only Admin action additionally calls
the Supabase Auth Admin API (via the service-role client) to apply/remove an
authentication-level ban as defense-in-depth. If the Auth-ban call fails, the
durable block still holds (every RLS-backed read/write already denies a
blocked profile), and the failure is surfaced to the acting Admin as a
partial-success, retryable operational error — never as a silent success or
a rollback of the durable block.

**Rationale**: this is exactly the two-layer model the master plan
recommends and the user's approved-decisions list confirms
("Supabase Auth ban is defense-in-depth and must be synchronized by secure
server-side Admin logic"). It also matches Constitution Principle VII
(blocked users denied at every boundary) without making the less-reliable
external Auth Admin API a single point of failure for the higher-assurance
database-level block.

**Alternatives considered**: Auth ban as the sole mechanism — rejected; it
requires the service-role key on every check and does not satisfy
"blocked at RLS" for direct data-layer access. Database flag only, no Auth
ban — rejected by the user's explicit approved-decision list.

## 6. Admin CRUD/Lead Inbox implementation surface

**Decision**: Keep the existing generic `[module]`/`admin-operations.ts`
machinery as the underlying mutation layer (it already implements
allow-listed fields, server-side `requireAdmin()` re-checks, and Zod
validation per the prior completion pass), and build the **Lead Inbox** as a
feature-specific read/detail/action surface on top of it rather than
replacing the generic list view wholesale. Split `admin-operations.ts` by
domain only after characterization tests exist for the functions being
moved, per the master plan's explicit anti-regression rule for the
"~1,000-line mixed domains" file.

**Rationale**: the master plan calls for "REPLACE only where the current
abstraction blocks product behavior" and names Lead Inbox and Users as the
two call-outs — not the whole Admin surface. Since the previous completion
pass already delivered real, gated CRUD for 16 modules, a wholesale rewrite
would regress working, audited functionality for no product benefit.

**Alternatives considered**: a full `src/features/admin/**` rewrite in one
pass — rejected as disproportionate risk; scheduled instead as an
incremental, per-module migration in Phase 10 once Lead Inbox and Users are
proven.

## 7. Toast / domain-error contract

**Decision**: Adopt the master plan's `ActionResult<T>` discriminated union
verbatim (`ok`, `code`, `messageKey`, optional `fieldErrors`, optional
`conflict.requestCode`) as the single result shape for every server action
in the codebase, replacing the current ad hoc `{ok,message}`-style results
where they exist. Domain codes are exactly: `VALIDATION`, `AUTH_REQUIRED`,
`VERIFICATION_REQUIRED`, `ADMIN_PORTAL_REQUIRED`, `FORBIDDEN`, `BLOCKED`,
`NOT_FOUND`, `DUPLICATE_SAMPLE`, `CONFLICT`, `RATE_LIMITED`,
`STORAGE_INVALID`, `STORAGE_FAILED`, `CONFIGURATION`, `UNEXPECTED`.

**Rationale**: a single typed contract is what makes "no raw backend error
ever reaches the user" (Constitution Principle XII) mechanically checkable —
every action returns a `messageKey` the UI localizes, never a raw string from
Postgres/Supabase.

**Alternatives considered**: per-feature bespoke result types — rejected;
this is exactly the "not every action uses one domain code/translation
contract" gap the master plan flags as High severity.

## 8. Visual regression tooling

**Decision**: Use Playwright's built-in `toHaveScreenshot()` baseline
comparison rather than introducing a new dependency or third-party visual
diffing service.

**Rationale**: Playwright is already the only E2E tool in the repository
(Constitution Principle XIX — npm-only, and the general preference against
unjustified complexity). Playwright's screenshot assertions cover the exact
matrix the master plan specifies (screen × theme × locale × viewport) without
a new service, new secret, or new CI dependency.

**Alternatives considered**: a hosted visual-regression SaaS — rejected,
introduces an external dependency and credential with no evidence it is
needed at this project's scale.

## 9. Sucafina-inspired interaction implementation boundary

**Decision**: Nothing beyond what `docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md`'s
"Sucafina Live UX Study" table already approved (interaction *patterns* —
sticky header behavior, accessible mega-menu semantics, filter drawer
mechanics, card hover restraint) is in scope. No further comparative
research, screenshots, or content inspection of Sucafina is performed by
this plan or by any later phase; each phase's UI tasks cite the specific
row of that table they implement, and copy/imagery is always Hills-original.

**Rationale**: directly required by the user's "do NOT repeat the Sucafina
study" instruction and Constitution Principle XVII.

## 10. Technical Context resolution (no NEEDS CLARIFICATION remain)

| Field | Resolution |
|---|---|
| Language/Version | TypeScript (strict), Next.js 16.3.3, React 19.2.8 |
| Primary Dependencies | `@supabase/ssr`, `@supabase/supabase-js`, `next-intl` 4.14, Motion, Sonner, Tailwind CSS 4, Zod, React Hook Form |
| Storage | Supabase Postgres (current live schema, see `data-model.md`) + Supabase Storage (`hills-public` public bucket, `avatars` private bucket) |
| Testing | Vitest (unit/behavioral), Playwright (E2E + accessibility via `@axe-core/playwright` + visual via `toHaveScreenshot`) |
| Target Platform | Server-rendered web application (Next.js App Router), deployed as a standard Node/Edge-capable Next.js server |
| Project Type | Web application (single Next.js repository; no separate frontend/backend split) |
| Performance Goals | Core Web Vitals "good" thresholds (LCP, INP, CLS) on public pages; bounded, paginated catalog queries independent of total catalog size |
| Constraints | No protected price in any public payload/cache; npm-only tooling; no new database migrations; WCAG 2.2 AA on core journeys |
| Scale/Scope | Current live data is near-empty (2 profiles, 2 warehouses, 18 site pages); design and tests must not assume production-scale data but must not silently fail at it either |
