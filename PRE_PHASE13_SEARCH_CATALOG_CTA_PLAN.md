# Pre-Phase-13 Follow-Up — Header Search, Origin Discovery, Catalog Experience, Auth-Aware CTAs

Planning document only. No application code, messages, schema, RLS or Auth were
changed to produce it. Phase 12 stays closed; Phase 13 has not started.

---

## 1. Executive summary

Four connected UX gaps, and the audit changes the shape of the work
substantially: **most of the data layer this needs already exists.**

| Area                       | What the audit found                                                                                                                                                                                                                                                                                    | Consequence                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Header search              | The search icon is a plain `<Link href="/green-coffee-offer-list">` — it navigates on click. There is **no `/search` route and no site-wide search data function** anywhere in the codebase.                                                                                                            | One new route, one new read module, one small client island.                                 |
| Origin discovery           | `getCatalogFacets()` already returns **active origins with EN/AR labels**, and `queryCatalog` already accepts `origin`. The header mega-menu, however, lists **no real origins** — it hardcodes `?location=EGYPT` / `?location=DUBAI`, which are _warehouses_, not origins.                             | Presentation-only. No new query.                                                             |
| Products / coffees listing | `Products` **already points at `/green-coffee-offer-list`**, which already has `q` + origin/process/location/type filters, DB-side pagination and a card grid. `catalog.sort`, `catalog.certification`, `catalog.availability` and `catalog.details` translation keys **already exist and are unused**. | Improve in place. **Do not create another catalog route.**                                   |
| Auth-aware CTAs            | The home page renders "Sign in" and "Continue" CTAs and **reads no viewer at all**. The header uses `requireVerifiedUser()`, so an Administrator and an unverified customer both see a "Sign in" button.                                                                                                | One shared presentation-persona resolver plus one CTA component; no new authorization logic. |

The single most valuable structural finding: **`queryCatalog` returns fewer
fields than the legacy `getOfferList`.** `OfferListItem` already carries
`packaging`, `availableFrom`, `sensory[]`, `certifications[]` and `tags[]` —
exactly the expandable-row payload — while `CatalogRow` does not. So the
expandable preview needs a bounded extension to `queryCatalog`, **not** a revert
to the unbounded `getOfferList`.

**No migration, no RLS change, no Auth model change is required.**

---

## 2. Current-state audit

### 2.1 Routes that exist today

Public (`src/app/[locale]/(site)/`):

```
/                             /about                  /contact
/green-coffee-offer-list      /green-coffee-offer-list/[slug]
/coffee-origins               /coffee-origins/[slug]
/knowledge                    /knowledge/[slug]
/request-a-quote              /[page]  (CMS)
/sign-in /sign-up /verify-email /forgot-password /reset-password
/account/**                   (customer)
```

Non-locale: `src/app/auth/callback`, `src/app/auth/reject`, `robots.ts`,
`sitemap.ts`.

`src/i18n/routing.ts` declares only `locales`, `defaultLocale` and
`localePrefix: "as-needed"` — **there is no `pathnames` map**, so a new route
needs no routing-config change and gets `/search` + `/ar/search` for free.

### 2.2 Header and navigation

`src/components/navigation/site-header.tsx` — **server component**.

- Nav items: Home, Products → `/green-coffee-offer-list`, Origins →
  `/coffee-origins`, Knowledge, About, Contact.
- Desktop nav renders `CatalogMegaMenu` for Products.
- **Search icon** (`lucide-react` `Search`) is a `<Link>` to
  `/green-coffee-offer-list`, `hidden … sm:grid` — absent on mobile.
- `const viewer = await requireVerifiedUser()` gates the account affordance.
- `MobileMenu` receives `actionHref`/`actionLabel` derived from that same viewer.

`catalog-mega-menu.tsx` — client island, already RTL-corrected in the pre-Phase-12
pass (`rtl:translate-x-1/2`). Its "origins" column links to `/coffee-origins`
plus two hardcoded `?location=EGYPT|DUBAI` warehouse links.

`mobile-menu.tsx`, `account-menu.tsx`, `locale-switcher.tsx`, `theme-toggle.tsx`,
`site-footer.tsx` — all present; footer is already viewer-aware.

### 2.3 Catalog

`src/lib/data/catalog-query.ts` — the modern, bounded path:

- `CatalogFilters = { q, origin, process, location, type, certified, page }`
- `queryCatalog()` — DB-side filter + order + `range()` pagination,
  `CATALOG_PAGE_SIZE = 12`. **Selects no price column at all** (structural
  price separation, Constitution VI/VIII).
- `CatalogRow` = `id, coffeeId, slug, name, origin, originSlug, region, type,
process, grade, reference, bags, bagWeightKg, warehouse, warehouseCode,
status, cupScore, imageUrl, imageAlt`.
- `getCatalogFacets()` — origins / processes / types / warehouses, each with a
  localized label, read from reference tables (deliberately not from the current
  result page, so narrowing never strands the visitor).

`src/lib/data/catalog.ts` — legacy/unbounded `getOfferList()`; its
`OfferListItem` additionally carries `packaging`, `availableFrom`, `sensory[]`,
`certifications[]`, `tags[]`, `featured*`. Still used by the home page and the
sitemap.

`green-coffee-offer-list/page.tsx` — GET `<form role="search">` with `q` +
four `<select>` filters, `FilterPanel` mobile disclosure, `CatalogCard` grid
(`md:grid-cols-2 xl:grid-cols-3`), prev/next pagination, `noResults` empty state.

**Not yet used:** `certified` filter, any sort control, any expandable detail.

### 2.4 Origins

`getOrigins(locale)` — `origins.is_active = true` joined to coffees with
`status = 'PUBLISHED'`; returns slug, localized name, continent.
`/coffee-origins` groups by continent and links to `/coffee-origins/{slug}`.
It offers **no path into the catalog filtered by that origin**.

### 2.5 Auth state

`src/lib/auth/session.ts`:

