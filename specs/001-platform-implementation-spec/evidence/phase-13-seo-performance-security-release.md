# Phase 13 — SEO, Performance, Security & Production-Readiness Audit

Run date: 2026-09-05 · Final official phase · Status: **P13-T01–T05 PASS, P13-T06 PASS with a documented external dependency**

---

## Production hostname status

| Item                                                     | State                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Intended production canonical host                       | `https://www.hillscoffees.com`                                                                                         |
| Domain connected to this application                     | **NO**                                                                                                                 |
| Code/config ready for that host                          | **YES** — verified by building with `NEXT_PUBLIC_SITE_URL=https://www.hillscoffees.com` and reading the emitted output |
| Live-domain DNS / HTTPS / redirects / crawl / indexation | **PENDING — DOMAIN NOT YET CONNECTED**                                                                                 |

Nothing in this report claims a live-domain verification. The production-host
build was made locally purely to prove the host wiring; `robots.txt`, the
sitemap and every canonical rendered `https://www.hillscoffees.com` from that
build. `src/lib/env.ts` still fails fast when `NEXT_PUBLIC_SITE_URL` is missing
in production, so a deploy cannot silently fall back to localhost.

---

## Owner SEO document audit

Both owner documents were read in full:
`HillsCoffee_SEO_Development_Specification.pdf` and
`HILLS Brand GuidLines copy.pdf` (note the folder spells it "GuidLines").

### OWNER SEO DOCUMENT FINDINGS USED

| Finding                                                                                                                                          | Where applied                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical host `https://www.hillscoffees.com/`                                                                                                   | Verified end to end against a production-host build                                                                                                                          |
| `/green-coffee-offer-list/` is the canonical inventory hub; do not rely on legacy `/products/{id}`                                               | Already true; the legacy `/products/*` → `/green-coffee-offer-list/*` 301s already exist in `next.config.ts`                                                                 |
| §8.1 — filtered offer-list URLs (`?origin=…&process=…`) must be **noindex, follow**; sort/view/pageSize must not create separate indexable pages | Implemented in the catalog's `generateMetadata`: any of `q, origin, process, location, type, availability, certified, sort` ⇒ `noindex, follow` + canonical to the clean hub |
| §8.1 — pagination stays crawlable                                                                                                                | `page` is deliberately excluded from the noindex trigger; pagination renders real `<a>` links                                                                                |
| Only 200/indexable/canonical/published URLs in XML sitemaps; accurate `lastmod`; no redirected/dead/filter URLs                                  | Sitemap rewritten to enforce exactly this                                                                                                                                    |
| Connected `@graph` with stable `@id`s (`#organization`, `#website`, `{canonical}#webpage`, `#breadcrumb`)                                        | Already the established pattern; extended with `#itemlist` and `#origin`                                                                                                     |
| Offer-list hub ⇒ `CollectionPage` + `ItemList` + `BreadcrumbList`                                                                                | Catalog upgraded from bare `ItemList` to `CollectionPage` + `ItemList`                                                                                                       |
| Origin hub/detail ⇒ `CollectionPage`/`WebPage` + `Place` + `ItemList`                                                                            | Added to `/coffee-origins` and `/coffee-origins/{slug}`                                                                                                                      |
| Contact/RFQ ⇒ `ContactPage` + `Organization`                                                                                                     | Added to `/contact`                                                                                                                                                          |
| "Offer only when price/availability are visible and current"                                                                                     | **No `Offer` node and no price field is emitted publicly** — the coffee lot renders `Product` without price, which is the only correct reading given protected pricing       |
| Metadata must never output `[object Object]` or placeholder values                                                                               | Asserted for every sitemap URL by the new crawl suite                                                                                                                        |
| `robots.txt` must reference the sitemap and not block rendering resources                                                                        | Verified                                                                                                                                                                     |

### OWNER SEO DOCUMENT FINDINGS NOT APPLICABLE

