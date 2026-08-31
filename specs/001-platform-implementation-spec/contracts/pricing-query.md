# Contract: Protected Pricing Query

The single, isolated path through which any price value may ever be read.
Every other module in the codebase is forbidden from querying
`offer_price_tiers` directly (Constitution Principle VIII; FR-030, FR-031).

## `getPriceTiersForOffers(offerIds[])`

- **Requires**: `requireVerifiedUser()` — authenticated, confirmed,
  unblocked, `role = 'USER'`. An authenticated Admin session calling this
  function through the public browsing path MUST NOT succeed (FR-031); Admin
  price *management* is a distinct, separately-authorized Admin contract,
  not this one.
- **Returns**: `AUTH_REQUIRED` / `VERIFICATION_REQUIRED` / `BLOCKED` per the
  standard authorization ordering, or `OK` with `{offerId, minBags,
  pricePerKgUsd}[]` scoped only to the requested, currently-visible offer
  IDs.
- **Caching**: responses MUST be private/no-store or explicitly user-scoped
  — never a shared/public cache key, and never merged into a public page's
  cache entry (Constitution Principle VIII).
- **Transport constraint**: this data MUST NOT be delivered via a Realtime
  subscription (`offer_price_tiers` is confirmed absent from the Realtime
  publication) and MUST NOT appear in any metadata, JSON-LD, sitemap, or
  RSC payload reachable by an unauthorized viewer.

## Admin pricing management (separate contract, not this one)

`createPriceTier` / `updatePriceTier` / `deletePriceTier` — require
`requireAdmin()`, validate the price ladder (ascending `min_bags`,
descending or otherwise consistent `price_per_kg_usd` per existing business
rule), and are unrelated to a customer's browsing-time price read.
