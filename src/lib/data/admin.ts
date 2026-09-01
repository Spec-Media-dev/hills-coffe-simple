import "server-only";
import type { Locale } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOfferList } from "./catalog";
import { pickTranslation } from "./shared";

export type AdminRow = {
  id: string;
  primary: string;
  secondary: string;
  detail: string;
  status: string;
  actionValue?: string;
  entity?: string;
  sampleHistory?: {
    requestCode: string;
    status: string;
    createdAt: string;
  }[];
};
export async function getAdminDashboard(locale: Locale) {
  if (!isSupabaseConfigured())
    return {
      products: 0,
      bags: 0,
      low: 0,
      open: 0,
      activity: [] as AdminRow[],
      configured: false,
    };
  const db = await createSupabaseServerClient();
  const [catalog, inquiriesQ, settingsQ, auditQ] = await Promise.all([
    getOfferList(locale),
    db
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .in("status", ["NEW", "RECEIVED"]),
    db
      .from("site_settings")
      .select("low_stock_threshold")
      .limit(1)
      .maybeSingle(),
    db
      .from("audit_logs")
      .select("id,entity_type,action,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const threshold = settingsQ.data?.low_stock_threshold ?? 20;
  return {
    products: new Set(catalog.offers.map((x) => x.coffeeId)).size,
    bags: catalog.offers.reduce((total, x) => total + x.bags, 0),
    low: catalog.offers.filter(
      (x) => x.bags <= threshold && x.status !== "SOLD_OUT",
    ).length,
    open: inquiriesQ.count ?? 0,
    configured: true,
    activity: (auditQ.data ?? []).map((row) => ({
      id: String(row.id),
      primary: row.action,
      secondary: row.entity_type,
      detail: new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(row.created_at)),
      status: "audit",
    })),
  };
}

export async function getAdminModuleRows(
  module: string,
  locale: Locale,
): Promise<AdminRow[]> {
  if (!isSupabaseConfigured()) return [];
  const db = await createSupabaseServerClient();
  // "products", "offers" and "pricing" are served by their own Phase 6
  // workspaces (`src/lib/data/admin-catalog.ts`), not by this generic router.
  if (module === "content") {
    const { data } = await db
      .from("site_pages")
      .select("id,page_key,route_path,status")
      .order("sort_order");
    return (data ?? []).map((x) => ({
      id: x.id,
      primary: x.page_key,
      secondary: x.route_path ?? "—",
      detail: "CMS page",
      status: x.status,
    }));
  }
  if (module === "origins") {
    const [originsQ, translationsQ] = await Promise.all([
      db.from("origins").select("id,slug,is_active"),
      db
        .from("origin_translations")
        .select("origin_id,name")
        .eq("locale", locale),
    ]);
    const names = new Map(
      (translationsQ.data ?? []).map((x) => [x.origin_id, x.name]),
    );
    return (originsQ.data ?? []).map((x) => ({
      id: x.id,
      primary: names.get(x.id) ?? x.slug,
      secondary: x.slug,
      detail: "Origin",
      status: x.is_active ? "active" : "inactive",
    }));
  }
  if (module === "taxonomy") {
    const tables = [
      "coffee_types",
      "processing_methods",
      "packaging_types",
      "sensory_notes",
      "certifications",
      "tags",
    ] as const;
    const groups = await Promise.all(
      tables.map(async (table) => ({
        table,
        result: await db.from(table).select("id,slug,is_active"),
      })),
    );
    return groups.flatMap(({ table, result }) =>
      (result.data ?? []).map((x) => ({
        id: x.id,
        primary: x.slug,
        secondary: table.replaceAll("_", " "),
        detail: "Taxonomy",
        status: x.is_active ? "active" : "inactive",
        entity: table,
      })),
    );
  }
  if (module === "regions") {
    const [regionsQ, translationsQ, originsQ, originTranslationsQ] =
      await Promise.all([
        db.from("regions").select("id,origin_id,slug,is_active,deleted_at"),
        db.from("region_translations").select("region_id,name,locale"),
        db.from("origins").select("id,slug"),
        db.from("origin_translations").select("origin_id,name,locale"),
      ]);
    const originLabels = new Map(
      (originsQ.data ?? []).map((origin) => [
        origin.id,
        pickTranslation(
          (originTranslationsQ.data ?? []).filter(
            (row) => row.origin_id === origin.id,
          ),
          locale,
        ).translation?.name ?? origin.slug,
      ]),
    );
    return (regionsQ.data ?? []).map((region) => ({
      id: region.id,
      primary:
        pickTranslation(
          (translationsQ.data ?? []).filter(
            (row) => row.region_id === region.id,
          ),
          locale,
        ).translation?.name ?? region.slug,
      secondary: originLabels.get(region.origin_id) ?? "—",
      detail: region.slug,
      status: region.deleted_at
        ? "deleted"
        : region.is_active
          ? "active"
          : "inactive",
      entity: "regions",
    }));
  }
  if (module === "warehouses") {
    const { data } = await db
      .from("warehouses")
      .select("id,code,name,city,country_code,is_active")
      .order("code");
    return (data ?? []).map((warehouse) => ({
      id: warehouse.id,
      primary: warehouse.name,
      secondary: warehouse.code,
      detail: [warehouse.city, warehouse.country_code]
        .filter(Boolean)
        .join(", "),
      status: warehouse.is_active ? "active" : "inactive",
      entity: "warehouses",
    }));
  }
  if (module === "varieties") {
    const { data } = await db
      .from("varieties")
      .select("id,slug,name,is_active")
      .order("name");
    return (data ?? []).map((variety) => ({
      id: variety.id,
      primary: variety.name ?? variety.slug,
      secondary: variety.slug,
      detail: "Variety",
      status: variety.is_active ? "active" : "inactive",
      entity: "varieties",
    }));
  }
  if (module === "articles") {
    const [articlesQ, translationsQ] = await Promise.all([
      db.from("articles").select("id,status,category_id,deleted_at,created_at"),
      db.from("article_translations").select("article_id,locale,title,slug"),
    ]);
    return (articlesQ.data ?? []).map((article) => {
      const translation = pickTranslation(
        (translationsQ.data ?? []).filter(
          (row) => row.article_id === article.id,
        ),
        locale,
      ).translation;
      return {
        id: article.id,
        primary: translation?.title ?? "Untitled article",
        secondary: translation?.slug ?? "—",
        detail: article.category_id ?? "Uncategorised",
        status: article.deleted_at ? "deleted" : article.status,
        entity: "articles",
      };
    });
  }
  if (module === "article-categories") {
    const [categoriesQ, translationsQ] = await Promise.all([
      db.from("article_categories").select("id,slug,is_active"),
      db
        .from("article_category_translations")
        .select("category_id,locale,name"),
    ]);
    return (categoriesQ.data ?? []).map((category) => ({
      id: category.id,
      primary:
        pickTranslation(
          (translationsQ.data ?? []).filter(
            (row) => row.category_id === category.id,
          ),
          locale,
        ).translation?.name ?? category.slug,
      secondary: category.slug,
      detail: "Article category",
      status: category.is_active ? "active" : "inactive",
      entity: "article_categories",
    }));
  }
  if (module === "media") {
    const [mediaQ, translationsQ] = await Promise.all([
      db
        .from("media")
        .select(
          "id,storage_bucket,storage_path,mime_type,file_size_bytes,deleted_at,created_at",
        )
        .order("created_at", { ascending: false }),
      db.from("media_translations").select("media_id,locale,alt_text"),
    ]);
    return (mediaQ.data ?? []).map((media) => ({
      id: media.id,
      primary:
        pickTranslation(
          (translationsQ.data ?? []).filter((row) => row.media_id === media.id),
          locale,
        ).translation?.alt_text ?? media.storage_path,
      secondary: media.mime_type ?? "unknown",
      detail: `${media.storage_bucket}/${media.storage_path} · ${Math.round(
        Number(media.file_size_bytes ?? 0) / 1024,
      )} KB`,
      status: media.deleted_at ? "deleted" : "active",
      entity: "media",
    }));
  }
  if (module === "audit") {
    const { data } = await db
      .from("audit_logs")
      .select("id,actor_user_id,entity_type,entity_id,action,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      primary: row.action,
      secondary: `${row.entity_type} · ${row.entity_id ?? "—"}`,
      detail: `${row.actor_user_id ?? "system"} · ${new Intl.DateTimeFormat(
        locale,
        { dateStyle: "medium", timeStyle: "short" },
      ).format(new Date(row.created_at))}`,
      status: "audit",
    }));
  }
  if (module === "settings") {
    const { data } = await db
      .from("site_settings")
      .select("id,org_brand_name,org_email,updated_at");
    return (data ?? []).map((x) => ({
      // `AdminRow.id` is a string across every module; site settings is the
      // one table with an integer key.
      id: String(x.id),
      primary: x.org_brand_name ?? "Hills Coffee",
      secondary: x.org_email ?? "—",
      detail: x.updated_at,
      status: "configured",
    }));
  }
  return [];
}

