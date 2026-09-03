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

---

# Pre-Phase 12 Owner Alignment Addendum: Research

Everything below is scoped to the addendum in `spec.md` (FR-069–FR-083). It
does not revisit or reopen any decision above. All empirical claims were
re-verified live against the current database during this planning pass
(2026-09-03), not assumed from `docs/HILLS_SUPABASE_CURRENT_STATE.md`, which
is now stale on this one table — see finding 11 below.

## 11. The already-applied delta, empirically re-verified

`docs/HILLS_SUPABASE_CURRENT_STATE.md` still shows the pre-delta definition
of `inquiries_product_needs_user`
(`CHECK (type = 'GENERAL' OR user_id IS NOT NULL)`), because that snapshot
predates the owner's manual change. Rather than plan against a stale
document, the live database was probed directly with disposable, immediately
deleted rows:

| Probe | Result |
|---|---|
| Insert `SAMPLE_REQUEST`, `user_id = NULL`, real `coffee_id` | **Accepted** |
| Immediately repeat the same normalized email + coffee, still active | **Rejected**, `23505` on `uq_inquiries_active_sample_anon_email_coffee` |
| Insert `PRODUCT`, `user_id = NULL` | **Rejected**, `23514` on `inquiries_product_needs_user` |
| Insert `GENERAL`, `user_id = NULL`, `coffee_id = NULL` | **Accepted** (pre-existing allowance, unchanged) |

**Decision**: treat the owner's description of the delta as confirmed fact,
not as something planning needs to independently re-derive. The exact
constraint name (`inquiries_product_needs_user`) and the exact new index
name (`uq_inquiries_active_sample_anon_email_coffee`) are now known with
certainty and are what FR-083's migration file must name.

