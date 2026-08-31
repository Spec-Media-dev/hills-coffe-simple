# Hills Coffee — Final Post-Remediation Read-Only Review

**Reviewer:** Independent post-remediation review pass, read-only. No application code, database, or config was modified. Only this file was written.
**Date:** 2026-08-31
**Baseline:** working tree at `main` (starting commit `ee40259`), against `./docs/CLAUDE_INDEPENDENT_REVIEW.md`, `./docs/HILLS_IMPLEMENTATION_EXECUTION_REPORT.md`, `./artifacts/HILLS_FULL_IMPLEMENTATION_PLAN.md`, the restored Post-DB0 Supabase snapshot, the SEO specification, and current source.

**Note on missing input:** `./docs/CODEX_REMEDIATION_COMPLETION_REPORT.md`, which these review instructions name as the primary claims document, **does not exist in the repository**. The closest available claims source is `./docs/HILLS_IMPLEMENTATION_EXECUTION_REPORT.md` (updated 2026-08-31 13:39, containing matching content: npm migration, `SAMPLE_REQUEST` implementation, admin/CMS work, a "DATABASE HARDENING DECISION REQUIRED" section). All claim verification below treats that file as the claims-under-test.

**Two live questions raised while this review was in progress** are answered directly in §17, since they don't fit the standard template: a reported console error about a `<script>` tag, and difficulty locating the admin dashboard.

---

# 1. Final Verdict

## PASS WITH REMAINING STAGING QA

No BLOCKER and no HIGH application-code finding survives this pass. Every HIGH item from the prior independent review — the missing `SAMPLE_REQUEST` flow and the largely-unbuilt Admin/CMS surface — is now genuinely resolved with real, independently-verified CRUD, validation, authorization, and test coverage. The npm migration is complete and verified by actually running `typecheck`/`lint`/`test`. No security regression was introduced by the remediation.

What remains is: (a) a real but low-impact database concurrency gap in `SAMPLE_REQUEST` duplicate detection, explicitly disclosed by the implementation and independently confirmed real — a **database hardening decision**, not an application-code defect; (b) five MEDIUM and five LOW polish/completeness findings (wrong default canonical host, missing `BreadcrumbList`, an inaccessible mobile menu, un-itemized sample history, and hygiene items); and (c) the same external/business dependencies already known (real staging credentials, production hostname, live catalog content, font licensing). None of these block authenticated staging QA.

---

# 2. Codex Claim Verification

(Claims sourced from `./docs/HILLS_IMPLEMENTATION_EXECUTION_REPORT.md`, since the named completion report does not exist.)