| Helper                  | Semantics                                                                                               | Side effects                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `getViewer()`           | `Viewer \| null`; `role` from `public.profiles` (sole authority); `emailVerified`, `isBlocked` included | **none** — safe on public pages            |
| `requireVerifiedUser()` | verified **and** `role = USER` **and** not blocked, composed with `hills_is_verified_user()` RPC        | **calls `signOut()` for a blocked viewer** |
| `requireAccountOwner()` | self-scoped, either role                                                                                | signs out a blocked viewer                 |
| `requireAdmin()`        | ADMIN + `is_admin()` RPC                                                                                | signs out a blocked admin                  |

Public surfaces that read a viewer today: `contact` (`getViewer`),
`green-coffee-offer-list` list + detail (`getViewer`), `request-a-quote`
(`requireVerifiedUser`), `site-header` and `site-footer` (`requireVerifiedUser`).

**Public surfaces that render auth CTAs but read no viewer: the home page.**

Protected pricing: `getProtectedPriceTiers()` is gated internally by
`requireVerifiedUser()`. The listing's `viewer?.emailVerified` check is only a
round-trip optimisation — an Administrator passes that pre-check but the helper
still returns nothing, so ADMIN is correctly not a customer.

### 2.6 Search

**There is no site-wide search.** Every `search` hit in `src/` is either the
catalog's `q` filter, an Admin table filter, or `URLSearchParams` usage. The
`catalog.search` message key is the catalog input's placeholder.

---

## 3. Reference screenshot observations

Five screenshots in `public/images/new/`, all Sucafina. Used for **interaction
architecture only** — no branding, colour, type, spacing or wording is carried over.

| File        | Shows                                                                                                                                                                                                                                                                                                                          | Useful concept                                                                                                                                     | Explicitly not taken                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `cd587516…` | Header, collapsed: circular search icon, region selector, LOGIN                                                                                                                                                                                                                                                                | Search as a compact icon that owns a fixed slot                                                                                                    | Teal palette, pill LOGIN button                        |
| `b23dc1b5…` | **Header, expanded**: input replaces the nav area, placeholder "Search for coffee, FAQs, news and…", `×` to close                                                                                                                                                                                                              | The core interaction: expand **in place**, no navigation, explicit close, placeholder that advertises multi-type results                           | Exact wording, border treatment                        |
| `0bbcc879…` | Region dropdown open under its trigger                                                                                                                                                                                                                                                                                         | A lightweight header dropdown listing real, data-driven choices — maps to **Origins** for Hills                                                    | Region/market concept; Hills has no market switcher    |
| `8c45e35c…` | Offerings: segmented All/Specialty/Commercial, "Search Coffee Beans", left filter rail (Origin with search-within-filter and "+24 more", Tag, Process, Bags Available), top dropdowns (Certification, Location, Sensory, Packaging, Availability), **"Login / Signup to view prices"** banner, sortable table, chevron per row | Filter rail + sort + a single prominent protected-price banner instead of repeating a lock on every row; "+N more" to keep a long facet list short | Table density, teal, checkbox styling, "LOGIN" wording |
| `c953f574…` | A row expanded: Full Name, Ref #, Package, Tags, Certifications, Cupping Score, Sensories                                                                                                                                                                                                                                      | The expandable preview and its field set                                                                                                           | —                                                      |

Two observations worth carrying into the plan as rules:

1. In `c953f574…` several expanded fields (**Tags, Certifications, Cupping Score,
   Sensories**) are rendered as empty labels. That is the failure mode to avoid:
   **render a field only when it has a value**, never a labelled void.
2. The protected-price message appears **once, above the results**, not per row.
   That is both calmer and cheaper, and it suits Hills' existing card grid.

---

## 4. Existing route / component / data-flow map

```
SiteHeader (server, requireVerifiedUser)
├── BrandMark · nav links
├── CatalogMegaMenu (client)   → /green-coffee-offer-list  ?location=EGYPT|DUBAI
├── Search icon  → <Link> /green-coffee-offer-list        ← navigates today
├── ThemeToggle · LocaleSwitcher
├── AccountMenu (client) | "Sign in" link
└── MobileMenu (client)

/green-coffee-offer-list (server)
├── queryCatalog(locale, filters)      → CatalogPage   (no price column)
├── getCatalogFacets(locale)           → origins/processes/types/warehouses
├── getViewer() → getProtectedPriceTiers()  [requireVerifiedUser() inside]
├── FilterPanel (client, mobile disclosure)
└── CatalogCard × n  → /green-coffee-offer-list/[slug]

/coffee-origins (server) → getOrigins() → /coffee-origins/[slug]
/knowledge      (server) → getArticles()
```

---

## 5. Search architecture plan

### 5.1 Decision

**Add one new route `/search`** (`/ar/search`). None exists, so nothing is
duplicated. The catalog keeps its own `?q=` as an _in-catalog_ filter; `/search`
is the _cross-content_ entry point. The two are deliberately different jobs and
the reference screenshot supports it — its header placeholder promises coffee,
FAQs and news, while the Offerings page has its own "Search Coffee Beans" box.

### 5.2 Scope of the index

| Source             | Included            | Read via                                       | Authorization boundary                                                                         |
| ------------------ | ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Coffees / offers   | **Yes**             | `queryCatalog(locale, { q, page })`            | Already `is_visible`, `status = PUBLISHED`, `deleted_at IS NULL`; **no price column selected** |
| Origins            | **Yes**             | `getOrigins(locale)`, filtered in-process      | Already `is_active` + has PUBLISHED coffees                                                    |
| Knowledge articles | **Yes**             | `getArticles(locale)`                          | Already published/embargo-aware                                                                |
| CMS pages          | **Yes, title only** | existing `site_pages` reader used by `/[page]` | Published pages only                                                                           |
| Prices             | **Never**           | —                                              | Not selected by any of the above                                                               |

Reusing `queryCatalog` for the coffee half is the security-critical choice: it is
the module that structurally cannot return a price. A bespoke search query would
re-open that question. Origins, articles and CMS pages carry no protected data,
and their existing readers already apply the published filters — so **`/search`
introduces no new authorization surface**.

### 5.3 Header interaction

`HeaderSearch` — a small client island replacing the current `<Link>`:

