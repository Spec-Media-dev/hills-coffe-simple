import type { InquiryStatus } from "@/lib/supabase/types.generated";

export const ACTIVE_SAMPLE_STATUSES = [
  "NEW",
  "RECEIVED",
  "CONTACTED",
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
  insertRequest: (
    input: SampleInsert,
  ) => Promise<{ requestCode: string } | null>;
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
  return created
    ? { ok: true, requestCode: created.requestCode }
    : { ok: false, reason: "CREATE_FAILED" };
}
