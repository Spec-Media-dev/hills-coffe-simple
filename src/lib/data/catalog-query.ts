import "server-only";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OfferStatus } from "@/lib/supabase/types.generated";

/**
 * P6-T01 — the public catalog query, evaluated by the database.
 *
 * The previous listing fetched every visible offer and narrowed it in
 * JavaScript with `Array.filter`, which means the work grew with the catalog
 * rather than with the page. Here filtering, ordering and pagination are all
 * expressed as one bounded query, so the server transfers a page of rows no
 * matter how large the catalog becomes.
 *
 * It deliberately selects **no price column**. Price lives only in
 * `offer_price_tiers`, read exclusively by `src/lib/data/pricing.ts` behind
 * `requireVerifiedUser()`. Keeping the two apart at module level is what makes
 * "an anonymous visitor cannot receive a price" a structural property rather
 * than a rule someone has to remember (Constitution VI and VIII).
 */

export const CATALOG_PAGE_SIZE = 12;

/**
 * Sorts are an allow-list, not a passthrough: the value arrives from a query
 * string and is interpolated into an `order()` column, so anything outside this
 * set must be rejected rather than forwarded.
 *
 * Sorting by localized *name* is deliberately absent. Names live in
 * `coffee_translations`, a to-many embed, and PostgREST cannot order a parent
 * by a to-many child reliably. The alternatives — ordering by `coffees.slug`
 * (alphabetical in English only, misleading in Arabic) or adding a database
 * view — would either mislead Arabic readers or require the schema change this
 * follow-up excludes.
 */
export const CATALOG_SORTS = ["reference", "cup-score", "bags"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const isCatalogSort = (value: unknown): value is CatalogSort =>
  typeof value === "string" &&
  (CATALOG_SORTS as readonly string[]).includes(value);

export type CatalogFilters = {
  q?: string;
  origin?: string;
  process?: string;
  location?: string;
  type?: string;
  certified?: boolean;
  availability?: OfferStatus;
  sort?: CatalogSort;
  page: number;
};

export type CatalogRow = {
  id: string;
  coffeeId: string;
  slug: string;
  name: string;
  origin: string;
  originSlug: string;
  region: string | null;
  type: string;
  process: string | null;
  grade: string | null;
  reference: string;
  bags: number;
  bagWeightKg: number;
  warehouse: string;
  warehouseCode: string;
  status: OfferStatus;
  cupScore: number | null;
  imageUrl: string | null;
  imageAlt: string;
  /** Plain column, so it costs nothing to carry on the listing row. */
  availableFrom: string | null;
  /** Resolved to a localized label by `getCatalogRowDetails`. */
  packagingTypeId: string | null;
};

export type CatalogPage = {
  rows: CatalogRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  configured: boolean;
};

const EMPTY: CatalogPage = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: CATALOG_PAGE_SIZE,
  pageCount: 0,
  configured: false,
};

/** `hills-public` is a public bucket, so its objects have a stable URL. */
function publicUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const origin = base ? new URL(base).origin : "";
  return `${origin}/storage/v1/object/public/${bucket}/${path}`;
}

const localized = (
  rows: Record<string, unknown>[] | undefined,
  locale: Locale,
  fallback: string,
) => {
  const list = rows ?? [];
  const active = list.find((row) => row.locale === locale);
  const english = list.find((row) => row.locale === "en");
  return String(active?.name ?? english?.name ?? fallback);
};

/**
 * The one place a filter turns into a predicate.
 *
 * `queryCatalog` and `countMatching` used to spell these out separately, and
 * they had already drifted: the count omitted the certification constraint, so
 * once `certified` became reachable from the UI the fallback total would have
 * disagreed with the rows. Sharing the builder makes that class of drift
 * impossible rather than merely fixed once.
 *
 * The `!inner` decisions must be applied identically in both callers' `select`
 * strings, which is what `joinsFor` below is for.
 */
