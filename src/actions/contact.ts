"use server";

import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ContactState = {
  status: "idle" | "success" | "error";
  message: string;
};
const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  company: z.string().min(2).max(120),
  location: z.enum(["Egypt", "Dubai"]),
  message: z.string().min(15).max(1600),
});
export async function createContactInquiry(
  _: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      status: "error",
      message: "Please complete every field with valid details.",
    };
  if (!isSupabaseConfigured())
    return {
      status: "error",
      message:
        "Form preview complete. Connect Supabase to save incoming requests.",
    };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("contact_inquiries")
    .insert({ ...parsed.data, created_at: new Date().toISOString() });
  return error
    ? {
        status: "error",
        message:
          "We could not save this request. Please email hello@hillscoffee.co.",
      }
    : {
        status: "success",
        message: "Thank you. Our team will follow up shortly.",
      };
}