| Finding                                                                                                             | Why not applied                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Segmented sitemap index (`/sitemap-static.xml`, `-commercial`, `-origins`, `-offer-list`, `-knowledge`, `-support`) | The site publishes **24 URLs**. Segmentation exists to keep sitemaps under 50,000 URLs / 50 MB; at this volume it would add six files and a routing layer for no crawl benefit. Both the owner's Phase-13 brief and P13-T01 say to segment **only if data volume warrants it**. It does not. Revisit past a few thousand URLs. |
| IndexNow submission for offer-list changes                                                                          | Requires a deployed origin and a hosted key file. Not actionable before the domain is connected; recorded in the release checklist.                                                                                                                                                                                            |
| Author/reviewer `Person` nodes on knowledge guides                                                                  | The schema has no author entity. `src/lib/seo/article.ts` already documents this and omits `author` rather than inventing a person.                                                                                                                                                                                            |
| `Service` nodes on commercial supplier pages                                                                        | Those pages do not exist (below).                                                                                                                                                                                                                                                                                              |

### OWNER SEO DOCUMENT CONFLICTS

| Conflict                                                                                                                                                                                                                                      | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trailing slashes.** The spec requires "trailing slash enforced for public canonical routes". The application serves **non-trailing-slash** URLs, and P13-T01 explicitly says to KEEP "the existing trailing-slash-free robots/sitemap fix". | **Product and official Spec Kit win.** Switching would change every public URL in the site, contradict an explicit KEEP instruction, and require a full redirect map — for zero SEO gain, since either convention is fine provided it is consistent. Consistency was verified.                                                                                                                                                |
| **Lot URL pattern** `/green-coffee-offer-list/{origin-lot-slug}-{stable-id}/`. Live routes are `/green-coffee-offer-list/{slug}`.                                                                                                             | **Product wins.** The brief forbids changing public URLs unnecessarily; the existing slugs are stable, unique and already indexed in the sitemap.                                                                                                                                                                                                                                                                             |
| **"English-only canonical site"** implied by one migration row.                                                                                                                                                                               | **Product wins.** The platform is bilingual by contract (FR/SC-003), with reciprocal hreflang.                                                                                                                                                                                                                                                                                                                                |
| **Commercial landing pages** (`/green-coffee-beans-supplier/`, `/wholesale-coffee-beans/`, and seven more) are central to the spec's architecture but **do not exist as routes**.                                                             | Not created. Creating nine keyword-targeted pages with no authored content is precisely the "fake SEO pages / doorway pages / new product scope" the brief prohibits. **They are already provisioned as CMS pages** (all 18 currently `DRAFT`) and the sitemap allow-list already names them, so they enter the index the moment the owner writes and publishes them. This is an owner content decision, not a developer one. |

### UNSUPPORTED CLAIMS REJECTED

- No reviews, ratings, `aggregateRating`, awards, certifications, statistics or credentials were added to any schema.
- No `Offer`, `price`, `priceCurrency`, `lowPrice` or `highPrice` in public structured data.
- Brand copy from the guidelines — mission, vision, the tagline _"Beyond The Origin."_, the values list — was **deliberately not injected into `Organization` schema**. Those strings are not rendered on the pages in question, and the owner's own specification forbids "hidden SEO-only schema values". Facts already in `site_settings` (brand name, legal name, email, phone, address) continue to populate the node.
- No coordinates, production volumes or trade claims on the origin `Place` nodes — only the origin name and its continent, both of which the row actually holds and the page visibly shows.

---

## P13-T01 — SEO architecture · PASS

### Sitemap inventory

| Metric                              | Value                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Total URLs                          | **24**                                                                                                                              |
| EN URLs                             | **12**                                                                                                                              |
| AR URLs                             | **12**                                                                                                                              |
| Static indexable paths              | **7** (`/`, `/green-coffee-offer-list`, `/coffee-origins`, `/knowledge`, `/about`, `/contact`, `/request-a-quote`) × 2 locales = 14 |
| Dynamic indexable entries           | **5** (2 coffee lots, 2 origins, 1 knowledge article) × 2 locales = 10                                                              |
| hreflang alternate links emitted    | **72** (24 entries × en/ar/x-default)                                                                                               |
| Private/auth/admin URLs excluded    | **26** path patterns, 0 present                                                                                                     |
| Draft/unpublished CMS URLs excluded | **18** CMS pages, all `DRAFT`, 0 present                                                                                            |
| Filtered/search URLs excluded       | 0 present (no `?` in any `<loc>`)                                                                                                   |
| Segmented                           | **NO** — 24 URLs does not warrant it (see conflicts table)                                                                          |

### Two real defects found and fixed

