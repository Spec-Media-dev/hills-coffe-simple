"use server";

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
import {
  PAGE_TEMPLATES,
  entityRefSchema,
  sectionTypeSchema,
  validateSection,
} from "@/lib/cms/sections";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * CMS write paths (P8-T01).
 *
 * Three rules the previous implementation broke, each of which made a real
 * operation impossible rather than merely awkward:
 *
 *  1. **Template values must be ones the database accepts.**
 *     `site_pages_template_check` allows HOME, ABOUT, COMMERCIAL, SEGMENT,
 *     PRICING, SUPPORT, LEGAL, CONTACT. The old form offered `STANDARD` as its
 *     first and default option — a value the check constraint has always
 *     rejected, so creating a page with the default selection could never
 *     succeed (finding N54).
 *  2. **Section keys are snake_case.** `site_page_sections_key_format` is
 *     `^[a-z0-9]+(_[a-z0-9]+)*$`, but the action validated a hyphenated slug,
 *     so any multi-word key was refused by the database (finding N55).
 *  3. **Section types are the eight approved ones.** The old action offered
 *     `WAREHOUSES` and `MEDIA_TEXT`, which the check constraint rejects, and
 *     could not create the `MEDIA_SPLIT` sections already in the table
 *     (finding N52).
 *
 * Translations are written one locale at a time. Editing Arabic must never
 * touch the English row, so each form posts a single `locale` and upserts only
 * that key (§14).
 */

const UNIQUE_VIOLATION = "23505";

async function adminDb() {
  const admin = await requireAdmin();
  if (!admin) return fail("FORBIDDEN", "adminRequired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConfigured");
  return { db: await createSupabaseServerClient(), adminId: admin.id };
}

const isFailure = (value: unknown): value is ActionResult =>
  typeof value === "object" && value !== null && "ok" in value;

const invalid = (error: z.ZodError, fallback = "checkHighlightedFields") => {
  const flattened = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const fieldErrors: FieldErrors = {};
  for (const [field, messages] of Object.entries(flattened))
    if (messages?.length)
      fieldErrors[field] = [
        messages[0].includes(" ") ? "invalidValue" : messages[0],
      ];
  return fail("VALIDATION", fallback, { fieldErrors });
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().trim().max(max, "tooLong").nullable(),
  );

const uuid = z.string().trim().uuid("invalidReference");

// ------------------------------------------------------------------ pages --

const pageSchema = z.object({
  id: z.string().trim().uuid("invalidReference").optional(),
  pageKey: z
    .string()
    .trim()
    .min(2, "required")
    .max(120, "tooLong")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalidSlug"),
  /**
   * `site_pages_route_path_check` requires a route to start **and end** with
   * `/` and to contain no `//`. Every live row is shaped `/about/`. The old
   * action checked only the leading slash, so a natural `/help` was refused by
   * the database with no explanation (finding N58).
   *
   * A missing trailing slash is normalized rather than rejected — it is the
   * obvious intent, and the constraint is about storage shape, not authoring.
   */
  routePath: z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) return null;
      const trimmed = String(value).trim();
      if (!trimmed) return null;
      return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
    },
    z
      .string()
      .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/, "invalidRoute")
      .max(200, "tooLong")
      .nullable(),
  ),
  template: z.enum(PAGE_TEMPLATES, { message: "required" }),
  sortOrder: z.coerce.number().int("invalidNumber").min(0).max(1000).default(0),
});

