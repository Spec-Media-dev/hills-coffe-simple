# Phase 6 Evidence — Catalog, Admin data entry, protected pricing, origins

**Recorded**: 2026-09-01
**Branch**: `main`, Phases 0–5 committed
**Phases 0–5**: not redone; re-run as regressions only.

## Scope note — the brief was wider than `tasks.md`

`tasks.md` P6-T01…T06 covers only the query layer (catalog query, origin→region
filtering, price isolation, origins aggregation, the test matrix). The owner's
Phase 6 instruction additionally required the **Admin catalog data-entry flow**
to become genuinely operational: reference data → coffee → coffee images →
offer → pricing → public catalog → verified-customer price, with inline
bilingual validation throughout.

Both were executed. The extra surface is recorded here rather than silently
absorbed, because parts of it (`Admin visual redesign`, `Media Library`) remain
owned by Phases 8 and 10 and were deliberately **not** taken.

---

## What the audit found before any code changed

A runtime + live-database audit of every Admin route and every catalog table
produced the starting picture:

| Area                                                                                    | Live state at audit                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `coffees`, `coffee_offers`, `offer_price_tiers`, `media`, `coffee_media`                | **0 rows**                                                |
| `origins`, `regions`, `varieties`, `sensory_notes`, `tags`                              | **0 rows**                                                |
| `warehouse_translations`                                                                | **0 rows** — Arabic Admin fell back to English base names |
| `warehouses`, `coffee_types`, `processing_methods`, `packaging_types`, `certifications` | present (2 / 2 / 6 / 4 / 3)                               |
| Storage buckets                                                                         | `hills-public` (public), `avatars` (private)              |

So the catalog flow could not be exercised at all: with no origins there is no
valid coffee, with no coffee there is no offer, with no offer there is no
price. Four defects on top of that made it unusable even with data:

1. **`saveOfferAction` wrote a column that does not exist.** It set `currency`;
   the live column is `currency_code`. **Every offer save had always failed.**
2. **Every Admin form was English-only**, with hardcoded prose labels and
   messages — no Arabic at all.
3. **Validation was a bottom-of-form list** of `field: message` pairs carrying
   raw Zod English ("Required", "Invalid uuid"), plus `required` attributes that
   produced the browser's own popup ("Please select an item in the list.").
4. **No coffee image path existed.** `coffee_media` was unused by the Admin.

Two more surfaced during implementation, both of them real:

5. **`pricing_unit` and `currency_code` are pinned to one value each** by
   `coffee_offers_pricing_unit_kg` (`= 'KG'`) and the currency check (`= 'USD'`).
   Free-text inputs could only ever produce an opaque check-constraint failure.
6. **`coffee_offers` carries two partial unique indexes**, not one. The action
   attributed every `23505` to the reference number, so "this coffee already has
   an active offer in that warehouse" was reported against the wrong field.

---

## P6-T01 — Database-side catalog query — **PASS**

New `src/lib/data/catalog-query.ts`. The listing previously fetched every
visible offer and narrowed it with `Array.filter`, with **no pagination at
all** — work that grew with the catalog rather than with the page.

`queryCatalog()` expresses search, filters, ordering and pagination as one
bounded PostgREST query. Embeds become `!inner` only when a filter actually
constrains them, so an offer whose coffee has no region or processing method is
still returned when those filters are unused. `count: "exact"` supplies the
total, and `.range()` bounds the transfer.

Proven at runtime against real data: search matches the translated name;
origin, warehouse and processing filters each include and exclude correctly;
a page past the last row returns an empty page with the correct total rather
than an error.

**A defect found and fixed here**: PostgREST answers `PGRST103` for a range
starting past the last row. The first implementation logged that as a query
failure and lost the pagination footer. An out-of-range page is an ordinary
empty page, so it now re-counts and returns one.

## P6-T02 — Origin-dependent region filtering — **PASS**

Two independent layers, because the client narrowing a list is convenience and
the server is the boundary:

- the coffee form filters region options to the selected origin and **clears** a
  region that no longer belongs when the origin changes;
