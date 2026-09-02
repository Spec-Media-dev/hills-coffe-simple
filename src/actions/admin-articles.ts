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
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Article write paths (P8, §16–§18).
 *
 * The previous action never wrote `featured_media_id`, so the column existed
 * and no article could ever have an image (finding N56). It also stamped
 * `published_at` on every save and reset it to NULL whenever the status was
 * anything but PUBLISHED, which silently rewrote publication history.
 *
 * Both locales are still upserted together here, unlike CMS pages: an article
 * is created from one form with both languages side by side, and the schema
 * makes `slug` and `title` NOT NULL per locale, so a one-language article
 * cannot exist at all.
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

const invalid = (error: z.ZodError) => {
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
  return fail("VALIDATION", "checkHighlightedFields", { fieldErrors });
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().trim().max(max, "tooLong").nullable(),
  );

const slug = z
  .string()
  .trim()
  .min(2, "required")
  .max(160, "tooLong")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalidSlug");

const articleSchema = z.object({
  id: z.string().trim().uuid("invalidReference").optional(),
  categoryId: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().uuid("invalidReference").nullable(),
  ),
  featuredMediaId: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().uuid("invalidReference").nullable(),
  ),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"], { message: "required" }),
  isFeatured: z.enum(["true", "false"]).default("false"),
  slugEn: slug,
  titleEn: z.string().trim().min(1, "required").max(200, "tooLong"),
  excerptEn: optionalText(500),
  bodyEn: optionalText(40000),
  slugAr: slug,
  titleAr: z.string().trim().min(1, "required").max(200, "tooLong"),
  excerptAr: optionalText(500),
  bodyAr: optionalText(40000),
});

export async function saveArticleAction(
  _state: ActionFormState<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = articleSchema.safeParse({
    ...Object.fromEntries(formData),
    id: formData.get("id") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const context = await adminDb();
  if (isFailure(context)) return context as ActionResult<{ id: string }>;
  const { db, adminId } = context;
  const input = parsed.data;

  // Every submitted reference is verified server-side, never trusted because
  // it is a well-formed uuid.
  if (input.categoryId) {
    const { data } = await db
      .from("article_categories")
      .select("id")
      .eq("id", input.categoryId)
      .eq("is_active", true)
      .maybeSingle();
    if (!data)
      return fail("VALIDATION", "checkHighlightedFields", {
        fieldErrors: { categoryId: ["referenceUnavailable"] },
      });
  }
  if (input.featuredMediaId) {
    const { data } = await db
      .from("media")
      .select("id")
      .eq("id", input.featuredMediaId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data)
      return fail("VALIDATION", "checkHighlightedFields", {
        fieldErrors: { featuredMediaId: ["mediaUnavailable"] },
      });
  }

  const { data: current } = input.id
    ? await db
        .from("articles")
        .select("published_at")
        .eq("id", input.id)
        .maybeSingle()
    : { data: null };

  const values = {
    category_id: input.categoryId,
    featured_media_id: input.featuredMediaId,
    status: input.status,
    is_featured: input.isFeatured === "true",
    // Stamped once, on the first publish. Re-saving a live article keeps its
    // original date, and unpublishing does not erase it.
    published_at:
      input.status === "PUBLISHED"
        ? (current?.published_at ?? new Date().toISOString())
        : (current?.published_at ?? null),
    deleted_at: input.status === "ARCHIVED" ? new Date().toISOString() : null,
    updated_by: adminId,
  };

  const base = input.id
    ? await db
        .from("articles")
        .update(values)
        .eq("id", input.id)
        .select("id")
        .single()
    : await db
        .from("articles")
        .insert({ ...values, created_by: adminId })
        .select("id")
        .single();
  if (base.error || !base.data) {
    console.error(`[admin-articles] save failed: ${base.error?.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }
  const articleId = String(base.data.id);

  const translations = await db.from("article_translations").upsert(
    [
      {
        article_id: articleId,
        locale: "en",
        slug: input.slugEn,
        title: input.titleEn,
        excerpt: input.excerptEn,
        body_markdown: input.bodyEn,
      },
      {
        article_id: articleId,
        locale: "ar",
        slug: input.slugAr,
        title: input.titleAr,
        excerpt: input.excerptAr,
        body_markdown: input.bodyAr,
      },
    ],
    { onConflict: "article_id,locale" },
  );
  if (translations.error) {
    if (translations.error.code === UNIQUE_VIOLATION)
      return fail("CONFLICT", "checkHighlightedFields", {
        fieldErrors: { slugEn: ["slugTaken"], slugAr: ["slugTaken"] },
      });
    console.error(
      `[admin-articles] translations failed: ${translations.error.code}`,
    );
    return fail("UNEXPECTED", "translationsNotSaved");
  }

  revalidatePath("/", "layout");
  return ok<{ id: string }>(input.id ? "articleUpdated" : "articleCreated", {
    id: articleId,
  });
}

export async function setArticleStatusAction(
  _state: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.string().trim().uuid("invalidReference"),
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

  const { data: current } = await db
    .from("articles")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) return fail("NOT_FOUND", "recordUnavailable");

  const { error } = await db
    .from("articles")
    .update({
      status,
      published_at:
        status === "PUBLISHED"
          ? (current.published_at ?? new Date().toISOString())
          : current.published_at,
      deleted_at: status === "ARCHIVED" ? new Date().toISOString() : null,
      updated_by: adminId,
    })
    .eq("id", id);
  if (error) {
    console.error(`[admin-articles] status failed: ${error.code}`);
    return fail("UNEXPECTED", "saveFailed");
  }

  revalidatePath("/", "layout");
  return ok(
    status === "PUBLISHED"
      ? "articlePublished"
      : status === "ARCHIVED"
        ? "articleArchived"
        : "articleUnpublished",
  );
}