- collapsed: icon button, `aria-expanded="false"`, `aria-controls`, accessible
  label from `catalog.search`;
- on activate: expands to an input **in the header**, focuses it, no navigation;
- `Enter` / submit → `router.push('/search?q=…')` (localized via `@/i18n/navigation`);
- `Escape` → collapse and return focus to the trigger;
- explicit close (`×`) and submit affordances;
- empty query → do not navigate.

It is a `<form action="/search" method="get">` so it still works with JS
disabled, and the client island only adds expand/focus/Escape.

Expansion direction is handled by **logical properties** (`inset-inline-end`,
`ps-*`/`pe-*`), not `left/right`. The pre-Phase-12 mega-menu defect — logical
`start-1/2` compounding with physical `-translate-x-1/2` in RTL — is the exact
trap to avoid: **if a transform is used for the expand animation, it needs an
explicit `rtl:` counterpart**, and that must be verified by measurement, not
assumed.

### 5.4 Results page

Server component. Grouped sections (Coffees, Origins, Knowledge, Pages), each
capped and each linking to its canonical detail route. Empty query renders a
prompt, not an error.

**SEO:** the natural convention here is `robots: { index: false, follow: false }`,
which is what `/sign-in`, `/verify-email` and `/continue` already do. The
sitemap's `staticPaths` list is explicit, so `/search` is excluded by default —
no action needed. Whether to formally register `/search` as noindex is flagged
as a **Phase-13 SEO decision**; this plan neither adds it to the sitemap nor
changes any canonical/hreflang behaviour.

---

## 6. Origins discovery / filter plan

**Decision: C — both, from one shared source.**

- **Header**: extend the existing `CatalogMegaMenu` origins column with real
  origins rather than adding a second dropdown. Fewer islands, one interaction
  language, and the RTL geometry there is already fixed and tested.
- **Catalog**: the `origin` filter already exists; it gains presentation work
  only (§7).

Data source: **`getCatalogFacets(locale).origins`** — already active-only,
already localized, already the exact `slug` the catalog filter accepts. The
header is a server component, so the list is fetched server-side and passed to
the client island as props; **no origin dataset ships as client JS beyond the
labels actually rendered.**

Links: `/green-coffee-offer-list?origin=<slug>` for "browse this origin's
coffees", and `/coffee-origins/<slug>` for the editorial page. Both are existing
canonical URLs — **no new origin route, no duplicate page, no SEO change**.

Hardcoding origins is explicitly rejected: the database already provides them.
The existing `?location=EGYPT|DUBAI` links stay, but should be relabelled so
they no longer read as origins — they are warehouses.

Long lists: cap the header dropdown (e.g. first N by label) with a "View all
origins" link to `/coffee-origins`, mirroring the reference's "+24 more" without
copying its styling.

---

## 7. Products / coffees listing plan

**Decision: improve `/green-coffee-offer-list` in place.** `Products` already
points there; it is the canonical catalog route, it is in the sitemap, and its
detail pages hang off it. Creating a `/products` route would fork the catalog,
duplicate SEO and orphan existing links. **Rejected.**

Improvements, all on existing data:

1. **Expose `certified`.** `CatalogFilters.certified` and its `!inner` join are
   already implemented in `queryCatalog` but the page never passes the param.
   The `catalog.certification` message key already exists.
2. **Add sorting.** `catalog.sort` already exists as a key. Order by name,
   cup score, or bags — expressed as an added `.order()` in `queryCatalog` and a
   `sort` URL param, so it stays DB-side and paginates correctly.
3. **Availability filter** — `catalog.availability` key exists; maps to
   `coffee_offers.status`.
4. **Expandable preview** — §8.
5. **One protected-price banner** above the results instead of per-card
   repetition, per the reference observation.
6. Keep the GET-form + URL-param model exactly as it is. It is shareable,
   back-button-correct, server-rendered and already working.

Filter presentation: keep `FilterPanel`'s mobile disclosure. On desktop the
current single-row form is already compact; a left rail is **optional** and
should only be adopted if the added facets make the row overflow. Prefer the
smaller change.

---

## 8. Expandable coffee / offer preview plan

### 8.1 Field mapping — only what the schema actually supports

| Reference field            | Hills source                                           | Available in `CatalogRow` today?                               |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| Full name                  | `coffee_translations.name`                             | ✅ `name`                                                      |
| Origin                     | `origin_translations.name`                             | ✅ `origin`                                                    |
| Region                     | `region_translations.name`                             | ✅ `region` (nullable)                                         |
| Process                    | `processing_methods.slug`                              | ✅ `process` (nullable)                                        |
| Grade                      | `coffees.grade`                                        | ✅ `grade` (nullable)                                          |
| Ref #                      | `coffee_offers.reference_number`                       | ✅ `reference`                                                 |
| Bags / bag weight          | `bags_quantity`, `bag_weight_kg`                       | ✅                                                             |
| Warehouse                  | `warehouse_translations.name`                          | ✅ `warehouse`                                                 |
| Availability status        | `coffee_offers.status`                                 | ✅ `status`                                                    |
| Cup score                  | `coffee_offers.cup_score`                              | ✅ `cupScore` (nullable)                                       |
| **Packaging**              | `OfferListItem.packaging`                              | ❌ **needs adding**                                            |
| **Available from / crop**  | `OfferListItem.availableFrom`                          | ❌ **needs adding**                                            |
| **Certifications**         | `coffee_certifications` → `certification_translations` | ❌ **needs adding**                                            |
| **Tags**                   | `coffee_tags`                                          | ❌ **needs adding**                                            |
| **Sensory notes**          | `offer_sensory_notes` → `sensory_note_translations`    | ❌ **needs adding**                                            |
| Variety                    | `coffee_varieties` → varieties                         | ❌ needs adding (verify translation table before promising it) |
| Producer / farm / altitude | —                                                      | **Does not exist. Will not be invented.**                      |

### 8.2 How to add the missing five

**Extend `queryCatalog`, do not revert to `getOfferList`.** `getOfferList`
fetches the entire catalog; using it for the listing would undo the bounded
query that P6-T01 deliberately introduced.

