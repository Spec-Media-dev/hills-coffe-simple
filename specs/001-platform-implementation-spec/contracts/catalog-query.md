# Contract: Catalog Query

Read-only, callable by any viewer (anonymous through Admin). Never returns a
price value — pricing is a separate contract (`pricing-query.md`).

## `queryCatalog(params)`

**Input** (all optional except `locale`; unrecognized/empty values are
normalized away before querying, per `research.md` §4):

```text
locale, q, originSlug, regionSlug, coffeeTypeSlug, processSlug,
certificationSlugs[], sensorySlugs[], warehouseSlugs[], availability[],
sort, page, pageSize
```

**Behavior**:
- `regionSlug` MUST be validated against `originSlug`'s dependent regions;
  an inconsistent pair is treated as "region filter cleared", not an error
  (FR-033).
- Only `PUBLISHED`, non-deleted coffees with at least one `is_visible`,
  non-`INACTIVE` offer are eligible.
- Filtering, sorting, and pagination are evaluated by the query itself —
  the handler MUST NOT fetch more rows than one page plus an accurate total
  count (FR-032).
- `pageSize` is capped server-side regardless of the requested value.

**Output**: `{ items: CatalogItem[], total: number, page, pageSize }` where
`CatalogItem` carries only public identity/availability fields — coffee
name/slug/media, origin/region/type/process labels, warehouse, offer
status/availability — and never a price field, per FR-030.

**Empty-data behavior**: an empty result set is a normal `OK` response with
`items: []`; the caller renders the approved empty state (FR-034), never a
fabricated substitute.

## `getCoffeeDetail(slug, locale)`

- Same visibility rules as `queryCatalog`.
- Returns full identity/media/taxonomy/origin/region/related-content data
  and the list of visible offers for that coffee, again with no price field.
- Returns `NOT_FOUND` (real 404 at the page level) for a missing or
  unpublished slug — never a soft-200 placeholder (FR-065).

## `getOriginList(locale)` / `getOriginDetail(slug, locale)`

- Active, non-deleted origins/regions only; origin detail aggregates its
  dependent regions and an efficiently computed published-coffee count
  (no N+1 per coffee).