| Claim                                                                       | Verdict                                          | Evidence                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install` PASS, 835 deps                                                | VERIFIED                                         | `package-lock.json` valid, `lockfileVersion: 3`, ~920 resolved entries (plausible superset incl. transitive/dupes)                                                                                                                |
| `npm run format:check` PASS                                                 | **NOT VERIFIED as stated**                       | Actually run: **FAILS** — the only flagged file is `docs/CLAUDE_POST_REMEDIATION_REVIEW.md` itself, which held review _instructions_ text, not application code, and is overwritten by this review. Not a source-code regression. |
| `npm run typecheck` PASS, 0 errors                                          | VERIFIED                                         | Actually run: 0 errors                                                                                                                                                                                                            |
| `npm run lint` PASS, 0 errors/warnings                                      | VERIFIED                                         | Actually run: 0 errors/warnings                                                                                                                                                                                                   |
| `npm test` PASS, 2 files/20 tests (16 sample-request + 4 security-boundary) | VERIFIED                                         | Actually run: `Test Files 2 passed (2)`, `Tests 20 passed (20)`; file names and split confirmed exactly                                                                                                                           |
| `npm run build` PASS, 45/45 static outputs                                  | NOT RE-RUN (out of scope — slow/server-starting) | No reason to doubt; not independently re-confirmed this pass                                                                                                                                                                      |
| `npm run test:e2e` PASS, 20/20 Playwright                                   | PARTIAL                                          | Test/project count structurally confirmed (10 tests × 2 projects = 20) by reading the spec + config; not re-executed. No test in the file authenticates a real session — the "20/20" figure covers only the anonymous surface.    |
| Axe accessibility PASS 2/2                                                  | VERIFIED literally, MISLEADING as coverage       | Exactly one Axe assertion exists, scanning `/` only, English only, anonymous only, executed once per Playwright project (2 runs of the same single check), not two different pages/states                                         |
| Anonymous auth/admin guards PASS 2/2                                        | VERIFIED (same scope as before)                  | Redirect-to-login only; not a guard-bypass test                                                                                                                                                                                   |
| Public price-leak checks PASS                                               | VERIFIED                                         | Re-confirmed zero `Offer`/`priceCurrency`/price nodes in JSON-LD after the `page.tsx` rewrite                                                                                                                                     |
| SAMPLE_REQUEST business rules                                               | VERIFIED, with one PARTIAL item                  | See §4                                                                                                                                                                                                                            |
| Admin/CMS module list                                                       | VERIFIED, essentially complete                   | See §6                                                                                                                                                                                                                            |
| npm migration complete                                                      | VERIFIED                                         | See §10                                                                                                                                                                                                                           |

---

# 3. Previous Finding Resolution Matrix

Source: `./docs/CLAUDE_INDEPENDENT_REVIEW.md` §5.

| Previous finding                                                               | Current status                    | Evidence                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BLOCKER (historical) — admin role from `app_metadata`                          | RESOLVED (unchanged, reconfirmed) | `grep -rn "app_metadata" src/` → 0 hits                                                                                                                                                                                             |
| BLOCKER (historical) — `HILLS_*_PREVIEW` bypass                                | RESOLVED (unchanged, reconfirmed) | `grep -rn "PREVIEW" src/` → 0 hits                                                                                                                                                                                                  |
| HIGH-1 — no `SAMPLE_REQUEST` code path                                         | **RESOLVED**                      | `src/lib/inquiries/sample-request.ts`, `src/actions/inquiries.ts:161-279`, 16 real behavioral unit tests. See §4 for one PARTIAL sub-item and §5 for the concurrency caveat.                                                        |
| HIGH-2 — Warehouses admin CRUD MISSING                                         | **RESOLVED**                      | `/admin/warehouses`, full CRUD + EN/AR + soft-archive                                                                                                                                                                               |
| HIGH-3 — Media admin CRUD MISSING                                              | **RESOLVED**                      | `/admin/media`, upload with server-side MIME/size re-validation, translations, soft-archive                                                                                                                                         |
| HIGH-4 — Articles / Article Categories MISSING                                 | **RESOLVED**                      | Both full CRUD, EN/AR, soft-archive                                                                                                                                                                                                 |
| HIGH-5 — Coffees/Origins/6 taxonomy tables DISPLAY ONLY                        | **RESOLVED**                      | All now full CRUD via `admin-operations.ts`, EN/AR, soft-archive                                                                                                                                                                    |
| HIGH-6 — Regions/Varieties not surfaced                                        | **RESOLVED**                      | Both full CRUD                                                                                                                                                                                                                      |
| HIGH-7 — Site/Organization Content no update action                            | **RESOLVED**                      | `updateSiteSettingsAction` (`admin-operations.ts:763-822`), EN/AR translations                                                                                                                                                      |
| HIGH-8 — no delete/archive for CMS pages/sections                              | **RESOLVED**                      | Page soft-archive + section hide/archive confirmed                                                                                                                                                                                  |
| MEDIUM-1 — zero admin toast/error feedback                                     | **PARTIALLY RESOLVED**            | Sonner success/failure wired across `admin-operations.ts`-backed modules; Inquiries status-update still runs through the old, dead `src/actions/admin.ts` and lacks the same toast pattern (new LOW finding, §13)                   |
| MEDIUM-2 — `phone` empty-string fallback into NOT-NULL column                  | **RESOLVED**                      | `createProductInquiry` now rejects with `PROFILE_INCOMPLETE` if `!viewer.phone?.trim()` (`src/actions/inquiries.ts:92-98`); `SAMPLE_REQUEST` flow enforces the same plus address/country                                            |
| MEDIUM-3 — wrong default canonical host (`hillscoffee.co`)                     | **STILL OPEN**                    | `src/lib/seo/metadata.ts:5`, `src/app/[locale]/layout.tsx:28` unchanged                                                                                                                                                             |
| MEDIUM-4 — no `BreadcrumbList` JSON-LD                                         | **STILL OPEN**                    | Zero matches repo-wide, no visible breadcrumb trail either                                                                                                                                                                          |
| MEDIUM-5 — test suite overstated coverage                                      | **PARTIALLY RESOLVED**            | `SAMPLE_REQUEST` now has genuine, thorough behavioral unit coverage (16/16, real mocked-dependency tests); Playwright/Axe coverage unchanged in scope — still zero authenticated E2E, still one page/locale/state for accessibility |
| MEDIUM-6 — Audit Logs no dedicated module                                      | **RESOLVED**                      | Dedicated searchable, paginated (25/page) module                                                                                                                                                                                    |
| MEDIUM-7 — raw-UUID offer picker in Price Tiers                                | **RESOLVED**                      | `src/components/admin/offer-picker.tsx`, searchable                                                                                                                                                                                 |
| LOW-1 — redundant trigger-owned snapshot fields sent by `createProductInquiry` | **RESOLVED**                      | Insert object (`inquiries.ts:138-149`) no longer sends `user_id`/`coffee_id`/snapshot fields; only `offer_id` + genuinely app-owned fields                                                                                          |
| LOW-2 — stale empty `products/`, `products/[slug]/` directories                | **STILL OPEN**                    | Directories still present, still empty (hygiene only)                                                                                                                                                                               |
| LOW-3 — monolithic (non-segmented) sitemap                                     | **STILL OPEN, not a defect**      | Unchanged; internally consistent, acceptable at current scale                                                                                                                                                                       |
| LOW-4 — `/contact/` not marked `noindex`                                       | **STILL OPEN**                    | No `robots`/`noindex` override found in `contact/page.tsx`; unresolved business decision, not a code defect                                                                                                                         |
| LOW-5 — Offers/Inquiries admin status-only editing                             | **PARTIALLY RESOLVED**            | Offers upgraded to full CRUD; Inquiries remains status-only, which is the correct design for a customer-submitted workflow entity                                                                                                   |

---

# 4. SAMPLE_REQUEST Review

All business rules from the review instructions were independently verified against `src/lib/inquiries/sample-request.ts`, `src/actions/inquiries.ts:161-279`, `src/lib/inquiries/sample-request.test.ts`, and the Post-DB0 CSV's `inquiries` trigger/RLS rows (re-confirmed unchanged — no schema drift):

- Authenticated + verified-email required: **CONFIRMED**.
- Phone, delivery address, country required: **CONFIRMED** (`PROFILE_INCOMPLETE` with per-field `missingFields`).
- Trusted offer context, resolved server-side to a visible/non-deleted offer with a published coffee and active warehouse: **CONFIRMED**.
- `coffee_id` resolved server-side (not client-supplied): **CONFIRMED**.
- Stored as `SAMPLE_REQUEST`, never `PRODUCT`: **CONFIRMED**.
- No `quantity` field anywhere, none hidden in `message`: **CONFIRMED**, with a dedicated test.
- Duplicate identity = `user_id` + `coffee_id` (not `offer_id`) + `type = SAMPLE_REQUEST`: **CONFIRMED** — a dedicated test proves switching the Egypt/Dubai offer for the same coffee still blocks.
- `NEW`/`RECEIVED`/`CONTACTED` active, `CLOSED` not: **CONFIRMED**, with a test that a new request is allowed after a prior one is `CLOSED`.
- A duplicate attempt returns the existing request code rather than creating a new row: **CONFIRMED**.
- Different user, same coffee → allowed: **CONFIRMED**.
- Inserts omit trigger-owned columns (`user_id`, `coffee_id`, status, snapshots), letting `hills_hydrate_inquiry_context` derive them: **CONFIRMED**.
- No shipment/reservation/fulfillment side effect created: **CONFIRMED**, with a dedicated test.
- 16/16 Vitest tests: **CONFIRMED**, and these are **real behavioral tests** against the actual decision function through an injected/mocked repository, not source-text greps (the failure mode of the pre-remediation test suite). Each rule above maps to a specific, independently-readable test case.
- Admin can identify prior same-user/same-coffee sample history: **PARTIALLY CONFIRMED**. The admin inquiries list shows a "Previous same-coffee samples: N" **count** per row, plus the current request's code/status/email, but does **not** list the individual prior request codes, statuses, or timestamps as the review instructions explicitly require. New MEDIUM finding, §13.

**Verdict: SAMPLE_REQUEST is genuinely implemented and correctly enforces the approved business rule**, with one incomplete item (itemized history vs. a count) and one known, explicitly-disclosed concurrency gap (§5).

---

# 5. Database Concurrency / Hardening Decision

**Is the race real? YES.** Independently confirmed against the Post-DB0 CSV: no unique constraint or index exists on `inquiries` covering `(user_id, coffee_id)` or `(user_id, coffee_id, type)` — the only unique constraints on the table are `id`, `inquiry_number`, and `request_code`. No serializing trigger or function exists; `hills_hydrate_inquiry_context` only derives field values, it does not lock or de-duplicate. The application's `processSampleRequest` performs a plain `SELECT` (`findActiveRequest`) followed by a plain `INSERT` (`insertRequest`) with no surrounding transaction, `SELECT ... FOR UPDATE`, advisory lock, or `INSERT ... ON CONFLICT`. Two truly concurrent submissions (double-click, two open tabs, or a deliberate replay) from the same user for the same coffee can both pass the duplicate check before either insert completes.

**Minimal conceptual fix** (described only, no SQL written): a partial unique index on `inquiries(user_id, coffee_id)` scoped to `WHERE type = 'SAMPLE_REQUEST' AND status IN ('NEW','RECEIVED','CONTACTED')`, with the application catching the resulting unique-violation and returning the existing request code instead of a raw insert failure.

**Does it block staging? NO.** The exploit window requires genuine millisecond-scale concurrency from the same user against the same coffee, and its worst outcome is a harmless duplicate manual-review row — no financial, inventory, security, or data-integrity impact, since sample requests create no shipment/fulfillment side effect (independently confirmed by test). Safe to exercise in authenticated staging QA as-is.

**Does it block production? NO, but it should be resolved or explicitly accepted before launch.** It is a genuine, if low-severity, data-hygiene gap under real traffic. Recommend it be tracked and decided as its own item — approve the partial-unique-index approach (or an equivalent transactional function) — rather than shipped indefinitely, but it does not need to gate the current remediation cycle or staging QA.

---

# 6. Admin Capability Matrix

All 8 previously MISSING/DISPLAY-ONLY modules are now built.

| Module                                                                                | Status                      | Notes                                                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Coffees                                                                               | **FULL CRUD**               | EN/AR, soft-archive (`deleted_at`+`ARCHIVED`), Sonner, `requireAdmin()`                                                  |
| Offers                                                                                | **FULL CRUD**               | + status workflow, soft-archive                                                                                          |
| Price Tiers                                                                           | **FULL CRUD**               | Zod ladder invariant, searchable offer picker, hard delete (appropriate — no translation/history dependents)             |
| Coffee Types / Processing Methods / Packaging / Sensory Notes / Certifications / Tags | **FULL CRUD**               | One entity-scoped "taxonomy" module, EN/AR, soft-archive (`is_active`)                                                   |
| Origins                                                                               | **FULL CRUD**               | EN/AR, soft-archive                                                                                                      |
| Regions                                                                               | **FULL CRUD**               | EN/AR, soft-archive                                                                                                      |
| Varieties                                                                             | **FULL CRUD**               | Soft-archive (`is_active`)                                                                                               |
| Warehouses                                                                            | **FULL CRUD**               | EN/AR, soft-archive                                                                                                      |
| Media                                                                                 | **FULL CRUD**               | Server-side MIME/size re-validation on upload, EN/AR alt/caption, soft-archive                                           |
| Users                                                                                 | **READ ONLY**               | Explicitly approved design; DB-enforced via `admin_list_users()`                                                         |
| Inquiries                                                                             | **PARTIAL (status-only)**   | Correct design for a customer-submitted entity; still routed through the old `admin.ts` action (no Sonner) — see §13 LOW |
| Articles                                                                              | **FULL CRUD**               | EN/AR, soft-archive                                                                                                      |
| Article Categories                                                                    | **FULL CRUD**               | EN/AR, soft-archive                                                                                                      |
| Homepage / About / Commercial CMS pages                                               | **FULL CRUD**               | Page + section create/update, translations, ordering, visibility, CTA, page soft-archive + section hide/archive          |
| Site / Organization Content                                                           | **FULL CRUD (single-row)**  | EN/AR, minor `id` validation inconsistency (§13 LOW)                                                                     |
| Audit Logs                                                                            | **FULL (dedicated module)** | Searchable, paginated                                                                                                    |

Every mutating action independently re-checks `requireAdmin()` server-side; no mass assignment; no unsafe dynamic table names (entity/table selectors are compile-time-fixed Zod enums, not client-arbitrary strings); no client-supplied `user_id`/primary keys; archive paths are genuinely soft (no `DELETE FROM` except the appropriate Price Tier hard delete); translation-table writes correctly key by `(entity_id, locale)`.

---

# 7. CMS Review

- `site_settings`/`site_settings_translations` now has a real, working update action (`updateSiteSettingsAction`) covering brand name, legal name, email, phone, low-stock threshold, and EN/AR display name/tagline/address. **Confirmed fixed.**
- No free-text "custom canonical URL," "raw JSON-LD," or arbitrary HTML/JS/CSS admin field exists anywhere — the only `dangerouslySetInnerHTML` uses remain the three escaped `JSON.stringify(jsonLd)` structured-data injections (see §17 for why this is the _correct_, officially-recommended pattern). **Confirmed.**
- Draft→published lifecycle, ordering, visibility, CTA, page archive, section hide/archive are wired to real server actions. **Confirmed**, consistent with the admin capability matrix above.
- Public pages genuinely read live CMS data: `getSitePage()` filters by `status="PUBLISHED"`, `is_active`, `deleted_at IS NULL`, and a future-`published_at` guard, and the homepage calls it at request time. **Confirmed** — an admin edit reaches the public page.
- **Gap:** the homepage Organization/WebSite JSON-LD still hardcodes `name: "Hills Coffee"` and a bare `url`, rather than reading the now-editable `site_settings` (legal name, logo, contact). Editing organization data in the admin CMS does not propagate to structured data. New MEDIUM finding, §13.

---

# 8. Auth / Security Review

No regression found from the remediation pass:

- `profiles.role` remains the sole admin-authorization source; zero `app_metadata` usage; zero preview-bypass code. **RESOLVED, unchanged.**
- No public Admin signup path exists (Admin accounts are provisioned outside the public sign-up flow — see §17 for what this means for reaching the dashboard).
- Every exported mutation in the new `admin-operations.ts` (18 functions covering every module in §6) independently calls `requireAdmin()` before any DB access — verified function-by-function, not assumed from a shared wrapper.
- No `user_id` or other identity field is ever accepted from client input anywhere in the new admin or inquiries code; `created_by`/`updated_by` and inquiry `user_id` are always session/trigger-derived.
- `offer_price_tiers` is still touched only by `src/lib/data/pricing.ts` — no new admin file bypasses the price boundary.
- Price is still absent from all JSON-LD/metadata/sitemap after the significant `page.tsx` rewrite — re-confirmed by fresh grep.
- Media upload re-validates MIME type and the 10 MB limit server-side, independent of any client `accept=` attribute, before writing to `hills-public`.
- No service-role key usage anywhere in application code.
- Safe redirects, recovery-session protection (PKCE-based), and Markdown sanitization all remain as previously confirmed — untouched by this remediation pass.

---

# 9. SEO Review

| Area                                | Status                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical host default              | **STILL WRONG** — `https://hillscoffee.co` fallback remains in `src/lib/seo/metadata.ts:5` and `src/app/[locale]/layout.tsx:28`, vs. spec's `https://www.hillscoffees.com`. This is a code-controlled fallback, not purely environment-driven — recommend fixing the fallback value itself, separate from the external decision of setting `NEXT_PUBLIC_SITE_URL` correctly in the real production environment. |
| English unprefixed / Arabic `/ar/`  | Unchanged, correct                                                                                                                                                                                                                                                                                                                                                                                              |
| Canonical / hreflang / x-default    | Unchanged, correct mechanism                                                                                                                                                                                                                                                                                                                                                                                    |
| robots.ts                           | Confirmed correct — `/account/`, `/admin/`, `/sign-in/` disallowed in both locales                                                                                                                                                                                                                                                                                                                              |
| Sitemap                             | Unchanged, monolithic but internally consistent and correctly excludes unpublished CMS pages                                                                                                                                                                                                                                                                                                                    |
| Filter/pagination noindex           | Unchanged, compliant via self-canonicalization                                                                                                                                                                                                                                                                                                                                                                  |
| Real 404                            | Unchanged, confirmed correct                                                                                                                                                                                                                                                                                                                                                                                    |
| Product schema                      | No price/Offer node — confirmed unchanged                                                                                                                                                                                                                                                                                                                                                                       |
| Organization/WebSite schema         | Still minimal/hardcoded, does not reflect the now-editable `site_settings` (§7)                                                                                                                                                                                                                                                                                                                                 |
| `BreadcrumbList`                    | **Still missing** everywhere, no visible breadcrumb trail either                                                                                                                                                                                                                                                                                                                                                |
| Internal links / no protected price | Confirmed clean                                                                                                                                                                                                                                                                                                                                                                                                 |

