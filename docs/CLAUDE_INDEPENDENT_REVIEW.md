# Hills Coffee — Independent Read-Only Review (Post-DB0)

**Reviewer:** Independent review pass, read-only, no application/DB changes made.
**Date:** 2026-08-31
**Baseline reviewed:** working tree at `main` (starting commit `ee40259`), against restored authoritative support files and `./docs/HILLS_IMPLEMENTATION_EXECUTION_REPORT.md`.

---

## 1. Final Verdict

## FAIL

No security BLOCKER survives from the prior review — the admin-role source, the preview-auth bypass, the price-tier grant/tautology defect, and the anonymous-write risk are all genuinely fixed. The application is **not** unsafe to expose publicly in its current anonymous-only state.

It fails as a _final_ implementation, not as a security posture, because the Admin/CMS surface — explicitly marked **REQUIRED** in the approved plan (§16, §22, §32) — is largely unbuilt: 8 of 22 required modules are `MISSING` and 8 more are `DISPLAY ONLY` (read-only, no create/update/delete). One required customer-facing flow, `SAMPLE_REQUEST` inquiries, has zero code path despite full DB/RLS support. The execution report's prose ("real-data dashboard and modules for products, offers, pricing, inquiries, origins, taxonomy, users, content, settings, and audit data") overstates what exists — most of those "modules" are read-only lists, not CRUD surfaces.

---

## 2. Support Artifact Verification

| Artifact                                        | Status  | Evidence                                                                           |
| ----------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `Supabase Database Snapshot - Post DB0.csv`     | PRESENT | 653,686 bytes, 2,311 lines, modified 2026-08-31 00:50                              |
| `HillsCoffee_SEO_Development_Specification.pdf` | PRESENT | 520,841 bytes, modified 2026-08-29 13:09, extracts cleanly via `pdftotext -layout` |
| `HILLS Brand GuidLines copy.pdf`                | PRESENT | 31,952,046 bytes, modified 2026-08-29 12:59                                        |

CSV `00_SUMMARY` row: `public_enums:7, public_tables:47, public_columns:387, public_indexes:105, public_triggers:47, storage_buckets:1, public_functions:43, public_foreign_keys:69, public_rls_policies:98, storage_rls_policies:4`. Cross-checked, not a stale label: a raw row-count of `11_RLS_POLICY` section entries = 102 = 98 public + 4 storage, and `grep` of `03_TABLE` rows under `public.` = 47. **Confirmed genuine, not a rounded/stale figure.**

All three restored files are the correct, expected artifacts. The previous review's blocking complaint ("Post-DB0 snapshot and SEO spec are missing") is resolved — the files are present and were read in full for this pass.

---

## 3. Verified Implementation

Confirmed working as claimed, with direct evidence:

- **Admin role source of truth**: `src/lib/auth/session.ts` reads `profiles.role` via a real DB query; zero repo-wide hits for `app_metadata` or `HILLS_USER_PREVIEW`/`HILLS_ADMIN_PREVIEW`. Admin route guard (`src/app/[locale]/admin/layout.tsx`) is a server component that calls `requireAdmin()` and redirects before rendering children.
- **Price boundary**: `src/lib/data/pricing.ts` is the sole file in `src/` that touches `offer_price_tiers`; every function gates on `requireVerifiedUser()`/`requireAdmin()`; a source-text test enforces `catalog.ts` never contains the string `offer_price_tiers`.
- **Price never in JSON-LD**: verified zero `Offer`/price nodes across all three JSON-LD emitters (homepage Organization/WebSite, offer-list ItemList, Product detail).
- **Post-DB0 schema is real**: `site_pages`, `site_page_translations`, `site_page_sections`, `site_page_section_translations`, `site_settings` (single-row typed, not key/value), `site_settings_translations`, `warehouse_translations`, `coffees.is_featured`/`featured_sort_order`, `origins.is_featured`/`featured_sort_order` all present and correctly shaped per the approved plan.
- **Inquiry RLS tautology (old GAP-10) is fixed**: `hills_inquiries_insert_verified` now correlates `o.coffee_id = inquiries.coffee_id` (previously `o.coffee_id = o.coffee_id`).
- **Storage hardening**: bucket `hills-public` restricted to `image/jpeg,png,webp,avif`, 10 MB limit.
- **CMS content injection safety**: markdown rendered through `react-markdown` + `rehypeSanitize` + `skipHtml`; the only `dangerouslySetInnerHTML` uses are `JSON.stringify` of server-built JSON-LD with `<` escaped — not a raw-HTML admin field.
- **Password recovery / verification**: both `forgotPasswordAction` and `resendVerificationAction` return an identical response regardless of whether the email exists (no enumeration leak); `updatePasswordAction` requires an authenticated session from the PKCE callback rather than trusting a client token.
- **No service-role key usage**: `SUPABASE_SERVICE_ROLE_KEY` appears only as a name in `.env.example`; never read by application code.
- **Route architecture matches spec**: unprefixed English + `/ar/...` Arabic via `localePrefix: "as-needed"` and an explicit `proxy.ts` rewrite; all spec-required route families exist (`green-coffee-offer-list`, `coffee-origins`, `knowledge`, commercial `[page]`, `request-a-quote`).
- **Legacy redirects and soft-404 handling**: one-hop 301/308s for `/products/`, `/full-offer-list/`, `/spot-offerings/`, `/origins/`, `/en/...`; unpublished/unknown pages hit real `notFound()`, not a fake-200 soft-404.