Add one bounded batch round-trip **for the current page's rows only**, using the
identical pattern already in `queryCatalog` for coffee/origin/region/warehouse
translations: collect the page's `coffeeIds`/offer ids, issue `.in(...)` reads,
map them on. Cost is a fixed handful of queries per page regardless of catalog
size — no N+1, no unbounded transfer.

### 8.3 Interaction

Reuse the existing `AccordionExpand` motion primitive
(`@/components/motion/primitives`) — the same one `FilterPanel` uses — so the
motion system and reduced-motion contract are inherited rather than re-invented.

- `<button aria-expanded aria-controls>` toggles a region with a stable id;
- keyboard operable, visible focus ring, ≥44px target;
- chevron uses `rtl:rotate-180` (the pattern already used by the pagination
  arrows in the listing);
- reference codes, `320 × 60 kg`, cup scores and dates are Latin/numeric inside
  Arabic text — wrap them with `dir="ltr"` in an RTL context, exactly as the
  verify-email page already does for the masked email;
- the expanded panel is a **preview**; it always offers the link to the canonical
  `/green-coffee-offer-list/[slug]` detail page and never replaces it.

---

## 9. Protected-pricing behaviour matrix

**No change to the security model.** Presentation only, around the existing
contract.

| Persona                   | Price visible | Listing message                                                    | Enforcement (unchanged)                                                                      |
| ------------------------- | ------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Anonymous                 | No            | "Sign in to view pricing" → `/sign-in`                             | `requireVerifiedUser()` inside `getProtectedPriceTiers()`; no price column in `queryCatalog` |
| Unverified USER           | No            | "Verify your email to view pricing" → resend/verify                | `emailVerified` false → helper returns null                                                  |
| Verified USER (unblocked) | **Yes**       | tiers rendered                                                     | `hills_is_verified_user()` RPC + RLS                                                         |
| Blocked USER              | No            | existing restricted-account behaviour; do not advertise capability | `isBlocked` → helper returns null; RLS                                                       |
| ADMIN                     | **No**        | neutral — no customer CTA                                          | `requireVerifiedUser()` requires `role = USER`; ADMIN never passes                           |

Rules this plan binds itself to:

- price stays server-side; nothing moves to the client;
- `getProtectedPriceTiers()` remains the only price reader and keeps its internal
  gate — the page-level `viewer?.emailVerified` check stays a _pre-filter only_;
- the expandable preview renders price **only from the same server-resolved map**
  the cards already use — it never fetches its own;
- no price value is placed in JSON-LD, `<meta>`, or any client prop for a
  non-entitled viewer.

---

## 10. Auth-aware CTA plan

### 10.1 The shared resolver — and which helper it must use

Add `src/lib/auth/persona.ts`:

```
type PublicPersona = "anonymous" | "unverified" | "verified" | "blocked" | "admin";
async function getPublicPersona(): Promise<PublicPersona>
```

It composes **`getViewer()`**, not `requireVerifiedUser()`.

This is deliberate and evidence-based: `requireVerifiedUser()` calls
`supabase.auth.signOut()` when the viewer is blocked. That is an acceptable side
effect on an entitlement path, but on a _public marketing page_ it would sign a
visitor out as a side effect of rendering a CTA. The same reasoning was already
applied and accepted on the Contact page. `getViewer()` is non-throwing, has no
side effects, and exposes `role`, `emailVerified` and `isBlocked` — everything a
CTA needs.

**This is presentation state, not a new authorization layer.** No CTA decides
entitlement; every protected read keeps its own server-side gate.

### 10.2 CTA inventory

| Component / page                            | Current CTA                                      | Anonymous               | Unverified             | Verified USER                       | Blocked              | ADMIN                  | Proposed change                                                 |
| ------------------------------------------- | ------------------------------------------------ | ----------------------- | ---------------------- | ----------------------------------- | -------------------- | ---------------------- | --------------------------------------------------------------- |
| `site-header.tsx`                           | "Sign in" (when `requireVerifiedUser()` is null) | Sign in                 | **shows "Sign in"** ❌ | account menu ✅                     | shows "Sign in"      | **shows "Sign in"** ❌ | Persona-driven: Verify email / account menu / neutral for ADMIN |
| `mobile-menu.tsx`                           | `actionHref` `/sign-in` \| `/account`            | Sign in                 | "Sign in" ❌           | Account ✅                          | Sign in              | "Sign in" ❌           | Same resolver, passed as props                                  |
| `site-footer.tsx`                           | account links \| "Sign in"                       | Sign in                 | "Sign in" ❌           | links ✅                            | Sign in              | "Sign in" ❌           | Persona-driven                                                  |
| home `page.tsx` — path 3 "Trade With Hills" | "Sign in" + "Need access?"                       | correct                 | Verify email           | **"View available lots" / account** | restricted messaging | neutral public action  | **Main fix** — page currently reads no viewer                   |
| home `page.tsx` — gold account band         | "Continue" → `/sign-up`                          | correct                 | Verify email           | **"Go to your account"**            | restricted           | hide or neutral        | **Main fix**                                                    |
| `green-coffee-offer-list/page.tsx`          | per-card `actions.pricing`                       | Sign in to view pricing | Verify to view pricing | tiers ✅                            | no capability        | neutral                | Single banner + persona copy                                    |
| `green-coffee-offer-list/[slug]`            | pricing + inquiry panel                          | correct                 | correct                | correct                             | check                | check                  | Already passes `signedIn`/`verifiedEmail` — align wording       |
| `inquiry-panel.tsx`                         | sign-in / verify prompts                         | correct                 | correct                | correct                             | verify               | verify                 | Audit against resolver                                          |
| `contact/page.tsx`                          | RFQ + Sign in / account                          | ✅ already fixed        | ✅                     | ✅                                  | check                | ✅                     | Reference implementation                                        |
| `request-a-quote/page.tsx`                  | `requireVerifiedUser()`                          | correct                 | correct                | correct                             | correct              | correct                | No change                                                       |

Message-file sweep: `nav`, `actions`, `home`, `footer`, `catalog`, `product`,
`quote`, `inquiry`, `account`, `auth` namespaces all need checking for copy that
presumes anonymity, in **both** `messages/en.json` and `messages/ar.json`.