export type AdminOption = { id: string; label: string };
export async function getAdminFormOptions(locale: Locale) {
  if (!isSupabaseConfigured())
    return {
      coffees: [] as AdminOption[],
      origins: [] as AdminOption[],
      regions: [] as AdminOption[],
      coffeeTypes: [] as AdminOption[],
      processingMethods: [] as AdminOption[],
      warehouses: [] as AdminOption[],
      articleCategories: [] as AdminOption[],
      offers: [] as AdminOption[],
    };
  const db = await createSupabaseServerClient();
  const [
    coffeesQ,
    coffeeTranslationsQ,
    originsQ,
    originTranslationsQ,
    regionsQ,
    regionTranslationsQ,
    typesQ,
    typeTranslationsQ,
    processesQ,
    processTranslationsQ,
    warehousesQ,
    categoriesQ,
    categoryTranslationsQ,
    offersQ,
  ] = await Promise.all([
    db.from("coffees").select("id,slug").is("deleted_at", null),
    db.from("coffee_translations").select("coffee_id,locale,name"),
    db.from("origins").select("id,slug").is("deleted_at", null),
    db.from("origin_translations").select("origin_id,locale,name"),
    db.from("regions").select("id,slug").is("deleted_at", null),
    db.from("region_translations").select("region_id,locale,name"),
    db.from("coffee_types").select("id,slug").eq("is_active", true),
    db.from("coffee_type_translations").select("coffee_type_id,locale,name"),
    db.from("processing_methods").select("id,slug").eq("is_active", true),
    db
      .from("processing_method_translations")
      .select("processing_method_id,locale,name"),
    db.from("warehouses").select("id,code,name").eq("is_active", true),
    db.from("article_categories").select("id,slug").eq("is_active", true),
    db.from("article_category_translations").select("category_id,locale,name"),
    db
      .from("coffee_offers")
      .select("id,reference_number")
      .is("deleted_at", null),
  ]);
  const translated = <T extends { id: string; slug: string }>(
    rows: T[] | null,
    translations: {
      locale: "en" | "ar";
      name: string;
      ownerId: string;
    }[],
  ) =>
    (rows ?? []).map((row) => {
      const candidates = translations.filter(
        (translation) => translation.ownerId === row.id,
      );
      return {
        id: row.id,
        label:
          candidates.find((translation) => translation.locale === locale)
            ?.name ??
          candidates.find((translation) => translation.locale === "en")?.name ??
          row.slug,
      };
    });
  return {
    coffees: translated(
      coffeesQ.data,
      (coffeeTranslationsQ.data ?? []).map((row) => ({
        ...row,
        ownerId: row.coffee_id,
      })),
    ),
    origins: translated(
      originsQ.data,
      (originTranslationsQ.data ?? []).map((row) => ({
        ...row,
        ownerId: row.origin_id,
      })),
    ),
    regions: translated(
      regionsQ.data,
      (regionTranslationsQ.data ?? []).map((row) => ({
        ...row,
        ownerId: row.region_id,
      })),
    ),
    coffeeTypes: translated(
      typesQ.data,
      (typeTranslationsQ.data ?? []).map((row) => ({
        ...row,
        ownerId: row.coffee_type_id,
      })),
    ),
    processingMethods: translated(
      processesQ.data,
      (processTranslationsQ.data ?? []).map((row) => ({
        ...row,
        ownerId: row.processing_method_id,
      })),
    ),
    warehouses: (warehousesQ.data ?? []).map((row) => ({
      id: row.id,
      label: `${row.code} · ${row.name}`,
    })),
    articleCategories: translated(
      categoriesQ.data,
      (categoryTranslationsQ.data ?? []).map((row) => ({
        ...row,
        ownerId: row.category_id,
      })),
    ),
    offers: (offersQ.data ?? []).map((row) => ({
      id: row.id,
      label: row.reference_number,
    })),
  };
}