---

## 4. Capability Matrix — Admin / CMS

Single generic `[module]/page.tsx` router (247 lines) driven by `getAdminModuleRows()` plus 9 server actions in `src/actions/admin.ts` (280 lines) — **not** 22 independent modules as the execution report's prose implies.

| Module                      | Status            | list/read                                                                  | create                     | update                | delete                 | EN/AR     | validation             | server-side authz | error+toast    | responsive                    |
| --------------------------- | ----------------- | -------------------------------------------------------------------------- | -------------------------- | --------------------- | ---------------------- | --------- | ---------------------- | ----------------- | -------------- | ----------------------------- |
| Coffees                     | DISPLAY ONLY      | ✅                                                                         | ❌                         | ❌                    | ❌                     | read-only | n/a                    | n/a               | ❌             | ok                            |
| Offers                      | PARTIAL           | ✅                                                                         | ❌                         | ✅ status only        | ❌                     | n/a       | enum only              | ✅                | ❌ silent fail | ok                            |
| Price Tiers                 | FULLY IMPLEMENTED | ✅                                                                         | ✅                         | ✅                    | ✅                     | n/a       | Zod + ladder invariant | ✅                | ❌ no toast    | offer picked by raw UUID text |
| Origins                     | DISPLAY ONLY      | ✅                                                                         | ❌                         | ❌                    | ❌                     | read-only | n/a                    | n/a               | ❌             | ok                            |
| Regions                     | **MISSING**       | ❌                                                                         | ❌                         | ❌                    | ❌                     | ❌        | ❌                     | ❌                | ❌             | n/a                           |
| Coffee Types                | DISPLAY ONLY      | ✅ (taxonomy list)                                                         | ❌                         | ❌                    | ❌                     | ❌        | n/a                    | n/a               | ❌             | ok                            |
| Processing Methods          | DISPLAY ONLY      | ✅ (taxonomy list)                                                         | ❌                         | ❌                    | ❌                     | ❌        | n/a                    | n/a               | ❌             | ok                            |
| Varieties                   | **MISSING**       | ❌ `coffee_varieties` never queried                                        | ❌                         | ❌                    | ❌                     | ❌        | ❌                     | ❌                | ❌             | n/a                           |
| Certifications              | DISPLAY ONLY      | ✅ (taxonomy list)                                                         | ❌                         | ❌                    | ❌                     | ❌        | n/a                    | n/a               | ❌             | ok                            |
| Tags                        | DISPLAY ONLY      | ✅ (taxonomy list)                                                         | ❌                         | ❌                    | ❌                     | ❌        | n/a                    | n/a               | ❌             | ok                            |
| Sensory Notes               | DISPLAY ONLY      | ✅ (taxonomy list)                                                         | ❌                         | ❌                    | ❌                     | ❌        | n/a                    | n/a               | ❌             | ok                            |
| Packaging                   | DISPLAY ONLY      | ✅ (taxonomy list)                                                         | ❌                         | ❌                    | ❌                     | ❌        | n/a                    | n/a               | ❌             | ok                            |
| Warehouses                  | **MISSING**       | ❌ not queried anywhere in admin                                           | ❌                         | ❌                    | ❌                     | ❌        | ❌                     | ❌                | ❌             | n/a                           |
| Media                       | **MISSING**       | ❌ no admin route reads `media`                                            | ❌                         | ❌                    | ❌                     | ❌        | ❌                     | ❌                | ❌             | n/a                           |
| Users                       | DISPLAY ONLY      | ✅ via `admin_list_users()` RPC                                            | ❌                         | ❌ no role/ban change | ❌                     | n/a       | n/a                    | ✅ (DB-enforced)  | ❌             | ok                            |
| Inquiries                   | PARTIAL           | ✅ (latest 100)                                                            | ❌                         | ✅ status only        | ❌                     | n/a       | enum only              | ✅                | ❌ silent fail | ok                            |
| Articles                    | **MISSING**       | ❌ no admin route                                                          | ❌                         | ❌                    | ❌                     | ❌        | ❌                     | ❌                | ❌             | n/a                           |
| Article Categories          | **MISSING**       | ❌ no admin route                                                          | ❌                         | ❌                    | ❌                     | ❌        | ❌                     | ❌                | ❌             | n/a                           |
| Homepage CMS                | PARTIAL           | ✅ (`site_pages` HOME)                                                     | ✅ generic page create     | ✅ translation+status | ❌                     | ✅        | Zod                    | ✅                | ❌             | ok                            |
| About CMS                   | PARTIAL           | ✅                                                                         | ✅                         | ✅                    | ❌                     | ✅        | Zod                    | ✅                | ❌             | ok                            |
| Commercial CMS Pages        | PARTIAL           | ✅; sections create+update only, no reorder-drag                           | ✅                         | ✅                    | ❌ page/section delete | ✅        | Zod, key regex         | ✅                | ❌             | ok                            |
| Site / Organization Content | DISPLAY ONLY      | ✅ `site_settings` row shown                                               | ❌ no update action exists | ❌                    | ❌                     | ❌        | n/a                    | n/a               | ❌             | ok                            |
| Audit Logs                  | DISPLAY ONLY      | ✅ top-8 widget only; no dedicated module, filter, pagination, or nav link | ❌                         | n/a                   | n/a                    | n/a       | n/a                    | n/a (read-only)   | n/a            | n/a                           |