1. **`/about` was missing from the sitemap entirely.** It is a real static route and one of the few pages that represent the business, but it appeared in the CMS allow-list only — so it could enter the sitemap only if a CMS row claimed `/about`, and that row is `DRAFT`. Added to the static paths.
2. **No CMS page could ever enter the sitemap.** Stored `route_path` values carry a trailing slash (`/privacy/`), the allow-list did not (`/privacy`), and the comparison was exact. All 18 pages are currently `DRAFT` so nothing was visibly wrong — but every one of them would have been silently missing the moment the owner published it. Both sides are now normalized.

### Crawl results

`tests/e2e/seo-crawl.spec.ts` — **6/6 pass**. The route matrix is derived from
`/sitemap.xml` itself, so it cannot keep passing after the sitemap stops
emitting a page.

| Check                                                                                 | Result |
| ------------------------------------------------------------------------------------- | ------ |
| Canonicals — absolute, self-referential, one per page                                 | PASS   |
| hreflang `en` / `ar` / `x-default` on every indexable page                            | PASS   |
| `x-default` equals the English alternate                                              | PASS   |
| Unique titles and descriptions within each locale                                     | PASS   |
| No `[object Object]` / placeholder metadata                                           | PASS   |
| Every sitemap URL returns 200 and is not `noindex`                                    | PASS   |
| Filtered/search states `noindex, follow` + canonical to clean hub                     | PASS   |
| Unfiltered hub stays indexable                                                        | PASS   |
| Private/auth/search routes never indexable                                            | PASS   |
| robots.txt disallows private areas, names the sitemap, leaves public routes crawlable | PASS   |
| Structured data parses, is typed, and carries no price field                          | PASS   |

Measured directly against a production-host build:

```
/                                    canonical=https://www.hillscoffees.com            indexable
/green-coffee-offer-list             canonical=…/green-coffee-offer-list               indexable
/green-coffee-offer-list?origin=…    canonical=…/green-coffee-offer-list               noindex, follow
/green-coffee-offer-list?page=2      canonical=…/green-coffee-offer-list               indexable
/search?q=x                          —                                                 noindex, nofollow
/account · /admin                    307 redirect for anonymous                        never served
```

### Private SEO boundary

Private routes are protected in three independent layers: a **307 redirect**
for anonymous visitors, an explicit **`noindex, nofollow`** meta directive, and
a **robots.txt disallow**. Ten private pages had no directive of their own
(`/account`, `/account/profile`, `/account/security`, the admin module routes
and both admin layouts); `robots: { index: false, follow: false }` is now
declared on the three private **layouts**, which Next merges down to every page
beneath. A redirect alone is not sufficient, because a URL can be indexed from
an external link without ever being fetched.

### Google sitelink readiness (controllable signals only)

**No claim is made that sitelinks can be forced — Google alone decides.** What
was verified is the architecture that makes a site eligible:

| Signal                                                  | State                                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Clear primary navigation with descriptive anchors       | Home · Products · Origins · Knowledge · About · Contact, all real `<a href>`                                    |
| Direct crawlable link to the catalog from the header    | Restored during the pre-Phase-13 follow-up (the Products trigger is a link, with a separate disclosure control) |
| Stable canonical URLs, one intent per URL               | PASS — filtered variants consolidate onto the hub                                                               |
| Unique titles/descriptions per page per locale          | PASS (asserted)                                                                                                 |
| Semantic headings, one `h1` per page                    | PASS                                                                                                            |
| Breadcrumbs on catalog, lot, origin and knowledge pages | PASS, matching the canonical hierarchy                                                                          |
| `Organization` + `WebSite` identity with stable `@id`s  | PASS                                                                                                            |
| Localized equivalents declared reciprocally             | PASS                                                                                                            |
| No doorway or thin pages created                        | Confirmed — none added                                                                                          |

---

## P13-T02 — Performance & Core Web Vitals · PASS

Measured on the current production build, 2026-09-05 — **32 measurements**
across 8 routes × EN/AR × desktop 1440 / mobile 375.

| Metric             | Result                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LCP**            | 600 ms – 2324 ms; **every route under the 2500 ms "good" threshold**                                                                                                |
| LCP desktop        | 600–1548 ms                                                                                                                                                         |
| LCP mobile (375)   | 652–2324 ms                                                                                                                                                         |
| **CLS**            | **0.0000 on all 32 measurements**                                                                                                                                   |
| TTFB               | 406–1259 ms (local server; not representative of a production CDN)                                                                                                  |
| Requests per page  | 27–43                                                                                                                                                               |
| Filter interaction | **exactly 1 request** per filter change — no client dataset, no per-keystroke fetch, no router loop                                                                 |
| INP                | Not measurable in this harness (no synthetic interaction); interaction surface is bounded to small client islands — header search, catalog filters, expandable rows |

