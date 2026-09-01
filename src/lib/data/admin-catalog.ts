import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read layer for the Phase 6 Admin catalog workspace.
 *
 * Every list of options comes from the database. Nothing here hardcodes a
 * React option to make a select look populated: an empty list is reported as
 * empty so the form can tell the Admin which dependency to create first.
 *
 * Labels resolve through the `*_translations` tables in the active locale and
 * fall back to English, then to the slug — and the fallback is *reported*
 * (`missingTranslation`) rather than silently pretending the Arabic copy
 * exists, so an Admin can see what still needs translating.
 */

export type CatalogOption = {
  id: string;
  label: string;
  /** True when the active locale had no translation row and a fallback was used. */
  missingTranslation?: boolean;
};

export type RegionOption = CatalogOption & { originId: string };

export type CatalogFormOptions = {
  coffeeTypes: CatalogOption[];
  origins: CatalogOption[];
  regions: RegionOption[];
  processingMethods: CatalogOption[];
  varieties: CatalogOption[];
  certifications: CatalogOption[];
  tags: CatalogOption[];
  sensoryNotes: CatalogOption[];
  packagingTypes: CatalogOption[];
  warehouses: CatalogOption[];
  coffees: CatalogOption[];
  offers: CatalogOption[];
};

const EMPTY_OPTIONS: CatalogFormOptions = {
  coffeeTypes: [],
  origins: [],
  regions: [],
  processingMethods: [],
  varieties: [],
  certifications: [],
  tags: [],
  sensoryNotes: [],
  packagingTypes: [],
  warehouses: [],
  coffees: [],
  offers: [],
};

type TranslationRow = { locale: string; name: string } & Record<
  string,
  unknown
>;

/** Resolves one row's label, reporting whether the active locale was missing. */
function label(
  slug: string,
  locale: Locale,
  translations: TranslationRow[],
): CatalogOption {
  const active = translations.find((row) => row.locale === locale);
  if (active?.name) return { id: "", label: active.name };
  const english = translations.find((row) => row.locale === "en");
  return {
    id: "",
    label: english?.name ?? slug,
    missingTranslation: true,
  };
}