export async function savePageAction(
  _state: ActionFormState<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = pageSchema.safeParse({
    id: formData.get("id") || undefined,
    pageKey: formData.get("pageKey"),
    routePath: formData.get("routePath"),
    template: formData.get("template"),
    sortOrder: formData.get("sortOrder") ?? 0,
  });
  if (!parsed.success) return invalid(parsed.error);

  const context = await adminDb();
  if (isFailure(context)) return context as ActionResult<{ id: string }>;
  const { db, adminId } = context;
  const input = parsed.data;

  const values = {
    page_key: input.pageKey,
    route_path: input.routePath,
    template: input.template,
    sort_order: input.sortOrder,
    updated_by: adminId,
  };
  const result = input.id
    ? await db
        .from("site_pages")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await db
        .from("site_pages")
        .insert({
          ...values,
          status: "DRAFT",
          is_active: true,
          created_by: adminId,
        })
        .select("id")
        .single();

  if (result.error || !result.data) {
    if (result.error?.code === UNIQUE_VIOLATION)
      return fail("CONFLICT", "checkHighlightedFields", {
        fieldErrors: { pageKey: ["pageKeyTaken"] },
      });
    console.error(`[admin-cms] page save failed: ${result.error?.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  revalidatePath("/", "layout");
  return ok<{ id: string }>(input.id ? "pageUpdated" : "pageCreated", {
    id: String(result.data.id),
  });
}

/**
 * Moves a page between DRAFT, PUBLISHED and ARCHIVED.
 *
 * `published_at` is only stamped on the transition into PUBLISHED, so
 * re-saving a live page does not silently reset its publication date.
 */
export async function setPageStatusAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      id: uuid,
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"], {
        message: "required",
      }),
    })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return invalid(parsed.error);

  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db, adminId } = context;
  const { id, status } = parsed.data;

  // A page with no English translation has nothing to render, so publishing
  // it would put an empty route into the sitemap.
  if (status === "PUBLISHED") {
    const { data: translations } = await db
      .from("site_page_translations")
      .select("locale")
      .eq("page_id", id);
    if (!(translations ?? []).some((row) => row.locale === "en"))
      return fail("VALIDATION", "englishContentRequiredToPublish");
  }

  const { data: current } = await db
    .from("site_pages")
    .select("status,published_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) return fail("NOT_FOUND", "recordUnavailable");

  const { error } = await db
    .from("site_pages")
    .update({
      status,
      is_active: status !== "ARCHIVED",
      deleted_at: status === "ARCHIVED" ? new Date().toISOString() : null,
      published_at:
        status === "PUBLISHED"
          ? (current.published_at ?? new Date().toISOString())
          : current.published_at,
      updated_by: adminId,
    })
    .eq("id", id);
  if (error) {
    console.error(`[admin-cms] page status failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  revalidatePath("/", "layout");
  return ok(
    status === "PUBLISHED"
      ? "pagePublished"
      : status === "ARCHIVED"
        ? "pageArchived"
        : "pageUnpublished",
  );
}

export async function savePageTranslationAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      pageId: uuid,
      locale: z.enum(["en", "ar"], { message: "required" }),
      title: z.string().trim().min(1, "required").max(200, "tooLong"),
      h1: optionalText(240),
      summary: optionalText(500),
      bodyMarkdown: optionalText(20000),
      seoTitle: optionalText(200),
      seoDescription: optionalText(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const context = await adminDb();
  if (isFailure(context)) return context;
  const input = parsed.data;

  // Only this locale's row is touched. The other language is not read, not
  // defaulted from, and not written.
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
  if (error) {
    console.error(`[admin-cms] page translation failed: ${error.code}`);
    return fail("UNEXPECTED", "translationsNotSaved");
  }
  revalidatePath("/", "layout");
  return ok(input.locale === "en" ? "englishSaved" : "arabicSaved");
}

// --------------------------------------------------------------- sections --

const sectionSchema = z.object({
  id: z.string().trim().uuid("invalidReference").optional(),
  pageId: uuid,
  // snake_case, matching `site_page_sections_key_format`.
  sectionKey: z
    .string()
    .trim()
    .min(2, "required")
    .max(80, "tooLong")
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "invalidSectionKey"),
  sectionType: sectionTypeSchema,
  sortOrder: z.coerce.number().int("invalidNumber").min(0).max(1000),
  isVisible: z.enum(["true", "false"], { message: "required" }),
  mediaId: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().uuid("invalidReference").nullable(),
  ),
  ctaHref: optionalText(500),
  entityRef: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    entityRefSchema.nullable(),
  ),
  entityLimit: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().int("invalidNumber").min(1).max(24).nullable(),
  ),
});