Slowest observed: AR mobile `/knowledge` at 2324 ms LCP, driven by article
imagery (~2.1 MB on the knowledge and article routes). Still inside "good", and
recorded as the first place to look if a budget is set later.

**No index recommendation.** No query in this audit showed a plan or latency
justifying one. Per P13-T02, none would be applied here regardless — it would
be a separate, owner-approved unit.

### Caching review

| Class                         | Strategy                                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public cacheable content**  | None cached across requests. `use cache` requires the app-wide `cacheComponents` flag (an architecture change out of scope); `unstable_cache` is deprecated in Next 16 and cannot wrap the cookie-reading Supabase client. Facet reads are small and indexed. |
| **Persona-sensitive content** | React `cache()` request memoization only — one render pass, never across requests or viewers.                                                                                                                                                                 |
| **Protected pricing**         | Never cached. Read per request through `getProtectedPriceTiers()` → `requireVerifiedUser()` → `hills_is_verified_user()`.                                                                                                                                     |
| **Admin/private data**        | Never cached; `Cache-Control: private, no-store` from `next.config.ts`.                                                                                                                                                                                       |
| **Invalidation**              | Existing `revalidatePath("/", "layout")` in every Admin mutation. No second mechanism introduced.                                                                                                                                                             |

Verified at the HTTP layer: **every route** returns
`private, no-cache, no-store, max-age=0, must-revalidate` — including `/`,
the catalog, lot detail, `/account` and `/admin`. Cross-persona cache leakage is
therefore impossible by construction, not by policy. Two permanent tests pin it:
an entitled response is never replayed to an anonymous visitor, and locales do
not share facet results.

---

## P13-T03 — Security review · PASS

### Service role