**Rationale**: Constitution Principle XVI (verify, don't assume) and this
project's standing practice of never trusting a documentation snapshot over
the live system. The probe rows were tagged `[QA-PLAN-PROBE]`, used only the
existing Phase 6 QA catalog coffee as an FK reference (never modified), and
were deleted immediately after the assertions ran — no residue.

**Alternatives considered**: trusting the owner's prose as-is without
verification (rejected — this session has repeatedly found stale
documentation elsewhere in this same project); requesting raw SQL access to
read `pg_get_constraintdef` (rejected — no DDL-capable credential exists for
this agent, confirmed by `P1-T04`'s own header note, and the empirical
insert/probe approach answers the same question without needing one).

## 12. Public write boundary: a new `SECURITY DEFINER` function, not a new RLS policy

This function is planned as its own migration file — **Migration B** — kept
entirely separate from the reconciliation migration in finding #11/#15
(**Migration A**). The two have different content and different approval
statuses (Migration A: already owner-approved and live; Migration B: new
schema, needs approval before being applied) and must never be merged into
one file. See `plan.md` sections A/B for the full content requirements.

**Decision**: add exactly one new Postgres function,
`public.submit_public_inquiry(...)`, `SECURITY DEFINER`, owned by `postgres`
— the same ownership/privilege pattern already used twice in this codebase
(`admin_list_users()`, `hydrate_inquiry_context()`). `GRANT EXECUTE` to
`anon` only; `REVOKE ALL` from `PUBLIC` and from `authenticated` (mirroring
`P1-T02`'s exact `REVOKE`/`GRANT` shape). No new RLS policy is added to
`public.inquiries`.

**Why this satisfies the "safest minimal boundary" requirement, point by
point**:

- **Allow-lists writable fields**: the function's own parameter list *is*
  the allow-list — it accepts only `full_name`, `email`, `phone`, `address`,
  `country_code`, `offer_id` (nullable), `subject`, `message`. It does not
  accept `user_id`, `status`, `type` as a free string, or any snapshot
  column.
- **Forces `type` server-side**: the function itself decides `GENERAL` (no
  `offer_id`) vs `SAMPLE_REQUEST` (`offer_id` supplied) — the caller never
  passes a `type` value.
- **Forces initial `status = 'NEW'`**: hardcoded in the function body; no
  parameter can override it.
- **Prevents anonymous control of `user_id`**: the function never accepts a
  `user_id` parameter and never sets one — it inserts with `user_id`
  omitted, which the existing `hills_hydrate_inquiry_context` `BEFORE
  INSERT` trigger already leaves untouched when `auth.uid()` is null (see
  finding 13). The row is created with `user_id IS NULL` by construction,
  not by trusting client input.
- **Prevents arbitrary snapshot/private fields**: `coffee_name_snapshot`,
  `offer_reference_snapshot`, `warehouse_code_snapshot` are never parameters;
  they continue to be derived exclusively by the existing trigger, exactly as
  they are for the authenticated path today.
- **Validates coffee context for sample requests**: the function requires a
  non-null `offer_id` when it is building a `SAMPLE_REQUEST`, and the
  existing trigger's `raise exception 'Invalid offer'` / `'Offer does not
  belong to selected coffee'` guards fire on the INSERT exactly as they do
  today — this addendum does not re-implement that validation, it inherits
  it.
- **Prevents protected-price leakage**: the function only ever touches
  `public.inquiries`; it has no reason to read `offer_price_tiers` and does
  not, so there is no path by which a price could enter its response.
- **Keeps the service-role credential server-only**: unaffected either way —
  this function is called through the ordinary anon-key server client
  (`createSupabaseServerClient()`), the same helper the authenticated
  inquiry actions already use; no service-role key is introduced anywhere in
  this addendum.

**Why not an anon RLS INSERT policy instead**: a policy broad enough to let
`anon` insert into `inquiries` directly would need its `WITH CHECK` clause to
re-encode every one of the constraints above in policy-expression form (no
`user_id`, forced `status`, type-shape rules), duplicating logic the function
approach gets once, in one place, in a language (`plpgsql`) suited to it. It
would also widen the table's attack surface permanently rather than through
one reviewable, revocable function grant. This is exactly the case the
addendum's own instruction anticipated: "Do NOT plan a broad anonymous INSERT
policy unless repository evidence proves it is necessary" — the evidence
(two existing precedents, and a clean specification of every required
constraint at the function-parameter level) shows it is not necessary.

**Alternatives considered**: a broad `anon` INSERT RLS policy (rejected,
above); performing the INSERT from the Next.js server action using the
service-role key (rejected — this project's standing rule keeps the
service-role key server-only *and* out of any general-purpose write path;
routing every anonymous write through one narrow, auditable function is
strictly safer than handing a broad-privilege key to application code that
also handles user input).

## 13. `hydrate_inquiry_context()` needs no change

Its live definition was read directly from `docs/HILLS_SUPABASE_CURRENT_STATE.md`
(the function itself, unlike the constraint above, is not something the
owner's delta touched, so the doc is current here):

```sql
if auth.uid() is not null then
    new.user_id = auth.uid();
end if;
```

It only ever *sets* `user_id` when `auth.uid()` is non-null; for an
anonymous caller (`auth.uid()` is null) it simply does not touch the column,
leaving whatever the INSERT already supplied — which, per finding 12, is
nothing. **Decision**: this trigger requires zero changes. The new function
in finding 12 relies on this behavior rather than duplicating it.

## 14. Duplicate-identity handling stays inside the existing error-mapping pattern

`src/actions/inquiries.ts` already catches a `23505` on
`uq_inquiries_active_sample_user_coffee` and maps it to the `DUPLICATE_SAMPLE`
domain error with the winning row's `request_code` looked up and returned —
never the raw constraint name. **Decision**: the new public server action
does the identical thing for `23505` on
`uq_inquiries_active_sample_anon_email_coffee`. No new domain error code is
needed; `DUPLICATE_SAMPLE` (already in the closed `DomainErrorCode` set) and
`RATE_LIMITED` (already in the same set, for finding 16) both already exist.

## 15. Migration idempotency for two starting states

**Decision**: the reconciliation migration (FR-083) is written as
`ALTER TABLE ... DROP CONSTRAINT IF EXISTS inquiries_product_needs_user`
immediately followed by `ADD CONSTRAINT inquiries_product_needs_user CHECK
(...)` with the desired final definition, and
`CREATE UNIQUE INDEX IF NOT EXISTS uq_inquiries_active_sample_anon_email_coffee
ON ...`. Both forms are naturally idempotent: on the current database (delta
already live) the constraint drop-and-recreate is a same-definition no-op and
the index creation is skipped by `IF NOT EXISTS`; on a clean database
applying the full migration sequence from scratch, the same two statements
produce the delta for the first time. One file, one script, both starting
states, no conditional branching needed in the SQL itself.

**Rationale**: this is the same idiom `P1-T02` already uses
(`DROP FUNCTION IF EXISTS` before `CREATE FUNCTION`) for exactly this
"may or may not already exist" situation.

**Alternatives considered**: a guarded `DO $$ ... IF NOT EXISTS (SELECT ...
pg_constraint ...) THEN ... END IF; $$` block (rejected — more code, no
behavioral difference from the drop-and-recreate idiom the repository
already uses, and harder to read against the existing style).

## 16. Anti-abuse persistence: durable where it is free, best-effort where a new table would be needed

The clarified decision is honeypot + server-side per-IP/per-email rate
limiting, no third-party CAPTCHA (`spec.md` Clarifications). Two different
mechanisms are needed because the two keys have different available storage:

- **Per-normalized-email limiting is free**: `public.inquiries` already has
  `email` and `created_at` on every row. A `COUNT(*)` of recent rows for the
  same `lower(btrim(email))` within a short rolling window, evaluated inside
  `submit_public_inquiry()` itself before the insert, needs **zero new
  schema** — it is a read against columns that already exist for a purpose
  (Admin Lead Inbox search) unrelated to rate limiting.
- **Per-IP limiting has no existing column to key off**: `inquiries` stores
  no client IP anywhere today, and adding one would be a schema change to an
  existing table that Admin tooling already reads — a bigger, more
  broadly-scoped change than this addendum's own instruction to avoid new
  columns where avoidable.

**Decision**: implement per-IP limiting as a best-effort, in-process,
module-scoped sliding-window counter in the Next.js server action layer
(reading the proxy's forwarded-for header via `headers()`, the same API
already available to every server action in this codebase), with the
durable per-email check inside the database function as the backstop. This
keeps the addendum's anti-abuse layer at **zero new tables and zero new
columns**, matching the same minimalism the owner's reconciliation-migration
constraints already established for the rest of this addendum.

**Explicitly flagged, not silently decided**: a per-instance in-process
counter does not share state across multiple server instances/cold starts if
this application is ever deployed on a multi-instance or serverless
platform; it is a real but bounded weakness, not a false guarantee, and the
plan's final report calls it out as a risk rather than presenting it as
equivalent to a durable store. A durable, cross-instance IP-based limiter
would need a genuinely new table and its own explicit owner approval under
Constitution Principle XV — that table is deliberately **not** proposed here
because it was not part of what this addendum was asked to plan, and adding
it silently would be exactly the "silent or inferred migration" Principle XV
forbids.

**Alternatives considered**: Upstash/Redis-backed rate limiting (rejected —
introduces a new paid third-party dependency of the same kind the owner
already declined for CAPTCHA, and nothing in this codebase or its
`package.json` uses one today); a new dedicated rate-limit table (rejected
for this pass — see "explicitly flagged" above; remains available as a
follow-up if the owner wants durable per-IP limiting badly enough to approve
new schema for it).

## 17. Confirmed: zero anonymous-callable RPC exists today

The PostgREST OpenAPI document (fetched with the anon key) lists zero
`/rpc/*` paths. **Decision**: `submit_public_inquiry` is confirmed to be a
genuinely new surface, not a rename or extension of something already
anon-reachable — nothing already-built is being duplicated (per the user's
"do not duplicate already-implemented functionality" instruction).

## 18. Where the anonymous "Request a sample" control attaches

`InquiryPanel` (`src/components/inquiries/inquiry-panel.tsx`) already branches
on `signedIn`: when false, it renders two links to `/sign-in` — one for
"Send inquiry" (PRODUCT), one for "Request sample." **Decision**: leave the
PRODUCT link exactly as-is (PRODUCT inquiries remain authenticated-only —
FR-036 and the addendum's own decision 7 are unchanged); replace only the
sample link's anonymous branch with a real, working public sample-request
trigger that opens a new dialog built the same way the existing authenticated
one is (`ModalDialog`, so focus trap/restore/Escape/scroll-lock are inherited
rather than re-implemented). The authenticated branch of `InquiryPanel` is
untouched.

## 19. Route for the General RFQ: correction — `/request-a-quote` is canonical, no new route

`/contact` was checked and is presentational only (org details, warehouses,
an image) — it has no lead-capture form to extend, so it is not a candidate
for reuse. A first pass of this research proposed a new `/request-an-offer`
route on that basis. **This was corrected by the owner**: the SEO
architecture already defines `/request-a-quote/` as the canonical RFQ
route, and no parallel route may exist. "Request an Offer" is CTA/copy
wording only, and it links to `/request-a-quote`.

`/request-a-quote` (`src/app/[locale]/(site)/request-a-quote/page.tsx`)
already exists — it is currently `requireVerifiedUser()`-gated and lets a
signed-in customer pick a specific offer to raise a `PRODUCT` inquiry
through `RequestQuoteForm`/`createProductInquiry`. Today, an anonymous
visitor to this page sees only a "sign in to continue" prompt.

**Decision**: extend this page with a third branch — rendered only when
there is no `viewer` — that swaps today's dead-end sign-in prompt for a
real, working, coffee-agnostic `GENERAL` RFQ form calling the new
`submitPublicRfq`. The existing `viewer`/`viewer && offers.length` branches,
`RequestQuoteForm`, and `createProductInquiry` are untouched. Two follow-on
facts: the page's current `robots: { index: false, follow: true }` override
was correct while the page was authenticated-only and must be removed (or
flipped to indexable) now that it has a genuine anonymous path, per FR-061;
and it must be added to `src/app/sitemap.ts`'s `staticPaths`, where it is
not present today. It is already in `src/lib/auth/redirects.ts`'s
`knownRoots`, so no change is needed there.

**Rationale**: matches the owner's explicit SEO architecture rather than a
plan-invented URL, and reuses one page's existing infrastructure (metadata,
CMS-override check, offer list fetch) instead of duplicating it — directly
satisfying "do not duplicate already-implemented functionality" in the
opposite direction from the first pass's own reasoning (the first pass used
that same instruction to justify *avoiding* reuse of a page it judged too
different in shape; the owner's correction says the SEO/URL identity of the
page outweighs that shape difference, and the shape difference is handled
by branching, not by forking the route).

## 20. `inquiryType`/`inquiryStatus` Admin display already anticipates `GENERAL`

`messages/en.json`'s `inquiryType.GENERAL` is already `"General enquiry"`
and `lead-inbox.ts`'s type filter vocabulary already includes `"GENERAL"` —
both predate this addendum. **Decision**: FR-080 (Admin Lead Inbox needs no
code change) is confirmed rather than assumed; the display path was already
built for a type that simply had no anonymous-accessible way to be created
until now.
