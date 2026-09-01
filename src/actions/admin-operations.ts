"use server";

/**
 * Legacy Admin operations.
 *
 * Coffee, Offer and Pricing moved to `src/actions/admin-catalog.ts` in Phase 6,
 * where they use the project's real `ActionResult` contract with localized
 * message keys. What remains here still returns the older `AdminActionState`
 * with hardcoded English prose and is scheduled for the Phase 11 migration.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import type { AdminActionState } from "@/lib/admin/action-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const slug = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalUuid = z.preprocess(
  (value) => (value === "" ? null : value),
  uuid.nullable(),
);
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().trim().max(max).nullable(),
  );

function invalid(error: z.ZodError): AdminActionState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

const failed = (
  message = "The database did not accept this change.",
): AdminActionState => ({
  status: "error",
  message,
});
const saved = (message: string): AdminActionState => ({
  status: "success",
  message,
});

async function adminContext() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return { admin, db: await createSupabaseServerClient() };
}

const namedEntityNames = [
  "coffee_types",
  "processing_methods",
  "packaging_types",
  "sensory_notes",
  "certifications",
  "tags",
  "article_categories",
] as const;
const namedSchema = z.object({
  id: optionalUuid.optional(),
  entity: z.enum(namedEntityNames),
  slug,
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().min(1).max(160),
  descriptionEn: optionalText(1000),
  descriptionAr: optionalText(1000),
  isActive: z.enum(["true", "false"]).default("true"),
});

export async function saveNamedEntityAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = namedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const { db } = context;
  const input = parsed.data;
  const baseResult = input.id
    ? await db
        .from(input.entity)
        .update({ slug: input.slug, is_active: input.isActive === "true" })
        .eq("id", input.id)
        .select("id")
        .single()
    : await db
        .from(input.entity)
        .insert({ slug: input.slug, is_active: input.isActive === "true" })
        .select("id")
        .single();
  if (baseResult.error || !baseResult.data) return failed();
  const entityId = baseResult.data.id;
  // Only four of the seven taxonomy translation tables actually have a
  // `description` column. Sending it to the others made PostgREST reject the
  // whole upsert with PGRST204, so the term kept its slug as its name in both
  // languages — every coffee type, sensory note, tag and article category
  // created through this form was silently untranslated (finding N38).
  const supportsDescription = (
    ["processing_methods", "packaging_types", "certifications"] as const
  ).includes(input.entity as "processing_methods");
  const translations = (
    [
      ["en", input.nameEn, input.descriptionEn],
      ["ar", input.nameAr, input.descriptionAr],
    ] as const
  ).map(([locale, name, description]) =>
    supportsDescription ? { locale, name, description } : { locale, name },
  );
  let error: { message: string } | null = null;
  if (input.entity === "coffee_types")
    ({ error } = await db.from("coffee_type_translations").upsert(
      translations.map((row) => ({ ...row, coffee_type_id: entityId })),
      { onConflict: "coffee_type_id,locale" },
    ));
  else if (input.entity === "processing_methods")
    ({ error } = await db.from("processing_method_translations").upsert(
      translations.map((row) => ({ ...row, processing_method_id: entityId })),
      { onConflict: "processing_method_id,locale" },
    ));
  else if (input.entity === "packaging_types")
    ({ error } = await db.from("packaging_type_translations").upsert(
      translations.map((row) => ({ ...row, packaging_type_id: entityId })),
      { onConflict: "packaging_type_id,locale" },
    ));
  else if (input.entity === "sensory_notes")
    ({ error } = await db.from("sensory_note_translations").upsert(
      translations.map((row) => ({ ...row, sensory_note_id: entityId })),
      { onConflict: "sensory_note_id,locale" },
    ));
  else if (input.entity === "certifications")
    ({ error } = await db.from("certification_translations").upsert(
      translations.map((row) => ({ ...row, certification_id: entityId })),
      { onConflict: "certification_id,locale" },
    ));
  else if (input.entity === "tags")
    ({ error } = await db.from("tag_translations").upsert(
      translations.map((row) => ({ ...row, tag_id: entityId })),
      { onConflict: "tag_id,locale" },
    ));
  else
    ({ error } = await db.from("article_category_translations").upsert(
      translations.map((row) => ({ ...row, category_id: entityId })),
      { onConflict: "category_id,locale" },
    ));
  if (error)
    return failed("The record was saved, but its translations were not.");
  revalidatePath("/", "layout");
  return saved(input.id ? "Record updated." : "Record created.");
}

const varietySchema = z.object({
  id: optionalUuid.optional(),
  slug,
  name: z.string().trim().min(1).max(160),
  isActive: z.enum(["true", "false"]).default("true"),
});

export async function saveVarietyAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = varietySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const values = {
    slug: parsed.data.slug,
    name: parsed.data.name,
    is_active: parsed.data.isActive === "true",
  };
  const result = parsed.data.id
    ? await context.db.from("varieties").update(values).eq("id", parsed.data.id)
    : await context.db.from("varieties").insert(values);
  if (result.error) return failed();
  revalidatePath("/admin/varieties");
  return saved(parsed.data.id ? "Variety updated." : "Variety created.");
}

const originSchema = z.object({
  id: optionalUuid.optional(),
  slug,
  countryCode: z.string().trim().length(2).toUpperCase(),
  continent: optionalText(80),
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().min(1).max(160),
  summaryEn: optionalText(2000),
  summaryAr: optionalText(2000),
  isActive: z.enum(["true", "false"]).default("true"),
});

export async function saveOriginAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = originSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const input = parsed.data;
  const values = {
    slug: input.slug,
    country_code: input.countryCode,
    continent: input.continent,
    is_active: input.isActive === "true",
    updated_by: context.admin.id,
  };
  const base = input.id
    ? await context.db
        .from("origins")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await context.db
        .from("origins")
        .insert({ ...values, created_by: context.admin.id })
        .select("id")
        .single();
  if (base.error || !base.data) return failed();
  const { error } = await context.db.from("origin_translations").upsert(
    [
      {
        origin_id: base.data.id,
        locale: "en",
        name: input.nameEn,
        summary: input.summaryEn,
      },
      {
        origin_id: base.data.id,
        locale: "ar",
        name: input.nameAr,
        summary: input.summaryAr,
      },
    ],
    { onConflict: "origin_id,locale" },
  );
  if (error)
    return failed("The origin was saved, but its translations were not.");
  revalidatePath("/", "layout");
  return saved(input.id ? "Origin updated." : "Origin created.");
}

const regionSchema = z.object({
  id: optionalUuid.optional(),
  originId: uuid,
  slug,
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().min(1).max(160),
  descriptionEn: optionalText(1000),
  descriptionAr: optionalText(1000),
  isActive: z.enum(["true", "false"]).default("true"),
});

export async function saveRegionAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = regionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const input = parsed.data;
  const values = {
    origin_id: input.originId,
    slug: input.slug,
    is_active: input.isActive === "true",
  };
  const base = input.id
    ? await context.db
        .from("regions")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await context.db.from("regions").insert(values).select("id").single();
  if (base.error || !base.data) return failed();
  const { error } = await context.db.from("region_translations").upsert(
    [
      {
        region_id: base.data.id,
        locale: "en",
        name: input.nameEn,
        description: input.descriptionEn,
      },
      {
        region_id: base.data.id,
        locale: "ar",
        name: input.nameAr,
        description: input.descriptionAr,
      },
    ],
    { onConflict: "region_id,locale" },
  );
  if (error)
    return failed("The region was saved, but its translations were not.");
  revalidatePath("/", "layout");
  return saved(input.id ? "Region updated." : "Region created.");
}

const warehouseSchema = z.object({
  id: optionalUuid.optional(),
  code: z.enum(["EGYPT", "DUBAI"]),
  name: z.string().trim().min(1).max(160),
  countryCode: z.string().trim().length(2).toUpperCase(),
  city: optionalText(160),
  address: optionalText(500),
  email: z.preprocess(
    (value) => (value === "" ? null : value),
    z.email().nullable(),
  ),
  phone: optionalText(60),
  isActive: z.enum(["true", "false"]).default("true"),
  nameAr: z.string().trim().min(1).max(160),
});

export async function saveWarehouseAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = warehouseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const input = parsed.data;
  const values = {
    code: input.code,
    name: input.name,
    country_code: input.countryCode,
    city: input.city,
    address: input.address,
    email: input.email,
    phone: input.phone,
    is_active: input.isActive === "true",
  };
  const base = input.id
    ? await context.db
        .from("warehouses")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await context.db.from("warehouses").insert(values).select("id").single();
  if (base.error || !base.data) return failed();
  const { error } = await context.db.from("warehouse_translations").upsert(
    [
      {
        warehouse_id: base.data.id,
        locale: "en",
        name: input.name,
        city: input.city,
        address: input.address,
      },
      {
        warehouse_id: base.data.id,
        locale: "ar",
        name: input.nameAr,
        city: input.city,
        address: input.address,
      },
    ],
    { onConflict: "warehouse_id,locale" },
  );
  if (error)
    return failed("The warehouse was saved, but its translations were not.");
  revalidatePath("/", "layout");
  return saved(input.id ? "Warehouse updated." : "Warehouse created.");
}

const articleSchema = z.object({
  id: optionalUuid.optional(),
  categoryId: optionalUuid,
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  slugEn: slug,
  slugAr: slug,
  titleEn: z.string().trim().min(1).max(240),
  titleAr: z.string().trim().min(1).max(240),
  excerptEn: optionalText(1000),
  excerptAr: optionalText(1000),
  bodyEn: optionalText(30000),
  bodyAr: optionalText(30000),
});

export async function saveArticleAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = articleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const input = parsed.data;
  const values = {
    category_id: input.categoryId,
    status: input.status,
    published_at:
      input.status === "PUBLISHED" ? new Date().toISOString() : null,
    updated_by: context.admin.id,
  };
  const base = input.id
    ? await context.db
        .from("articles")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await context.db
        .from("articles")
        .insert({ ...values, created_by: context.admin.id })
        .select("id")
        .single();
  if (base.error || !base.data) return failed();
  const { error } = await context.db.from("article_translations").upsert(
    [
      {
        article_id: base.data.id,
        locale: "en",
        slug: input.slugEn,
        title: input.titleEn,
        excerpt: input.excerptEn,
        body_markdown: input.bodyEn,
      },
      {
        article_id: base.data.id,
        locale: "ar",
        slug: input.slugAr,
        title: input.titleAr,
        excerpt: input.excerptAr,
        body_markdown: input.bodyAr,
      },
    ],
    { onConflict: "article_id,locale" },
  );
  if (error)
    return failed("The article was saved, but its translations were not.");
  revalidatePath("/", "layout");
  return saved(input.id ? "Article updated." : "Article created.");
}

export async function uploadMediaAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const file = formData.get("file");
  const altEn = String(formData.get("altEn") ?? "").trim();
  const altAr = String(formData.get("altAr") ?? "").trim();
  const allowed = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/avif", "avif"],
  ]);
  if (
    !(file instanceof File) ||
    !allowed.has(file.type) ||
    file.size <= 0 ||
    file.size > 10_000_000
  )
    return failed(
      "Choose a JPEG, PNG, WebP, or AVIF image no larger than 10 MB.",
    );
  if (!altEn || !altAr)
    return failed("English and Arabic alt text are required.");
  const extension = allowed.get(file.type)!;
  const storagePath = `media/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${extension}`;
  const upload = await context.db.storage
    .from("hills-public")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (upload.error) return failed("The image could not be uploaded.");
  const media = await context.db
    .from("media")
    .insert({
      storage_bucket: "hills-public",
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      is_public: true,
      uploaded_by: context.admin.id,
    })
    .select("id")
    .single();
  if (media.error || !media.data) {
    await context.db.storage.from("hills-public").remove([storagePath]);
    return failed(
      "The upload succeeded, but its media record could not be created.",
    );
  }
  const translations = await context.db.from("media_translations").upsert(
    [
      { media_id: media.data.id, locale: "en", alt_text: altEn },
      { media_id: media.data.id, locale: "ar", alt_text: altAr },
    ],
    { onConflict: "media_id,locale" },
  );
  if (translations.error)
    return failed("The image was saved, but its alt text was not.");
  revalidatePath("/", "layout");
  return saved("Media uploaded.");
}

export async function updateMediaTranslationAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      id: uuid,
      altEn: z.string().trim().min(1).max(500),
      altAr: z.string().trim().min(1).max(500),
      captionEn: optionalText(1000),
      captionAr: optionalText(1000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const input = parsed.data;
  const { error } = await context.db.from("media_translations").upsert(
    [
      {
        media_id: input.id,
        locale: "en",
        alt_text: input.altEn,
        caption: input.captionEn,
      },
      {
        media_id: input.id,
        locale: "ar",
        alt_text: input.altAr,
        caption: input.captionAr,
      },
    ],
    { onConflict: "media_id,locale" },
  );
  if (error) return failed(error.message);
  revalidatePath("/", "layout");
  return saved("Media translations updated.");
}

const archiveEntities = [
  "products",
  "offers",
  "origins",
  "regions",
  "warehouses",
  "varieties",
  "coffee_types",
  "processing_methods",
  "packaging_types",
  "sensory_notes",
  "certifications",
  "tags",
  "articles",
  "article_categories",
  "media",
  "content",
  "sections",
] as const;

export async function archiveAdminRecordAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({ id: uuid, entity: z.enum(archiveEntities) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const { id, entity } = parsed.data;
  const now = new Date().toISOString();
  let error: { message: string } | null = null;
  if (entity === "products")
    ({ error } = await context.db
      .from("coffees")
      .update({ deleted_at: now, status: "ARCHIVED" })
      .eq("id", id));
  else if (entity === "offers")
    ({ error } = await context.db
      .from("coffee_offers")
      .update({ deleted_at: now, is_visible: false, status: "INACTIVE" })
      .eq("id", id));
  else if (entity === "origins")
    ({ error } = await context.db
      .from("origins")
      .update({ deleted_at: now, is_active: false })
      .eq("id", id));
  else if (entity === "regions")
    ({ error } = await context.db
      .from("regions")
      .update({ deleted_at: now, is_active: false })
      .eq("id", id));
  else if (entity === "warehouses")
    ({ error } = await context.db
      .from("warehouses")
      .update({ is_active: false })
      .eq("id", id));
  else if (entity === "varieties")
    ({ error } = await context.db
      .from("varieties")
      .update({ is_active: false })
      .eq("id", id));
  else if (entity === "articles")
    ({ error } = await context.db
      .from("articles")
      .update({ deleted_at: now, status: "ARCHIVED" })
      .eq("id", id));
  else if (entity === "media")
    ({ error } = await context.db
      .from("media")
      .update({ deleted_at: now })
      .eq("id", id));
  else if (entity === "content")
    ({ error } = await context.db
      .from("site_pages")
      .update({ deleted_at: now, is_active: false, status: "ARCHIVED" })
      .eq("id", id));
  else if (entity === "sections")
    ({ error } = await context.db
      .from("site_page_sections")
      .update({ is_visible: false })
      .eq("id", id));
  else {
    const table = entity;
    ({ error } = await context.db
      .from(table)
      .update({ is_active: false })
      .eq("id", id));
  }
  if (error) return failed(error.message);
  revalidatePath("/", "layout");
  return saved(entity === "sections" ? "Section hidden." : "Record archived.");
}

export async function updateSiteSettingsAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      // `site_settings` is a single-row table keyed by a smallint (id = 1),
      // not a uuid. Validating it as a uuid rejected every submission with
      // "Invalid UUID", so Site settings could never be saved (finding N25).
      id: z.coerce.number().int().nonnegative(),
      brandName: optionalText(160),
      legalName: optionalText(200),
      email: z.preprocess(
        (value) => (value === "" ? null : value),
        z.email().nullable(),
      ),
      phone: optionalText(60),
      lowStockThreshold: z.coerce.number().int().min(0).max(100000),
      displayNameEn: optionalText(160),
      displayNameAr: optionalText(160),
      taglineEn: optionalText(300),
      taglineAr: optionalText(300),
      addressEn: optionalText(500),
      addressAr: optionalText(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const input = parsed.data;
  const base = await context.db
    .from("site_settings")
    .update({
      org_brand_name: input.brandName,
      org_legal_name: input.legalName,
      org_email: input.email,
      org_phone: input.phone,
      low_stock_threshold: input.lowStockThreshold,
      updated_by: context.admin.id,
    })
    .eq("id", input.id);
  if (base.error) return failed();
  const { error } = await context.db.from("site_settings_translations").upsert(
    [
      {
        settings_id: input.id,
        locale: "en",
        org_display_name: input.displayNameEn,
        org_tagline: input.taglineEn,
        org_address: input.addressEn,
      },
      {
        settings_id: input.id,
        locale: "ar",
        org_display_name: input.displayNameAr,
        org_tagline: input.taglineAr,
        org_address: input.addressAr,
      },
    ],
    { onConflict: "settings_id,locale" },
  );
  if (error) return failed("Settings were saved, but translations were not.");
  revalidatePath("/", "layout");
  return saved("Site settings updated.");
}

export async function updateWorkflowStatusAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      id: uuid,
      entity: z.enum(["inquiries", "offers", "content"]),
      status: z.string(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const { id, entity, status } = parsed.data;
  let error: { message: string } | null = null;
  if (entity === "inquiries") {
    const valid = z
      .enum(["NEW", "RECEIVED", "CONTACTED", "CLOSED"])
      .safeParse(status);
    if (!valid.success) return failed("Choose a valid inquiry status.");
    ({ error } = await context.db
      .from("inquiries")
      .update({ status: valid.data })
      .eq("id", id));
  } else if (entity === "offers") {
    const valid = z
      .enum([
        "ARRIVING_SOON",
        "NEW_ARRIVAL",
        "IN_STORE",
        "DISCOUNT",
        "SOLD_OUT",
        "INACTIVE",
      ])
      .safeParse(status);
    if (!valid.success) return failed("Choose a valid offer status.");
    ({ error } = await context.db
      .from("coffee_offers")
      .update({ status: valid.data })
      .eq("id", id));
  } else {
    const valid = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).safeParse(status);
    if (!valid.success) return failed("Choose a valid page status.");
    ({ error } = await context.db
      .from("site_pages")
      .update({
        status: valid.data,
        published_at:
          valid.data === "PUBLISHED" ? new Date().toISOString() : null,
      })
      .eq("id", id));
  }
  if (error) return failed(error.message);
  revalidatePath("/", "layout");
  return saved("Status updated.");
}

export async function createCmsPageAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      pageKey: slug,
      routePath: z.string().trim().startsWith("/").max(200),
      template: z.enum([
        "STANDARD",
        "HOME",
        "COMMERCIAL",
        "SEGMENT",
        "PRICING",
        "LEGAL",
        "SUPPORT",
      ]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const { error } = await context.db.from("site_pages").insert({
    page_key: parsed.data.pageKey,
    route_path: parsed.data.routePath,
    template: parsed.data.template,
    status: "DRAFT",
    is_active: true,
    sort_order: 0,
    created_by: context.admin.id,
    updated_by: context.admin.id,
  });
  if (error) return failed(error.message);
  revalidatePath("/admin/content");
  return saved("CMS draft created.");
}

export async function upsertPageTranslationAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      pageId: uuid,
      locale: z.enum(["en", "ar"]),
      title: z.string().trim().min(1).max(200),
      h1: optionalText(240),
      summary: optionalText(500),
      bodyMarkdown: optionalText(20000),
      seoTitle: optionalText(200),
      seoDescription: optionalText(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const input = parsed.data;
  const { error } = await context.db.from("site_page_translations").upsert(
    {
      page_id: input.pageId,
      locale: input.locale,
      title: input.title,
      h1: input.h1,
      summary: input.summary,
      body_markdown: input.bodyMarkdown,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
    },
    { onConflict: "page_id,locale" },
  );
  if (error) return failed(error.message);
  revalidatePath("/", "layout");
  return saved(`${input.locale.toUpperCase()} page content saved.`);
}

export async function createCmsSectionAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      pageId: uuid,
      sectionKey: slug,
      sectionType: z.enum([
        "HERO",
        "RICH_TEXT",
        "CTA",
        "ENTITY_LIST",
        "WAREHOUSES",
        "MEDIA_TEXT",
      ]),
      sortOrder: z.coerce.number().int().min(0).max(1000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const { error } = await context.db.from("site_page_sections").insert({
    page_id: parsed.data.pageId,
    section_key: parsed.data.sectionKey,
    section_type: parsed.data.sectionType,
    sort_order: parsed.data.sortOrder,
    is_visible: false,
  });
  if (error) return failed(error.message);
  revalidatePath("/admin/content");
  return saved("CMS section created hidden by default.");
}

export async function updateCmsSectionAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      id: uuid,
      sortOrder: z.coerce.number().int().min(0).max(1000),
      isVisible: z.enum(["true", "false"]),
      ctaHref: optionalText(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const { error } = await context.db
    .from("site_page_sections")
    .update({
      sort_order: parsed.data.sortOrder,
      is_visible: parsed.data.isVisible === "true",
      cta_href: parsed.data.ctaHref,
    })
    .eq("id", parsed.data.id);
  if (error) return failed(error.message);
  revalidatePath("/", "layout");
  return saved("Section settings updated.");
}

export async function upsertSectionTranslationAction(
  _: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = z
    .object({
      sectionId: uuid,
      locale: z.enum(["en", "ar"]),
      heading: optionalText(240),
      subheading: optionalText(240),
      bodyMarkdown: optionalText(20000),
      ctaLabel: optionalText(120),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return failed("Your admin session has expired.");
  const input = parsed.data;
  const { error } = await context.db
    .from("site_page_section_translations")
    .upsert(
      {
        section_id: input.sectionId,
        locale: input.locale,
        heading: input.heading,
        subheading: input.subheading,
        body_markdown: input.bodyMarkdown,
        cta_label: input.ctaLabel,
      },
      { onConflict: "section_id,locale" },
    );
  if (error) return failed(error.message);
  revalidatePath("/", "layout");
  return saved(`${input.locale.toUpperCase()} section content saved.`);
}
