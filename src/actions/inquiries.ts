"use server";

import { z } from "zod";
import { getOfferById } from "@/data/coffees";
import { getViewer } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inquirySchema = z.object({
  offerId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(10000),
  message: z.string().trim().min(10).max(1200),
});
export type InquiryState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function createProductInquiry(
  _: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const viewer = await getViewer();
  if (!viewer)
    return {
      status: "error",
      message: "Please sign in before sending a product inquiry.",
    };
  const parsed = inquirySchema.safeParse({
    offerId: formData.get("offerId"),
    quantity: formData.get("quantity"),
    message: formData.get("message"),
  });
  if (!parsed.success)
    return {
      status: "error",
      message:
        "Please add a valid bag quantity and at least 10 characters of detail.",
    };
  const trusted = getOfferById(parsed.data.offerId);
  if (!trusted)
    return {
      status: "error",
      message: "That warehouse offer is no longer available.",
    };
  if (!isSupabaseConfigured())
    return {
      status: "error",
      message:
        "Inquiry preview complete. Connect Supabase to save and route this request.",
    };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("product_inquiries").insert({
    user_id: viewer.id,
    coffee_id: trusted.coffee.id,
    offering_id: trusted.offer.id,
    warehouse: trusted.offer.warehouse,
    quantity_bags: parsed.data.quantity,
    message: parsed.data.message,
    created_at: new Date().toISOString(),
  });
  if (error)
    return {
      status: "error",
      message:
        "We could not save the inquiry. Please contact hello@hillscoffee.co.",
    };
  return {
    status: "success",
    message: "Your inquiry was sent. Our coffee team will follow up shortly.",
  };
}
