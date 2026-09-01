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

export type CatalogFilters = {
  q?: string;
  origin?: string;
  process?: string;
  location?: string;
  type?: string;
  certified?: boolean;
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

/** Row count for the same filters, used when a page falls past the last row. */
async function countMatching(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filters: CatalogFilters,
): Promise<number> {
  const processJoin = filters.process ? "!inner" : "";
  const searchJoin = filters.q ? "!inner" : "";
  let query = db
    .from("coffee_offers")
    .select(
      `id, warehouse:warehouses!inner(code), coffee:coffees!inner(
         status, deleted_at,
         coffee_type:coffee_types!inner(slug),
         origin:origins!inner(slug),
         processing_method:processing_methods${processJoin}(slug),
         coffee_translations${searchJoin}(name)
       )`,
      { count: "exact", head: true },
    )
    .is("deleted_at", null)
    .eq("is_visible", true)
    .eq("coffee.status", "PUBLISHED")
    .is("coffee.deleted_at", null);
  if (filters.origin) query = query.eq("coffee.origin.slug", filters.origin);
  if (filters.process)
    query = query.eq("coffee.processing_method.slug", filters.process);
  if (filters.type) query = query.eq("coffee.coffee_type.slug", filters.type);
  if (filters.location) query = query.eq("warehouse.code", filters.location);
  if (filters.q)
    query = query.ilike("coffee.coffee_translations.name", `%${filters.q}%`);
  const { count } = await query;
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
  const processJoin = filters.process ? "!inner" : "";
  const certificationJoin = filters.certified ? "!inner" : "";
  const searchJoin = filters.q ? "!inner" : "";

  const select = `
    id, reference_number, bags_quantity, bag_weight_kg, status, cup_score,
    warehouse:warehouses!inner ( id, code, name ),
    coffee:coffees!inner (
      id, slug, grade, status, deleted_at,
      coffee_type:coffee_types!inner ( id, slug ),
      origin:origins!inner ( id, slug ),
      region:regions ( id, slug ),
      processing_method:processing_methods${processJoin} ( id, slug ),
      coffee_translations${searchJoin} ( locale, name ),
      coffee_certifications${certificationJoin} ( certification_id ),
      coffee_media ( media_id, role, sort_order )
    )
  `;

  let query = db
    .from("coffee_offers")
    .select(select, { count: "exact" })
    .is("deleted_at", null)
    .eq("is_visible", true)
    .eq("coffee.status", "PUBLISHED")
    .is("coffee.deleted_at", null);

  if (filters.origin) query = query.eq("coffee.origin.slug", filters.origin);
  if (filters.process)
    query = query.eq("coffee.processing_method.slug", filters.process);
  if (filters.type) query = query.eq("coffee.coffee_type.slug", filters.type);
  if (filters.location) query = query.eq("warehouse.code", filters.location);
  if (filters.q)
    query = query.ilike("coffee.coffee_translations.name", `%${filters.q}%`);

  // A stable secondary key keeps pagination deterministic when two offers
  // share a status, so a row can never appear on two pages or on none.
  const { data, error, count } = await query
    .order("reference_number", { ascending: true })
    .range(from, to);

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