---

# 10. npm Migration Review

**Genuinely complete.** `pnpm-lock.yaml` and `pnpm-workspace.yaml` are physically absent (both `D` in `git status`); `package.json` declares `"packageManager": "npm@11.11.1"` with no pnpm remnant; `package-lock.json` is valid (`lockfileVersion: 3`, ~920 resolved entries, plausible for the claimed 835 dependencies); every script uses plain `next`/`eslint`/`prettier`/`vitest`/`playwright` invocations with no pnpm-specific syntax; README's setup instructions exclusively use `npm install`/`npm run *`. The only repo-wide "pnpm" text hits are inside this review's own instructions document (expected). No `.github/` CI config exists to audit. `npm run typecheck`, `npm run lint`, and `npm test` were actually executed during this review (not just claimed) and all passed cleanly.

---

# 11. UX / Accessibility / Motion Review

- RTL: **confirmed fixed** — `lang={locale}` and `dir="rtl"` correctly set at the `<html>` level for Arabic routes.
- Reduced motion: **partial** — one `prefers-reduced-motion` CSS block exists (`globals.css:277`); still no automated regression test for it.
- Sonner mounting: **confirmed sane** — single `<Toaster richColors closeButton position="bottom-right" />`, standard ARIA live-region behavior, nothing overridden.
- **Mobile menu — real, unclaimed regression.** `src/components/navigation/mobile-menu.tsx` is a plain conditional `<div>`, not an accessible dialog: no `role="dialog"`/`aria-modal`, no Escape-to-close, no focus trap, no focus restoration on close. The toggle button measures 40px, below the 44px minimum touch target the execution report explicitly claims ("44px targets"). This directly contradicts a specific accessibility claim and is not caught by the test suite because Axe never opens the mobile menu — it only scans the closed home page. New MEDIUM finding, §13.
- Axe coverage: **unchanged in scope** — exactly one check (home page, English, anonymous), executed twice only because it runs once per Playwright project (desktop + mobile), not because two different states were scanned.