### 10.3 Shared presentation component

`src/components/auth/auth-cta.tsx` — takes a persona plus a per-slot map of
`{ label, href }` and renders the correct one. Each calling section supplies its
own contextual copy (a catalog CTA and a home-page CTA should not say the same
thing), but **the branching logic lives in exactly one place**. This directly
answers the "do not create different authorization logic inside every CTA"
requirement.

---

## 11. EN / AR / RTL plan

- All new copy via `next-intl` keys in both message files. No hardcoded strings.
  Reuse the existing unused keys — `catalog.sort`, `catalog.certification`,
  `catalog.availability`, `catalog.details` — before adding new ones.
- New keys anticipated: `search.*` (placeholder, submit, close, results,
  empty, sections), `nav.searchLabel`, `catalog.expand`/`collapse`,
  `cta.*` per persona slot.
- **Logical properties everywhere** (`ps/pe`, `ms/me`, `start/end`,
  `inset-inline-*`). Any physical transform used in the search expansion needs an
  explicit `rtl:` counterpart — the exact class of bug fixed in the mega menu.
- Search input inherits document direction; Latin queries inside an RTL field
  render correctly because the field is `dir="auto"`-safe.
- Chevrons/arrows: `rtl:rotate-180` / `rtl:-scale-x-100`, matching existing usage.
- Reference codes, weights, cup scores and dates wrapped `dir="ltr"` inside AR.
- Origin/facet labels come from `*_translations` and are already localized.
- Verification by measurement, not inspection: assert panel/input geometry in
  both directions, as the mega-menu fix did.

---

## 12. Mobile / responsive plan

| Surface          | Desktop                                                | Mobile (375px)                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header search    | Expands inline in the header bar                       | Header has no room — the icon is `sm:`-only today. Open a **full-width sheet/overlay** below the header, or surface search inside `MobileMenu`. Recommend the sheet: it keeps search reachable without opening the whole menu. |
| Origins          | Mega-menu column with real origins                     | Grouped section inside `MobileMenu`                                                                                                                                                                                            |
| Filters          | Inline row (add a left rail only if the row overflows) | Existing `FilterPanel` disclosure; consider a bottom sheet if facet count grows                                                                                                                                                |
| Catalog items    | Row-style layout with expand chevron                   | **Card-style stacked layout, same component** — do not ship the desktop table at 375px                                                                                                                                         |
| Expanded preview | Multi-column definition grid                           | Single-column stacked pairs                                                                                                                                                                                                    |

One responsive component for the catalog item rather than a separate table and
card implementation — two implementations drift, and the pre-Phase-12 pass
already established an adaptive-layout precedent.

Constraints: ≥44px touch targets (the codebase already uses `min-h-11`/`h-12`),
**zero horizontal overflow at 360px and 375px** — enforced by the existing
`hasHorizontalOverflow()` audit helper, which correctly distinguishes a page that
scrolls sideways from a contained scroller.

---

## 13. Accessibility plan

- Search trigger: `aria-expanded`, `aria-controls`, accessible name; focus moves
  to the input on open and returns to the trigger on close/Escape.
- Search form: `role="search"`, labelled input (`sr-only` label, as the catalog
  form already does).
- Origins dropdown: existing mega-menu keyboard/focus behaviour reused.
- Expandable rows: `aria-expanded` + `aria-controls` on the toggle, stable ids,
  logical focus order, no focus trap.
- Filters/sort: every control labelled; result count already announced via
  `aria-live="polite"` — keep it.
- Visible focus rings (`focus-visible:ring-2 focus-visible:ring-ring` is the
  house pattern); no removal of outlines.
- Reduced motion honoured through the existing `[data-motion]` reset and the
  shared motion primitives — no bespoke animation that bypasses it.
- Axe checks on the new/changed surfaces, matching the existing suite.

---

## 14. Performance plan

- Header stays a **server component**; only `HeaderSearch` and the origins
  dropdown are client islands, and both receive already-rendered props.
- **No coffee dataset in the client bundle.** Origins ship as a short label/slug
  list only.
- Search and filters are **URL params + server rendering** — no client-side
  index, no fetch-on-keystroke. (Typeahead is explicitly out of scope, §21.)
- Expandable content is server-rendered with the row and toggled by CSS/disclosure
  — no per-row fetch on expand.
- Extra offer fields arrive via a **bounded batch** keyed on the current page's
  ids, matching the existing translation-batch pattern.
- Watch LCP on the listing; the pre-Phase-12 pass already fixed a real mobile LCP
  regression, and the same budget applies.

---

## 15. Exact files expected to change

**New (7):**

| File                                          | Purpose                                       |
| --------------------------------------------- | --------------------------------------------- |
| `src/app/[locale]/(site)/search/page.tsx`     | Unified results page                          |
| `src/lib/data/search.ts`                      | Composes existing readers; no new SQL surface |
| `src/components/navigation/header-search.tsx` | Expand/focus/Escape island                    |
| `src/components/catalog/catalog-item.tsx`     | Responsive expandable row/card                |
| `src/lib/auth/persona.ts`                     | `getPublicPersona()` presentation resolver    |
| `src/components/auth/auth-cta.tsx`            | Shared persona-aware CTA                      |
| `tests/e2e/search-catalog-cta.spec.ts`        | Focused suite (§18)                           |

**Modified (~11):**

`src/components/navigation/site-header.tsx` · `mobile-menu.tsx` ·
`catalog-mega-menu.tsx` · `site-footer.tsx` ·
`src/app/[locale]/(site)/green-coffee-offer-list/page.tsx` ·
`src/app/[locale]/(site)/page.tsx` · `src/lib/data/catalog-query.ts` ·
`src/components/catalog/filter-panel.tsx` (only if a rail is adopted) ·
`messages/en.json` · `messages/ar.json` · possibly
`src/lib/auth/redirects.ts` (add `/search` to `knownRoots` only if a redirect
ever targets it).

**Estimated source files to change: ~18 (7 new, ~11 modified).**

---