**Systemic findings across the whole surface:**

- Authorization is genuinely sound everywhere it exists — every mutating admin action independently re-checks `requireAdmin()` server-side; the old client-trust risk is gone.
- **Zero Sonner/toast usage anywhere** under `src/app/[locale]/admin/**` or `src/actions/admin.ts`. All mutations are plain `<form action={serverAction}>` + `revalidatePath`; a `safeParse` failure returns silently — the page reloads with no error shown to the admin.
- `admin-nav.tsx` links only 9 destinations. Warehouses, Media, Articles, Article Categories, Regions, Varieties, and Audit Logs have **no navigation entry at all** — they are unreachable, not merely read-only.
- The flattened "taxonomy" list spans 6 tables but excludes `coffee_varieties` even from the read-only view.
- No delete/archive action exists for `site_pages` or `site_page_sections` once created.

---

## 5. Findings

### BLOCKER

_(none remaining — see below for the two historical blockers, both resolved)_

- **[RESOLVED] B-03 — Admin role read from `app_metadata` instead of `profiles.role`.**
  Requirement: admin authorization must use DB-truth `profiles.role`.
  Actual: `src/lib/auth/session.ts:26-41` queries `profiles` directly and returns `role: profile.role`; `requireAdmin()` (line 52-55) checks `viewer.role === "ADMIN"`.
  Evidence: `src/lib/auth/session.ts:26-55`; repo-wide `grep -rn "app_metadata" src/` → 0 hits.
  Impact if unresolved: privilege escalation via client-controllable JWT metadata. **Now closed.**

- **[RESOLVED] B-04 — `HILLS_USER_PREVIEW`/`HILLS_ADMIN_PREVIEW` env-based auth bypass.**
  Evidence: `grep -rn "PREVIEW" src/` → 0 hits.

### HIGH