export async function getAdminSiteSettings() {
  if (!isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();
  const [settingsQ, translationsQ] = await Promise.all([
    db.from("site_settings").select("*").limit(1).maybeSingle(),
    db.from("site_settings_translations").select("*"),
  ]);
  if (!settingsQ.data) return null;
  return {
    settings: settingsQ.data,
    translations: translationsQ.data ?? [],
  };
}

export async function getAdminRecordForEdit(
  module: string,
  recordId: string,
  entity?: string,
) {
  if (!isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();
  if (module === "media") {
    const [recordQ, translationsQ] = await Promise.all([
      db
        .from("media")
        .select("id,storage_path")
        .eq("id", recordId)
        .maybeSingle(),
      db.from("media_translations").select("*").eq("media_id", recordId),
    ]);
    if (!recordQ.data) return null;
    const en = translationsQ.data?.find((row) => row.locale === "en");
    const ar = translationsQ.data?.find((row) => row.locale === "ar");
    return {
      storagePath: recordQ.data.storage_path,
      altEn: en?.alt_text ?? "",
      altAr: ar?.alt_text ?? "",
      captionEn: en?.caption ?? "",
      captionAr: ar?.caption ?? "",
    };
  }
  if (
    module === "taxonomy" &&
    [
      "coffee_types",
      "processing_methods",
      "packaging_types",
      "sensory_notes",
      "certifications",
      "tags",
    ].includes(entity ?? "")
  ) {
    const table = entity as
      | "coffee_types"
      | "processing_methods"
      | "packaging_types"
      | "sensory_notes"
      | "certifications"
      | "tags";
    const { data: record } = await db
      .from(table)
      .select("id,slug,is_active")
      .eq("id", recordId)
      .maybeSingle();
    if (!record) return null;
    let translations: {
      locale: "en" | "ar";
      name: string;
      description?: string | null;
    }[] = [];
    if (table === "coffee_types")
      translations =
        (
          await db
            .from("coffee_type_translations")
            .select("locale,name,description")
            .eq("coffee_type_id", recordId)
        ).data ?? [];
    else if (table === "processing_methods")
      translations =
        (
          await db
            .from("processing_method_translations")
            .select("locale,name,description")
            .eq("processing_method_id", recordId)
        ).data ?? [];
    else if (table === "packaging_types")
      translations =
        (
          await db
            .from("packaging_type_translations")
            .select("locale,name,description")
            .eq("packaging_type_id", recordId)
        ).data ?? [];
    else if (table === "sensory_notes")
      translations =
        (
          await db
            .from("sensory_note_translations")
            .select("locale,name,description")
            .eq("sensory_note_id", recordId)
        ).data ?? [];
    else if (table === "certifications")
      translations =
        (
          await db
            .from("certification_translations")
            .select("locale,name,description")
            .eq("certification_id", recordId)
        ).data ?? [];
    else
      translations =
        (
          await db
            .from("tag_translations")
            .select("locale,name,description")
            .eq("tag_id", recordId)
        ).data ?? [];
    const en = translations.find((row) => row.locale === "en");
    const ar = translations.find((row) => row.locale === "ar");
    return {
      entity: table,
      slug: record.slug,
      nameEn: en?.name ?? "",
      nameAr: ar?.name ?? "",
      descriptionEn: en?.description ?? "",
      descriptionAr: ar?.description ?? "",
      isActive: String(record.is_active),
    };
  }
  if (module === "origins") {
    const [recordQ, translationsQ] = await Promise.all([
      db.from("origins").select("*").eq("id", recordId).maybeSingle(),
      db.from("origin_translations").select("*").eq("origin_id", recordId),
    ]);
    if (!recordQ.data) return null;
    const en = translationsQ.data?.find((row) => row.locale === "en");
    const ar = translationsQ.data?.find((row) => row.locale === "ar");
    return {
      slug: recordQ.data.slug,
      countryCode: recordQ.data.country_code,
      continent: recordQ.data.continent,
      nameEn: en?.name ?? "",
      nameAr: ar?.name ?? "",
      summaryEn: en?.summary ?? "",
      summaryAr: ar?.summary ?? "",
      isActive: String(recordQ.data.is_active),
    };
  }
  if (module === "regions") {
    const [recordQ, translationsQ] = await Promise.all([
      db.from("regions").select("*").eq("id", recordId).maybeSingle(),
      db.from("region_translations").select("*").eq("region_id", recordId),
    ]);
    if (!recordQ.data) return null;
    const en = translationsQ.data?.find((row) => row.locale === "en");
    const ar = translationsQ.data?.find((row) => row.locale === "ar");
    return {
      originId: recordQ.data.origin_id,
      slug: recordQ.data.slug,
      nameEn: en?.name ?? "",
      nameAr: ar?.name ?? "",
      descriptionEn: en?.description ?? "",
      descriptionAr: ar?.description ?? "",
      isActive: String(recordQ.data.is_active),
    };
  }
  if (module === "warehouses") {
    const [recordQ, translationsQ] = await Promise.all([
      db.from("warehouses").select("*").eq("id", recordId).maybeSingle(),
      db
        .from("warehouse_translations")
        .select("*")
        .eq("warehouse_id", recordId),
    ]);
    if (!recordQ.data) return null;
    const ar = translationsQ.data?.find((row) => row.locale === "ar");
    return {
      code: recordQ.data.code,
      name: recordQ.data.name,
      nameAr: ar?.name ?? recordQ.data.name,
      countryCode: recordQ.data.country_code,
      city: recordQ.data.city,
      address: recordQ.data.address,
      email: recordQ.data.email,
      phone: recordQ.data.phone,
      isActive: String(recordQ.data.is_active),
    };
  }
  if (module === "varieties") {
    const { data } = await db
      .from("varieties")
      .select("*")
      .eq("id", recordId)
      .maybeSingle();
    return data
      ? { slug: data.slug, name: data.name, isActive: String(data.is_active) }
      : null;
  }
  if (module === "articles") {
    const [recordQ, translationsQ] = await Promise.all([
      db.from("articles").select("*").eq("id", recordId).maybeSingle(),
      db.from("article_translations").select("*").eq("article_id", recordId),
    ]);
    if (!recordQ.data) return null;
    const en = translationsQ.data?.find((row) => row.locale === "en");
    const ar = translationsQ.data?.find((row) => row.locale === "ar");
    return {
      categoryId: recordQ.data.category_id,
      status: recordQ.data.status,
      slugEn: en?.slug ?? "",
      slugAr: ar?.slug ?? "",
      titleEn: en?.title ?? "",
      titleAr: ar?.title ?? "",
      excerptEn: en?.excerpt ?? "",
      excerptAr: ar?.excerpt ?? "",
      bodyEn: en?.body_markdown ?? "",
      bodyAr: ar?.body_markdown ?? "",
    };
  }
  if (module === "article-categories") {
    const [recordQ, translationsQ] = await Promise.all([
      db
        .from("article_categories")
        .select("*")
        .eq("id", recordId)
        .maybeSingle(),
      db
        .from("article_category_translations")
        .select("*")
        .eq("category_id", recordId),
    ]);
    if (!recordQ.data) return null;
    const en = translationsQ.data?.find((row) => row.locale === "en");
    const ar = translationsQ.data?.find((row) => row.locale === "ar");
    return {
      entity: "article_categories",
      slug: recordQ.data.slug,
      nameEn: en?.name ?? "",
      nameAr: ar?.name ?? "",
      descriptionEn: en?.description ?? "",
      descriptionAr: ar?.description ?? "",
      isActive: String(recordQ.data.is_active),
    };
  }
  return null;
}