---

# 12. Test Coverage Review

**Automated verified (real, re-run this pass):**

- TypeScript (`tsc --noEmit`) — 0 errors.
- ESLint — 0 errors/warnings.
- Vitest — 2 files, 20/20 tests, including 16 genuinely behavioral `SAMPLE_REQUEST` unit tests against the real decision function via a mocked repository interface (not source-text greps).
- Public/anonymous price-leak, JSON-LD price-absence, and route-loop smoke checks (fresh grep against the rewritten `page.tsx`).

**Code-ready only (structurally sound, not independently re-executed this pass):**

- `npm run build` (45/45 static outputs) — not re-run, no reason to doubt.
- `npm run test:e2e` (20/20 Playwright) — test/project count structurally verified by reading the spec + config, not re-executed.

**Staging-credential blocked (no automated evidence exists, and none should be claimed):**

- Real verified-USER price access and favorites RLS.
- Real PRODUCT and SAMPLE_REQUEST inquiry writes against a live Supabase instance.
- Real Admin CRUD execution (all 15 full-CRUD modules in §6 are unit-validated for their pure logic and gated correctly in code, but no E2E test authenticates an admin session — the SAMPLE_REQUEST TOCTOU pattern in particular is proven only against a mock, not the real Supabase-backed repository).
- Real verification email delivery.
- Real Admin CMS writes reflected end-to-end in a live browser session.

