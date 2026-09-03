"use server";

import { z } from "zod";
import {
  fail,
  ok,
  type ActionFormState,
  type ActionResult,
} from "@/lib/actions";
import { allowPublicInquiryAttempt } from "@/lib/rate-limit/public-inquiries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PHONE_PATTERN } from "@/lib/validation/auth";

/**
 * Anonymous request creation — `contracts/public-inquiry-actions.md`.
 *
 * The sibling of `src/actions/inquiries.ts`, which is untouched: a signed-in
 * verified customer keeps using those actions and their `requireVerifiedUser()`
 * gate (FR-076). These two exist for visitors with no session at all, and
 * three properties define them:
 *
 *  1. **The database is the boundary, not this file.** Both call
 *     `public.submit_public_inquiry()`, a `SECURITY DEFINER` function whose
 *     parameter list is the allow-list — `type`, `status`, `user_id`, the
 *     coffee id and every snapshot column are simply not addressable from
 *     here. Anonymous `INSERT` on `inquiries` stays denied by RLS; this
 *     addendum never widens a policy.
 *  2. **The anon key only.** `createSupabaseServerClient()` is the same
 *     helper the authenticated actions already use. No service-role
 *     credential is imported here or reachable from anything a browser
 *     loads.
 *  3. **No prose crosses the wire.** The function raises stable tokens
 *     (`public_inquiry_invalid_offer` and friends) which a closed switch
 *     maps to domain codes, so a Postgres message can never reach a user
 *     (Constitution Principle XII).
 */

/** Postgres unique-violation — the anonymous duplicate-sample index. */
const UNIQUE_VIOLATION = "23505";

type CreatedRequest = { requestCode: string };

/**
 * Shared by both forms. `website` is the honeypot: the field is present in
 * the DOM but hidden from people, so anything in it came from a script.
 * Same name and shape as the authenticated inquiry actions already use.
 */
const publicBase = {
  fullName: z.string().trim().min(2, "invalidFullName").max(200, "tooLong"),
  email: z.string().trim().toLowerCase().pipe(z.email("invalidEmail")),
  // Same rule as the shared auth phone schema, with this addendum's own
  // error code attached so the message resolves properly per field.
  phone: z.string().trim().regex(PHONE_PATTERN, "invalidPhone"),
  companyName: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().trim().max(160, "tooLong").nullable(),
  ),
  message: z.string().trim().min(10, "messageTooShort").max(2000, "tooLong"),
  website: z.string().max(0, "invalidValue").optional(),
};

const rfqSchema = z.object({
  ...publicBase,
  subject: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.string().trim().max(160, "tooLong").nullable(),
  ),
});

const sampleSchema = z.object({
  ...publicBase,
  offerId: z.string().trim().min(1, "required").uuid("invalidReference"),
  address: z.string().trim().min(5, "invalidAddress").max(400, "tooLong"),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "invalidCountry"),
});

function invalidFields(error: z.ZodError): ActionResult<CreatedRequest> {
  const flattened = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const fieldErrors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(flattened))
    if (messages?.length)
      fieldErrors[field] = [
        // A Zod default message contains spaces; our own codes never do, so
        // anything unrecognised collapses to a safe generic key.
        messages[0].includes(" ") ? "invalidValue" : messages[0],
      ];
  return fail("VALIDATION", "checkRequestFields", { fieldErrors });
}

/**
 * Translates the database function's closed token vocabulary.
 *
 * Anything unrecognised becomes `UNEXPECTED` with a safe key, so a message
 * this switch has never seen cannot leak through by default.
 */