export async function saveSectionAction(
  _state: ActionFormState<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = sectionSchema.safeParse({
    id: formData.get("id") || undefined,
    pageId: formData.get("pageId"),
    sectionKey: formData.get("sectionKey"),
    sectionType: formData.get("sectionType"),
    sortOrder: formData.get("sortOrder") ?? 0,
    isVisible: formData.get("isVisible") ?? "false",
    mediaId: formData.get("mediaId"),
    ctaHref: formData.get("ctaHref"),
    entityRef: formData.get("entityRef"),
    entityLimit: formData.get("entityLimit"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const context = await adminDb();
  if (isFailure(context)) return context as ActionResult<{ id: string }>;
  const { db } = context;
  const input = parsed.data;

  // A referenced media item must exist and be usable. A client-supplied uuid
  // is never trusted just because it parses.
  if (input.mediaId) {
    const { data: media } = await db
      .from("media")
      .select("id")
      .eq("id", input.mediaId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!media)
      return fail("VALIDATION", "checkHighlightedFields", {
        fieldErrors: { mediaId: ["mediaUnavailable"] },
      });
  }

  // The section's own content rules are checked here, against the English
  // translation if one exists — a visible section must be renderable.
  if (input.isVisible === "true") {
    const { data: translation } = input.id
      ? await db
          .from("site_page_section_translations")
          .select("heading,subheading,body_markdown,cta_label")
          .eq("section_id", input.id)
          .eq("locale", "en")
          .maybeSingle()
      : { data: null };
    const issues = validateSection({
      sectionType: input.sectionType,
      heading: translation?.heading ?? null,
      subheading: translation?.subheading ?? null,
      bodyMarkdown: translation?.body_markdown ?? null,
      ctaLabel: translation?.cta_label ?? null,
      ctaHref: input.ctaHref,
      entityRef: input.entityRef,
      entityLimit: input.entityLimit,
      hasMedia: Boolean(input.mediaId),
    });
    // Issues are split by which form can actually fix them. `heading` and
    // `bodyMarkdown` live on the translation form beside this one, so
    // reporting them as field errors here would attach them to inputs that do
    // not exist — the Admin would see a rejected save and no message at all.
    const ownFields = [
      "mediaId",
      "entityRef",
      "entityLimit",
      "ctaHref",
      "sectionType",
    ];
    const own = issues.filter((issue) => ownFields.includes(issue.field));
    if (own.length) {
      const fieldErrors: FieldErrors = {};
      for (const issue of own) fieldErrors[issue.field] = [issue.messageKey];
      return fail("VALIDATION", "sectionNotRenderable", { fieldErrors });
    }
    if (issues.length)
      // A form-level message, because the fix is in the content editor.
      return fail("VALIDATION", "sectionNeedsContentBeforeVisible");
  }

  const values = {
    page_id: input.pageId,
    section_key: input.sectionKey,
    section_type: input.sectionType,
    sort_order: input.sortOrder,
    is_visible: input.isVisible === "true",
    media_id: input.mediaId,
    cta_href: input.ctaHref,
    entity_ref: input.entityRef,
    entity_limit: input.entityLimit,
  };
  const result = input.id
    ? await db
        .from("site_page_sections")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await db.from("site_page_sections").insert(values).select("id").single();

  if (result.error || !result.data) {
    if (result.error?.code === UNIQUE_VIOLATION)
      return fail("CONFLICT", "checkHighlightedFields", {
        fieldErrors: { sectionKey: ["sectionKeyTaken"] },
      });
    console.error(`[admin-cms] section save failed: ${result.error?.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  revalidatePath("/", "layout");
  return ok<{ id: string }>("sectionSaved", { id: String(result.data.id) });
}

export async function saveSectionTranslationAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      sectionId: uuid,
      locale: z.enum(["en", "ar"], { message: "required" }),
      heading: optionalText(240),
      subheading: optionalText(240),
      bodyMarkdown: optionalText(20000),
      ctaLabel: optionalText(120),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const context = await adminDb();
  if (isFailure(context)) return context;
  const { db } = context;
  const input = parsed.data;

  // Validate the content against the section's own type before storing it, so
  // an unrenderable section is refused at the point the Admin can fix it
  // rather than silently dropped later by the public page (§11).
  const { data: section } = await db
    .from("site_page_sections")
    .select("section_type,cta_href,entity_ref,entity_limit,media_id,is_visible")
    .eq("id", input.sectionId)
    .maybeSingle();
  if (!section) return fail("NOT_FOUND", "recordUnavailable");

  if (section.is_visible) {
    const issues = validateSection({
      sectionType: section.section_type,
      heading: input.heading,
      subheading: input.subheading,
      bodyMarkdown: input.bodyMarkdown,
      ctaLabel: input.ctaLabel,
      ctaHref: section.cta_href,
      entityRef: section.entity_ref,
      entityLimit: section.entity_limit,
      hasMedia: Boolean(section.media_id),
    });
    // Only issues about fields on this form are actionable here; the rest
    // belong to the section settings form beside it.
    const own = issues.filter((issue) =>
      ["heading", "subheading", "bodyMarkdown", "ctaLabel"].includes(
        issue.field,
      ),
    );
    if (own.length) {
      const fieldErrors: FieldErrors = {};
      for (const issue of own) fieldErrors[issue.field] = [issue.messageKey];
      return fail("VALIDATION", "sectionNotRenderable", { fieldErrors });
    }
  }

  const { error } = await db.from("site_page_section_translations").upsert(
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
  if (error) {
    console.error(`[admin-cms] section translation failed: ${error.code}`);
    return fail("UNEXPECTED", "translationsNotSaved");
  }
  revalidatePath("/", "layout");
  return ok(input.locale === "en" ? "englishSaved" : "arabicSaved");
}

export async function deleteSectionAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const context = await adminDb();
  if (isFailure(context)) return context;
  const id = z.string().trim().uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("VALIDATION", "invalidReference");

  // Translations cascade with the section, per the live foreign key.
  const { error, data } = await context.db
    .from("site_page_sections")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error(`[admin-cms] section delete failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }
  if (!data?.length) return fail("NOT_FOUND", "recordUnavailable");
  revalidatePath("/", "layout");
  return ok("sectionRemoved");
}