- `saveCoffeeAction` re-checks with `regionBelongsToOrigin()` and returns
  `regionOriginMismatch` against the `regionId` field.

Both proven in the browser: choosing Ethiopia offers Sidama and not Minas
Gerais; switching to Brazil empties the field and swaps the list.

## P6-T03 — Protected-pricing isolation after the refactor — **PASS**

`src/lib/data/pricing.ts` is unchanged. The new catalog query selects **no
price column**, and a unit invariant now pins the price table to a four-module
allow-list — customer reads behind `requireVerifiedUser()`, two Admin paths
behind `requireAdmin()`, and the generated type map — so a new ungated price
path fails the build rather than shipping.

Five-persona runtime matrix against a real offer with real tiers:

| Persona                      | Result                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Anonymous                    | no price in the HTML of `/green-coffee-offer-list`, `/ar/…`, the origin pages, or `sitemap.xml` |
| Blocked customer             | signs in, still no price                                                                        |
| **Administrator**            | verified email confers **no** customer entitlement — no price                                   |
| Verified, unblocked customer | receives the price                                                                              |

## P6-T04 — Origin listing and detail aggregation — **PASS**

`getOrigins()` had **no coffee count at all**, and origin detail still called
`getOfferList()` — the whole catalog — and filtered it in JavaScript.

- The published-coffee count is now one extra query whose cost is independent
  of the number of origins: the `origin_id` column of published coffees is
  fetched once and tallied. Three queries total, whatever the catalog's size —
  no per-origin count, no N+1.
- Origin detail uses `queryCatalog({ origin: slug })`, so its coffees are
  scoped by the database.
- `getOriginRegions()` reads one origin's regions in a single scoped query and
  the detail page lists them.

Runtime: the Ethiopia card shows a real count; its detail lists Sidama and not
Minas Gerais and shows only Ethiopian coffees; Brazil shows the inverse; the
Arabic route renders the Arabic region name; no price appears for an anonymous
visitor.

## Admin data-entry flow (owner's primary goal) — **PASS**

New: `src/actions/admin-catalog.ts`, `src/lib/admin/validation.ts`,
`src/lib/data/admin-catalog.ts`, `src/components/admin/admin-form.tsx`,
`coffee-form.tsx`, `coffee-images.tsx`, `offer-form.tsx`, and dedicated
workspaces at `admin/products/**`, `admin/offers/**`, `admin/pricing`.
`products`, `offers` and `pricing` were removed from the generic `[module]`
renderer and their superseded legacy actions deleted, so each has exactly one
implementation.

**Inline validation.** Forms are `noValidate`: the browser never raises its own
unlocalized popup. The server returns `fieldErrors` keyed by field name whose
values are **message keys**, and each field resolves its own key in the active
locale and renders it directly beneath itself, with `aria-invalid`,
`aria-describedby`, a non-colour glyph, and focus moved to the first failing
field. A form-level message is reserved for failures no single field owns.

**Form values survive a rejection.** Every control is controlled from its own
state seeded from `defaultValue`, so a rejected submit re-renders with
everything the Admin typed. Proven: with the slug left empty, the English name,
Arabic name and grade are all still present after the failure.

**The server re-validates everything.** Every submitted id is checked to exist,
to be of the expected table, to be active/non-deleted, and to satisfy its
relationships. Many-to-many links are verified row by row before insert, so a
tampered id is dropped rather than reaching a foreign key.

**No provider text reaches the browser.** Failures map onto the closed
`DomainErrorCode` set plus a key. A constraint _name_ is read server-side only
to decide which field owns the message, and never returned — pinned by a unit
invariant.

**Coffee images.** Built on the existing `coffees → coffee_media → media →
Storage` model; no column was added to `coffees`. The first image of a coffee
becomes `MAIN`, the rest `GALLERY` ordered by `sort_order`, and the partial
unique index `coffee_media_one_main_image` stays the authority — promotion
demotes the previous main first. The bytes decide the type: `File.type` must
agree with the sniffed magic bytes, and the storage path is generated
server-side from the coffee id and a uuid. A failed attach removes its uploaded
object and media row rather than orphaning them.

