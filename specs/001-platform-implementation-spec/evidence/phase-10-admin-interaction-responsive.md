# Phase 10 — Admin interaction, responsive redesign, and final Admin flow closure

**Status: COMPLETE — GATE PASS**

Scope: Admin UI / UX / interaction / responsive only. No schema change, no
migration, and no change to Auth, RLS, roles, blocking, pricing protection,
sample/inquiry rules, CMS schema or Media schema.

Phase 9 was implemented by a different agent and is accepted as the starting
point. It was not reverted. Three concrete regressions surfaced by this phase's
regression run are recorded under "Regressions found in existing work", each
with the adaptation made around the current implementation.

---

## P10-T01 — Characterization before redesign

All 18 modules were opened in a real browser, in both locales and both themes,
before any file was edited. The decision that characterization produced:

| # | Module | Route | Generic UX sufficient? | Action taken |
|---|---|---|---|---|
| 1 | Dashboard | `/admin` | Yes | Verified only |
| 2 | Products / Coffees | `/admin/products` | Yes — dedicated surface (Phase 6) | Verified only |
| 3 | Offers | `/admin/offers` | Yes — dedicated surface (Phase 6) | Verified only |
| 4 | Pricing | `/admin/pricing` | Yes — dedicated surface (Phase 6) | Verified only |
| 5 | Origins | `/admin/origins` | **No** | Rebuilt on the Phase 6 form system |
| 6 | Regions | `/admin/regions` | **No** | Rebuilt; dependency dead end handled |
| 7 | Varieties | `/admin/varieties` | **No** | Rebuilt |
| 8 | Warehouses | `/admin/warehouses` | **No** | Rebuilt |
| 9 | Taxonomy | `/admin/taxonomy` | **No** | Rebuilt; list projection fixed (N69) |
| 10 | Article categories | `/admin/article-categories` | **No** | Rebuilt |
| 11 | Settings | `/admin/settings` | **No** | Rebuilt; logo picker preserved |
| 12 | Audit | `/admin/audit` | **No** | Rebuilt; search and pagination localized |
| 13 | Media | `/admin/media` | Yes — Phase 8 | Verified only |
| 14 | Articles | `/admin/articles` | Yes — Phase 8 | Verified only |
| 15 | Content / CMS | `/admin/content` | Yes — Phase 8 | Verified only |
| 16 | Customers / Users | `/admin/users` | Yes — Phase 5 | Verified only |
| 17 | Leads / Requests | `/admin/inquiries` | Yes — Phase 7 | Verified only |
| 18 | Admin account | `/admin/account` | Yes | 375px overflow fixed |

Eight modules were rebuilt; ten were left alone. The replacement criterion was
applied per module, not by default.

---

## P10-T02 — What changed

### One form system for the whole Admin

Before this phase the Admin ran **two** form systems: the Phase 6 `AdminForm`
family (inline errors, `noValidate`, controlled values, message-key
resolution) on Products/Offers/Pricing, and a legacy `AdminActionForm` +
`AdminActionState` on the eight reference modules. The legacy system relied on
browser-native validation and pre-localized server strings.

The legacy system is now **deleted**, not deprecated:

- `src/components/admin/admin-action-form.tsx` — removed
- `src/lib/admin/action-state.ts` — removed

`src/actions/admin-operations.ts` was converted from `AdminActionState` to the
`ActionResult` contract (845 → 644 lines). Queries, guards and business rules
were not touched — only the error vocabulary changed. Five dead CMS actions,
one dead article action and one dead workflow action were removed.

### Inline validation (§21) and no native popups (§22)

Every rebuilt form posts to a Zod schema whose every rule carries a message
key, so a rejection returns `fieldErrors` keyed by field name. Each field
renders its own error beneath it. The summary message is a summary only and
never replaces the field-level message.

`tests/e2e/admin-reference.spec.ts` asserts this structurally across 8 forms:
`novalidate` present, zero `[required]` attributes, and every failure reported
under its own field.

### Preserved values (§23) and dependency dead ends (§25, §26)

Fields are controlled, so a rejection keeps what was typed in both languages,
and focus moves to the first invalid field. A required select whose parent
table is empty renders an actionable state and a route to the dependency
rather than an empty dropdown — Regions with no Origins offers "Go to
Origins". No required select uses "None"; each names what to choose.

### Raw error ban (§24)

`admin-operations.ts` logs only the upstream error *code* server-side and
returns a closed `DomainErrorCode` with a message key. No SQLSTATE, constraint
name, RPC name, Supabase message or stack trace can reach a client.

### Localization

69 hardcoded English strings were found on Admin surfaces and are now 0,
verified by a scanner over the rebuilt files. The `admin.modules` namespace
(~90 keys) was added to both `messages/en.json` and `messages/ar.json`.

---

## Defects found and fixed

| ID | Defect | Fix |
|---|---|---|
| N65 | Module heading was the raw route slug (`article-categories`), untranslated in both languages | Localized title and purpose sentence per module |
| N66 | Reference forms relied on browser-native validation popups | Rebuilt on `AdminForm`; `noValidate` with inline errors |
| N67 | A rejected submit wiped the form, losing both translations | Controlled values; focus moves to first invalid field |
| N68 | An empty database and an empty search result rendered identically | Distinct empty vs no-results states, with clear filters |
| N69 | Taxonomy list showed raw slugs and raw table names (`sensory notes`) | List projection reads the translation tables; localized taxonomy label |
| N70 | Archive submitted immediately, with no confirmation | `ConfirmDialog` naming the record and its impact |
| N71 | `/admin/account` scrolled sideways at 375px | Grid `min-width:auto` trap → `grid-cols-[minmax(0,1fr)]` plus flex-wrap |

---

## Regressions found in existing work

