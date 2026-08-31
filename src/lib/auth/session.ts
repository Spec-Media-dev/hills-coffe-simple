import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types.generated";

export type Viewer = {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  countryCode: string | null;
  role: AppRole;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,phone,company_name,address,country_code,role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    fullName: profile.full_name,
    phone: profile.phone,
    companyName: profile.company_name,
    address: profile.address,
    countryCode: profile.country_code,
    role: profile.role,
  };
});

export async function requireUser() {
  return getViewer();
}
export async function requireVerifiedUser() {
  const viewer = await getViewer();
  return viewer?.emailVerified ? viewer : null;
}
export async function requireAdmin() {
  const viewer = await getViewer();
  return viewer?.role === "ADMIN" ? viewer : null;
}
