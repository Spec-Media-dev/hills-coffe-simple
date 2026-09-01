import { getTranslations } from "next-intl/server";
import type { InquiryStatus } from "@/lib/supabase/types.generated";

/**
 * The single localized vocabulary for inquiry statuses and types.
 *
 * Three separate copies of these labels existed before Phase 7, and only one
 * of them had been updated when `SAMPLE_SENT` and `DELIVERED` were added to
 * the database — so the customer's request list and detail page rendered the
 * raw enum name for exactly the two statuses the sample workflow depends on
 * (P7-T04). One resolver, read by every customer and Admin surface, makes that
 * class of drift impossible: a missing key now fails the EN/AR parity test
 * instead of silently reaching a customer.
 *
 * The wording deliberately describes state that Hills Coffee *recorded*
 * manually. Nothing here may imply automatic dispatch, guaranteed delivery or
 * stock reservation.
 */
export async function getInquiryLabels() {
  const [status, type] = await Promise.all([
    getTranslations("inquiryStatus"),
    getTranslations("inquiryType"),
  ]);
  return {
    /** Falls back to the raw value so an unknown enum shows, never blanks. */
    status: (value: unknown) => {
      const key = String(value);
      return status.has(key as Parameters<typeof status.has>[0])
        ? status(key as Parameters<typeof status>[0])
        : key;
    },
    type: (value: unknown) => {
      const key = String(value);
      return type.has(key as Parameters<typeof type.has>[0])
        ? type(key as Parameters<typeof type>[0])
        : key;
    },
  };
}

export type InquiryLabels = Awaited<ReturnType<typeof getInquiryLabels>>;
export type { InquiryStatus };