function applyCatalogFilters<T extends { eq: unknown; ilike: unknown }>(
  query: T,
  filters: CatalogFilters,
): T {
  type Chain = {
    eq: (column: string, value: unknown) => Chain;
    ilike: (column: string, value: string) => Chain;
  };
  let chain = query as unknown as Chain;
  chain = chain.eq("is_visible", true).eq("coffee.status", "PUBLISHED");
  if (filters.origin) chain = chain.eq("coffee.origin.slug", filters.origin);
  if (filters.process)
    chain = chain.eq("coffee.processing_method.slug", filters.process);
  if (filters.type) chain = chain.eq("coffee.coffee_type.slug", filters.type);
  if (filters.location) chain = chain.eq("warehouse.code", filters.location);
  if (filters.availability) chain = chain.eq("status", filters.availability);
  // `certified` needs no predicate: the `!inner` join below already restricts
  // the result to coffees that carry at least one certification.
  if (filters.q)
    chain = chain.ilike("coffee.coffee_translations.name", `%${filters.q}%`);
  return chain as unknown as T;
}

/** Embeds become `!inner` only when a filter actually constrains them. */
function joinsFor(filters: CatalogFilters) {
  return {
    process: filters.process ? "!inner" : "",
    certification: filters.certified ? "!inner" : "",
    search: filters.q ? "!inner" : "",
  };
}

/** Row count for the same filters, used when a page falls past the last row. */
async function countMatching(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filters: CatalogFilters,
): Promise<number> {
  const join = joinsFor(filters);
  const query = db
    .from("coffee_offers")
    .select(
      `id, warehouse:warehouses!inner(code), coffee:coffees!inner(
         status, deleted_at,
         coffee_type:coffee_types!inner(slug),
         origin:origins!inner(slug),
         processing_method:processing_methods${join.process}(slug),
         coffee_translations${join.search}(name),
         coffee_certifications${join.certification}(certification_id)
       )`,
      { count: "exact", head: true },
    )
    .is("deleted_at", null)
    .is("coffee.deleted_at", null);
  const { count } = await applyCatalogFilters(query, filters);
  return count ?? 0;
}