## 16. Existing modules and functions to reuse

`queryCatalog`, `CatalogFilters`, `CatalogRow`, `getCatalogFacets`,
`CATALOG_PAGE_SIZE` · `getProtectedPriceTiers` (unchanged, gate intact) ·
`getOrigins`, `getArticles`, `getOriginBySlug` · `getViewer` (presentation),
`requireVerifiedUser` (entitlement only) · `CatalogCard`, `FilterPanel`,
`FavoriteButton` · `AccordionExpand`, `SectionReveal`, `FilterTransition`,
`NavUnderline` · `Link`/`useRouter` from `@/i18n/navigation` ·
`localizedMetadata`, `localizedUrl`, `Breadcrumbs` · `collectRuntimeProblems`,
`devOverlayError`, `auditScreen`, `hasHorizontalOverflow`, `visitInTheme`.

---

## 17. New components justified

Only where nothing exists: `HeaderSearch` (the current icon is a bare link),
`search/page.tsx` + `search.ts` (no search route or reader exists),
`CatalogItem` (no expandable item exists), `persona.ts` + `AuthCta` (no shared
CTA state model exists). Everything else extends what is already there.

---

## 18. Tests required

**Header search** — icon click opens the input **without navigating**; input
focused; submit navigates to `/search?q=…`; Escape closes and restores focus;
empty submit does not navigate; EN + AR; desktop + 375px; clean
console/pageerror/hydration gate.

**Search results** — a seeded coffee, origin and article each appear; a DRAFT /
ARCHIVED coffee does **not**; an unpublished article does **not**; **no price
string appears for an anonymous viewer** (reuse the existing protected-price scan
approach, with a token-boundary needle rather than a bare substring — see §20).

**Origins** — header dropdown lists real active origins in EN and AR; selecting
one lands on `/green-coffee-offer-list?origin=<slug>` with results narrowed;
`/coffee-origins/<slug>` still resolves; RTL geometry measured (panel within
viewport, centre tracks trigger).

**Catalog** — each filter narrows results; `certified` and `sort` behave; filters
survive pagination; expand/collapse works by mouse and keyboard with correct
`aria-expanded`; expanded panel shows only fields that have data; detail link
navigates; no horizontal overflow at 360/375.

**Pricing** — anonymous hidden · unverified hidden · verified USER authorized ·
blocked denied · **ADMIN not treated as a customer**. Reuse the Phase-12 persona
fixtures (`p12-fixtures.ts`, `signInAs`) rather than inventing new ones.

**Auth-aware CTA** — for all five personas across home, header, footer, catalog:
assert a **verified USER is never shown "Sign in" or "Verify your email"**, and
an ADMIN is never shown a customer CTA. This is the regression the owner
reported, so it gets an explicit named assertion.

All authenticated tests inherit the Phase-12 console / pageerror / hydration /
Dev-Overlay gate.

---

## 19. Implementation order

| #   | Step                                                     | Risk       | Why here                                                                             |
| --- | -------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| 1   | `persona.ts` + `AuthCta` + CTA tests                     | LOW        | Pure addition; nothing consumes it yet                                               |
| 2   | Apply CTAs to home, header, mobile menu, footer          | LOW        | Fixes the owner-visible contradiction first                                          |
| 3   | Extend `queryCatalog` with the bounded extra-field batch | **MEDIUM** | Only data-layer change; verify no price column is added and pagination still matches |
| 4   | `CatalogItem` expandable + listing integration           | LOW        | Presentation over step 3                                                             |
| 5   | Expose `certified`, `sort`, availability filters         | LOW        | Params + one `.order()`                                                              |
| 6   | Origins in the mega menu + mobile menu                   | LOW        | Facets already exist                                                                 |
| 7   | `search.ts` + `/search` page                             | LOW        | Composes existing readers                                                            |
| 8   | `HeaderSearch` island                                    | **MEDIUM** | RTL expansion geometry is the known trap                                             |
| 9   | EN/AR, 360/375, light/dark, reduced-motion polish        | LOW        | —                                                                                    |
| 10  | Full regression gate                                     | —          | typecheck, lint, build, unit, integration, desktop, mobile                           |

Steps 1–2 alone resolve the reported contradiction and are independently
shippable.

---

## 20. Risks and rollback

| Risk                                                              | Mitigation                                                                                                       | Rollback                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| RTL search expansion repeats the logical/physical compounding bug | Logical properties; explicit `rtl:` counterpart for any transform; **measure** both directions                   | Revert `header-search.tsx`; restore the icon link                    |
| `queryCatalog` extension changes row counts or leaks a column     | Additive batch only; assert `pageCount`/`total` unchanged for identical filters; re-run the protected-price scan | Revert `catalog-query.ts`; `CatalogItem` degrades to existing fields |
| Persona resolver drifts into an authorization layer               | It only reads `getViewer()`; every protected read keeps its own gate; tests assert ADMIN is not a customer       | Revert `persona.ts`; sections fall back to current CTAs              |
| Search surfaces unpublished content                               | Reuse existing published-filtered readers only; explicit negative tests                                          | Revert `search.ts`                                                   |
| Header becomes JS-heavy                                           | Two small islands; server-rendered data; no client index                                                         | Revert islands                                                       |
| Mobile search has no room                                         | Sheet/overlay pattern, not inline                                                                                | Keep search in `MobileMenu` only                                     |

**Two pre-existing findings surfaced by this audit** (neither caused by, nor
blocking, this work):

1. `countMatching()` in `catalog-query.ts` omits the `certified` certification
   join that `queryCatalog()` applies, so the fallback count could disagree when
   `certified` is set. It is only reached on `PGRST103`. Worth fixing **as part
   of step 5**, since that step is what first makes `certified` reachable.
2. The Phase-12 protected-price scan matches a bare numeric substring and can
   collide with SVG path geometry. Any new price assertion here should use a
   token boundary from the outset.

---

## 21. Out of scope

