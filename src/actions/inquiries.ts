"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fail,
  ok,
  type ActionFormState,
  type ActionResult,
} from "@/lib/actions";
import { requireVerifiedUser } from "@/lib/auth/session";
import {
  findActiveSampleRequest,
  findRecentIdenticalProductInquiry,
  submissionFingerprint,
} from "@/lib/data/inquiries";
import { processSampleRequest } from "@/lib/inquiries/sample-request";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Customer request creation — `contracts/inquiry-actions.md`.
 *
 * Three properties this file exists to guarantee:
 *
 *  1. **One authorization model.** Both actions gate on
 *     `requireVerifiedUser()`, which is authenticated AND email-confirmed AND
 *     `role = 'USER'` AND not blocked. The previous implementation used a bare
 *     `getViewer()` plus an `emailVerified` check, which let a **blocked**
 *     customer and an **Administrator** through (finding N44).
 *  2. **The client never names the coffee.** Only an `offerId` is accepted;
 *     `hydrate_inquiry_context()` derives `coffee_id`, the snapshots and
 *     `user_id` from `auth.uid()` server-side, so a forged coffee id cannot be
 *     attached to a request.
 *  3. **No prose crosses the wire.** Results carry a `messageKey` the client
 *     resolves in the active locale, so there is no `locale === "ar"` branch
 *     in action code and no provider text can reach the browser.
 */

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = "23505";

const requestSchema = z.object({
  offerId: z.string().trim().min(1, "required").uuid("invalidReference"),
  subject: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().trim().max(160, "tooLong").nullable(),
  ),
  message: z.string().trim().min(10, "messageTooShort").max(2000, "tooLong"),
  // Honeypot: a real person never fills this.
  website: z.string().max(0, "invalidValue").optional(),
});

type CreatedRequest = { requestCode: string };

function invalidFields(error: z.ZodError): ActionResult<CreatedRequest> {
  const flattened = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const fieldErrors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(flattened))
    if (messages?.length)
      fieldErrors[field] = [
        messages[0].includes(" ") ? "invalidValue" : messages[0],
      ];
  return fail("VALIDATION", "checkRequestFields", { fieldErrors });
}

/** Missing profile data is actionable, so it names the fields to complete. */
const profileIncomplete = (
  missing: ("phone" | "address" | "country")[],
): ActionResult<CreatedRequest> =>
  fail("VALIDATION", "completeProfileFirst", {
    fieldErrors: Object.fromEntries(
      missing.map((field) => [field, ["profileFieldRequired"]]),
    ),
  });

/**
 * Resolves an offer the customer is actually allowed to reference.
 *
 * Visible, not archived, not soft-deleted, its coffee published, its warehouse
 * active. A stale or hidden offer is indistinguishable from a non-existent
 * one, so this cannot be used to probe the catalog.
 */