| Check                                                    | Result                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Client-reachable build artifacts scanned                 | 77 (`.next/static` plus server HTML/RSC output)                                                                                                  |
| Service-role key value present                           | **NO**                                                                                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY` named in any client artifact | **NO**                                                                                                                                           |
| `"role":"service_role"` claim in any client artifact     | **NO**                                                                                                                                           |
| Source modules referencing the key                       | 3 in `src/` — `supabase/service-role.ts`, `auth/recovery.ts`, `admin-boundaries.test.ts` — **all server-only, none in a client component graph** |
| Secret printed in this report or any log                 | **NO**                                                                                                                                           |

**SERVICE ROLE ROTATION REQUIRED BEFORE PRODUCTION: YES.** Not because of any
finding in this codebase — the scans are clean — but because the owner has
recorded that a service-role secret previously appeared in development
screenshots. A credential that has been seen outside the trust boundary must be
treated as compromised regardless of how carefully the code handles it. **Not
rotated automatically**; this needs the owner acting in the Supabase dashboard.

### Five-persona boundary matrix

`p12-persona-matrix` + `auth-session-isolation` + `search-catalog-cta` +
`inquiry-actions` — **71 passed, 0 failed** on the Phase-13 build.

| Persona         | Result                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous       | Public access works; protected prices absent; account/Admin denied                                                                        |
| Unverified USER | `/account` → `/sign-in`; pricing denied; Admin denied                                                                                     |
| Verified USER   | Protected per-kg pricing authorized (`true`); favorites, requests, account work; no Admin capability                                      |
| Blocked USER    | Blocked through the real Admin workflow; sign-in refused, no session, account unreachable; pricing denied                                 |
| ADMIN           | Reaches the workspace only via `/dashboard-admin`; never treated as a pricing customer; `/admin/**` server-authorized by `requireAdmin()` |

Stale-session isolation (the regression fixed before this phase) remains proven:
a public customer signup can no longer carry an Administrator session into the
Admin workspace, and `settled=1` cannot settle a session it never established.

### Redirect allow-list

`src/lib/auth/redirect-fuzz.test.ts` — **19/19 pass**. Seventeen hostile inputs
refused in both locales: absolute external URLs, protocol-relative `//`, triple
slash, backslash variants, `javascript:`, `data:`, `vbscript:`, percent-encoded
`%2F%2F`, tab/CR-LF injection, and traversal. Legitimate internal destinations
are preserved with correct locale prefixing.

Internal `/admin` and `/dashboard-admin` **are** allowed by this helper, by
design: it guards against leaving the site, not against reaching a privileged
route. Authorization is enforced at the route by `requireAdmin()`, which the
session-isolation suite proves end to end.

### Headers, cookies and Realtime

All present on every response: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`,
`Permissions-Policy` (camera/microphone/geolocation denied),
`Cross-Origin-Opener-Policy: same-origin`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

Auth cookies remain Supabase-managed `HttpOnly` `sb-*` tokens; the recovery
marker and the new `hills-auth-settle` marker are both `HttpOnly`, `SameSite=Lax`,
`secure` when the request is HTTPS, and single-use.

**Realtime: no subscription exists anywhere in `src/`** — `grep` for
`.channel(` / `postgres_changes` / `realtime` returns nothing, and the
pre-Phase-13 follow-up introduced none. Phase-0 baseline evidence records
`offer_price_tiers` and `audit_logs` as **absent from the publication**, and
nothing in Phases 1–13 altered publication membership.

---

## P13-T04 — Final public price scan · PASS

| Metric                                                                             | Result                                                                                                                              |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Public routes scanned                                                              | **33** — every sitemap URL in both locales, plus filtered/sorted/searched catalog states, `/search`, `robots.txt` and `sitemap.xml` |
| Protected tier values used as needles                                              | 4 (read from `offer_price_tiers`)                                                                                                   |
| **TRUE PRICE LEAKS**                                                               | **0**                                                                                                                               |
| False positives suppressed                                                         | **33**, in SVG geometry, CSS, URLs, `/_next/` chunk paths and UUIDs                                                                 |
| JSON-LD price fields (`price`, `priceCurrency`, `lowPrice`, `highPrice`, `offers`) | **0 occurrences**                                                                                                                   |

The scan is evidence-aware by construction: it strips hydration comments, whole
`<svg>` blocks, `d="…"` path geometry, `viewBox`, `<style>`, URLs and UUIDs
_before_ matching, then looks for the one shape this application actually
renders a price in (`$N.NN / kg`) and for tier values adjacent to a currency
symbol or per-kg wording. This is the direct fix for the previously documented
naive bug where `7.5` inside a shield-check SVG path was reported as a coffee
price — that class of false positive is now suppressed and counted, not
reported as a leak.

**FINAL SC-008 VERDICT: PASS.**

---

## P13-T05 — Deployment, rollback and release readiness

| Item                                            | Result                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **PRODUCTION BUILD**                            | **PASS** — clean build, including a dedicated build with `NEXT_PUBLIC_SITE_URL=https://www.hillscoffees.com`           |
| **DEPLOYMENT-CONFIG READINESS**                 | **PASS** — see environment table below                                                                                 |
| **PREVIEW/PRODUCTION-LIKE SMOKE**               | **PASS** — production build served locally; all public routes, both locales, `robots.txt` and `sitemap.xml` return 200 |
| **ROLLBACK REHEARSAL**                          | **PASS** — see below                                                                                                   |
| REAL DOMAIN DNS                                 | **PENDING — DOMAIN NOT YET CONNECTED**                                                                                 |
| REAL DOMAIN HTTPS                               | **PENDING — DOMAIN NOT YET CONNECTED**                                                                                 |
| REAL DOMAIN REDIRECTS (www/non-www, http→https) | **PENDING — DOMAIN NOT YET CONNECTED**                                                                                 |
| REAL DOMAIN CRAWL                               | **PENDING — DOMAIN NOT YET CONNECTED**                                                                                 |
| REAL DOMAIN SEARCH INDEXATION                   | **PENDING — DOMAIN NOT YET CONNECTED**                                                                                 |

### Environment

| Variable                               | State                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | Must be `https://www.hillscoffees.com` in production; `src/lib/env.ts` throws in production if unset or not an absolute URL |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public by design                                                                                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public by design (anon key)                                                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only; **not** `NEXT_PUBLIC_`-prefixed                                                                                |
| Secrets in public variables            | **NONE** — every `NEXT_PUBLIC_*` value was decoded and checked for a `service_role` claim                                   |

Image hosts are restricted in `next.config.ts` to the configured Supabase
hostname under `/storage/v1/object/public/**`.

### Rollback rehearsal

The last known-good release is commit **`b4a0b06`** (all Phase-13 work is
uncommitted). Rehearsed non-destructively in an isolated `git worktree`, with no
change to the working tree and no database, migration or Auth action of any kind:

1. `git worktree add --detach /tmp/rollback-rehearsal HEAD` — clean checkout.
2. `npm run build` — **succeeded**.
3. `npx next start --port 3100` — served `/`, `/green-coffee-offer-list`, `/ar`,
   `/robots.txt`, `/sitemap.xml`, all **200**.
4. Differential proof it really was the earlier release: its sitemap contains
   **zero** occurrences of `/about`, which this phase added.
5. Worktree removed; working tree unchanged.

To roll back for real: discard the uncommitted Phase-13 changes (or revert the
Phase-13 commit once made) and redeploy `b4a0b06`. No data rollback is required —
Phase 13 applied no migration and changed no row.

### Search-engine release checklist (for when the domain is connected)

- [ ] DNS pointed at the deployment
- [ ] HTTPS certificate valid
- [ ] `www` / non-`www` canonical redirect confirmed, one hop
- [ ] `http` → `https` redirect confirmed, one hop
- [ ] Production deploy verified with `NEXT_PUBLIC_SITE_URL=https://www.hillscoffees.com`
- [ ] `https://www.hillscoffees.com/robots.txt` reachable
- [ ] `https://www.hillscoffees.com/sitemap.xml` reachable
- [ ] Canonicals confirmed to use `www.hillscoffees.com`
- [ ] Search Console property created and ownership verified — **not done; requires the live domain**
- [ ] Sitemap submitted in Search Console
- [ ] URL inspection on the homepage, catalog and one lot page
- [ ] Crawl-error report reviewed
- [ ] Rich-result validation for `Organization`, `WebSite`, `CollectionPage`, `Product`, `Article`, `BreadcrumbList`
- [ ] **Rotate the service-role key** before real production traffic
- [ ] Consider IndexNow once the origin is live

---

## P13-T06 — Final project gate

### Success criteria

| SC                                                                       | Verdict  | Evidence                                                                          |
| ------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------- |
| SC-001 five-persona authorization                                        | **PASS** | 71 passed on this build; zero unauthorized access or price exposure               |
| SC-002 signup → verify → protected pricing                               | **PASS** | Phase-12 evidence; real confirmation-email acceptance owner-confirmed             |
| SC-003 EN/AR parity, zero missing keys                                   | **PASS** | `src/i18n/messages.test.ts` in the 194-test unit run                              |
| SC-004 blocked customer loses capability next request                    | **PASS** | Persona matrix — blocked refused, no session, account unreachable                 |
| SC-005 duplicate sample request rejected, code shown                     | **PASS** | `inquiry-workflow` FLOW A/B including the cross-warehouse race; `inquiry-actions` |
| SC-006 bounded, paginated catalog from the data layer                    | **PASS** | `queryCatalog` DB-side filter/order/range; filter change = 1 request              |
| SC-007 accessibility, keyboard, 44px targets                             | **PASS** | `accessibility.spec.ts` incl. `/search` EN+AR; keyboard suites                    |
| SC-008 no protected price in public output                               | **PASS** | 33 routes, 0 true leaks, 0 JSON-LD price fields                                   |
| SC-009 Admin block/unblock observable next request                       | **PASS** | Persona matrix, real Admin workflow                                               |
| SC-010 EN→AR→EN with zero console/hydration errors                       | **PASS** | Phase-12 locale round trips; runtime gate on every suite                          |
| SC-011 canonical + reciprocal alternates; private absent & non-indexable | **PASS** | SEO crawl suite 6/6                                                               |
| SC-012 anonymous RFQ + sample request                                    | **PASS** | Owner Alignment evidence; `public-inquiry` suite                                  |
| SC-013 anonymous duplicate sample rejected until CLOSED                  | **PASS** | Owner Alignment evidence; DB partial unique index                                 |
| SC-014 no protected price/capability/marketplace mechanic for anonymous  | **PASS** | Price scan + persona matrix                                                       |

SC-012–SC-014 come from the Owner Alignment addendum; the report format
requested SC-001–SC-011, and all fourteen are recorded for completeness.

### External dependency

Every gate that can be closed without the production domain is closed. The
domain-dependent items — DNS, HTTPS, live redirects, live crawl, Search Console
and indexation — remain **PENDING — DOMAIN NOT YET CONNECTED**. The official
P13-T05 acceptance asks for "a production-like build/deploy/rollback rehearsal",
which was performed; it does not require a connected hostname, so this
dependency does not block the gate. It is recorded rather than waived.