Runtime proof: two images upload in one submit (one PNG, one JPEG) and land as
exactly one MAIN plus one GALLERY; promoting the gallery image leaves exactly
one MAIN; a shell script named `.png` is refused with the error under the file
input and **nothing** attached.

**Empty states name the dependency.** A required select never sits on a bare
"None": with data it shows a localized "Select …" prompt, and with none it says
which dependency to create and links to the page that creates it.

---

## Test results

| Suite                                             | Result                                                        |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `npm test` (unit)                                 | **103/103**, 12 files (was 84 — +19 Phase 6 invariants)       |
| `npm run test:integration`                        | **74/74**                                                     |
| `npm run test:e2e` (production, desktop + mobile) | **193 passed, 67 skipped, 0 failed** (11.3 min, fresh server) |
| `npm run test:e2e:dev`                            | **73/73**                                                     |
| `admin-catalog.spec.ts` (new)                     | **18/18**                                                     |
| `admin-smoke.spec.ts` (new)                       | **4/4**                                                       |
| `npm run typecheck`                               | PASS, 0 errors                                                |
| `npm run lint`                                    | PASS, 0 errors / 0 warnings                                   |
| `npm run build`                                   | PASS, 68/68 static pages                                      |

### Admin-wide smoke sweep

All **20** Admin routes, as a signed-in Administrator:

- English: every route resolves, stays authorized, renders a heading, carries
  no public footer, and logs no console or page error.
- Arabic: every route resolves with `lang="ar"`, `dir="rtl"`, and keeps its
  `/ar` prefix — no locale leakage.
- Anonymous: every route redirects to `/dashboard-admin`.
- The catalog workspaces list real rows.

Modules owned by later phases (CMS, articles, media library, inquiries) were
smoke-tested only; no later-phase business logic was implemented.

### Test changes

Two Playwright selector fixes, both making the tests _more_ precise, neither
weakening an assertion:

1. An unanchored `/Washed/i` also matched "Fully washed", so the coffee was
   stored with a different processing method than the filter assertion
   expected. Anchored.
2. `getByText("Sidama")` and `getByText("إثيوبيا")` matched several elements
   once real data existed. Scoped to the region chips and the result card.

---

## Database, RLS and storage changes

**None.** No migration, no schema change, no function change, no RLS change, no
storage-policy change, no bucket reconfiguration. Everything was built against
the live contract as it already stands, including its two single-value check
constraints and its two partial unique indexes.

Rows were **inserted** (owner-approved QA/demo data) — that is data, not schema.

---

## Persisted QA/demo data

The first coffee, its two images, its offer and its two price tiers were
created **through the Admin UI** by `tests/e2e/admin-catalog.spec.ts`; that run
is the proof the flow works. A second connected coffee/offer/tier set is seeded
idempotently by `scripts/seed-qa-catalog.mjs` so the owner has more than one row
to filter and paginate against. Re-running the spec cleans up only its own
run-scoped rows, so the set below stays stable.

29 rows, all namespaced `qa-p6-*` / `[QA P6]`:

