"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";
import {
  ACTIVE_SAMPLE_STATUSES,
  processSampleRequest,
} from "@/lib/inquiries/sample-request";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inquirySchema = z.object({
  offerId: z.string().uuid(),
  locale: z.enum(["en", "ar"]),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(0).optional(),
});
export type InquiryState = {
  status: "idle" | "success" | "error";
  message: string;
  reason?:
    | "AUTH_REQUIRED"
    | "EMAIL_VERIFICATION_REQUIRED"
    | "PROFILE_INCOMPLETE"
    | "OFFER_UNAVAILABLE"
    | "ACTIVE_SAMPLE_EXISTS"
    | "CREATE_FAILED";
  requestCode?: string;
  fieldErrors?: string[];
};
const copy = (locale: Locale) =>
  locale === "ar"
    ? {
        auth: "أكد بريدك الإلكتروني قبل إرسال الطلب.",
        signin: "سجّل الدخول لإرسال الطلب.",
        profile: "أكمل رقم الهاتف وعنوان التوصيل والدولة في ملفك الشخصي أولاً.",
        invalid: "أضف تفاصيل طلب واضحة من 10 أحرف على الأقل.",
        missing: "هذا العرض لم يعد متاحاً.",
        config: "خدمة الطلبات غير متصلة بعد.",
        failed: "تعذر حفظ الطلب. حاول مرة أخرى.",
        sent: "تم إرسال طلبك وسيتابع معك فريق القهوة قريباً.",
        sampleSent:
          "تم إرسال طلب العينة للمراجعة اليدوية. لا يضمن الطلب إرسال عينة.",
        activeSample: "لديك بالفعل طلب عينة نشط لهذه القهوة.",
        duplicate:
          "تم استلام طلب حديث بالفعل. انتظر قليلاً قبل الإرسال مرة أخرى.",
      }
    : {
        auth: "Verify your email before sending a request.",
        signin: "Sign in before sending a request.",
        profile:
          "Complete your phone, delivery address, and country in your profile first.",
        invalid: "Add at least 10 characters describing your request.",
        missing: "That offer is no longer available.",
        config: "The request service is not connected yet.",
        failed: "We could not save the request. Please try again.",
        sent: "Your request was sent. Our coffee team will follow up shortly.",
        sampleSent:
          "Your sample request was submitted for manual review. Submission does not guarantee a physical sample.",
        activeSample:
          "You already have an active sample request for this coffee.",
        duplicate:
          "A recent request was already received. Please wait before sending again.",
      };

export async function createProductInquiry(
  _: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const text = copy(locale);
  const viewer = await getViewer();
  if (!viewer)
    return { status: "error", reason: "AUTH_REQUIRED", message: text.signin };
  if (!viewer.emailVerified)
    return {
      status: "error",
      reason: "EMAIL_VERIFICATION_REQUIRED",
      message: text.auth,
    };
  const parsed = inquirySchema.safeParse({
    offerId: formData.get("offerId"),
    locale,
    subject: formData.get("subject") || undefined,
    message: formData.get("message"),
    website: formData.get("website") || "",
  });
  if (!parsed.success) return { status: "error", message: text.invalid };
  if (!viewer.phone?.trim())
    return {
      status: "error",
      reason: "PROFILE_INCOMPLETE",
      message: text.profile,
      fieldErrors: ["phone"],
    };
  if (!isSupabaseConfigured()) return { status: "error", message: text.config };
  const db = await createSupabaseServerClient();
  const { data: offer } = await db
    .from("coffee_offers")
    .select("id,coffee_id,warehouse_id,reference_number")
    .eq("id", parsed.data.offerId)
    .eq("is_visible", true)
    .neq("status", "INACTIVE")
    .is("deleted_at", null)
    .maybeSingle();
  if (!offer) return { status: "error", message: text.missing };
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await db
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .eq("offer_id", offer.id)
    .gte("created_at", oneMinuteAgo);
  if ((recentCount ?? 0) > 0)
    return { status: "error", message: text.duplicate };
  const [coffeeQ, warehouseQ] = await Promise.all([
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
  if (!coffeeQ.data || !warehouseQ.data)
    return { status: "error", message: text.missing };
  const { data: created, error } = await db
    .from("inquiries")
    .insert({
      type: "PRODUCT",
      offer_id: offer.id,
      full_name: viewer.fullName,
      company_name: viewer.companyName,
      email: viewer.email,
      phone: viewer.phone.trim(),
      address: viewer.address,
      country_code: viewer.countryCode,
      subject: parsed.data.subject ?? null,
      message: parsed.data.message,
    })
    .select("request_code")
    .single();
  if (error) return { status: "error", message: text.failed };
  revalidatePath(`/${locale}/account`);
  return {
    status: "success",
    message: text.sent,
    requestCode: created.request_code,
  };
}

export async function createSampleRequestInquiry(
  _: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const locale = formData.get("locale") === "ar" ? "ar" : "en";
  const text = copy(locale);
  const parsed = inquirySchema.safeParse({
    offerId: formData.get("offerId"),
    locale,
    subject: formData.get("subject") || undefined,
    message: formData.get("message"),
    website: formData.get("website") || "",
  });
  if (!parsed.success) return { status: "error", message: text.invalid };
  if (!isSupabaseConfigured()) return { status: "error", message: text.config };

  const viewer = await getViewer();
  const db = await createSupabaseServerClient();
  const result = await processSampleRequest(
    {
      viewer,
      offerId: parsed.data.offerId,
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
    {
      resolveVisibleOffer: async (offerId) => {
        const { data: offer } = await db
          .from("coffee_offers")
          .select("id,coffee_id,warehouse_id")
          .eq("id", offerId)
          .eq("is_visible", true)
          .neq("status", "INACTIVE")
          .is("deleted_at", null)
          .maybeSingle();
        if (!offer) return null;
        const [coffeeQ, warehouseQ] = await Promise.all([
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
        return coffeeQ.data && warehouseQ.data
          ? { offerId: offer.id, coffeeId: offer.coffee_id }
          : null;
      },
      findActiveRequest: async (userId, coffeeId) => {
        const { data } = await db
          .from("inquiries")
          .select("request_code,status")
          .eq("user_id", userId)
          .eq("coffee_id", coffeeId)
          .eq("type", "SAMPLE_REQUEST")
          .in("status", [...ACTIVE_SAMPLE_STATUSES])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data
          ? {
              requestCode: data.request_code,
              status: data.status as (typeof ACTIVE_SAMPLE_STATUSES)[number],
            }
          : null;
      },
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
        return error || !data ? null : { requestCode: data.request_code };
      },
    },
  );

  if (result.ok) {
    revalidatePath(`/${locale}/account`);
    return {
      status: "success",
      message: text.sampleSent,
      requestCode: result.requestCode,
    };
  }
  const messages = {
    AUTH_REQUIRED: text.signin,
    EMAIL_VERIFICATION_REQUIRED: text.auth,
    PROFILE_INCOMPLETE: text.profile,
    OFFER_UNAVAILABLE: text.missing,
    ACTIVE_SAMPLE_EXISTS: text.activeSample,
    CREATE_FAILED: text.failed,
  } as const;
  return {
    status: "error",
    reason: result.reason,
    message: messages[result.reason],
    requestCode: result.requestCode,
    fieldErrors: result.missingFields,
  };
}
