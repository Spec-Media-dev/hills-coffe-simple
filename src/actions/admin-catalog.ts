"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fail,
  ok,
  type ActionFormState,
  type ActionResult,
} from "@/lib/actions";
import {
  collectReferenceErrors,
  existingIds,
  fieldFail,
  invalid,
  referenceExists,
  regionBelongsToOrigin,
  replaceLinks,
  slugTaken,
  type Db,
} from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/auth/session";
import { sniffImageType, type AvatarMimeType } from "@/lib/avatar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Phase 6 — the Admin catalog write path: Coffee, its images, Offer, Pricing.
 *
 * These actions were split out of `admin-operations.ts` because they are the
 * first to use the project's real `ActionResult` contract (a closed error code
 * plus a `messageKey`) instead of the legacy `AdminActionState`, whose messages
 * are hardcoded English prose. Mixing the two shapes in one file would have
 * hidden which contract any given action follows. The remaining legacy actions
 * keep their own file until the Phase 11 migration.
 *
 * Three rules hold throughout:
 *
 *  1. **The server re-validates everything.** Client validation is UX; a form
 *     post is attacker-controlled. Every submitted id is checked to exist, to
 *     belong to the expected table, and to satisfy its relationship rules.
 *  2. **No provider text ever reaches the browser.** Failures map onto the
 *     closed `DomainErrorCode` set plus a message key; Postgres codes,
 *     constraint names and RPC names stay server-side.
 *  3. **An error belongs to the field that caused it**, so the Admin can fix
 *     one input rather than re-reading the whole form.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTENSION: Record<AvatarMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function adminDb(): Promise<{ db: Db; adminId: string } | ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("FORBIDDEN", "adminRequired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConfigured");
  return { db: (await createSupabaseServerClient()) as Db, adminId: admin.id };
}

const isFailure = (value: unknown): value is ActionResult =>
  typeof value === "object" && value !== null && "ok" in value;

/** Slugs are lowercase, hyphen-separated, and unique per table. */
const slugSchema = z
  .string()
  .trim()
  .min(2, "required")
  .max(120, "tooLong")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalidSlug");

const uuidField = (key = "required") =>
  z.string().trim().min(1, key).uuid("invalidReference");

const optionalUuidField = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.string().uuid("invalidReference").nullable(),
);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().trim().max(max, "tooLong").nullable(),
  );

/** FormData carries repeated names for multi-selects. */
const idList = (formData: FormData, name: string) =>
  formData
    .getAll(name)
    .map((value) => String(value))
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value));

// ============================================================ COFFEE

const coffeeSchema = z.object({
  id: optionalUuidField.optional(),
  slug: slugSchema,
  coffeeTypeId: uuidField(),
  originId: uuidField(),
  regionId: optionalUuidField,
  processingMethodId: optionalUuidField,
  grade: optionalText(80),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"], { message: "required" }),
  nameEn: z.string().trim().min(1, "required").max(200, "tooLong"),
  nameAr: z.string().trim().min(1, "required").max(200, "tooLong"),
  descriptionEn: optionalText(1000),
  descriptionAr: optionalText(1000),
});