Any Phase-13 SEO work (canonical/hreflang/sitemap/schema changes); a visual
redesign or any move toward Sucafina's look; new marketing routes; a `/products`
route; typeahead/autocomplete or a search-as-you-type index; full-text search
infrastructure (`tsvector`, trigram indexes, external search services); any
schema, RLS, function or Auth change; changes to the RFQ page or public sample
dialog; changes to Admin surfaces; new taxonomy or business fields; producer /
farm / altitude data, which does not exist in this schema.

---

## 22. Acceptance gate

1. A verified USER never sees "Sign in" or "Verify your email" on any public
   surface; an ADMIN never sees a customer CTA.
2. The header search icon opens an input **without navigating**; submitting
   navigates to `/search?q=…`; Escape closes and restores focus — EN and AR,
   desktop and 375px.
3. `/search` returns real coffees, origins and articles; unpublished, draft and
   archived records are absent; **no price is present for an anonymous viewer**
   in source, metadata or any response.
4. Origins in the header come from live active origin records, are localized, and
   land on existing canonical routes. No duplicate origin page.
5. The catalog filters, sorts, paginates and expands correctly; the expanded
   preview shows only fields the schema supports; the detail page still works.
6. The protected-pricing matrix in §9 holds for all five personas, enforced
   server-side.
7. Zero horizontal overflow at 360/375; ≥44px targets; axe clean; console /
   pageerror / hydration gate clean across EN/AR and light/dark.
8. Full regression green: typecheck, lint, build, unit, integration, desktop,
   mobile.
9. `DATABASE MIGRATION: NO` · `RLS CHANGE: NO` · `AUTH MODEL CHANGE: NO`.

---

# Implementation record

Appended after building the plan. Everything below is what was actually done,
including the two places the implementation deviates from the plan and why.

## Caching architecture — deliberate, and mostly a decision _not_ to cache

Next.js **16.3.3**, `reactCompiler: true`, `cacheComponents` **not** enabled.

**What is cached:** request-level memoization via React `cache()` only —
`getViewer()` and `getSiteLogo()` already did this, and `getPublicPersona()`
now joins them. Cache identity is _one server request_. The header, footer and
page body therefore resolve the viewer and persona from a single
`auth.getUser()` round trip instead of three.

**What is deliberately NOT cross-request cached, and why.** Public facet data
(origins, processes, types, warehouses) is the obvious candidate, and the plan
proposed evaluating it. Reading this version's own docs changed the answer:

- **`use cache`** is the correct Next 16 API, but
  `node_modules/next/dist/docs/.../use-cache.md` states it _"is a Cache
  Components feature"_ requiring `cacheComponents: true` in `next.config.ts`.
  That flag changes rendering semantics for the entire application, not just
  the catalog. It is an architecture change that warrants its own review, and
  it is outside this follow-up.