1. **[CONFIRMED — new finding] No code path ever creates a `SAMPLE_REQUEST` inquiry.**
   Requirement (approved plan): PRODUCT and SAMPLE_REQUEST inquiries both require authenticated + verified-email users; both are first-class flows.
   Actual: `inquiry_type` enum and `hills_inquiries_insert_verified` RLS policy both support `SAMPLE_REQUEST` at the DB layer, but `src/actions/inquiries.ts` contains only `createProductInquiry`, which hardcodes `type: "PRODUCT"`. `grep -rn "SAMPLE_REQUEST" src/` matches only the generated types file. `src/app/[locale]/(site)/request-a-quote/page.tsx` also calls `createProductInquiry`.
   Files: `src/actions/inquiries.ts`, `src/app/[locale]/(site)/request-a-quote/page.tsx`, `src/components/inquiries/request-quote-form.tsx`.
   Impact: a required customer-facing flow does not exist; any "sample request" UI is either absent or silently mislabels itself as a product inquiry.
   Fix: add `createSampleRequestInquiry` (or a `type` parameter on the existing action) with the same `requireVerifiedUser()` gate, wire a distinct entry point/CTA, and add coverage to the DB-verification test.

2. **Admin CRUD for Warehouses is MISSING.** Requirement: plan §21.6 requires a Warehouses admin module (create/update EN/AR translations added in DB-0). Actual: `warehouses`/`warehouse_translations` are never queried by any admin route; no nav entry. File: absent — no `src/app/[locale]/admin/...warehouse...` exists. Fix: add a module (reuse the generic `[module]/page.tsx` pattern) with translation editing for `name`/`city`/`address`/`service_region`.

3. **Admin CRUD for Media is MISSING.** Requirement: plan requires Media management since `site_page_sections.media_id` and coffee/origin hero images reference `media`. Actual: no admin route reads the `media` table at all — there is no UI path to upload/manage the assets that CMS sections reference. Fix: build a Media library module (list, upload with the existing MIME/size-hardened bucket, translations, delete).

4. **Admin CRUD for Articles / Article Categories is MISSING entirely.** No admin route exists for either. The public `/knowledge/{slug}/` route can only ever show whatever seed data exists; Admin cannot publish, edit, or categorize articles. Fix: add both modules with the same create/update/EN-AR/status pattern used for CMS pages.

5. **Coffees, Origins, and all six taxonomy tables are DISPLAY ONLY.** No create/update/delete exists for `coffees`, `origins`, `coffee_types`, `processing_methods`, `certifications`, `tags`, `sensory_notes`, `packaging_types` — the core catalog data an operator would need to manage day-to-day is entirely un-editable from the UI. This directly contradicts the execution report's claim of "modules for products... origins, taxonomy." Fix: this is the largest remaining build item — prioritize Coffees and Origins CRUD first (they gate the public catalog), then taxonomy CRUD.

6. **Regions and Varieties (`coffee_varieties`) are not surfaced in admin at all — MISSING, not even read.** Fix: add both to the taxonomy list minimum, then full CRUD.

7. **Site / Organization Content has no update action.** `site_settings` (org name, logo, default OG image, social links, SEO defaults, low-stock threshold) is readable but has zero mutation path — an admin cannot correct the organization's name or logo without direct DB access. Fix: add a settings-edit form + server action gated by `requireAdmin()`.

8. **No delete/archive capability exists anywhere for CMS pages or sections.** Content can be created and edited but never removed once published, which will accumulate stale/duplicate entries over time. Fix: add a soft-delete (`deleted_at`) action per the schema's existing column.

### MEDIUM

1. **Admin surface has zero user feedback on failure.** No Sonner/toast anywhere under `src/app/[locale]/admin/**`; a failed `safeParse` reloads the page with no visible error. This violates the plan's requirement (§21/§41 checklist) for admin error feedback. Fix: surface `safeParse` errors via the existing `sonner` dependency (already installed and used on the public site).

2. **`phone` falls back to an empty string when a verified user's profile has none, and is silently inserted into a NOT-NULL column.** `src/actions/inquiries.ts:102`: `phone: viewer.phone ?? ""`. Fix: require profile completeness (real phone) before allowing inquiry creation, with a clear validation message instead of a silent empty write.

3. **`NEXT_PUBLIC_SITE_URL` default fallback is `https://hillscoffee.co`, not the spec's canonical `https://www.hillscoffees.com`.** `src/lib/seo/metadata.ts:5`. If the env var is ever missing in production, canonical/OG/hreflang all ship the wrong host. Ties to open plan decision D-01. Fix: either hard-fail at build time if the var is unset, or default it to the correct canonical host.