async function resolveVisibleOffer(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  offerId: string,
) {
  const { data: offer } = await db
    .from("coffee_offers")
    .select("id,coffee_id,warehouse_id")
    .eq("id", offerId)
    .eq("is_visible", true)
    .neq("status", "INACTIVE")
    .is("deleted_at", null)
    .maybeSingle();
  if (!offer) return null;
  const [coffee, warehouse] = await Promise.all([
    db
      .from("coffees")
      .select("id")
      .eq("id", offer.coffee_id)
      .eq("status", "PUBLISHED")
      .is("deleted_at", null)
      .maybeSingle(),
    db
      .from("warehouses")
      .select("id")
      .eq("id", offer.warehouse_id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  return coffee.data && warehouse.data
    ? { offerId: offer.id, coffeeId: String(offer.coffee_id) }
    : null;
}

// ================================================== PRODUCT INQUIRY

export async function createProductInquiry(
  _state: ActionFormState<CreatedRequest>,
  formData: FormData,
): Promise<ActionResult<CreatedRequest>> {
  const parsed = requestSchema.safeParse({
    offerId: formData.get("offerId"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return invalidFields(parsed.error);

  const viewer = await requireVerifiedUser();
  if (!viewer) return fail("VERIFICATION_REQUIRED", "verifiedCustomerOnly");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConnected");

  const missing: ("phone" | "address" | "country")[] = [];
  if (!viewer.phone?.trim()) missing.push("phone");
  if (!viewer.address?.trim()) missing.push("address");
  if (!viewer.countryCode?.trim()) missing.push("country");
  if (missing.length) return profileIncomplete(missing);

  const db = await createSupabaseServerClient();
  const offer = await resolveVisibleOffer(db, parsed.data.offerId);
  if (!offer) return fail("NOT_FOUND", "offerUnavailable");

  /*
   * One intent must not become several rows.
   *
   * A commercial inquiry has no uniqueness rule — a customer may raise a new
   * one about the same coffee whenever business calls for it, and nothing here
   * blocks that. What this catches is the same submission arriving twice: a
   * double-click that outruns the disabled button, a second tab, a retry after
   * a dropped connection, or a no-JavaScript resubmit. The earlier request is
   * returned as the result, so the customer sees one success and one reference
   * rather than a refusal for something they did not knowingly do.
   *
   * Deliberately *not* modelled as a unique index: that would need a schema
   * change, and it would also make a legitimate identical follow-up months
   * later impossible.
   */
  const fingerprint = submissionFingerprint(
    parsed.data.subject,
    parsed.data.message,
  );
  const duplicate = await findRecentIdenticalProductInquiry(
    db,
    viewer.id,
    offer.offerId,
    fingerprint,
  );
  if (duplicate)
    return ok<CreatedRequest>("productInquirySent", {
      requestCode: duplicate.requestCode,
    });

  const { data, error } = await db
    .from("inquiries")
    .insert({
      type: "PRODUCT",
      offer_id: offer.offerId,
      full_name: viewer.fullName,
      company_name: viewer.companyName,
      email: viewer.email,
      phone: viewer.phone!.trim(),
      address: viewer.address!.trim(),
      country_code: viewer.countryCode!.trim(),
      subject: parsed.data.subject,
      message: parsed.data.message,
    })
    .select("request_code")
    .single();
  if (error || !data) {
    console.error(`[inquiries] product insert failed: ${error?.code}`);
    return fail("UNEXPECTED", "requestNotSaved");
  }

  revalidatePath("/", "layout");
  return ok<CreatedRequest>("productInquirySent", {
    requestCode: String(data.request_code),
  });
}

// ================================================== SAMPLE REQUEST

export async function createSampleRequestInquiry(
  _state: ActionFormState<CreatedRequest>,
  formData: FormData,
): Promise<ActionResult<CreatedRequest>> {
  const parsed = requestSchema.safeParse({
    offerId: formData.get("offerId"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return invalidFields(parsed.error);

  const viewer = await requireVerifiedUser();
  if (!viewer) return fail("VERIFICATION_REQUIRED", "verifiedCustomerOnly");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConnected");

  const db = await createSupabaseServerClient();
  const result = await processSampleRequest(
    {
      viewer,
      offerId: parsed.data.offerId,
      subject: parsed.data.subject ?? undefined,
      message: parsed.data.message,
    },
    {
      resolveVisibleOffer: (offerId) => resolveVisibleOffer(db, offerId),

      // Scoped by coffee, never by offer: choosing a different warehouse for
      // the same coffee is exactly the bypass the rule exists to stop. Shared
      // with the offer page, so the button it renders and the decision this
      // action makes cannot disagree.
      findActiveRequest: (userId, coffeeId) =>
        findActiveSampleRequest(db, userId, coffeeId),

      insertRequest: async (input) => {
        const { data, error } = await db
          .from("inquiries")
          .insert({
            type: input.type,
            offer_id: input.offerId,
            full_name: input.fullName,
            company_name: input.companyName,
            email: input.email,
            phone: input.phone,
            address: input.address,
            country_code: input.countryCode,
            subject: input.subject,
            message: input.message,
          })
          .select("request_code")
          .single();
        if (error)
          // The partial unique index is the concurrency-safe backstop. Its
          // violation is a duplicate, not a failure — recognised here and
          // named by the caller, never surfaced as constraint text.
          return error.code === UNIQUE_VIOLATION ? "DUPLICATE" : null;
        return data ? { requestCode: String(data.request_code) } : null;
      },
    },
  );

  if (result.ok) {
    revalidatePath("/", "layout");
    return ok<CreatedRequest>("sampleRequestSent", {
      requestCode: result.requestCode,
    });
  }

  switch (result.reason) {
    case "AUTH_REQUIRED":
    case "EMAIL_VERIFICATION_REQUIRED":
      return fail("VERIFICATION_REQUIRED", "verifiedCustomerOnly");
    case "PROFILE_INCOMPLETE":
      return profileIncomplete(result.missingFields ?? []);
    case "OFFER_UNAVAILABLE":
      return fail("NOT_FOUND", "offerUnavailable");
    case "ACTIVE_SAMPLE_EXISTS":
      // The surviving request's code travels with the error so the UI can
      // offer to open it instead of leaving the customer stuck.
      return fail("DUPLICATE_SAMPLE", "activeSampleExists", {
        conflict: { requestCode: result.requestCode },
      });
    default:
      return fail("UNEXPECTED", "requestNotSaved");
  }
}