export async function queryCatalog(
  locale: Locale,
  filters: CatalogFilters,
): Promise<CatalogPage> {
  if (!isSupabaseConfigured()) return EMPTY;
  const db = await createSupabaseServerClient();
  const page = Math.max(1, filters.page || 1);
  const from = (page - 1) * CATALOG_PAGE_SIZE;
  const to = from + CATALOG_PAGE_SIZE - 1;

  // Embeds become `!inner` only when a filter actually constrains them, so an
  // offer whose coffee has no region or processing method is still returned
  // when those filters are unused.
  const join = joinsFor(filters);

  const select = `
    id, reference_number, bags_quantity, bag_weight_kg, status, cup_score,
    available_from, packaging_type_id,
    warehouse:warehouses!inner ( id, code, name ),
    coffee:coffees!inner (
      id, slug, grade, status, deleted_at,
      coffee_type:coffee_types!inner ( id, slug ),
      origin:origins!inner ( id, slug ),
      region:regions ( id, slug ),
      processing_method:processing_methods${join.process} ( id, slug ),
      coffee_translations${join.search} ( locale, name ),
      coffee_certifications${join.certification} ( certification_id ),
      coffee_media ( media_id, role, sort_order )
    )
  `;

  const base = db
    .from("coffee_offers")
    .select(select, { count: "exact" })
    .is("deleted_at", null)
    .is("coffee.deleted_at", null);
  const query = applyCatalogFilters(base, filters);

  // Every sort ends on `reference_number`. Without that tiebreaker two offers
  // sharing a cup score or bag count could order differently between two
  // requests, which is how a row appears on two pages — or on none.
  const sorted =
    filters.sort === "cup-score"
      ? query
          .order("cup_score", { ascending: false, nullsFirst: false })
          .order("reference_number", { ascending: true })
      : filters.sort === "bags"
        ? query
            .order("bags_quantity", { ascending: false })
            .order("reference_number", { ascending: true })
        : query.order("reference_number", { ascending: true });

  const { data, error, count } = await sorted.range(from, to);

  if (error) {
    // PGRST103 means the requested range starts past the last row — a page
    // number beyond the result set. That is an ordinary empty page, not a
    // failure, so the real total is fetched and an empty page is returned
    // rather than logging an error and losing the pagination footer.
    if (error.code === "PGRST103") {
      const total = count ?? (await countMatching(db, filters));
      return {
        rows: [],
        total,
        page,
        pageSize: CATALOG_PAGE_SIZE,
        pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
        configured: true,
      };
    }
    console.error(`[catalog] query failed: ${error.code ?? "upstream"}`);
    return { ...EMPTY, configured: true };
  }

  const rows = (data ?? []) as unknown as Record<string, never>[];

  // Names come from the translation tables; only the referenced rows are
  // fetched, so this stays a bounded second round trip rather than an N+1.
  const coffeeIds = rows.map((row) => String((row.coffee as never)["id"]));
  const originIds = rows.map((row) =>
    String(((row.coffee as never)["origin"] as never)["id"]),
  );
  const regionIds = rows
    .map((row) => (row.coffee as never)["region"] as { id: string } | null)
    .filter((region): region is { id: string } => Boolean(region))
    .map((region) => region.id);
  const mediaIds = rows.flatMap((row) =>
    (
      ((row.coffee as never)["coffee_media"] ?? []) as {
        media_id: string;
        role: string;
      }[]
    )
      .filter((entry) => entry.role === "MAIN")
      .map((entry) => entry.media_id),
  );
  const warehouseIds = rows.map((row) =>
    String((row.warehouse as never)["id"]),
  );

  const [coffeeT, originT, regionT, warehouseT, mediaRows, mediaT] =
    await Promise.all([
      coffeeIds.length
        ? db
            .from("coffee_translations")
            .select("coffee_id,locale,name")
            .in("coffee_id", coffeeIds)
        : Promise.resolve({ data: [] }),
      originIds.length
        ? db
            .from("origin_translations")
            .select("origin_id,locale,name")
            .in("origin_id", originIds)
        : Promise.resolve({ data: [] }),
      regionIds.length
        ? db
            .from("region_translations")
            .select("region_id,locale,name")
            .in("region_id", regionIds)
        : Promise.resolve({ data: [] }),
      warehouseIds.length
        ? db
            .from("warehouse_translations")
            .select("warehouse_id,locale,name")
            .in("warehouse_id", warehouseIds)
        : Promise.resolve({ data: [] }),
      mediaIds.length
        ? db
            .from("media")
            .select("id,storage_bucket,storage_path")
            .in("id", mediaIds)
        : Promise.resolve({ data: [] }),
      mediaIds.length
        ? db
            .from("media_translations")
            .select("media_id,locale,alt_text")
            .in("media_id", mediaIds)
        : Promise.resolve({ data: [] }),
    ]);

  const pick = (
    source: { data: Record<string, unknown>[] | null },
    key: string,
    id: string,
  ) => (source.data ?? []).filter((row) => String(row[key]) === id);

  const mapped: CatalogRow[] = rows.map((row) => {
    const coffee = row.coffee as never as Record<string, never>;
    const origin = coffee["origin"] as never as Record<string, string>;
    const region = coffee["region"] as never as {
      id: string;
      slug: string;
    } | null;
    const warehouse = row.warehouse as never as Record<string, string>;
    const main = (
      (coffee["coffee_media"] ?? []) as { media_id: string; role: string }[]
    ).find((entry) => entry.role === "MAIN");
    const mediaRow = main
      ? (mediaRows.data ?? []).find(
          (entry) => String(entry.id) === main.media_id,
        )
      : undefined;

    return {
      id: String(row.id),
      coffeeId: String(coffee["id"]),
      slug: String(coffee["slug"]),
      name: localized(
        pick(coffeeT, "coffee_id", String(coffee["id"])),
        locale,
        String(coffee["slug"]),
      ),
      origin: localized(
        pick(originT, "origin_id", origin.id),
        locale,
        origin.slug,
      ),
      originSlug: origin.slug,
      region: region
        ? localized(pick(regionT, "region_id", region.id), locale, region.slug)
        : null,
      type: String((coffee["coffee_type"] as never as { slug: string }).slug),
      process:
        (coffee["processing_method"] as never as { slug: string } | null)
          ?.slug ?? null,
      grade: coffee["grade"] ? String(coffee["grade"]) : null,
      reference: String(row.reference_number),
      bags: Number(row.bags_quantity),
      bagWeightKg: Number(row.bag_weight_kg),
      warehouse: localized(
        pick(warehouseT, "warehouse_id", warehouse.id),
        locale,
        warehouse.name,
      ),
      warehouseCode: warehouse.code,
      status: row.status as unknown as OfferStatus,
      cupScore: row.cup_score === null ? null : Number(row.cup_score),
      imageUrl: mediaRow
        ? publicUrl(
            String(mediaRow.storage_bucket),
            String(mediaRow.storage_path),
          )
        : null,
      imageAlt: main
        ? String(
            (mediaT.data ?? []).find(
              (entry) =>
                String(entry.media_id) === main.media_id &&
                entry.locale === locale,
            )?.alt_text ?? "",
          )
        : "",
      availableFrom: row.available_from ? String(row.available_from) : null,
      packagingTypeId: row.packaging_type_id
        ? String(row.packaging_type_id)
        : null,
    };
  });

  const total = count ?? 0;
  return {
    rows: mapped,
    total,
    page,
    pageSize: CATALOG_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
    configured: true,
  };
}