4. **No `BreadcrumbList` JSON-LD anywhere**, despite the SEO spec requiring it on nearly every template (T01/T03/T04/knowledge/commercial). Fix: add breadcrumb schema + a visible breadcrumb trail component to detail pages.

5. **Test suite materially overstates coverage.** Zero authenticated E2E tests exist (no login flow is ever exercised for a verified user or admin); Axe accessibility coverage is exactly one page (`/`), one locale (EN), one auth state (anonymous). The execution report's "Automated accessibility: PASS" and "Auth/admin guard smoke: PASS" lines are true only for that narrow scope and should not be read as general coverage. See §10.

6. **Audit Logs has no dedicated admin module** — only an 8-row widget on the dashboard, no filter/search/pagination, no nav entry. Fix: add a dedicated, paginated, filterable module.

7. **Price Tier admin selects the target offer via a raw UUID text input**, not a searchable picker — usability gap likely to cause operator error. Fix: replace with a combobox against `coffee_offers`.

### LOW

1. **Redundant DB lookups in `createProductInquiry`.** The action fetches `coffee_translations`/`warehouses` snapshot data and sends it to the insert, but `hills_hydrate_inquiry_context` (BEFORE INSERT trigger) unconditionally overwrites those same fields. Not incorrect (values happen to match), just wasted queries. Fix: drop the redundant fetch/fields; let the trigger derive them.

2. **Stale empty `products/` and `products/[slug]/` directories** remain after their `page.tsx` files were deleted. Hygiene only — does not affect routing. Fix: remove the empty directories.

3. **Sitemap is a single monolithic Next.js route**, not the segmented `sitemap-static/commercial/origins/offer-list/knowledge/support.xml` + index architecture the spec describes (spec lines 700–713). Functionally correct and consistent at current URL volume; flag as a documented spec deviation, not a defect, unless/until URL count grows.

4. **`/contact/` is not marked `noindex`** despite one spec table row (line ~953) requesting it, though the spec is internally inconsistent about this route elsewhere. Business decision, not a defect — record as D-18 if a firm answer is wanted.

5. **Offers and Inquiries admin modules only support status transitions**, not full field edits. Acceptable for a workflow-status pattern, but worth confirming this matches operator expectations.

---

## 6. Security Review

No BLOCKER-level issue survives. Specifically re-verified against the restored Post-DB0 schema and current code:

- **Authorization**: `profiles.role` is the sole source of truth end-to-end; `prevent_profile_role_escalation()` trigger still blocks any role UPDATE outside `postgres`/`service_role`; `handle_hills_new_user()` still hard-codes `role='USER'` on signup. No client-trusted role signal remains anywhere.
- **Price protection**: `offer_price_tiers` has no `anon` grant (confirmed unchanged); `hills_price_tiers_verified_users` RLS still requires `is_email_verified()`; the single application read boundary (`src/lib/data/pricing.ts`) is enforced both by code convention and a source-text test. Price never appears in any public payload, JSON-LD, metadata, or sitemap.
- **Inquiry write path**: `hills_hydrate_inquiry_context` (BEFORE INSERT, SECURITY DEFINER) forces `user_id = auth.uid()` and validates `coffee_id` against the selected offer — the RLS tautology from the prior review is fixed (`o.coffee_id = inquiries.coffee_id`). The application insert uses an explicit named-field object, not a `...spread`, so no mass-assignment risk. **Gap**: this hardening only protects the `PRODUCT` flow that exists — see HIGH-1, `SAMPLE_REQUEST` isn't implemented at all yet, so it can't leak anything, but it also can't be used.
- **CMS injection safety**: markdown is sanitized (`rehype-sanitize`, `skipHtml`); JSON-LD is injected via `JSON.stringify` with `<` escaped, not raw admin-supplied HTML/script. No free-text "custom canonical URL" or "raw JSON-LD" admin field exists.
- **Auth flows**: no user-enumeration leak on forgot-password/resend-verification (identical response regardless of account existence); password reset requires an authenticated session established via the real PKCE callback exchange, not a client-supplied token; `assertSafeRedirect` allow-lists path roots and rejects protocol-relative payloads, closing the open-redirect risk.
- **No service-role key usage** anywhere in application code.

Net: the security posture matches the approved plan's non-negotiables. The remaining risk surface is **functional incompleteness** (Section 5, HIGH items 2–8), not exploitable weakness.

---