function join<T extends { id: string; slug: string }>(
  rows: T[] | null,
  translations: Record<string, unknown>[] | null,
  ownerKey: string,
  locale: Locale,
): CatalogOption[] {
  const byOwner = new Map<string, TranslationRow[]>();
  for (const row of translations ?? []) {
    const owner = String(row[ownerKey]);
    const list = byOwner.get(owner) ?? [];
    list.push(row as TranslationRow);
    byOwner.set(owner, list);
  }
  return (rows ?? [])
    .map((row) => ({
      ...label(row.slug, locale, byOwner.get(row.id) ?? []),
      id: row.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export async function getCatalogFormOptions(
  locale: Locale,
): Promise<CatalogFormOptions> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return EMPTY_OPTIONS;
  const db = await createSupabaseServerClient();

  const [
    types,
    typeT,
    origins,
    originT,
    regions,
    regionT,
    processes,
    processT,
    varieties,
    certifications,
    certificationT,
    tags,
    tagT,
    notes,
    noteT,
    packaging,
    packagingT,
    warehouses,
    warehouseT,
    coffees,
    coffeeT,
    offers,
  ] = await Promise.all([
    db.from("coffee_types").select("id,slug").eq("is_active", true),
    db.from("coffee_type_translations").select("coffee_type_id,locale,name"),
    db
      .from("origins")
      .select("id,slug")
      .is("deleted_at", null)
      .eq("is_active", true),
    db.from("origin_translations").select("origin_id,locale,name"),
    db
      .from("regions")
      .select("id,slug,origin_id")
      .is("deleted_at", null)
      .eq("is_active", true),
    db.from("region_translations").select("region_id,locale,name"),
    db.from("processing_methods").select("id,slug").eq("is_active", true),
    db
      .from("processing_method_translations")
      .select("processing_method_id,locale,name"),
    // `varieties` carries a plain `name` column and has no translation table
    // in the live schema, so it is English-only by contract (finding N32).
    db.from("varieties").select("id,slug,name").eq("is_active", true),
    db.from("certifications").select("id,slug").eq("is_active", true),
    db
      .from("certification_translations")
      .select("certification_id,locale,name"),
    db.from("tags").select("id,slug").eq("is_active", true),
    db.from("tag_translations").select("tag_id,locale,name"),
    db.from("sensory_notes").select("id,slug").eq("is_active", true),
    db.from("sensory_note_translations").select("sensory_note_id,locale,name"),
    db.from("packaging_types").select("id,slug").eq("is_active", true),
    db
      .from("packaging_type_translations")
      .select("packaging_type_id,locale,name"),
    db.from("warehouses").select("id,code,name").eq("is_active", true),
    db.from("warehouse_translations").select("warehouse_id,locale,name"),
    db.from("coffees").select("id,slug").is("deleted_at", null),
    db.from("coffee_translations").select("coffee_id,locale,name"),
    db
      .from("coffee_offers")
      .select("id,reference_number")
      .is("deleted_at", null)
      .order("reference_number"),
  ]);

  const regionOptions: RegionOption[] = join(
    (regions.data ?? []) as { id: string; slug: string; origin_id: string }[],
    regionT.data,
    "region_id",
    locale,
  ).map((option) => ({
    ...option,
    originId: String(
      (regions.data ?? []).find((row) => row.id === option.id)?.origin_id ?? "",
    ),
  }));

  return {
    coffeeTypes: join(types.data, typeT.data, "coffee_type_id", locale),
    origins: join(origins.data, originT.data, "origin_id", locale),
    regions: regionOptions,
    processingMethods: join(
      processes.data,
      processT.data,
      "processing_method_id",
      locale,
    ),
    varieties: (varieties.data ?? [])
      .map((row) => ({
        id: row.id,
        label: row.name ?? row.slug,
        missingTranslation: locale !== "en",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale)),
    certifications: join(
      certifications.data,
      certificationT.data,
      "certification_id",
      locale,
    ),
    tags: join(tags.data, tagT.data, "tag_id", locale),
    sensoryNotes: join(notes.data, noteT.data, "sensory_note_id", locale),
    packagingTypes: join(
      packaging.data,
      packagingT.data,
      "packaging_type_id",
      locale,
    ),
    warehouses: join(
      (warehouses.data ?? []).map((row) => ({ id: row.id, slug: row.name })),
      warehouseT.data,
      "warehouse_id",
      locale,
    ),
    coffees: join(coffees.data, coffeeT.data, "coffee_id", locale),
    offers: (offers.data ?? []).map((row) => ({
      id: row.id,
      label: row.reference_number,
    })),
  };
}

// -------------------------------------------------------------- coffees

export type AdminCoffeeImage = {
  mediaId: string;
  url: string;
  role: "MAIN" | "GALLERY";
  sortOrder: number;
  altEn: string;
  altAr: string;
};

export type AdminCoffeeRecord = {
  id: string;
  slug: string;
  coffeeTypeId: string;
  originId: string;
  regionId: string | null;
  processingMethodId: string | null;
  grade: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  varietyIds: string[];
  certificationIds: string[];
  tagIds: string[];
  images: AdminCoffeeImage[];
};

/** `hills-public` is a public bucket, so its objects have a stable URL. */
function publicUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const origin = base ? new URL(base).origin : "";
  return `${origin}/storage/v1/object/public/${bucket}/${path}`;
}

export async function getAdminCoffee(
  coffeeId: string,
): Promise<AdminCoffeeRecord | null> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();
  const { data: coffee } = await db
    .from("coffees")
    .select(
      "id,slug,coffee_type_id,origin_id,region_id,processing_method_id,grade,status",
    )
    .eq("id", coffeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!coffee) return null;

  const [translations, varieties, certifications, tags, media] =
    await Promise.all([
      db
        .from("coffee_translations")
        .select("locale,name,short_description")
        .eq("coffee_id", coffeeId),
      db
        .from("coffee_varieties")
        .select("variety_id")
        .eq("coffee_id", coffeeId),
      db
        .from("coffee_certifications")
        .select("certification_id")
        .eq("coffee_id", coffeeId),
      db.from("coffee_tags").select("tag_id").eq("coffee_id", coffeeId),
      db
        .from("coffee_media")
        .select("media_id,role,sort_order")
        .eq("coffee_id", coffeeId)
        .order("role")
        .order("sort_order"),
    ]);

  const mediaIds = (media.data ?? []).map((row) => String(row.media_id));
  const [mediaRows, mediaTranslations] = await Promise.all([
    mediaIds.length
      ? db
          .from("media")
          .select("id,storage_bucket,storage_path")
          .in("id", mediaIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    mediaIds.length
      ? db
          .from("media_translations")
          .select("media_id,locale,alt_text")
          .in("media_id", mediaIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const byId = new Map(
    (mediaRows.data ?? []).map((row) => [String(row.id), row]),
  );

  const images: AdminCoffeeImage[] = (media.data ?? [])
    .map((link) => {
      const row = byId.get(String(link.media_id));
      if (!row) return null;
      const alts = (mediaTranslations.data ?? []).filter(
        (entry) => String(entry.media_id) === String(link.media_id),
      );
      return {
        mediaId: String(link.media_id),
        url: publicUrl(String(row.storage_bucket), String(row.storage_path)),
        role: link.role === "MAIN" ? ("MAIN" as const) : ("GALLERY" as const),
        sortOrder: Number(link.sort_order) || 0,
        altEn: String(
          alts.find((entry) => entry.locale === "en")?.alt_text ?? "",
        ),
        altAr: String(
          alts.find((entry) => entry.locale === "ar")?.alt_text ?? "",
        ),
      };
    })
    .filter((entry): entry is AdminCoffeeImage => entry !== null)
    // Main first, then gallery in its stored order.
    .sort((a, b) =>
      a.role === b.role
        ? a.sortOrder - b.sortOrder
        : a.role === "MAIN"
          ? -1
          : 1,
    );

  const en = (translations.data ?? []).find((row) => row.locale === "en");
  const ar = (translations.data ?? []).find((row) => row.locale === "ar");

  return {
    id: String(coffee.id),
    slug: String(coffee.slug),
    coffeeTypeId: String(coffee.coffee_type_id),
    originId: String(coffee.origin_id),
    regionId: coffee.region_id ? String(coffee.region_id) : null,
    processingMethodId: coffee.processing_method_id
      ? String(coffee.processing_method_id)
      : null,
    grade: coffee.grade ? String(coffee.grade) : null,
    status: coffee.status as AdminCoffeeRecord["status"],
    nameEn: String(en?.name ?? ""),
    nameAr: String(ar?.name ?? ""),
    descriptionEn: String(en?.short_description ?? ""),
    descriptionAr: String(ar?.short_description ?? ""),
    varietyIds: (varieties.data ?? []).map((row) => String(row.variety_id)),
    certificationIds: (certifications.data ?? []).map((row) =>
      String(row.certification_id),
    ),
    tagIds: (tags.data ?? []).map((row) => String(row.tag_id)),
    images,
  };
}

export type AdminCoffeeListRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  originLabel: string;
  imageCount: number;
  offerCount: number;
};

export async function listAdminCoffees(
  locale: Locale,
): Promise<AdminCoffeeListRow[]> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const [coffees, translations, originT, media, offers] = await Promise.all([
    db
      .from("coffees")
      .select("id,slug,status,origin_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    db.from("coffee_translations").select("coffee_id,locale,name"),
    db.from("origin_translations").select("origin_id,locale,name"),
    db.from("coffee_media").select("coffee_id"),
    db.from("coffee_offers").select("coffee_id").is("deleted_at", null),
  ]);
  const pick = (
    rows: Record<string, unknown>[] | null,
    key: string,
    owner: string,
  ) => {
    const candidates = (rows ?? []).filter((row) => String(row[key]) === owner);
    return String(
      candidates.find((row) => row.locale === locale)?.name ??
        candidates.find((row) => row.locale === "en")?.name ??
        "",
    );
  };
  return (coffees.data ?? []).map((coffee) => ({
    id: String(coffee.id),
    slug: String(coffee.slug),
    name:
      pick(translations.data, "coffee_id", String(coffee.id)) ||
      String(coffee.slug),
    status: String(coffee.status),
    originLabel: pick(originT.data, "origin_id", String(coffee.origin_id)),
    imageCount: (media.data ?? []).filter(
      (row) => String(row.coffee_id) === String(coffee.id),
    ).length,
    offerCount: (offers.data ?? []).filter(
      (row) => String(row.coffee_id) === String(coffee.id),
    ).length,
  }));
}

// --------------------------------------------------------------- offers

export type AdminOfferRecord = {
  id: string;
  coffeeId: string;
  warehouseId: string;
  referenceNumber: string;
  bagsQuantity: number;
  bagWeightKg: number;
  packagingTypeId: string | null;
  status: string;
  cupScore: number | null;
  currencyCode: string;
  pricingUnit: string;
  isVisible: boolean;
  sensoryNoteIds: string[];
  offerTagIds: string[];
};

export async function getAdminOffer(
  offerId: string,
): Promise<AdminOfferRecord | null> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("coffee_offers")
    .select("*")
    .eq("id", offerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const [notes, tags] = await Promise.all([
    db
      .from("offer_sensory_notes")
      .select("sensory_note_id")
      .eq("offer_id", offerId),
    db.from("offer_tags").select("tag_id").eq("offer_id", offerId),
  ]);
  return {
    id: String(data.id),
    coffeeId: String(data.coffee_id),
    warehouseId: String(data.warehouse_id),
    referenceNumber: String(data.reference_number),
    bagsQuantity: Number(data.bags_quantity),
    bagWeightKg: Number(data.bag_weight_kg),
    packagingTypeId: data.packaging_type_id
      ? String(data.packaging_type_id)
      : null,
    status: String(data.status),
    cupScore: data.cup_score === null ? null : Number(data.cup_score),
    currencyCode: String(data.currency_code ?? "USD"),
    pricingUnit: String(data.pricing_unit ?? "kg"),
    isVisible: Boolean(data.is_visible),
    sensoryNoteIds: (notes.data ?? []).map((row) =>
      String(row.sensory_note_id),
    ),
    offerTagIds: (tags.data ?? []).map((row) => String(row.tag_id)),
  };
}

export type AdminOfferListRow = {
  id: string;
  reference: string;
  coffeeName: string;
  warehouseName: string;
  status: string;
  bags: number;
  visible: boolean;
  tierCount: number;
};

export async function listAdminOffers(
  locale: Locale,
): Promise<AdminOfferListRow[]> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const [offers, coffeeT, warehouses, warehouseT, tiers] = await Promise.all([
    db
      .from("coffee_offers")
      .select(
        "id,reference_number,coffee_id,warehouse_id,status,bags_quantity,is_visible",
      )
      .is("deleted_at", null)
      .order("reference_number"),
    db.from("coffee_translations").select("coffee_id,locale,name"),
    db.from("warehouses").select("id,name"),
    db.from("warehouse_translations").select("warehouse_id,locale,name"),
    db.from("offer_price_tiers").select("offer_id"),
  ]);
  const localized = (
    rows: Record<string, unknown>[] | null,
    key: string,
    owner: string,
    fallback: string,
  ) => {
    const candidates = (rows ?? []).filter((row) => String(row[key]) === owner);
    return String(
      candidates.find((row) => row.locale === locale)?.name ??
        candidates.find((row) => row.locale === "en")?.name ??
        fallback,
    );
  };
  return (offers.data ?? []).map((offer) => ({
    id: String(offer.id),
    reference: String(offer.reference_number),
    coffeeName: localized(
      coffeeT.data,
      "coffee_id",
      String(offer.coffee_id),
      "",
    ),
    warehouseName: localized(
      warehouseT.data,
      "warehouse_id",
      String(offer.warehouse_id),
      String(
        (warehouses.data ?? []).find((row) => row.id === offer.warehouse_id)
          ?.name ?? "",
      ),
    ),
    status: String(offer.status),
    bags: Number(offer.bags_quantity),
    visible: Boolean(offer.is_visible),
    tierCount: (tiers.data ?? []).filter(
      (row) => String(row.offer_id) === String(offer.id),
    ).length,
  }));
}