export async function saveCoffeeAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = coffeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db, adminId } = context;
  const input = parsed.data;

  if (await slugTaken(db, "coffees", input.slug, input.id ?? undefined))
    return fieldFail("slug", "slugTaken");

  const referenceErrors = await collectReferenceErrors(db, [
    {
      field: "coffeeTypeId",
      id: input.coffeeTypeId,
      table: "coffee_types",
      activeFlag: true,
      softDelete: false,
    },
    { field: "originId", id: input.originId, table: "origins" },
    { field: "regionId", id: input.regionId, table: "regions" },
    {
      field: "processingMethodId",
      id: input.processingMethodId,
      table: "processing_methods",
      activeFlag: true,
      softDelete: false,
    },
  ]);
  if (Object.keys(referenceErrors).length)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: referenceErrors,
    });

  // A region that exists but belongs to a different origin is a relationship
  // failure, not a missing-row failure, and gets its own message (FR-033).
  if (
    input.regionId &&
    !(await regionBelongsToOrigin(db, input.regionId, input.originId))
  )
    return fieldFail("regionId", "regionOriginMismatch");

  const values = {
    slug: input.slug,
    coffee_type_id: input.coffeeTypeId,
    origin_id: input.originId,
    region_id: input.regionId,
    processing_method_id: input.processingMethodId,
    grade: input.grade,
    status: input.status,
    published_at:
      input.status === "PUBLISHED" ? new Date().toISOString() : null,
    updated_by: adminId,
  };
  const base = input.id
    ? await db
        .from("coffees")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await db
        .from("coffees")
        .insert({ ...values, created_by: adminId })
        .select("id")
        .single();
  if (base.error || !base.data) {
    console.error(`[admin-catalog] coffee save failed: ${base.error?.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }
  const coffeeId = base.data.id as string;

  const translations = await db.from("coffee_translations").upsert(
    [
      {
        coffee_id: coffeeId,
        locale: "en",
        name: input.nameEn,
        short_description: input.descriptionEn,
      },
      {
        coffee_id: coffeeId,
        locale: "ar",
        name: input.nameAr,
        short_description: input.descriptionAr,
      },
    ],
    { onConflict: "coffee_id,locale" },
  );
  if (translations.error) return fail("UNEXPECTED", "translationsNotSaved");

  await syncCoffeeLinks(db, coffeeId, formData);

  revalidatePath("/", "layout");
  return ok<{ id: string }>(input.id ? "coffeeUpdated" : "coffeeCreated", {
    id: coffeeId,
  });
}

/**
 * Replaces a coffee's many-to-many links. Rows are verified before insert, so
 * a tampered id is dropped rather than reaching the foreign key.
 */
async function syncCoffeeLinks(db: Db, coffeeId: string, formData: FormData) {
  const links: Array<{
    table: string;
    column: string;
    source: string;
    field: string;
    activeFlag?: boolean;
  }> = [
    {
      table: "coffee_varieties",
      column: "variety_id",
      source: "varieties",
      field: "varietyIds",
      activeFlag: true,
    },
    {
      table: "coffee_certifications",
      column: "certification_id",
      source: "certifications",
      field: "certificationIds",
      activeFlag: true,
    },
    {
      table: "coffee_tags",
      column: "tag_id",
      source: "tags",
      field: "tagIds",
      activeFlag: true,
    },
  ];
  for (const link of links) {
    const submitted = idList(formData, link.field);
    const verified: string[] = [];
    for (const id of submitted) {
      if (
        await referenceExists(db, link.source, id, {
          activeFlag: link.activeFlag,
          softDelete: false,
        })
      )
        verified.push(id);
    }
    await replaceLinks(
      db,
      link.table,
      "coffee_id",
      coffeeId,
      link.column,
      verified,
    );
  }
}

// ==================================================== COFFEE IMAGES

/**
 * Attaches one or more uploaded images to a coffee through the existing
 * normalized `coffees → coffee_media → media → Storage` model.
 *
 * No column is added to `coffees`: the first image of a coffee that has none
 * becomes `role = 'MAIN'`, the rest become `GALLERY` ordered by
 * `sort_order`, and the partial unique index `coffee_media_one_main_image`
 * remains the authority on there being exactly one main image.
 *
 * The bytes decide the type, not the browser: `File.type` is attacker-
 * controlled, so the magic bytes are sniffed and must agree with it. The
 * storage path is generated server-side, so a client can never choose where
 * its file lands. If any step after the upload fails, the uploaded object is
 * removed rather than left orphaned.
 */
export async function attachCoffeeImagesAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const coffeeId = String(formData.get("coffeeId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(coffeeId))
    return fieldFail("coffeeId", "required");
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db, adminId } = context;

  if (!(await referenceExists(db, "coffees", coffeeId)))
    return fieldFail("coffeeId", "referenceUnavailable");

  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!files.length) return fieldFail("images", "imageRequired");

  const altEn = String(formData.get("altEn") ?? "").trim();
  const altAr = String(formData.get("altAr") ?? "").trim();

  const { data: existing } = await db
    .from("coffee_media")
    .select("media_id,role,sort_order")
    .eq("coffee_id", coffeeId);
  let hasMain = (existing ?? []).some((row) => row.role === "MAIN");
  let nextOrder =
    Math.max(0, ...(existing ?? []).map((row) => Number(row.sort_order) || 0)) +
    1;

  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES)
      return fieldFail("images", "imageTooLarge");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageType(bytes);
    // Declared type and actual signature must agree: a script renamed .png,
    // or a PNG announced as JPEG, is refused.
    if (!sniffed || sniffed !== file.type)
      return fieldFail("images", "imageTypeInvalid");

    const storagePath = `coffees/${coffeeId}/${crypto.randomUUID()}.${IMAGE_EXTENSION[sniffed]}`;
    const upload = await db.storage
      .from("hills-public")
      .upload(storagePath, bytes, { contentType: sniffed, upsert: false });
    if (upload.error) return fieldFail("images", "uploadFailed");

    const media = await db
      .from("media")
      .insert({
        storage_bucket: "hills-public",
        storage_path: storagePath,
        mime_type: sniffed,
        file_size_bytes: file.size,
        is_public: true,
        uploaded_by: adminId,
      })
      .select("id")
      .single();
    if (media.error || !media.data) {
      await db.storage.from("hills-public").remove([storagePath]);
      return fieldFail("images", "uploadFailed");
    }
    const mediaId = media.data.id as string;

    if (altEn || altAr)
      await db.from("media_translations").upsert(
        [
          { media_id: mediaId, locale: "en", alt_text: altEn || null },
          { media_id: mediaId, locale: "ar", alt_text: altAr || null },
        ],
        { onConflict: "media_id,locale" },
      );

    const role = hasMain ? "GALLERY" : "MAIN";
    const link = await db.from("coffee_media").insert({
      coffee_id: coffeeId,
      media_id: mediaId,
      role,
      sort_order: role === "MAIN" ? 0 : nextOrder,
    });
    if (link.error) {
      // Roll the whole image back so no object and no row is orphaned.
      await db.from("media").delete().eq("id", mediaId);
      await db.storage.from("hills-public").remove([storagePath]);
      return fieldFail("images", "uploadFailed");
    }
    if (role === "MAIN") hasMain = true;
    else nextOrder += 1;
  }

  revalidatePath("/", "layout");
  return ok("imagesAttached");
}

export async function setMainCoffeeImageAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const coffeeId = String(formData.get("coffeeId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;

  const { data: rows } = await db
    .from("coffee_media")
    .select("media_id,role,sort_order")
    .eq("coffee_id", coffeeId);
  const target = (rows ?? []).find((row) => row.media_id === mediaId);
  if (!target) return fieldFail("mediaId", "referenceUnavailable");
  if (target.role === "MAIN") return ok("mainImageSet");

  // The partial unique index allows only one MAIN row per coffee, so the old
  // main must be demoted before the new one is promoted.
  const previousMain = (rows ?? []).find((row) => row.role === "MAIN");
  if (previousMain) {
    const demote = await db
      .from("coffee_media")
      .update({
        role: "GALLERY",
        sort_order:
          Math.max(
            0,
            ...(rows ?? []).map((row) => Number(row.sort_order) || 0),
          ) + 1,
      })
      .eq("coffee_id", coffeeId)
      .eq("media_id", previousMain.media_id);
    if (demote.error) return fail("UNEXPECTED", "saveFailed");
  }
  const promote = await db
    .from("coffee_media")
    .update({ role: "MAIN", sort_order: 0 })
    .eq("coffee_id", coffeeId)
    .eq("media_id", mediaId);
  if (promote.error) return fail("UNEXPECTED", "saveFailed");

  revalidatePath("/", "layout");
  return ok("mainImageSet");
}

export async function removeCoffeeImageAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const coffeeId = String(formData.get("coffeeId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;

  const { data: media } = await db
    .from("media")
    .select("id,storage_path,storage_bucket")
    .eq("id", mediaId)
    .maybeSingle();
  const { data: link } = await db
    .from("coffee_media")
    .select("coffee_id,media_id,role")
    .eq("coffee_id", coffeeId)
    .eq("media_id", mediaId)
    .maybeSingle();
  if (!link || !media) return fieldFail("mediaId", "referenceUnavailable");

  const unlink = await db
    .from("coffee_media")
    .delete()
    .eq("coffee_id", coffeeId)
    .eq("media_id", mediaId);
  if (unlink.error) return fail("UNEXPECTED", "saveFailed");

  await db.from("media_translations").delete().eq("media_id", mediaId);
  await db.from("media").delete().eq("id", mediaId);
  await db.storage
    .from(String(media.storage_bucket))
    .remove([String(media.storage_path)]);

  // Removing the main image must not leave the coffee without one.
  if (link.role === "MAIN") {
    const { data: remaining } = await db
      .from("coffee_media")
      .select("media_id,sort_order")
      .eq("coffee_id", coffeeId)
      .order("sort_order");
    const promote = remaining?.[0];
    if (promote)
      await db
        .from("coffee_media")
        .update({ role: "MAIN", sort_order: 0 })
        .eq("coffee_id", coffeeId)
        .eq("media_id", promote.media_id);
  }

  revalidatePath("/", "layout");
  return ok("imageRemoved");
}

export async function reorderCoffeeImagesAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const coffeeId = String(formData.get("coffeeId") ?? "");
  const order = idList(formData, "order");
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;

  const { data: rows } = await db
    .from("coffee_media")
    .select("media_id,role")
    .eq("coffee_id", coffeeId);
  const known = new Set((rows ?? []).map((row) => String(row.media_id)));
  let position = 1;
  for (const mediaId of order) {
    if (!known.has(mediaId)) continue;
    const row = (rows ?? []).find((entry) => entry.media_id === mediaId);
    if (row?.role === "MAIN") continue; // the main image is always sort_order 0
    await db
      .from("coffee_media")
      .update({ sort_order: position })
      .eq("coffee_id", coffeeId)
      .eq("media_id", mediaId);
    position += 1;
  }
  revalidatePath("/", "layout");
  return ok("imagesReordered");
}

// ============================================================= OFFER

const offerSchema = z.object({
  id: optionalUuidField.optional(),
  coffeeId: uuidField(),
  warehouseId: uuidField(),
  referenceNumber: z.string().trim().min(2, "required").max(80, "tooLong"),
  bagsQuantity: z.coerce
    .number({ message: "invalidNumber" })
    .int("invalidNumber")
    .min(0, "mustNotBeNegative"),
  bagWeightKg: z.coerce
    .number({ message: "invalidNumber" })
    .positive("mustBeGreaterThanZero")
    .max(1000, "tooLarge"),
  packagingTypeId: optionalUuidField,
  status: z.enum(
    [
      "ARRIVING_SOON",
      "NEW_ARRIVAL",
      "IN_STORE",
      "DISCOUNT",
      "SOLD_OUT",
      "INACTIVE",
    ],
    { message: "required" },
  ),
  currencyCode: z.string().trim().toUpperCase().length(3, "invalidCurrency"),
  pricingUnit: z.string().trim().min(1, "required").max(40, "tooLong"),
  cupScore: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce
      .number({ message: "invalidNumber" })
      .min(0, "invalidNumber")
      .max(100, "invalidNumber")
      .nullable(),
  ),
  isVisible: z.enum(["true", "false"], { message: "required" }),
});

export async function saveOfferAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = offerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db, adminId } = context;
  const input = parsed.data;

  const referenceErrors = await collectReferenceErrors(db, [
    { field: "coffeeId", id: input.coffeeId, table: "coffees" },
    {
      field: "warehouseId",
      id: input.warehouseId,
      table: "warehouses",
      activeFlag: true,
      softDelete: false,
    },
    {
      field: "packagingTypeId",
      id: input.packagingTypeId,
      table: "packaging_types",
      activeFlag: true,
      softDelete: false,
    },
  ]);
  if (Object.keys(referenceErrors).length)
    return fail("VALIDATION", "checkHighlightedFields", {
      fieldErrors: referenceErrors,
    });

  const values = {
    coffee_id: input.coffeeId,
    warehouse_id: input.warehouseId,
    reference_number: input.referenceNumber,
    bags_quantity: input.bagsQuantity,
    bag_weight_kg: input.bagWeightKg,
    packaging_type_id: input.packagingTypeId,
    status: input.status,
    cup_score: input.cupScore,
    // The live column is `currency_code`. The previous implementation wrote
    // `currency`, which does not exist, so every offer save failed (N30).
    currency_code: input.currencyCode,
    pricing_unit: input.pricingUnit,
    is_visible: input.isVisible === "true",
    updated_by: adminId,
  };
  const result = input.id
    ? await db
        .from("coffee_offers")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await db
        .from("coffee_offers")
        .insert({ ...values, created_by: adminId })
        .select("id")
        .single();
  if (result.error || !result.data) {
    // `coffee_offers` carries two partial unique indexes, so a 23505 is not
    // automatically about the reference number. The constraint name is read
    // here, server-side, only to choose which field owns the message — the
    // name itself never leaves the server.
    if (result.error?.code === "23505") {
      const constraint = `${result.error.message} ${result.error.details ?? ""}`;
      if (constraint.includes("coffee_offers_unique_active_coffee_warehouse"))
        return fail("CONFLICT", "offerAlreadyExistsForWarehouse", {
          fieldErrors: {
            coffeeId: ["offerAlreadyExistsForWarehouse"],
            warehouseId: ["offerAlreadyExistsForWarehouse"],
          },
        });
      if (constraint.includes("coffee_offers_unique_active_reference_number"))
        return fieldFail("referenceNumber", "referenceNumberTaken");
      return fail("CONFLICT", "duplicateRecord");
    }
    console.error(`[admin-catalog] offer save failed: ${result.error?.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }
  const offerId = result.data.id as string;

  // Sensory notes and tags attach to the OFFER in this schema, not the coffee.
  for (const link of [
    {
      table: "offer_sensory_notes",
      column: "sensory_note_id",
      source: "sensory_notes",
      field: "sensoryNoteIds",
    },
    {
      table: "offer_tags",
      column: "tag_id",
      source: "tags",
      field: "offerTagIds",
    },
  ]) {
    const verified = await existingIds(
      db,
      link.source,
      idList(formData, link.field),
      { activeFlag: true, softDelete: false },
    );
    await replaceLinks(
      db,
      link.table,
      "offer_id",
      offerId,
      link.column,
      verified,
    );
  }

  revalidatePath("/", "layout");
  return ok<{ id: string }>(input.id ? "offerUpdated" : "offerCreated", {
    id: offerId,
  });
}

// =========================================================== PRICING

const tierSchema = z.object({
  id: optionalUuidField.optional(),
  offerId: uuidField(),
  minBags: z.coerce
    .number({ message: "invalidNumber" })
    .int("invalidNumber")
    .min(1, "mustBeAtLeastOne"),
  price: z.coerce
    .number({ message: "invalidNumber" })
    .positive("priceMustBeGreaterThanZero")
    .max(10000, "tooLarge"),
});

export async function savePriceTierAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = tierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;
  const input = parsed.data;

  if (!(await referenceExists(db, "coffee_offers", input.offerId)))
    return fieldFail("offerId", "referenceUnavailable");

  // The ladder rules are checked here rather than in the data helper so each
  // violation can be attributed to the field the Admin must change.
  const { data: siblings } = await db
    .from("offer_price_tiers")
    .select("id,min_bags,price_per_kg_usd")
    .eq("offer_id", input.offerId);
  const others = (siblings ?? []).filter((row) => row.id !== input.id);
  if (others.some((row) => Number(row.min_bags) === input.minBags))
    return fieldFail("minBags", "duplicateTier");

  const ladder = [
    ...others.map((row) => ({
      minBags: Number(row.min_bags),
      price: Number(row.price_per_kg_usd),
    })),
    { minBags: input.minBags, price: input.price },
  ].sort((a, b) => a.minBags - b.minBags);
  // A bigger commitment must never cost more per kilo.
  for (let index = 1; index < ladder.length; index += 1)
    if (ladder[index].price > ladder[index - 1].price)
      return fieldFail("price", "priceMustNotIncreaseWithVolume");

  const values = {
    offer_id: input.offerId,
    min_bags: input.minBags,
    price_per_kg_usd: input.price,
  };
  const result = input.id
    ? await db.from("offer_price_tiers").update(values).eq("id", input.id)
    : await db.from("offer_price_tiers").insert(values);
  if (result.error) {
    console.error(`[admin-catalog] tier save failed: ${result.error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }
  revalidatePath("/", "layout");
  return ok(input.id ? "tierUpdated" : "tierCreated");
}

export async function deletePriceTierAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const context = await adminDb();
  if (isFailure(context)) return context;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return fieldFail("id", "referenceUnavailable");
  const { error } = await context.db
    .from("offer_price_tiers")
    .delete()
    .eq("id", id);
  if (error) return fail("UNEXPECTED", "saveFailed");
  revalidatePath("/", "layout");
  return ok("tierDeleted");
}