## 7. SEO Review

| Area                             | Verdict                                     | Notes                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route architecture               | CONFIRMED CORRECT                           | Unprefixed EN + `/ar/...`, all spec route families present                                                                                                                        |
| `trailingSlash` removal          | CONSISTENT DEVIATION                        | No mixed slash usage found anywhere (canonical, sitemap, redirects all slash-free); a documented, internally consistent departure from the spec's stated preference, not a defect |
| Canonical/hreflang/x-default     | MECHANISM CORRECT, HOST WRONG BY DEFAULT    | `x-default` = en, EN/AR alternates present; but `SITE_URL` fallback is `https://hillscoffee.co` vs. spec's `https://www.hillscoffees.com` (MEDIUM-3)                              |
| robots.ts                        | CORRECT                                     | `/account/`, `/admin/`, `/sign-in/` disallowed in both locales                                                                                                                    |
| sitemap.ts                       | FUNCTIONALLY CORRECT, STRUCTURALLY DEVIATED | Monolithic route vs. spec's segmented sitemap-index (LOW-3); correctly excludes unpublished CMS pages                                                                             |
| Faceted/filtered catalog URLs    | COMPLIANT                                   | Offer-list self-canonicalizes to the clean path regardless of query params, satisfying the spec's stated alternative                                                              |
| JSON-LD price rule               | CONFIRMED CORRECT                           | Zero `Offer`/price nodes in Organization, ItemList, or Product schema                                                                                                             |
| BreadcrumbList                   | MISSING                                     | Required on nearly every template per spec; absent everywhere (MEDIUM-4)                                                                                                          |
| Organization schema completeness | MINIMAL                                     | name/url only; spec wants legal_name/logo/contact — acceptable as a placeholder pending `site_settings` org data being editable (see HIGH-7)                                      |
| Soft-404 / legacy redirects      | CONFIRMED CORRECT                           | Real `notFound()`, one-hop 301/308s for all legacy paths                                                                                                                          |
| Commercial CMS routes            | CONFIRMED CORRECT                           | Restricted to the nine spec slugs + privacy/terms; unpublished pages 404 and are excluded from the sitemap                                                                        |
| `/contact/` noindex              | MINOR INCONSISTENCY                         | Spec suggests noindex in one table row; no override set (LOW-4)                                                                                                                   |

---

## 8. Database / Supabase Review

Post-DB0 CSV independently verified (not compared against the old pre-DB0 schema):

- **47 public tables, 98 public RLS policies** — confirmed by direct row counts, not just the summary label.
- **CMS tables**: `site_pages`, `site_page_translations`, `site_page_sections`, `site_page_section_translations`, `site_settings` (real single-row typed table, `id default 1`, typed columns, `org_same_as text[]` — not key/value), `site_settings_translations` — all present, RLS enabled, matching the approved relational design (not arbitrary JSON).
- **`warehouse_translations`** translates `name`/`city`/`address`/`service_region` only; `id`/`code` correctly remain on the base table.
- **Featured curation**: `coffees.is_featured`/`featured_sort_order` and `origins.is_featured`/`featured_sort_order` present with correct defaults.
- **Storage hardening**: bucket `hills-public`, 10 MB file-size limit, MIME allow-list `image/jpeg,png,webp,avif`.
- **Inquiry contract** (`hills_hydrate_inquiry_context`, BEFORE INSERT, SECURITY DEFINER): unconditionally overwrites `user_id`, `coffee_id` (validated against the offer), `offer_reference_snapshot`, `warehouse_code_snapshot`, `coffee_name_snapshot`. DB-defaulted: `id`, `inquiry_number`, `request_code`, `created_at`, `updated_at`, `status` (default `'NEW'`). App-required (NOT NULL, no default, no trigger derivation): `type`, `full_name`, `email`, `phone`. No `quantity` field exists anywhere — the plan's GAP-05 withdrawal is respected, and the app does not stuff quantity into `message`.
- **`hills_inquiries_insert_verified` tautology is fixed**: now correctly correlates `o.coffee_id = inquiries.coffee_id`.
- **`offer_price_tiers`**: still no `anon` grant; `hills_price_tiers_verified_users` still requires `is_email_verified()`.