- **`unstable_cache`** is documented in this version as _"replaced by `use
cache` in Next.js 16"_, and its own note says accessing `cookies` inside a
  cache scope is unsupported. `getCatalogFacets()` builds a Supabase client
  through `createSupabaseServerClient()`, which reads cookies — so wrapping it
  would require a second, cookie-free client path _plus_ a `revalidateTag`
  mechanism that does not exist in this codebase yet (every Admin mutation
  currently calls `revalidatePath("/", "layout")`, which does not invalidate
  `unstable_cache` entries).

Adding a deprecated API, a second Supabase client and a second invalidation
mechanism to avoid eight small indexed reference-table reads is a poor trade.
The facet queries are already bounded and indexed, and the catalog page's
expensive work is the offer query, which must stay per-request anyway because
it is filtered by URL parameters.

**Never cached, by construction:**

| Data                     | Why                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewer / `PublicPersona` | Identity-derived. `cache()` is per-request only; nothing crosses a request boundary.                                                                                                                                                        |
| Protected price tiers    | Read through `getProtectedPriceTiers()` → `requireVerifiedUser()` → `hills_is_verified_user()` RPC, per request. No shared cache anywhere on this path, so no anonymous, blocked or Admin request can receive a verified customer's result. |
| Catalog results          | Filtered by URL parameters and rendered per request.                                                                                                                                                                                        |
| Search results           | Composed from the readers above, per request.                                                                                                                                                                                               |

**Invalidation.** Nothing new was introduced because nothing new is cached
across requests. The existing `revalidatePath("/", "layout")` in every Admin
mutation (`admin-catalog.ts`, `admin-articles.ts`, `admin-branding.ts`,
`admin-cms.ts`, …) continues to refresh the public routes, so a new origin,
coffee, offer or article appears in the facets, the catalog and search without
a second invalidation architecture.

**Recommendation for Phase 13:** if page-level caching becomes worthwhile,
adopt `cacheComponents: true` and `use cache` as one deliberate migration,
using `cacheTag` keyed by locale plus `revalidateTag` in the Admin mutations —
not `unstable_cache`.

## Realtime verdict

**REALTIME USED: NO.** `grep` for `realtime|channel(|postgres_changes` across
`src/` returns nothing: this project has never used Supabase Realtime, and
Phase 12 introduced none. Filtering here is a URL/query-parameter problem
solved by server rendering, not a subscription problem. No trigger,
publication or subscription was created.

## Deviations from the plan

1. **Sorting excludes coffee name.** The plan listed "name, cup score, or
   bags". Names live in `coffee_translations`, a to-many embed that PostgREST
   cannot order a parent by reliably. The alternatives were ordering by
   `coffees.slug` — alphabetical in English only, and misleading in Arabic —
   or adding a database view, which is the schema change this follow-up
   excludes. Implemented: reference (default), cup score, bags available, each
   with `reference_number` as a stable tiebreaker so rows cannot jump between
   pages. **No owner approval needed**; flagged for visibility.

2. **The header search trigger stays desktop-only; mobile search lives in the
   drawer.** The plan offered either a sheet below the header or the drawer.
   The header already carries brand, theme, locale and menu controls, and this
   project has previously had to fix a mobile header overflow; adding a fifth
   44px control risked reintroducing it at 360px. The drawer has room, needs no
   client state, and the audit confirms zero horizontal overflow at 360px and
   375px in both languages. **No owner approval needed.**

Two smaller notes: `variety` is included in the expandable preview and is
English-only, because the schema has `varieties` but no `variety_translations`
— a fact the Admin reference suite already records as "English-only by schema".
And the `certified` / `countMatching` mismatch identified in the plan was fixed
structurally, by extracting one `applyCatalogFilters()` builder that both the
row query and the count query use, rather than by patching the count once.

## Results

| Gate                                         | Result                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| Typecheck · lint · build                     | clean (1 pre-existing warning in committed `scripts/e2e/seed.mjs`)              |
| Unit                                         | **168/168** (+7 new: `persona-policy.test.ts`)                                  |
| Integration                                  | **122/122**                                                                     |
| Follow-up suite `search-catalog-cta.spec.ts` | **60 passed, 4 skipped** across desktop + mobile                                |
| Visual / responsive audit                    | **60 screenshots, 0 problems** — 5 surfaces × EN/AR × 1440/375/360 × light/dark |
| `format:check`                               | 71 pre-existing files drift; **none of the files this work touched**            |

The 4 skips are by design: the header search trigger is desktop-only, so its
four mobile cases skip and the drawer test covers the phone path instead.

### Regressions this work introduced, found by the full regression and fixed

The 2.4h all-suites run returned 421 passed / 10 failed. Three failures were
genuinely caused by this change:

1. **`p12-persona-matrix` — a verified customer stopped seeing pricing.**
   `CatalogItem` rendered the price as adjacent JSX children, which React
   serializes as separate text nodes joined by `<!-- -->`. Phase 12 matches
   rendered HTML, so it stopped matching. This is the same hydration-comment
   trap that had already made an early price-leak scan pass vacuously — the
   scan was corrected then, but the cause was left in the markup. Now emitted
   as a single template literal, identical to the card it replaced. Same fix
   applied to the bags cell.
2. **`p12-visual` — horizontal overflow on `/account` at 375px.** The search
   trigger had been made visible at all widths after the _anonymous_ audit
   showed no overflow; the authenticated header carries the wider account menu
   and tipped over. Trigger is `hidden sm:grid` again and phones use the drawer.
3. **`theme-locale` — primary navigation no longer reached the catalog.** The
   header's only direct `<a href="/green-coffee-offer-list">` _was_ the search
   icon this work converted into real search. Fixed by splitting the Products
   mega-menu trigger into a real link plus a separate chevron disclosure button
   with its own accessible name, so "Products" navigates to the canonical route
   and the panel stays keyboard-reachable.

The other 7 failures were not caused by this work: `admin-catalog` and
`admin-sweep` match on substrings that a seeded fixture origin also satisfies;
`public-inquiry` × 2 is the pre-existing bare-numeric price scan matching `7.5`
inside shield-check **SVG path geometry** — exactly the fragility §20 predicted;
and one `net::ERR_ABORTED` navigation flake.

### Performance

| Route                       | Desktop LCP | 375px LCP | CLS |
| --------------------------- | ----------- | --------- | --- |
| Home                        | 1276 ms     | 832 ms    | 0   |
| Catalog                     | 928 ms      | 836 ms    | 0   |
| Catalog (filtered + sorted) | 844 ms      | 768 ms    | 0   |
| Search                      | 576 ms      | 520 ms    | 0   |
| Catalog (AR)                | 872 ms      | 1000 ms   | 0   |

**A filter change costs exactly one request.** No client-side catalog dataset,
no fetch per keystroke, no duplicated client/server fetch, no router loop.

### Cache verification

Two permanent tests now make the caching claims falsifiable rather than
asserted:

- _an entitled response is never replayed to an anonymous visitor_ — fetches the
  same URL as a verified customer, then anonymously in the same browser, and
  fails if pricing survives. This is the test that would catch any future
  page-level cache leaking identity.
- _locales do not share catalog facet results_ — EN and AR return the same
  number of origin options with different labels.

### Fixture cleanup and data protection

Run `E2E-HILLS-mtmwrc1ccra`: 133 rows, 4 auth users and 11 storage objects
created and removed; **0 refused**, **0 pre-existing rows missing**. Verified
independently afterwards: `e2e/mtmwrc1ccra/` → 0 objects, fixture auth users
0/4, protected account present, not banned, confirmed, `role=USER
is_blocked=false`. Zero `e2e-hills-` rows remain in `coffees`, `origins`,
`regions`, `site_pages` or `media`.

Two items the cleanup flagged are **not** this work's, and both were attributed
from timestamps and ownership rather than assumed:

- **`site_settings:1`** — `updated_at` 13:35:30Z, inside the full-regression
  window, `updated_by` null, logo null and never fixture media, brand intact.
  The project's own Phase-8 branding tests.
- **8 inquiries** — `qa-oa-*@example.invalid`, created 13:20Z and 13:38Z (two
  batches, desktop and mobile), **0 of 8 in this run's manifest**. The
  `public-inquiry` suite's own leftovers. Left in place: deleting a row whose
  ownership cannot be proven from the active manifest is precisely what the
  rules forbid.

Also still present and still not ours: 21 `e2e-hills-` auth users from **Phase-3
and Phase-5** runs dated 2026-09-01/09-03 (**0 from any run in this work**), and
one inert orphaned storage folder from a Phase-12 aborted seed. Both were
already recorded at Phase-12 closure.

### Dead code removed

`src/components/catalog/filter-panel.tsx` was left orphaned by this work —
`CatalogFilters` absorbed its mobile disclosure — and has been deleted on the
owner's instruction after a reference sweep found nothing legitimate: no
imports, no dynamic imports, no barrel export, no test references. The only
`catalog-filter-panel` hits are DOM id strings (one in `CatalogFilters`, one
self-reference); the only file-path mentions are documentation — this plan and
the Phase-9 record in `IMPLEMENTATION-CHECKPOINT.md`.

That Phase-9 entry is left untouched on purpose: it records what Phase 9
_added_, which remains historically true, and editing it would rewrite a past
phase's record rather than describe the present.

Verified after removal: typecheck, lint, unit (168/168) and build all clean,
the catalog and search routes still build, and the 22 catalog-discovery and
expandable-item tests pass across desktop and mobile — so the disclosure
behaviour the component used to own is genuinely unchanged.