function mapSubmitError(
  message: string | undefined,
): ActionResult<CreatedRequest> {
  if (
    message?.includes("public_inquiry_missing_field") ||
    // Raised when a value is supplied but outside the bounds the function
    // enforces for direct PostgREST callers. The form's own Zod schema
    // normally catches these first; this is the case where it was bypassed.
    message?.includes("public_inquiry_invalid_field")
  )
    return fail("VALIDATION", "checkRequestFields");
  if (message?.includes("public_inquiry_invalid_offer"))
    return fail("NOT_FOUND", "offerUnavailable");
  if (message?.includes("public_inquiry_rate_limited"))
    return fail("RATE_LIMITED", "tooManyRequests");
  console.error(`[public-inquiries] submit failed: ${message ?? "unknown"}`);
  return fail("UNEXPECTED", "requestNotSaved");
}

/**
 * The duplicate answer for an anonymous submitter.
 *
 * Deliberately does not carry the existing request's code. A signed-in
 * customer's duplicate is provably their own row (`user_id = auth.uid()`),
 * so `createSampleRequestInquiry` returns their code and should. An
 * anonymous caller supplies whatever email they choose, so returning the
 * code would answer "does this person have an active request for this
 * coffee, and what is its reference?" for anyone willing to type a stranger's
 * address. The refusal already says the minimum needed to explain itself.
 *
 * `anon` also cannot read `inquiries` at all — RLS denies it — so there is
 * no lookup to attempt here without widening a policy or moving the read
 * into the definer function, either of which would build that disclosure
 * rather than avoid it. See `contracts/public-inquiry-actions.md`.
 */
function duplicateAnonymousSample(): ActionResult<CreatedRequest> {
  return fail("DUPLICATE_SAMPLE", "activeSampleExists");
}

/** Honeypot, then per-IP allowance. Neither reveals which one refused. */
async function abusePrecheck(
  honeypot: string | undefined,
): Promise<ActionResult<CreatedRequest> | null> {
  if (honeypot) return fail("VALIDATION", "checkRequestFields");
  if (!(await allowPublicInquiryAttempt()))
    return fail("RATE_LIMITED", "tooManyRequests");
  return null;
}

// ================================================== GENERAL RFQ

export async function submitPublicRfq(
  _state: ActionFormState<CreatedRequest>,
  formData: FormData,
): Promise<ActionResult<CreatedRequest>> {
  const parsed = rfqSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return invalidFields(parsed.error);

  const blocked = await abusePrecheck(parsed.data.website);
  if (blocked) return blocked;

  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConnected");

  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("submit_public_inquiry", {
    p_full_name: parsed.data.fullName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_message: parsed.data.message,
    p_company_name: parsed.data.companyName,
    p_subject: parsed.data.subject,
  });

  if (error) return mapSubmitError(error.message);

  const requestCode = (data as { request_code?: string } | null)?.request_code;
  if (!requestCode) {
    console.error("[public-inquiries] rfq returned no request code");
    return fail("UNEXPECTED", "requestNotSaved");
  }
  return ok<CreatedRequest>("publicRfqSent", { requestCode });
}

// ================================================== SAMPLE REQUEST

export async function submitPublicSampleRequest(
  _state: ActionFormState<CreatedRequest>,
  formData: FormData,
): Promise<ActionResult<CreatedRequest>> {
  const parsed = sampleSchema.safeParse({
    offerId: formData.get("offerId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    address: formData.get("address"),
    countryCode: formData.get("countryCode"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return invalidFields(parsed.error);

  const blocked = await abusePrecheck(parsed.data.website);
  if (blocked) return blocked;

  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "notConnected");

  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("submit_public_inquiry", {
    p_full_name: parsed.data.fullName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_message: parsed.data.message,
    p_offer_id: parsed.data.offerId,
    p_address: parsed.data.address,
    p_country_code: parsed.data.countryCode,
    p_company_name: parsed.data.companyName,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return duplicateAnonymousSample();
    return mapSubmitError(error.message);
  }

  const requestCode = (data as { request_code?: string } | null)?.request_code;
  if (!requestCode) {
    console.error("[public-inquiries] sample returned no request code");
    return fail("UNEXPECTED", "requestNotSaved");
  }
  return ok<CreatedRequest>("publicSampleSent", { requestCode });
}