**Application vs. DB contract mismatch (LOW, not a defect)**: `src/actions/inquiries.ts` sends four trigger-owned fields (`user_id`, `coffee_id`, `offer_reference_snapshot`, `warehouse_code_snapshot`, `coffee_name_snapshot`) that get silently discarded/overwritten by the trigger — redundant work, not incorrect, since the values happen to match what the trigger derives from the same offer row.

---

## 9. UX / Motion / Accessibility / Responsive Review

- Responsive: automated ≤1px horizontal-scroll check passes on 7 anonymous routes across 2 viewport presets (desktop Chrome, iPhone 13/Chromium). No tablet breakpoint tested, no admin-surface responsive check (admin was visually described as "ok" by the capability-matrix audit, not automated-tested).
- Accessibility: Axe WCAG2 A/AA + 2.1 A/AA passes, but **only** on the homepage, in English, unauthenticated. No scan exists for `/ar/` (RTL), any auth form (sign-in/sign-up/forgot-password), any account page, or any admin page.
- Motion: no automated `prefers-reduced-motion` check exists anywhere in the test suite or Playwright config, despite the execution report claiming reduced-motion handling is "present." This is a code-review-time visual claim, not a tested one.
- RTL: no dedicated RTL layout assertion beyond the same overflow/console-error smoke check used for LTR routes.
- Admin UX: as noted in §5 MEDIUM-1, there is no toast/error feedback anywhere in the admin surface — a real usability defect for the operator, not just a test gap.

---

## 10. Test Coverage Review

**Inventory**: `src/lib/security-boundaries.test.ts` (4 Vitest tests) + `tests/e2e/public-smoke.spec.ts` (10 Playwright tests × 2 projects = 20 runs). No other test files exist anywhere in the repo. The execution report's quantitative claims ("1 file, 4 tests," "20/20") are accurate; several qualitative claims overstate what was verified.

- The Vitest suite is mostly **source-text assertions** (e.g., "the string `offer_price_tiers` is absent from `catalog.ts`"), not runtime-behavior proofs — a real regression could pass these checks while still leaking data at runtime through a code path the tests don't exercise.
- The Playwright suite is **entirely anonymous** — no test anywhere authenticates a real Supabase session. `grep` confirms zero sign-in calls or `storageState` config.

| Feature                  | Anonymous                                    | Unverified USER | Verified USER          | ADMIN                  |
| ------------------------ | -------------------------------------------- | --------------- | ---------------------- | ---------------------- |
| Price access/leakage     | VERIFIED (regex-level, not schema-validated) | NOT VERIFIED    | BLOCKED BY CREDENTIALS | BLOCKED BY CREDENTIALS |
| Favorites                | NOT VERIFIED                                 | NOT VERIFIED    | BLOCKED BY CREDENTIALS | N/A                    |
| Inquiries (all types)    | NOT VERIFIED                                 | NOT VERIFIED    | BLOCKED BY CREDENTIALS | N/A                    |
| Admin CRUD               | PARTIALLY VERIFIED (redirect-to-login only)  | N/A             | N/A                    | BLOCKED BY CREDENTIALS |
| CMS publish/draft gating | NOT VERIFIED                                 | N/A             | N/A                    | BLOCKED BY CREDENTIALS |
| Email verification       | NOT VERIFIED                                 | NOT VERIFIED    | N/A                    | N/A                    |
| Password recovery        | NOT VERIFIED                                 | N/A             | N/A                    | N/A                    |
| Auth route guard         | VERIFIED (account + admin → login redirect)  | NOT VERIFIED    | N/A                    | N/A                    |
| Accessibility (Axe)      | PARTIAL (home/EN/anon only)                  | NOT VERIFIED    | NOT VERIFIED           | NOT VERIFIED           |
| RTL layout               | NOT VERIFIED                                 | —               | —                      | —                      |
| Reduced motion           | NOT VERIFIED (no automated check exists)     | —               | —                      | —                      |

**Conclusion**: "Auth/admin guard smoke: PASS" in the execution report validates only the anonymous → login-page redirect, not any actual authorization boundary under a real session. No claim of authenticated behavior in the execution report is backed by automated evidence — this matches the execution report's own honest caveat ("authenticated admin CRUD and live email delivery were not exercised without test credentials"), but that caveat should be read as covering _all_ authenticated-behavior claims, not just admin CRUD.

---

## 11. Remaining Operational Work

From the execution report (still accurate) plus this review's additions:

