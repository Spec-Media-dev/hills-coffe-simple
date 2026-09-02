"use server";

/**
 * Admin operations for reference data, taxonomy and site settings.
 *
 * Coffee, Offer and Pricing moved to `admin-catalog.ts` in Phase 6; media, CMS
 * and articles to their own modules in Phase 8. What remains is the reference
 * layer the catalog depends on — origins, regions, warehouses, varieties, the
 * seven taxonomy tables — plus archiving and site settings.
 *
 * Phase 10 moved these onto the project's real `ActionResult` contract. The
 * queries, schemas, guards and revalidation are unchanged; what changed is the
 * vocabulary they answer in. Previously every message was hardcoded English
 * prose, so the Arabic Admin was told its record had failed in English, and
 * seven paths returned Supabase's own error text verbatim. Now each result
 * carries a message key the client resolves in the active locale, and each
 * field rule carries the key for its own failure so the error lands under the
 * input that caused it (findings N65, N66).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fail,
  ok,
  type ActionFormState,
  type ActionResult,
  type FieldErrors,
} from "@/lib/actions";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid("invalidReference");
const slug = z
  .string()
  .trim()
  .min(2, "required")
  .max(120, "tooLong")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalidSlug");
const optionalUuid = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().uuid("invalidReference").nullable(),
);
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().trim().max(max, "tooLong").nullable(),
  );

/**
 * Turns a Zod failure into per-field message keys.
 *
 * Each rule below names its own key, so the client can render the specific
 * reason beneath the specific input. A rule that somehow arrives without one
 * degrades to `invalidValue` rather than leaking Zod's English default.
 */
function invalid(error: z.ZodError): ActionResult {
  const flattened = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const fieldErrors: FieldErrors = {};
  for (const [field, messages] of Object.entries(flattened))
    if (messages?.length)
      fieldErrors[field] = [
        /^[a-z][A-Za-z]*$/.test(messages[0]) ? messages[0] : "invalidValue",
      ];
  return fail("VALIDATION", "checkHighlightedFields", { fieldErrors });
}

/**
 * A failure the Administrator can do nothing about.
 *
 * The provider's own message is logged server-side and never returned: a
 * constraint name or SQLSTATE on screen is neither actionable nor safe.
 */
const failed = (
  where: string,
  error?: { code?: string; message?: string } | null,
) => {
  // The code is enough to diagnose; the message may quote row data.
  if (error) console.error(`[admin-operations] ${where}: ${error.code ?? "upstream"}`);
  return fail("UNEXPECTED", "saveFailed");
};
const expired = () => fail("FORBIDDEN", "adminRequired");

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
  entity: z.enum(namedEntityNames, { message: "required" }),
  slug,
  nameEn: z.string().trim().min(1, "required").max(160, "tooLong"),
  nameAr: z.string().trim().min(1, "required").max(160, "tooLong"),
  descriptionEn: optionalText(1000),
  descriptionAr: optionalText(1000),
  isActive: z.enum(["true", "false"], { message: "required" }).default("true"),
});

export async function saveNamedEntityAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = namedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return expired();
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
  if (baseResult.error || !baseResult.data)
    return failed("named entity", baseResult.error);
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
    return fail("UNEXPECTED", "translationsNotSaved");
  revalidatePath("/", "layout");
  return ok(input.id ? "recordUpdated" : "recordCreated");
}

const varietySchema = z.object({
  id: optionalUuid.optional(),
  slug,
  name: z.string().trim().min(1, "required").max(160, "tooLong"),
  isActive: z.enum(["true", "false"], { message: "required" }).default("true"),
});

export async function saveVarietyAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = varietySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return expired();
  const values = {
    slug: parsed.data.slug,
    name: parsed.data.name,
    is_active: parsed.data.isActive === "true",
  };
  const result = parsed.data.id
    ? await context.db.from("varieties").update(values).eq("id", parsed.data.id)
    : await context.db.from("varieties").insert(values);
  if (result.error) return failed("variety", result.error);
  revalidatePath("/admin/varieties");
  return ok(parsed.data.id ? "recordUpdated" : "recordCreated");
}

const originSchema = z.object({
  id: optionalUuid.optional(),
  slug,
  countryCode: z.string().trim().length(2, "invalidCountryCode").toUpperCase(),
  continent: optionalText(80),
  nameEn: z.string().trim().min(1, "required").max(160, "tooLong"),
  nameAr: z.string().trim().min(1, "required").max(160, "tooLong"),
  summaryEn: optionalText(2000),
  summaryAr: optionalText(2000),
  isActive: z.enum(["true", "false"], { message: "required" }).default("true"),
});

