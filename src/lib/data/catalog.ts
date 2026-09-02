import "server-only";
import type { Locale } from "@/i18n/routing";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OfferStatus } from "@/lib/supabase/types.generated";
import { groupBy, pickTranslation, storagePublicUrl } from "./shared";

export type OfferListItem = {
  id: string;
  coffeeId: string;
  slug: string;
  name: string;
  nameLang: Locale | "en";
  featured: boolean;
  featuredOrder: number;
  origin: string;
  originSlug: string;
  originFeatured: boolean;
  originFeaturedOrder: number;
  type: string;
  process: string | null;
  grade: string | null;
  region: string | null;
  reference: string;
  bags: number;
  bagWeightKg: number;
  warehouse: string;
  warehouseCode: "EGYPT" | "DUBAI";
  status: OfferStatus;
  cupScore: number | null;
  packaging: string | null;
  availableFrom: string | null;
  sensory: string[];
  certifications: string[];
  tags: string[];
};
export type CatalogData = {
  offers: OfferListItem[];
  origins: string[];
  processes: string[];
  warehouses: string[];
  statuses: OfferStatus[];
  types: string[];
  configured: boolean;
};

const empty = (): CatalogData => ({
  offers: [],
  origins: [],
  processes: [],
  warehouses: [],
  statuses: [],
  types: [],
  configured: false,
});
export async function getOfferList(locale: Locale): Promise<CatalogData> {
  if (!isSupabaseConfigured()) return empty();
  const db = await createSupabaseServerClient();
  const [
    coffeesQ,
    coffeeTranslationsQ,
    offersQ,
    originsQ,
    originTranslationsQ,
    warehousesQ,
    warehouseTranslationsQ,
    typesQ,
    typeTranslationsQ,
    processingQ,
    processingTranslationsQ,
    packagingQ,
    packagingTranslationsQ,
    offerSensoryQ,
    sensoryQ,
    sensoryTranslationsQ,
    coffeeCertQ,
    certQ,
    certTranslationsQ,
    offerTagsQ,
    tagsQ,
    tagTranslationsQ,
    regionsQ,
    regionTranslationsQ,
  ] = await Promise.all([
    db
      .from("coffees")
      .select("*")
      .eq("status", "PUBLISHED")
      .is("deleted_at", null),
    db.from("coffee_translations").select("*"),
    db
      .from("coffee_offers")
      .select("*")
      .eq("is_visible", true)
      .neq("status", "INACTIVE")
      .is("deleted_at", null),
    db.from("origins").select("*").eq("is_active", true).is("deleted_at", null),
    db.from("origin_translations").select("*"),
    db.from("warehouses").select("*").eq("is_active", true),
    db.from("warehouse_translations").select("*"),
    db.from("coffee_types").select("*").eq("is_active", true),
    db.from("coffee_type_translations").select("*"),
    db.from("processing_methods").select("*").eq("is_active", true),
    db.from("processing_method_translations").select("*"),
    db.from("packaging_types").select("*").eq("is_active", true),
    db.from("packaging_type_translations").select("*"),
    db.from("offer_sensory_notes").select("*"),
    db.from("sensory_notes").select("*").eq("is_active", true),
    db.from("sensory_note_translations").select("*"),
    db.from("coffee_certifications").select("*"),
    db.from("certifications").select("*").eq("is_active", true),
    db.from("certification_translations").select("*"),
    db.from("offer_tags").select("*"),
    db.from("tags").select("*").eq("is_active", true),
    db.from("tag_translations").select("*"),
    db.from("regions").select("*").eq("is_active", true).is("deleted_at", null),
    db.from("region_translations").select("*"),
  ]);
  const queries = [
    coffeesQ,
    coffeeTranslationsQ,
    offersQ,
    originsQ,
    originTranslationsQ,
    warehousesQ,
    warehouseTranslationsQ,
    typesQ,
    typeTranslationsQ,
    processingQ,
    processingTranslationsQ,
    packagingQ,
    packagingTranslationsQ,
    offerSensoryQ,
    sensoryQ,
    sensoryTranslationsQ,
    coffeeCertQ,
    certQ,
    certTranslationsQ,
    offerTagsQ,
    tagsQ,
    tagTranslationsQ,
    regionsQ,
    regionTranslationsQ,
  ];
  const failure = queries.find((query) => query.error)?.error;
  if (failure)
    throw new Error(`Catalog data unavailable (${failure.code ?? "upstream"})`);
  const coffees = coffeesQ.data ?? [];
  const coffeeTranslations = groupBy(
    coffeeTranslationsQ.data ?? [],
    (x) => x.coffee_id,
  );
  const origins = new Map((originsQ.data ?? []).map((x) => [x.id, x]));
  const originTranslations = groupBy(
    originTranslationsQ.data ?? [],
    (x) => x.origin_id,
  );
  const warehouses = new Map((warehousesQ.data ?? []).map((x) => [x.id, x]));
  const warehouseTranslations = groupBy(
    warehouseTranslationsQ.data ?? [],
    (x) => x.warehouse_id,
  );
  const types = new Map((typesQ.data ?? []).map((x) => [x.id, x]));
  const typeTranslations = groupBy(
    typeTranslationsQ.data ?? [],
    (x) => x.coffee_type_id,
  );
  const processing = new Map((processingQ.data ?? []).map((x) => [x.id, x]));
  const processingTranslations = groupBy(
    processingTranslationsQ.data ?? [],
    (x) => x.processing_method_id,
  );
  const packaging = new Map((packagingQ.data ?? []).map((x) => [x.id, x]));
  const packagingTranslations = groupBy(
    packagingTranslationsQ.data ?? [],
    (x) => x.packaging_type_id,
  );
  const regions = new Map((regionsQ.data ?? []).map((x) => [x.id, x]));
  const regionTranslations = groupBy(
    regionTranslationsQ.data ?? [],
    (x) => x.region_id,
  );
  const sensoryByOffer = groupBy(offerSensoryQ.data ?? [], (x) => x.offer_id);
  const sensory = new Map((sensoryQ.data ?? []).map((x) => [x.id, x]));
  const sensoryTranslations = groupBy(
    sensoryTranslationsQ.data ?? [],
    (x) => x.sensory_note_id,
  );
  const certByCoffee = groupBy(coffeeCertQ.data ?? [], (x) => x.coffee_id);
  const certs = new Map((certQ.data ?? []).map((x) => [x.id, x]));
  const certTranslations = groupBy(
    certTranslationsQ.data ?? [],
    (x) => x.certification_id,
  );
  const tagsByOffer = groupBy(offerTagsQ.data ?? [], (x) => x.offer_id);
  const tags = new Map((tagsQ.data ?? []).map((x) => [x.id, x]));
  const tagTranslations = groupBy(tagTranslationsQ.data ?? [], (x) => x.tag_id);
  const coffeeMap = new Map(coffees.map((x) => [x.id, x]));
  const offers: OfferListItem[] = (offersQ.data ?? []).flatMap((offer) => {
    const coffee = coffeeMap.get(offer.coffee_id);
    const origin = coffee ? origins.get(coffee.origin_id) : null;
    const warehouse = warehouses.get(offer.warehouse_id);
    if (!coffee || !origin || !warehouse) return [];
    const coffeeT = pickTranslation(
      coffeeTranslations.get(coffee.id) ?? [],
      locale,
    );
    const originT = pickTranslation(
      originTranslations.get(origin.id) ?? [],
      locale,
    );
    const warehouseT = pickTranslation(
      warehouseTranslations.get(warehouse.id) ?? [],
      locale,
    );
    if (!coffeeT.translation || !originT.translation) return [];
    const type = types.get(coffee.coffee_type_id);
    const typeT = type
      ? pickTranslation(typeTranslations.get(type.id) ?? [], locale).translation
      : null;
    const process = coffee.processing_method_id
      ? processing.get(coffee.processing_method_id)
      : null;
    const processT = process
      ? pickTranslation(processingTranslations.get(process.id) ?? [], locale)
          .translation
      : null;
    const pack = offer.packaging_type_id
      ? packaging.get(offer.packaging_type_id)
      : null;
    const packT = pack
      ? pickTranslation(packagingTranslations.get(pack.id) ?? [], locale)
          .translation
      : null;
    const region = coffee.region_id ? regions.get(coffee.region_id) : null;
    const regionT = region
      ? pickTranslation(regionTranslations.get(region.id) ?? [], locale)
          .translation
      : null;
    return [
      {
        id: offer.id,
        coffeeId: coffee.id,
        slug: coffee.slug,
        name: coffeeT.translation.name,
        nameLang: coffeeT.translation.locale,
        featured: coffee.is_featured,
        featuredOrder: coffee.featured_sort_order,
        origin: originT.translation.name,
        originSlug: origin.slug,
        originFeatured: origin.is_featured,
        originFeaturedOrder: origin.featured_sort_order,
        type: typeT?.name ?? type?.slug ?? "",
        process: processT?.name ?? process?.slug ?? null,
        grade: coffee.grade,
        region: regionT?.name ?? null,
        reference: offer.reference_number,
        bags: offer.bags_quantity,
        bagWeightKg: Number(offer.bag_weight_kg),
        warehouse: warehouseT.translation?.name ?? warehouse.name,
        warehouseCode: warehouse.code,
        status: offer.status,
        cupScore: offer.cup_score == null ? null : Number(offer.cup_score),
        packaging: packT?.name ?? pack?.slug ?? null,
        availableFrom: offer.available_from,
        sensory: (sensoryByOffer.get(offer.id) ?? []).flatMap((join) => {
          const item = sensory.get(join.sensory_note_id);
          const translation = item
            ? pickTranslation(sensoryTranslations.get(item.id) ?? [], locale)
                .translation
            : null;
          return translation?.name ? [translation.name] : [];
        }),
        certifications: (certByCoffee.get(coffee.id) ?? []).flatMap((join) => {
          const item = certs.get(join.certification_id);
          const translation = item
            ? pickTranslation(certTranslations.get(item.id) ?? [], locale)
                .translation
            : null;
          return translation?.name ? [translation.name] : [];
        }),
        tags: (tagsByOffer.get(offer.id) ?? []).flatMap((join) => {
          const item = tags.get(join.tag_id);
          const translation = item
            ? pickTranslation(tagTranslations.get(item.id) ?? [], locale)
                .translation
            : null;
          return translation?.name ? [translation.name] : [];
        }),
      },
    ];
  });
  return {
    offers,
    origins: [...new Set(offers.map((x) => x.origin))].sort(),
    processes: [
      ...new Set(offers.flatMap((x) => (x.process ? [x.process] : []))),
    ].sort(),
    warehouses: [...new Set(offers.map((x) => x.warehouse))].sort(),
    statuses: [...new Set(offers.map((x) => x.status))],
    types: [...new Set(offers.map((x) => x.type))].filter(Boolean).sort(),
    configured: true,
  };
}