1. Publish approved EN/AR CMS copy for the nine commercial pages and legal/support pages (execution report item 1).
2. Add live catalog/offer records (execution report item 2) — and note that once real data exists, Admin still cannot manage most of it (§5 HIGH-2 through HIGH-7).
3. Run authenticated browser tests with real seeded buyer/verified-buyer/admin accounts — currently zero authenticated automated coverage exists (§10).
4. Choose a production rate-limit backing store (open decision D-05).
5. Set and verify the production canonical host in `NEXT_PUBLIC_SITE_URL` **and** fix the wrong default fallback (§5 MEDIUM-3) before relying on the env var alone.
6. Rotate any credential that may have been placed in an example file or repo history.
7. Supply a licensed Benito webfont or confirm the Manrope/Cairo/Readex fallback is final (open decision D-04).
8. **New**: implement the `SAMPLE_REQUEST` inquiry flow (§5 HIGH-1).
9. **New**: build the missing/read-only admin modules — Warehouses, Media, Articles, Article Categories, Regions, Varieties, Coffees, Origins, all six taxonomy tables, and Site/Organization Content editing (§5 HIGH-2 through HIGH-7).
10. **New**: add admin error/success feedback (toasts) and a CMS content delete/archive path (§5 MEDIUM-1, HIGH-8).

---

## 12. Exact Codex Remediation List

1. `src/actions/inquiries.ts` — add `createSampleRequestInquiry` (or parameterize `type`) with the same `requireVerifiedUser()` gate; wire a real entry point instead of routing sample requests through `createProductInquiry`.
2. `src/actions/inquiries.ts:102` — replace `phone: viewer.phone ?? ""` with a validation error when the verified user's profile has no phone, instead of inserting an empty string.
3. `src/lib/seo/metadata.ts:5` — fix or fail-fast the `SITE_URL` fallback; it currently defaults to `https://hillscoffee.co` instead of the spec's canonical `https://www.hillscoffees.com`.
4. Add `BreadcrumbList` JSON-LD (and a visible breadcrumb trail) to offer-list, coffee-detail, origin-detail, knowledge-detail, and commercial CMS pages.
5. Build admin CRUD modules (list/create/update/delete, EN/AR, Zod validation, `requireAdmin()` gate, Sonner feedback) for: Coffees, Origins, Warehouses, Media, Articles, Article Categories, Regions, Varieties, Coffee Types, Processing Methods, Certifications, Tags, Sensory Notes, Packaging Types.
6. Add an update action + form for `site_settings`/`site_settings_translations` (Site/Organization Content module).
7. Add a soft-delete/archive action for `site_pages` and `site_page_sections`.
8. Add Sonner toast feedback to every admin server action currently failing silently on `safeParse` errors (`src/actions/admin.ts`, all admin `page.tsx` mutation paths).
9. Replace the raw-UUID offer picker in the Price Tier admin form with a searchable combobox.
10. Build a dedicated, filterable, paginated Audit Logs admin module (currently an 8-row dashboard widget only).
11. Remove the now-empty `src/app/[locale]/(site)/products/` and `products/[slug]/` directories.
12. Drop the redundant snapshot-field fetch/insert in `createProductInquiry` since the DB trigger overwrites those fields anyway (cosmetic cleanup, optional).
13. Add authenticated Playwright coverage (seeded verified-buyer and admin test accounts) for: price visibility after verification, favorites, PRODUCT and SAMPLE_REQUEST inquiry submission, admin CRUD for at least one built module, and CMS publish/draft gating.
14. Extend the Axe accessibility run to `/ar/` (RTL) and at minimum the sign-in/sign-up/forgot-password forms.
15. Add a `prefers-reduced-motion` Playwright check if the reduced-motion handling described in the execution report is meant to be regression-tested.

---

## 13. Final Recommendation

**READY FOR CODE REMEDIATION?** **YES** — the remediation list above is concrete and scoped; nothing blocks starting it immediately.

**READY FOR AUTHENTICATED STAGING QA?** **NO** — staging QA is meant to validate authenticated flows (verified-buyer pricing/favorites/inquiries, admin CRUD across the catalog). Most of the admin surface those flows would exercise does not exist yet, and the `SAMPLE_REQUEST` flow has no code path to test at all. Recommend completing remediation items 1, 2, and 5–8 above before scheduling staging QA; the remaining public/anonymous surface (already covered by the current Playwright matrix) does not need to block on this.