The execution report's own framing ("Blocked: live authenticated buyer writes... live Admin CRUD mutations") is accurate and should be read as covering every authenticated-behavior claim in the report, not only the ones it names explicitly.

---

# 13. New Findings

### BLOCKER

None.

### HIGH

None. (The `SAMPLE_REQUEST` concurrency race is real but is tracked as a database-hardening decision in §5, not as an application-code HIGH, per the explicit framing in the review instructions distinguishing DB-decision items from code defects.)

### MEDIUM

1. **Mobile menu is not keyboard/screen-reader accessible and its touch target is under the claimed 44px.** `src/components/navigation/mobile-menu.tsx`: no `role="dialog"`/`aria-modal`, no Escape-to-close, no focus trap, no focus restoration; toggle button is 40px. Contradicts the execution report's explicit "44px targets" claim, invisible to the current test suite because Axe never opens the menu. Fix: convert to an accessible dialog/sheet primitive (the codebase already depends on `@base-ui/react`, which has one), add Escape handling and focus management, raise the toggle target to 44px.
2. **Admin sample history is a count, not an itemized list.** The review instructions and approved design require Admin to see prior same-user/same-coffee `SAMPLE_REQUEST` request codes, statuses, and timestamps; the current admin inquiries view shows only "Previous same-coffee samples: N." Fix: expand the admin inquiry detail view to list the actual prior rows (code, status, `created_at`) for the same `(user_id, coffee_id)` pair.
3. **Organization/WebSite JSON-LD does not read from the now-editable `site_settings`.** `src/app/[locale]/(site)/page.tsx:44-58` hardcodes `name`/`url`; an admin editing organization name/legal name/logo in the new Site Settings module sees no effect on structured data. Fix: source the Organization node from `site_settings`/`site_settings_translations`.
4. **Canonical host default remains wrong.** `src/lib/seo/metadata.ts:5` and `src/app/[locale]/layout.tsx:28` still fall back to `https://hillscoffee.co` instead of the spec's `https://www.hillscoffees.com`. Carried forward, unresolved. Fix: change the code fallback (independent of also setting `NEXT_PUBLIC_SITE_URL` correctly in the real environment).
5. **No `BreadcrumbList` JSON-LD or visible breadcrumb trail anywhere.** Carried forward, unresolved. Fix: add breadcrumb schema + a visible trail on offer-list, coffee-detail, origin-detail, knowledge-detail, and commercial CMS pages.

