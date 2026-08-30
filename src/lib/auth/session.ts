import "server-only";
import type { Viewer } from "@/data/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getViewer(): Promise<Viewer | null> {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.HILLS_USER_PREVIEW === "true"
  ) {
    return {
      id: "local-user-preview",
      email: "preview@hillscoffee.local",
      name: "Preview Customer",
      company: "Hills Lab",
      role: "USER",
    };
  }
  if (
    process.env.NODE_ENV === "development" &&
    process.env.HILLS_ADMIN_PREVIEW === "true"
  ) {
    return {
      id: "local-admin-preview",
      email: "admin@hillscoffee.local",
      name: "Preview Admin",
      company: "Hills Coffee",
      role: "ADMIN",
    };
  }
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = user.app_metadata?.role === "ADMIN" ? "ADMIN" : "USER";
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.full_name,
    company: user.user_metadata?.company,
    role,
  };
}

export async function requireAdmin() {
  const viewer = await getViewer();
  return viewer?.role === "ADMIN" ? viewer : null;
}
