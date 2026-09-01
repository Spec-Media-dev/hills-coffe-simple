import type { InquiryStatus } from "@/lib/supabase/types.generated";

/**
 * The statuses that make a sample request "active" for the duplicate rule.
 *
 * This list is not a policy decision made here — it mirrors, exactly, the
 * predicate of the live partial unique index:
 *
 *   uq_inquiries_active_sample_user_coffee
 *     ON inquiries (user_id, coffee_id)
 *     WHERE type = 'SAMPLE_REQUEST'
 *       AND status = ANY (ARRAY['NEW','RECEIVED','CONTACTED',
 *                               'SAMPLE_SENT','DELIVERED'])
 *
 * i.e. everything except `CLOSED`. It previously stopped at `CONTACTED`, so a
 * customer whose earlier request had already reached `SAMPLE_SENT` or
 * `DELIVERED` slipped past the application pre-check and was stopped only by
 * the database — surfacing as a generic failure instead of the duplicate
 * message (finding N42). The database stays the authority; this exists so the
 * common case is answered without provoking a constraint violation.
 */
export const ACTIVE_SAMPLE_STATUSES = [
  "NEW",
  "RECEIVED",
  "CONTACTED",
  "SAMPLE_SENT",
  "DELIVERED",
] as const satisfies readonly InquiryStatus[];

export type SampleRequester = {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  countryCode: string | null;
};

export type TrustedSampleOffer = {
  offerId: string;
  coffeeId: string;
};

export type ActiveSampleRequest = {
  requestCode: string;
  status: (typeof ACTIVE_SAMPLE_STATUSES)[number];
};

export type SampleInsert = {
  type: "SAMPLE_REQUEST";
  offerId: string;
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string;
  address: string;
  countryCode: string;
  subject: string | null;
  message: string;
};

export type SampleRequestRepository = {
  resolveVisibleOffer: (offerId: string) => Promise<TrustedSampleOffer | null>;
  findActiveRequest: (
    userId: string,
    coffeeId: string,
  ) => Promise<ActiveSampleRequest | null>;
  /**
   * Returns the created code, or `"DUPLICATE"` when the database's partial
   * unique index rejected the insert. The adapter owns recognising that
   * specific violation; this module owns what it means.
   */
  insertRequest: (
    input: SampleInsert,
  ) => Promise<{ requestCode: string } | "DUPLICATE" | null>;
};

export type SampleRequestResult =
  | { ok: true; requestCode: string }
  | {
      ok: false;
      reason:
        | "AUTH_REQUIRED"
        | "EMAIL_VERIFICATION_REQUIRED"
        | "PROFILE_INCOMPLETE"
        | "OFFER_UNAVAILABLE"
        | "ACTIVE_SAMPLE_EXISTS"
        | "CREATE_FAILED";
      requestCode?: string;
      missingFields?: ("phone" | "address" | "country")[];
    };

const present = (value: string | null | undefined) => Boolean(value?.trim());

export async function processSampleRequest(
  input: {
    viewer: SampleRequester | null;
    offerId: string;
    subject?: string;
    message: string;
  },
  repository: SampleRequestRepository,
): Promise<SampleRequestResult> {
  if (!input.viewer) return { ok: false, reason: "AUTH_REQUIRED" };
  if (!input.viewer.emailVerified)
    return { ok: false, reason: "EMAIL_VERIFICATION_REQUIRED" };

  const missingFields: ("phone" | "address" | "country")[] = [];
  if (!present(input.viewer.phone)) missingFields.push("phone");
  if (!present(input.viewer.address)) missingFields.push("address");
  if (!present(input.viewer.countryCode)) missingFields.push("country");
  if (missingFields.length)
    return { ok: false, reason: "PROFILE_INCOMPLETE", missingFields };

  const offer = await repository.resolveVisibleOffer(input.offerId);
  if (!offer) return { ok: false, reason: "OFFER_UNAVAILABLE" };

  const active = await repository.findActiveRequest(
    input.viewer.id,
    offer.coffeeId,
  );
  if (active)
    return {
      ok: false,
      reason: "ACTIVE_SAMPLE_EXISTS",
      requestCode: active.requestCode,
    };

  const created = await repository.insertRequest({
    type: "SAMPLE_REQUEST",
    offerId: offer.offerId,
    fullName: input.viewer.fullName,
    companyName: input.viewer.companyName,
    email: input.viewer.email,
    phone: input.viewer.phone!.trim(),
    address: input.viewer.address!.trim(),
    countryCode: input.viewer.countryCode!.trim(),
    subject: input.subject?.trim() || null,
    message: input.message.trim(),
  });
  // A concurrent request can win the race between the pre-check above and
  // this insert. The database's unique index is what actually guarantees one
  // active request, so a rejection here is a duplicate, not a failure: the
  // surviving request is looked up so the caller can be pointed at it.
  if (created === "DUPLICATE") {
    const winner = await repository.findActiveRequest(
      input.viewer.id,
      offer.coffeeId,
    );
    return {
      ok: false,
      reason: "ACTIVE_SAMPLE_EXISTS",
      requestCode: winner?.requestCode,
    };
  }
  return created
    ? { ok: true, requestCode: created.requestCode }
    : { ok: false, reason: "CREATE_FAILED" };
}