### LOW

1. **Dead code: `src/actions/admin.ts` is fully unreferenced** (`updateInquiryStatus`, `updateOfferStatus`, `updatePageStatus`, price-tier and CMS actions) — the UI exclusively imports the newer, better-validated equivalents from `admin-operations.ts`, and the two files' logic has already started to diverge (the old file lacks the Sonner/`AdminActionState` pattern). Not a security issue since these are unreferenced server actions, but should be deleted to prevent future drift. This is also why the Inquiries module (§6) still lacks Sonner feedback — verify the call site before deleting; repoint Inquiries to the new pattern first, then delete the old file.
2. **`site_settings` update action validates `id` as `z.string().min(1)` instead of `.uuid()`**, inconsistent with every other action's UUID validation. Low impact (single-row table, `requireAdmin()`-gated), but worth aligning for consistency.
3. **Stale empty `products/` and `products/[slug]/` directories** remain. Hygiene only.
4. **`/contact/` is still not marked `noindex`**, per one spec table row. Unresolved business decision, not a code defect.
5. **Sitemap remains a single monolithic route** rather than the spec's segmented sitemap-index. Not a defect at current scale; flagged for awareness only.

---

# 14. Remaining External / Business Dependencies

(Unchanged in kind from the prior review; none are application-code defects.)