export type CatalogFacets = {
  origins: { slug: string; label: string }[];
  processes: { slug: string; label: string }[];
  types: { slug: string; label: string }[];
  warehouses: { code: string; label: string }[];
};

/**
 * Facet options come from the reference tables, not from the current result
 * page — otherwise narrowing to one origin would erase every other origin from
 * the filter and strand the visitor.
 */
export async function getCatalogFacets(locale: Locale): Promise<CatalogFacets> {
  if (!isSupabaseConfigured())
    return { origins: [], processes: [], types: [], warehouses: [] };
  const db = await createSupabaseServerClient();
  const [
    origins,
    originT,
    processes,
    processT,
    types,
    typeT,
    warehouses,
    warehouseT,
  ] = await Promise.all([
    db
      .from("origins")
      .select("id,slug")
      .is("deleted_at", null)
      .eq("is_active", true),
    db.from("origin_translations").select("origin_id,locale,name"),
    db.from("processing_methods").select("id,slug").eq("is_active", true),
    db
      .from("processing_method_translations")
      .select("processing_method_id,locale,name"),
    db.from("coffee_types").select("id,slug").eq("is_active", true),
    db.from("coffee_type_translations").select("coffee_type_id,locale,name"),
    db.from("warehouses").select("id,code,name").eq("is_active", true),
    db.from("warehouse_translations").select("warehouse_id,locale,name"),
  ]);

  const build = (
    rows: { id: string; slug: string }[] | null,
    translations: { data: Record<string, unknown>[] | null },
    key: string,
  ) =>
    (rows ?? [])
      .map((row) => ({
        slug: row.slug,
        label: localized(
          (translations.data ?? []).filter(
            (entry) => String(entry[key]) === row.id,
          ),
          locale,
          row.slug,
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));

  return {
    origins: build(origins.data, originT, "origin_id"),
    processes: build(processes.data, processT, "processing_method_id"),
    types: build(types.data, typeT, "coffee_type_id"),
    warehouses: (warehouses.data ?? []).map((row) => ({
      code: String(row.code),
      label: localized(
        (warehouseT.data ?? []).filter(
          (entry) => String(entry.warehouse_id) === row.id,
        ),
        locale,
        String(row.name),
      ),
    })),
  };
}

// ---------------------------------------------------------------------------
// Expandable-preview detail
// ---------------------------------------------------------------------------

export type CatalogRowDetail = {
  packaging: string | null;
  certifications: string[];
  tags: string[];
  sensory: string[];
  varieties: string[];
};

/**
 * The extra fields the expandable catalog preview shows, for **one page of
 * rows only**.
 *
 * The tempting shortcut here was to go back to `getOfferList()`, which already
 * returns these fields — but that reads the entire catalog on every request,
 * which is exactly what `queryCatalog` was written to stop doing. Instead this
 * batches by the ids already on the page, in two waves: join tables first, then
 * the reference and translation rows those joins actually pointed at. Cost is a
 * fixed handful of indexed reads per page, independent of catalog size, and
 * there is no per-row query anywhere.
 *
 * Like the rest of this module it selects **no price column**; price stays
 * exclusively in `src/lib/data/pricing.ts` behind `requireVerifiedUser()`.
 *
 * `varieties` are English-only: the schema has `varieties` but no
 * `variety_translations`, which the Admin reference suite already records as
 * "English-only by schema". They are returned as stored rather than invented in
 * Arabic.
 */
export async function getCatalogRowDetails(
  rows: CatalogRow[],
  locale: Locale,
): Promise<Map<string, CatalogRowDetail>> {
  const result = new Map<string, CatalogRowDetail>();
  if (!rows.length || !isSupabaseConfigured()) return result;

  const db = await createSupabaseServerClient();
  const offerIds = rows.map((row) => row.id);
  const coffeeIds = [...new Set(rows.map((row) => row.coffeeId))];
  const packagingIds = [
    ...new Set(
      rows
        .map((row) => row.packagingTypeId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  // Wave 1 — the join tables, all bounded by this page's ids.
  const [offerTags, offerSensory, coffeeCerts, coffeeVarieties] =
    await Promise.all([
      db.from("offer_tags").select("offer_id,tag_id").in("offer_id", offerIds),
      db
        .from("offer_sensory_notes")
        .select("offer_id,sensory_note_id")
        .in("offer_id", offerIds),
      db
        .from("coffee_certifications")
        .select("coffee_id,certification_id")
        .in("coffee_id", coffeeIds),
      db
        .from("coffee_varieties")
        .select("coffee_id,variety_id")
        .in("coffee_id", coffeeIds),
    ]);

  const ids = (
    source: { data: Record<string, unknown>[] | null },
    key: string,
  ) => [...new Set((source.data ?? []).map((entry) => String(entry[key])))];
  const tagIds = ids(offerTags, "tag_id");
  const sensoryIds = ids(offerSensory, "sensory_note_id");
  const certIds = ids(coffeeCerts, "certification_id");
  const varietyIds = ids(coffeeVarieties, "variety_id");

  const none = Promise.resolve({ data: [] as Record<string, unknown>[] });
  // Wave 2 — only the reference rows wave 1 actually pointed at.
  const [tagT, sensoryT, certT, varietyRows, packagingT] = await Promise.all([
    tagIds.length
      ? db
          .from("tag_translations")
          .select("tag_id,locale,name")
          .in("tag_id", tagIds)
      : none,
    sensoryIds.length
      ? db
          .from("sensory_note_translations")
          .select("sensory_note_id,locale,name")
          .in("sensory_note_id", sensoryIds)
      : none,
    certIds.length
      ? db
          .from("certification_translations")
          .select("certification_id,locale,name")
          .in("certification_id", certIds)
      : none,
    varietyIds.length
      ? db.from("varieties").select("id,name").in("id", varietyIds)
      : none,
    packagingIds.length
      ? db
          .from("packaging_type_translations")
          .select("packaging_type_id,locale,name")
          .in("packaging_type_id", packagingIds)
      : none,
  ]);

  /** Localized name for one reference id, or null when it has no usable name. */
  const nameOf = (
    translations: { data: Record<string, unknown>[] | null },
    key: string,
    id: string,
  ) => {
    const candidates = (translations.data ?? []).filter(
      (entry) => String(entry[key]) === id,
    );
    const match =
      candidates.find((entry) => entry.locale === locale) ??
      candidates.find((entry) => entry.locale === "en");
    const name = match?.name ? String(match.name).trim() : "";
    return name || null;
  };

  const labelsFor = (
    joins: { data: Record<string, unknown>[] | null },
    ownerKey: string,
    ownerId: string,
    refKey: string,
    translations: { data: Record<string, unknown>[] | null },
  ) =>
    (joins.data ?? [])
      .filter((entry) => String(entry[ownerKey]) === ownerId)
      .map((entry) => nameOf(translations, refKey, String(entry[refKey])))
      .filter((name): name is string => Boolean(name));

  for (const row of rows) {
    result.set(row.id, {
      packaging: row.packagingTypeId
        ? nameOf(packagingT, "packaging_type_id", row.packagingTypeId)
        : null,
      certifications: labelsFor(
        coffeeCerts,
        "coffee_id",
        row.coffeeId,
        "certification_id",
        certT,
      ),
      tags: labelsFor(offerTags, "offer_id", row.id, "tag_id", tagT),
      sensory: labelsFor(
        offerSensory,
        "offer_id",
        row.id,
        "sensory_note_id",
        sensoryT,
      ),
      varieties: (coffeeVarieties.data ?? [])
        .filter((entry) => String(entry.coffee_id) === row.coffeeId)
        .map((entry) => {
          const variety = (varietyRows.data ?? []).find(
            (candidate) => String(candidate.id) === String(entry.variety_id),
          );
          const name = variety?.name ? String(variety.name).trim() : "";
          return name || null;
        })
        .filter((name): name is string => Boolean(name)),
    });
  }
  return result;
}