| TABLE                    | ID                                     | SLUG / CODE                         | PURPOSE                                                    |
| ------------------------ | -------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `origins`                | `4fa4f5a3-9d13-4b9e-88e9-36e4500bc453` | `qa-p6-brazil`                      | QA origin                                                  |
| `origins`                | `34772140-dd0d-449c-88e1-351be0277d21` | `qa-p6-ethiopia`                    | QA origin                                                  |
| `regions`                | `66025172-5ce3-44e9-979a-38ab92e8b6f5` | `qa-p6-minas-gerais`                | QA region (Brazil)                                         |
| `regions`                | `68110f02-cd31-45a4-910e-8347eaa917f9` | `qa-p6-sidama`                      | QA region (Ethiopia)                                       |
| `varieties`              | `4db8f838-c066-4d74-84c5-42648d53f348` | `qa-p6-bourbon`                     | QA variety (English-only by schema)                        |
| `varieties`              | `052a9ccd-2126-4fca-8c86-669b7787f0d5` | `qa-p6-heirloom`                    | QA variety (English-only by schema)                        |
| `sensory_notes`          | `317d2fe2-d823-487e-bdd5-1490a26a2474` | `qa-p6-chocolate`                   | QA sensory note (attaches to offers)                       |
| `sensory_notes`          | `720780c2-6452-4a68-8816-82c58a89c21c` | `qa-p6-citrus`                      | QA sensory note                                            |
| `sensory_notes`          | `d7ba473f-9c52-4a6f-98c8-d76d49811d60` | `qa-p6-floral`                      | QA sensory note                                            |
| `tags`                   | `ac06d75d-2577-4149-b0aa-77b09534b514` | `qa-p6-high-altitude`               | QA tag                                                     |
| `tags`                   | `420dfd82-a2e3-42f2-9f0e-7cb4bff88956` | `qa-p6-single-origin`               | QA tag                                                     |
| `coffees`                | `5c83e57c-f435-4fbc-b8d5-a025d9c14408` | `qa-p6-coffee-mtikwgv0`             | QA coffee #1, PUBLISHED — **created through the Admin UI** |
| `coffees`                | `9a43d5fa-8447-4572-aedf-6ea97736ddaf` | `qa-p6-minas-natural`               | QA coffee #2, PUBLISHED — seeded                           |
| `coffee_media`           | `5c83e57c…408 / bf95f93f…014`          | `MAIN`                              | QA coffee #1 main image (sort_order 0)                     |
| `coffee_media`           | `5c83e57c…408 / 4ee554f9…218`          | `GALLERY`                           | QA coffee #1 gallery image (sort_order 1)                  |
| `coffee_media`           | `9a43d5fa…daf / ddb23187…824`          | `MAIN`                              | QA coffee #2 main image                                    |
| `media`                  | `bf95f93f-93b6-4a65-8165-d5ddfb51b014` | `coffees/5c83e57c…/f30b1a88….png`   | QA image object in `hills-public`                          |
| `media`                  | `4ee554f9-552b-4665-86d9-17734bd68218` | `coffees/5c83e57c…/44aa0237….jpg`   | QA image object in `hills-public`                          |
| `media`                  | `ddb23187-1d36-4898-8103-d58320a0a824` | `coffees/9a43d5fa…/6ad5e71a….png`   | QA image object in `hills-public`                          |
| `coffee_offers`          | `a33150fa-ce44-410f-8c68-e58d93609b22` | `QA-P6-MTIL40A9`                    | QA offer #1 (Egypt) — **created through the Admin UI**     |
| `coffee_offers`          | `716b9943-a8f1-42d0-8cb5-77ea9701ae05` | `QA-P6-DXB-0001`                    | QA offer #2 (Dubai) — seeded                               |
| `offer_price_tiers`      | `7155ba0d-81d3-45a3-b931-5dd44a20fb3a` | `min_bags=1`                        | QA protected price $7.25/kg                                |
| `offer_price_tiers`      | `09bfe922-87ec-4f16-850c-eda1c0c3937b` | `min_bags=100`                      | QA protected price $6.40/kg                                |
| `offer_price_tiers`      | `d2e754db-2e51-4f26-9403-5cf6397e8e2a` | `min_bags=1`                        | QA protected price $5.90/kg                                |
| `offer_price_tiers`      | `3eca248e-8c6c-4f7e-ae69-b50283ba44df` | `min_bags=200`                      | QA protected price $5.25/kg                                |
| `warehouse_translations` | `ae97da30-416e-4926-87d0-36da5e392d9d` | `en/ar: Egypt Warehouse / مخزن مصر` | **Not demo data** — closes a real bilingual gap            |
| `warehouse_translations` | `2f526fcd-66b1-43fe-b0d4-defcb58f4e72` | `en/ar: Dubai Warehouse / مخزن دبي` | **Not demo data** — closes a real bilingual gap            |