1. Run authenticated staging QA with approved anonymous, unverified-buyer, verified-buyer, and Admin test fixtures — no automated substitute exists or should be claimed.
2. Approve (or explicitly accept as-is) the `SAMPLE_REQUEST` database concurrency hardening described in §5.
3. Publish approved EN/AR CMS copy and licensed media for commercial/legal/support pages.
4. Add live catalog/offer records if production data remains empty.
5. Confirm the production canonical host, production rate-limit policy, and credential-rotation status.
6. Supply a licensed Benito webfont if exact brand typography is required.
7. Provision at least one real `profiles.role = 'ADMIN'` account in Supabase — see §17.2. There is no self-service admin signup by design, so this is an operational step, not a code task.

---

# 15. Exact Remaining Codex Fix List

1. Fix the mobile menu's accessibility (dialog semantics, Escape-to-close, focus trap/restoration, 44px touch target) — §13 MEDIUM-1.
2. Expand the admin sample-history view from a count to an itemized list of prior request codes/statuses/timestamps for the same `(user_id, coffee_id)` — §13 MEDIUM-2.
3. Source homepage Organization/WebSite JSON-LD from `site_settings`/`site_settings_translations` instead of hardcoded values — §13 MEDIUM-3.
4. Fix the default canonical-host fallback in `src/lib/seo/metadata.ts` and `src/app/[locale]/layout.tsx` to the spec's `https://www.hillscoffees.com` — §13 MEDIUM-4.
5. Add `BreadcrumbList` JSON-LD and a visible breadcrumb trail to detail/commercial pages — §13 MEDIUM-5.
6. Delete the dead `src/actions/admin.ts`, after first repointing the Inquiries status-update UI to a Sonner-enabled equivalent in `admin-operations.ts` — §13 LOW-1.
7. Align `site_settings` update-action `id` validation to `.uuid()` — §13 LOW-2.
8. Remove the stale empty `products/`/`products/[slug]/` directories — §13 LOW-3.
9. Decide and implement the minimum `SAMPLE_REQUEST` concurrency-hardening approach described conceptually in §5 (business/DB-owner decision, not a pure code task).