The Phase 1–9 regression run surfaced three failures. None was caused by a
Phase 10 edit. Each is recorded with the adaptation made; in no case was
Phase 9 reverted.

**R1 — Modal dialogs were painted underneath the footer.**
Phase 9 gave `<main class="route-frame">` and `<footer class="site-footer">`
each a `view-transition-name`. A named element is a stacking context, and two
sibling stacking contexts at `z-index: auto` paint in source order — so the
footer covered every dialog opened from the page beneath it, and `z-[80]`
could not escape its ancestor context. The Phase 7 sample-request dialog was
unclickable; Playwright reported the footer subtree intercepting the click.
*Fix:* `ModalDialog` and `ConfirmDialog` now render through `createPortal`
into `document.body`, where the z-index means what it says. Phase 9's view
transitions are untouched.

**R2 — The About hero was clipped off the side of a 375px screen.**
`.display-hero` used `clamp(4rem, 10.5vw, 9.5rem)`. The `10.5vw` term only
overtakes the floor above ~495px, so every phone rendered at a fixed 64px. At
that size the single word "accountability" measured 395px against a 355px
column and was clipped. The previous auditor missed it because the root sets
`overflow-x: clip`, which hides clipped overflow from `scrollWidth`.
*Fix:* the floor was lowered to `3.25rem`, plus `overflow-wrap: break-word` as
a last resort for any word no type scale can fit. Only `/about` in English at
375px was affected; a scan of all six public routes × 2 locales × 375/768 now
reports zero overflow.

**R3 — The Phase 8 CMS sweep asserted `main details`.**
Phase 9 replaced the native `<details>` FAQ with an ARIA disclosure
(`button[aria-expanded]` + `aria-controls`) — equivalent, and still
accessible. *Fix:* the assertion now tests the behaviour both implementations
share — a collapsed control per question that reveals its answer on click —
rather than the tag name. The test was strengthened, not weakened: it now
verifies the answer actually appears.

A fourth issue was in the **test tooling, not the app**. The auditor's
`scrollWidth > innerWidth` check produced false positives on `/admin/pricing`
at 375px, where the nav (2265px) and the table (672px) are intentional
contained scrollers under `overflow-x: clip`. The auditor was corrected to
test that the page cannot actually be scrolled sideways *and* that no visible
element sits outside the viewport unless it lives inside a scroll container.
It was also given a motion-settle step, so an element mid-reveal is not
measured as a layout defect.

**R4 — The catalogue filters forced a dark native dropdown in both themes.**
The offer-list filter selects carried `[color-scheme:dark]`, which makes the
browser paint the native option popup dark — correct in the dark theme, wrong
in the light one. The app declared no `color-scheme` at all, so this had been
patched per-component.
*Fix:* `color-scheme` now follows the theme at the root (`light` on `:root`,
`dark` on `.dark`), so every native control — option popups, scrollbars, date
pickers — matches the theme without any component forcing a scheme of its own.
The per-component override was removed, along with a prop and a translator
that the same edit had left unused.

---

## P10-T03 / P10-T04 — Runtime evidence

All verification below ran against a real production build (`npm run build`
then `next start` on `127.0.0.1:3000`) in a real browser. No result comes from
source inspection.

### Responsive / theme / RTL matrix

`tests/e2e/admin-sweep.spec.ts` runs one test per viewport, each covering
**18 modules × 2 themes × 2 locales = 72 audited screens**:

| Viewport | Screens | Result |
|---|---|---|
| 375 × 812 | 72 | PASS |
| 768 × 1024 | 72 | PASS |
| 1024 × 768 | 72 | PASS |
| 1280 × 650 (short desktop) | 72 | PASS |
| 1440 × 900 | 72 | PASS |

**360 audited screens.** Every screen is checked for raw translation keys,
broken images, text the theme has made unreadable, and horizontal overflow.
Navigation reachability on the short 1280 × 650 desktop is asserted
separately (§31).

### Flow tests

- Reference CRUD lifecycle through the real UI: create → verify → reload →
  edit → reload → archive → verify resulting state
- Dependent select behaviour and dependency dead-end handling
- Taxonomy create / list / edit across the six taxonomy tables
- Empty database vs no search results
- Customer authorization against every Admin route
- Localized headings for all 18 modules, in English and Arabic

### Suite results

| Suite | Result |
|---|---|
| `vitest run` | 139 passed (16 files) |
| `npm run test:integration` | 105 passed (8 files) |
| Playwright desktop (3 shards, all specs incl. the Phase 10 sweep) | 178 passed, 6 skipped |
| Playwright mobile project | 78 passed, 106 skipped |
| Playwright dev-server config | 73 passed |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | clean |

**Total: 573 passing checks, 0 failing.**

### Console failure gate (§45)

The dev-server config exists to catch React development diagnostics that a
production build strips. 73 passed, with no unexplained `console.error`, page
error, React warning or hydration warning.

---

## QA data (§36)

Temporary records were namespaced `qa-p10-` and removed. Verified against the
live database after the final run:

- reference tables (origins, regions, varieties, the six taxonomy tables,
  article categories, coffees, warehouses) carrying a `qa-p10` slug or
  name: **0**
- articles and site pages tagged `qa-p10`: **0**
- media alt text tagged `QA-P10`: **0**
- `qa-p10` auth accounts: **0**
- storage / media reconciliation: **3 media rows ↔ 3 storage files, 0 orphan
  files, 0 rows with a missing file**

No production or customer data was modified. The owner-approved persistent
Phase 6 QA catalog rows were preserved. The pending N32 Variety translation
migration was not touched.

---

## Gate result

**PHASE 10: COMPLETE — GATE PASS.**

Phase 9 remains complete and was not reverted. Phase 11 was not started.
Nothing was committed.