export async function getCoffeeBySlug(slug: string, locale: Locale) {
  const data = await getOfferList(locale);
  const offers = data.offers.filter((item) => item.slug === slug);
  return offers.length ? { ...offers[0], offers } : null;
}

export async function getPublicCoffeeMedia(coffeeId: string, locale: Locale) {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  const linksQ = await db
    .from("coffee_media")
    .select("media_id,role,sort_order")
    .eq("coffee_id", coffeeId)
    .order("sort_order");
  const ids = (linksQ.data ?? []).map((link) => String(link.media_id));
  if (!ids.length) return [];
  const [mediaQ, translationsQ] = await Promise.all([
    db
      .from("media")
      .select("id,storage_bucket,storage_path,width,height")
      .in("id", ids)
      .is("deleted_at", null),
    db
      .from("media_translations")
      .select("media_id,locale,alt_text")
      .in("media_id", ids),
  ]);
  if (linksQ.error || mediaQ.error || translationsQ.error) return [];
  const { url } = getSupabaseConfig();
  const media = new Map(
    (mediaQ.data ?? []).map((item) => [String(item.id), item]),
  );
  return (linksQ.data ?? []).flatMap((link) => {
    const item = media.get(String(link.media_id));
    if (!item?.width || !item.height) return [];
    const translations = (translationsQ.data ?? []).filter(
      (entry) => String(entry.media_id) === String(link.media_id),
    );
    const alt =
      translations.find((entry) => entry.locale === locale)?.alt_text ??
      translations.find((entry) => entry.locale === "en")?.alt_text ??
      "";
    return [
      {
        id: String(item.id),
        role: link.role,
        sortOrder: link.sort_order,
        url: storagePublicUrl(url, item.storage_bucket, item.storage_path),
        width: Number(item.width),
        height: Number(item.height),
        alt: String(alt),
      },
    ];
  });
}