**None of the above are required before authenticated staging QA.** All are recommended before a production launch decision, alongside the external/business dependencies in §14.

---

# 16. Final Recommendation

**READY FOR AUTHENTICATED STAGING QA: YES.**

**READY FOR PRODUCTION: NO** — but not because of an application-code defect that blocks functionality. Production readiness is currently gated on:

- External/business dependencies (§14): real staging QA execution, canonical hostname confirmation, live catalog/CMS content, font licensing, credential rotation, rate-limit policy, provisioning a real Admin account.
- The explicit database sample-concurrency hardening decision (§5) — real but low-severity, a data-owner decision rather than a code bug.
- A short list of MEDIUM/LOW polish items (§13, §15) that are recommended but do not themselves block a staging run.

Distinguish clearly: nothing in this review found a security hole, a broken required flow, or a missing required module. The prior review's FAIL verdict was driven by a largely-unbuilt Admin/CMS surface and a missing `SAMPLE_REQUEST` flow — both are now genuinely resolved and independently verified.

---

# 17. Answers to Questions Raised Mid-Review

### 17.1 — "Console Error: Encountered a script tag while rendering React component... Consider using template tag instead"

This warning is real, but it is **not a defect and no code change is recommended**. All three occurrences of a raw `<script>` element in this codebase (`src/app/[locale]/(site)/page.tsx:65`, `green-coffee-offer-list/page.tsx:88`, `green-coffee-offer-list/[slug]/page.tsx:101`) use `dangerouslySetInnerHTML` to inject JSON-LD structured data, with `<` escaped to `<` — this is **verbatim the pattern Next.js 16's own official documentation recommends** for this exact purpose (`node_modules/next/dist/docs/01-app/02-guides/json-ld.md`, confirmed by direct read):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
  }}
/>
```

The Next.js doc explicitly states: _"The `next/script` component is optimized for loading and executing JavaScript. Since JSON-LD is structured data, not executable code, a native `<script>` tag is the right choice here."_ React's generic DOM warning fires because React's client-side renderer cannot distinguish a non-executable `type="application/ld+json"` payload from real JavaScript, and warns on any `<script>` element that passes through client-side reconciliation — it is a known, cosmetic false-positive for this specific, officially-endorsed pattern. Following React's own suggestion (switching to `<template>`) would deviate from Next.js's documented guidance and risks search engines/crawlers not reliably picking up the structured data, which would be a real SEO regression in exchange for silencing a harmless console line. **Recommendation: leave as-is.** If the warning is worth eliminating cosmetically, the safe route is to confirm it only fires in development (React Strict Mode double-render) and not in the production build, rather than changing the markup.

### 17.2 — "I don't find admin dashboard??"

The admin dashboard is real and fully built — confirmed by reading `src/app/[locale]/admin/page.tsx`, which renders live stats (products, stock, low-stock alerts, open inquiries) and a real activity feed sourced from `getAdminDashboard()`. It is not a stub.

The reason it may not be reachable: `src/app/[locale]/admin/layout.tsx` gates every route under `/admin` with `requireAdmin()` and **redirects to `/admin/login`** for anyone who isn't signed in with an account whose `profiles.role = 'ADMIN'`. This is correct, intentional security behavior (confirmed clean in §8), not a bug. Two things follow from that:

1. **There is no public navigation link to `/admin` or `/admin/login`** anywhere in the site header/footer — this is standard, intentional practice (admin panels are reached by direct URL, not advertised in public nav), but it does mean a person just browsing the public site will never stumble onto it. Navigate directly to `/admin` (English) or `/ar/admin` (Arabic); either will redirect to `/admin/login` if not already signed in as an admin.
2. **There is no self-service admin signup** — this is also correct, intentional design (confirmed in §8: "No public Admin signup path exists"). An account only becomes an Admin by having `profiles.role = 'ADMIN'` set directly in Supabase; there's no UI path to create one. Per §14 item 7 (carried from the execution report's own "remaining dependencies" list), **no admin test account has been provisioned in any pass so far** — this is exactly why authenticated Admin QA is listed as credential-blocked throughout this review (§12). If you sign in at `/admin/login` with an account that is not flagged `ADMIN` in the `profiles` table, you will be sent back to the login page rather than the dashboard, which would look identical to "the dashboard doesn't exist."

**This is not a code defect.** To actually see the dashboard: have a database owner set `profiles.role = 'ADMIN'` for one real user row in Supabase, then sign in at `/admin/login` (or `/ar/admin/login`) with that account.