To remove the demo data later, delete in this order: `offer_price_tiers` →
`offer_sensory_notes`/`offer_tags` → `coffee_offers` → `coffee_media` →
`media_translations` → `media` (and their storage objects) →
`coffee_varieties`/`coffee_certifications`/`coffee_tags`/`coffee_translations`
→ `coffees` → `regions`/`region_translations` → `origins`/`origin_translations`
→ `varieties`, `sensory_notes`, `tags`. Keep `warehouse_translations`.

---

## Closure audit (owner request, after the phase was first reported)

### The "6 failed" premise

The report under review was quoted back as `193 passed / 67 skipped / 6 failed`.
The stored run outputs do not contain that result: three consecutive full sweeps
recorded `193 / 67 / 0`, `193 / 67 / 0` and `192 / 66 / 0`, with zero failure
markers in any of them. There were no six failures to investigate. What the
audit _did_ surface is below, and it was worth doing.

### Reference/taxonomy modules — audited at runtime for the first time

Phase 6 migrated products, offers and pricing to the new form stack; origins,
regions, warehouses, varieties and the six taxonomy entities were left on the
legacy stack and had never been exercised end to end. A new spec
(`tests/e2e/admin-reference.spec.ts`, 7/7) now drives them, and it found a real
defect — **N38**: the shared `saveNamedEntityAction` sent a `description` column
to every taxonomy translation table, but only three of seven have one. For
`coffee_types`, `sensory_notes`, `tags` and `article_categories` PostgREST
rejected the whole upsert with `PGRST204`, so the term was created **without
either name** and then displayed as its raw slug in both languages everywhere it
appeared. Fixed by sending `description` only where the column exists. The spec
now asserts the option label equals the translated name rather than merely
containing the run tag — which is exactly how this hid, since the slug contains
the tag too.

The audit also established what these modules do and do not do: create and edit
persist, both translations are written, and a new row reaches the dependent
dropdowns in EN and AR immediately. They still use browser-native validation and
a bottom-of-form error list — now pinned by an explicit test and recorded as
**N37** for the Phase 11 migration.

### Two test-infrastructure hazards, both real

**N39 — a stale or wrong server can silently invalidate a whole run.** One
closure sweep reported 104 failures. The evidence was unambiguous that the code
was not at fault: `/admin` returned **404** to an anonymous request (a route the
build demonstrably contains, which had passed minutes earlier), the log carried
`Failed to proxy … socket hang up` and `ECONNRESET`, and the run took 31 minutes
instead of 11. `webServer.reuseExistingServer: true` means Playwright attaches
to whatever already holds port 3000 rather than to the build under test. After
killing every node process, rebuilding from a cleared `.next`, starting the
server explicitly and **verifying** `/admin` → `307 /dashboard-admin` before
starting, the same suite ran **200 passed / 74 skipped / 0 failed**.

The mirror of that mistake is worse: `playwright.dev.config.ts` also reuses port
3000, so running `npm run test:e2e:dev` while a **production** server is up
silently tests production with a suite whose entire purpose is asserting React
_development_ diagnostics — it passes vacuously. Earlier "73/73 dev" runs in
this phase finished in ~3.1 minutes; a genuine dev run takes ~5.5. Those earlier
runs were reusing a production server. Re-run properly, the dev suite is 73/73.

**N40 — the locale switcher loses the query string if clicked before
hydration.** Surfaced by the dev suite once it was genuinely running against a
dev server. The switcher is a real anchor whose `href` carries only the
localized pathname; `search` and `hash` are re-added by its click handler, read
from `window.location` rather than `useSearchParams()` **on purpose**, so that
placing it in the shared header does not opt every page out of static
rendering. A click that beats hydration therefore follows the bare href and
drops the filters. No client-side change can fix a pre-hydration click — the
only true fix is server knowledge of the query, which is precisely the static
rendering Phase 2 chose to keep. Recorded as an accepted limitation rather than
silently patched; the regression test now waits for hydration so it measures the
switcher instead of racing React.

