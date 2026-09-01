import "server-only";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, type ActionResult, type FieldErrors } from "@/lib/actions";
import type { Database } from "@/lib/supabase/types.generated";

/**
 * Admin validation shared by every Phase 6 catalog form.
 *
 * The contract with the UI is that a `fieldError` value is a **message key**,
 * never prose. Zod schemas therefore carry keys as their messages
 * (`.min(1, "required")`), so `flatten()` already produces exactly what the
 * client resolves in the active locale. That is what makes an Arabic Admin
 * show Arabic validation without any `locale === "ar"` branch in action code.
 */

export type Db = SupabaseClient<Database>;

/** Turns a Zod failure into per-field message keys. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const flattened = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const out: FieldErrors = {};
  for (const [field, messages] of Object.entries(flattened)) {
    if (!messages?.length) continue;
    // A message that is not one of our keys would leak Zod's English default,
    // so anything unrecognised collapses to the generic key.
    out[field] = [messages[0].includes(" ") ? "invalidValue" : messages[0]];
  }
  return out;
}

export const invalid = (error: z.ZodError): ActionResult =>
  fail("VALIDATION", "checkHighlightedFields", {
    fieldErrors: fieldErrorsFrom(error),
  });

export const fieldFail = (field: string, key: string): ActionResult =>
  fail("VALIDATION", "checkHighlightedFields", {
    fieldErrors: { [field]: [key] },
  });

/**
 * Confirms a client-submitted id really is a live row of the expected table.
 *
 * A UUID arriving in a form is attacker-controlled: it may be well-formed,
 * belong to a different table, or point at a soft-deleted or deactivated row.
 * The database's foreign keys would catch a missing row, but only as an opaque
 * constraint error — this turns it into a precise, localized field error, and
 * additionally rejects rows the FK would happily accept but the business rules
 * would not (archived, inactive).
 */
export async function referenceExists(
  db: Db,
  table: string,
  id: string,
  options: { softDelete?: boolean; activeFlag?: boolean } = {},
): Promise<boolean> {
  let query = db.from(table).select("id").eq("id", id);
  if (options.softDelete !== false) query = query.is("deleted_at", null);
  if (options.activeFlag) query = query.eq("is_active", true);
  const { data, error } = await query.maybeSingle();
  return !error && Boolean(data);
}

/** Verifies a region really belongs to the submitted origin (FR-033). */
export async function regionBelongsToOrigin(
  db: Db,
  regionId: string,
  originId: string,
): Promise<boolean> {
  const { data } = await db
    .from("regions")
    .select("id,origin_id")
    .eq("id", regionId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data && data.origin_id === originId);
}

/** True when `slug` is already taken in `table` by a different row. */
export async function slugTaken(
  db: Db,
  table: string,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  let query = db.from(table).select("id").eq("slug", slug);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query.limit(1);
  return Boolean(data?.length);
}

/**
 * Validates every submitted id in one pass so the Admin sees all the broken
 * references at once rather than fixing them one submit at a time.
 */
export async function collectReferenceErrors(
  db: Db,
  checks: Array<{
    field: string;
    id: string | null | undefined;
    table: string;
    key?: string;
    activeFlag?: boolean;
    softDelete?: boolean;
  }>,
): Promise<FieldErrors> {
  const errors: FieldErrors = {};
  await Promise.all(
    checks.map(async (check) => {
      if (!check.id) return;
      const ok = await referenceExists(db, check.table, check.id, {
        activeFlag: check.activeFlag,
        softDelete: check.softDelete,
      });
      if (!ok) errors[check.field] = [check.key ?? "referenceUnavailable"];
    }),
  );
  return errors;
}

/**
 * Replaces the rows of a join table for one owner.
 *
 * The table name is chosen from a fixed internal list rather than from user
 * input, but it is still a variable, so the generated per-table row types are
 * unavailable here and the payload is cast once, in this one place, instead of
 * at every call site.
 */
export async function replaceLinks(
  db: Db,
  table: string,
  ownerColumn: string,
  ownerId: string,
  targetColumn: string,
  targetIds: string[],
) {
  const client = db.from(table) as unknown as {
    delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
  };
  await client.delete().eq(ownerColumn, ownerId);
  if (!targetIds.length) return;
  const inserter = db.from(table) as unknown as {
    insert: (rows: Record<string, string>[]) => Promise<{ error: unknown }>;
  };
  await inserter.insert(
    targetIds.map((id) => ({ [ownerColumn]: ownerId, [targetColumn]: id })),
  );
}

/**
 * Narrows a list of submitted ids to the ones that really exist.
 *
 * The obvious implementation checks each id with its own query, which turns a
 * coffee save with three link groups into a dozen sequential round trips and
 * made the Admin's save noticeably slow under load. One `in (...)` per group
 * gives exactly the same guarantee — an id that is missing, soft-deleted or
 * inactive simply never comes back and is dropped — at one round trip each.
 */
export async function existingIds(
  db: Db,
  table: string,
  ids: string[],
  options: { softDelete?: boolean; activeFlag?: boolean } = {},
): Promise<string[]> {
  if (!ids.length) return [];
  let query = db.from(table).select("id").in("id", ids);
  if (options.softDelete !== false) query = query.is("deleted_at", null);
  if (options.activeFlag) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) return [];
  const live = new Set(
    ((data ?? []) as { id: string }[]).map((row) => String(row.id)),
  );
  // Preserve the submitted order so `sort_order`-style semantics stay stable.
  return ids.filter((id) => live.has(id));
}