export async function saveOriginAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = originSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return expired();
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
  if (base.error || !base.data) return failed("record", base.error);
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
    return fail("UNEXPECTED", "translationsNotSaved");
  revalidatePath("/", "layout");
  return ok(input.id ? "recordUpdated" : "recordCreated");
}

const regionSchema = z.object({
  id: optionalUuid.optional(),
  originId: uuid,
  slug,
  nameEn: z.string().trim().min(1, "required").max(160, "tooLong"),
  nameAr: z.string().trim().min(1, "required").max(160, "tooLong"),
  descriptionEn: optionalText(1000),
  descriptionAr: optionalText(1000),
  isActive: z.enum(["true", "false"], { message: "required" }).default("true"),
});

export async function saveRegionAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = regionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return expired();
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
  if (base.error || !base.data) return failed("record", base.error);
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
    return fail("UNEXPECTED", "translationsNotSaved");
  revalidatePath("/", "layout");
  return ok(input.id ? "recordUpdated" : "recordCreated");
}

const warehouseSchema = z.object({
  id: optionalUuid.optional(),
  code: z.enum(["EGYPT", "DUBAI"], { message: "required" }),
  name: z.string().trim().min(1, "required").max(160, "tooLong"),
  countryCode: z.string().trim().length(2, "invalidCountryCode").toUpperCase(),
  city: optionalText(160),
  address: optionalText(500),
  email: z.preprocess(
    (value) => (value === "" ? null : value),
    z.email("invalidEmail").nullable(),
  ),
  phone: optionalText(60),
  isActive: z.enum(["true", "false"], { message: "required" }).default("true"),
  nameAr: z.string().trim().min(1, "required").max(160, "tooLong"),
});

export async function saveWarehouseAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = warehouseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return expired();
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
  if (base.error || !base.data) return failed("record", base.error);
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
    return fail("UNEXPECTED", "translationsNotSaved");
  revalidatePath("/", "layout");
  return ok(input.id ? "recordUpdated" : "recordCreated");
}

/*
 * `saveArticleAction` was removed in Phase 10. Articles have had their own
 * workspace and action since Phase 8 (`src/actions/admin-articles.ts`), which
 * writes `featured_media_id` and stamps `published_at` once rather than on
 * every save. This copy had become unreachable.
 */

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
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      id: uuid,
      entity: z.enum(archiveEntities, { message: "required" }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminContext();
  if (!context) return expired();
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
  if (error) return failed("archive", error);
  revalidatePath("/", "layout");
  return ok(entity === "sections" ? "sectionHidden" : "recordArchived");
}

export async function updateSiteSettingsAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      // `site_settings` is a single-row table keyed by a smallint (id = 1),
      // not a uuid. Validating it as a uuid rejected every submission with
      // "Invalid UUID", so Site settings could never be saved (finding N25).
      id: z.coerce.number().int("invalidNumber").nonnegative("mustNotBeNegative"),
      brandName: optionalText(160),
      legalName: optionalText(200),
      email: z.preprocess(
        (value) => (value === "" ? null : value),
        z.email("invalidEmail").nullable(),
      ),
      phone: optionalText(60),
      lowStockThreshold: z.coerce
        .number({ message: "invalidNumber" })
        .int("invalidNumber")
        .min(0, "mustNotBeNegative")
        .max(100000, "tooLarge"),
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
  if (!context) return expired();
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
  if (base.error) return failed("site settings", base.error);
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
  if (error) return fail("UNEXPECTED", "translationsNotSaved");
  revalidatePath("/", "layout");
  return ok("siteSettingsUpdated");
}

/*
 * `updateWorkflowStatusAction` was removed in Phase 10. It served a status
 * dropdown on the generic module list for offers and CMS pages; both now have
 * their own workspaces with status controls that offer only the transitions
 * their state allows, so the branch had become unreachable.
 */

/*
 * The five CMS actions that stood here — page create, page translation,
 * section create, section update, section translation — were removed in
 * Phase 10. Phase 8 replaced them with `src/actions/admin-cms.ts`, which
 * validates against the live check constraints (the template list, the
 * snake_case section key, the eight approved section types) and returns
 * message keys. Nothing had imported these since.
 */