## New findings

| #       | Severity           | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N30** | **HIGH — fixed**   | `saveOfferAction` wrote `currency`; the live column is `currency_code`. Offer creation had **never** worked. Same class as N25: the curated `types.generated.ts` had drifted from the live schema and declared the wrong name.                                                                                                                                                                                                                                             |
| **N31** | **MEDIUM — fixed** | `coffee_offers.pricing_unit` and `currency_code` are pinned to single values (`'KG'`, `'USD'`) by check constraints. Free-text inputs could only produce an opaque `23514`. Both are now closed selects validated as enums.                                                                                                                                                                                                                                                |
| **N32** | **MEDIUM**         | **`varieties` has a plain `name` column and no `variety_translations` table.** Varieties are English-only _by schema_, so an Arabic Admin necessarily sees English variety names. The form reports the fallback rather than pretending otherwise. Closing this needs a migration — **owner decision required**, not applied.                                                                                                                                               |
| **N33** | **MEDIUM**         | **Sensory notes attach to offers, not coffees** (`offer_sensory_notes`; there is no `coffee_sensory_notes`). The owner's brief expected them on the coffee. Implemented per the live schema, on the offer form. Worth confirming this matches the intended product model.                                                                                                                                                                                                  |
| **N34** | **MEDIUM — fixed** | `coffee_offers` has **two** partial unique indexes — reference number, and one active offer per (coffee, warehouse). Every `23505` was attributed to the reference number, so a genuine coffee/warehouse collision reported the wrong field.                                                                                                                                                                                                                               |
| **N35** | **LOW — fixed**    | PostgREST returns `PGRST103` for a page past the last row. Treated as a failure at first, which lost the pagination footer; now returns an ordinary empty page with the true total.                                                                                                                                                                                                                                                                                        |
| **N36** | **LOW**            | `site_page_translations` is still empty (all 18 CMS pages untranslated), so `/about` remains content-blocked. Pre-existing F3, unchanged by this phase; Phase 8 owns it.                                                                                                                                                                                                                                                                                                   |
| **N37** | **LOW**            | The legacy `admin-operations.ts` still returns `AdminActionState` with hardcoded English prose for the modules Phase 6 did not take (CMS, articles, media, taxonomy, origins, regions, warehouses, varieties). Their feedback is English-only in both locales until the Phase 11 migration. Extends N27.                                                                                                                                                                   |
| **N38** | **HIGH — fixed**   | Taxonomy terms created through the Admin were saved **without their names**: `saveNamedEntityAction` sent a `description` column to all seven translation tables but only three have one, so `coffee_types`, `sensory_notes`, `tags` and `article_categories` failed their translation upsert (`PGRST204`) and displayed as raw slugs in both languages.                                                                                                                   |
| **N39** | **HIGH**           | `reuseExistingServer: true` in both Playwright configs lets a suite attach to whatever is on port 3000. A stale server produced a 104-failure run that was pure artifact (`/admin` → 404, proxy socket hang up, 31 min); the same suite passed 200/0 against a verified server. The dev config has the mirror hazard — with a production server up the dev suite passes vacuously. **Verify the server answers correctly before trusting a suite result.** Supersedes N29. |
| **N40** | **MEDIUM**         | The locale switcher drops the query string when clicked **before hydration**: its `href` carries only the pathname and `search`/`hash` are re-added by the click handler, deliberately, to keep the shared header from forcing dynamic rendering. No client-side fix exists; the only true fix is server knowledge of the query. Accepted limitation, recorded rather than patched.                                                                                        |
| **N41** | **MEDIUM — fixed** | The catalog write path verified every submitted many-to-many id with its own query, so one coffee save issued roughly fifteen sequential round trips and could exceed a 7.5 s budget under load — a real Admin latency problem, not only a test-timing one. Replaced with one `in (…)` per link group; the guarantee is identical (a missing, soft-deleted or inactive id simply never comes back) and the full suite dropped from 10.7 to 8.8 minutes.                    |
