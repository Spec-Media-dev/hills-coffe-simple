"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Locale } from "@/i18n/routing";
import {
  fail,
  ok,
  type ActionFormState,
  type ActionResult,
} from "@/lib/actions";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  buildAvatarPath,
  isOwnedAvatarPath,
  validateAvatarBytes,
  type AvatarRejection,
} from "@/lib/avatar";
import { localizedPath } from "@/lib/auth/redirects";
import { requireAccountOwner, requireVerifiedUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  localeSchema,
  passwordSchema,
  phoneSchema,
} from "@/lib/validation/auth";

const localeFrom = (value: FormDataEntryValue | null): Locale =>
  localeSchema.safeParse(value).data ?? "en";

/**
 * Field-level messages are catalog keys, resolved by the client in the active
 * locale. The server never returns pre-localized or provider text
 * (Constitution Principle XII), which is what removed the `locale === "ar"`
 * branching this file used to carry.
 */
const fieldMessageKey: Record<string, string> = {
  full_name: "invalidFullName",
  phone: "invalidPhone",
  company_name: "invalidCompanyName",
  address: "invalidAddress",
  country_code: "invalidCountry",
  email: "invalidEmail",
  currentPassword: "wrongPassword",
  password: "invalidPassword",
  confirmPassword: "passwordMismatch",
};

function invalid(result: {
  error: {
    flatten: () => { fieldErrors: Record<string, string[] | undefined> };
  };
}): ActionResult {
  const source = result.error.flatten().fieldErrors;
  const fieldErrors: Record<string, string[]> = {};
  for (const field of Object.keys(source))
    fieldErrors[field] = [fieldMessageKey[field] ?? "validation"];
  return fail("VALIDATION", "validation", { fieldErrors });
}

/**
 * `company_name` is optional throughout: an empty submission is stored as
 * NULL and never blocks the save.
 */
const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: phoneSchema.nullable(),
  company_name: z.string().trim().max(160).nullable(),
  address: z.string().trim().max(300).nullable(),
  country_code: z.string().trim().length(2).toUpperCase().nullable(),
});

export async function updateProfileAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  // Own-account edit, so the own-account gate: an Administrator manages their
  // own profile here too, and RLS still scopes the write to `auth.uid()`.
  const viewer = await requireAccountOwner();
  if (!viewer) return fail("AUTH_REQUIRED", "sessionExpired");

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || null,
    company_name: formData.get("company_name") || null,
    address: formData.get("address") || null,
    country_code: formData.get("country_code") || null,
  });
  if (!parsed.success) return invalid(parsed);

  // Only these five columns are ever written. role/is_blocked/blocked_* are
  // not in the schema and not in this object, and `protect_profile_block_fields()`
  // is the database backstop if that allow-list is ever bypassed (FR-015).
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .update(parsed.data)
    .eq("id", viewer.id)
    .select("id");
  if (error) return fail("UNEXPECTED", "saveFailed");
  // RLS denies a blocked customer by filtering the row out rather than
  // raising, so zero affected rows is a denial, not a success (finding N9).
  if (!data || data.length === 0) return fail("FORBIDDEN", "saveFailed");

  revalidatePath("/", "layout");
  return ok("profileSaved");
}

const avatarRejectionKey: Record<AvatarRejection, string> = {
  empty: "avatarEmpty",
  too_large: "avatarTooLarge",
  unsupported_type: "avatarUnsupportedType",
  signature_mismatch: "avatarSignatureMismatch",
};

export async function uploadAvatarAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireVerifiedUser();
  if (!viewer) return fail("AUTH_REQUIRED", "sessionExpired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");

  const file = formData.get("avatar");
  if (!(file instanceof File)) return fail("STORAGE_INVALID", "avatarEmpty");

  // Read the bytes and judge the file by them. `File.type` and `File.size` are
  // browser-reported and are never the deciding factor (FR-019).
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateAvatarBytes(bytes, file.type);
  if (!validation.ok)
    return fail("STORAGE_INVALID", avatarRejectionKey[validation.reason]);

  const supabase = await createSupabaseServerClient();
  const previousPath = viewer.avatarPath;
  // Path is derived from the authenticated id, never from client input, so a
  // traversal or foreign-folder path cannot be requested.
  const path = buildAvatarPath(viewer.id, validation.mimeType);

  const upload = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, validation.bytes, {
      contentType: validation.mimeType,
      upsert: false,
      // Supabase Storage keeps serving a deleted object from its edge cache
      // for the cache lifetime. Each upload already gets a unique path, so a
      // short TTL costs little and bounds how long a removed avatar stays
      // fetchable by anyone still holding its (10-minute) signed URL.
      cacheControl: "60",
    });
  if (upload.error) return fail("STORAGE_FAILED", "avatarUploadFailed");

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", viewer.id)
    .select("id");

  // If the profile could not be pointed at the new object, remove the orphan
  // rather than leaving unreferenced bytes in the bucket.
  if (updateError || !updated || updated.length === 0) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return fail("STORAGE_FAILED", "avatarUploadFailed");
  }

  // Only now is the previous object safe to delete. A failure here leaves a
  // stale object but a working avatar, so it is logged rather than surfaced.
  if (isOwnedAvatarPath(previousPath, viewer.id) && previousPath !== path) {
    const cleanup = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([previousPath as string]);
    if (cleanup.error)
      console.error(
        `[avatar] replaced object left behind; cleanup needed. userId=${viewer.id}`,
      );
  }

  revalidatePath("/", "layout");
  return ok("avatarUpdated");
}

export async function deleteAvatarAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  void formData;
  const viewer = await requireVerifiedUser();
  if (!viewer) return fail("AUTH_REQUIRED", "sessionExpired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");

  const supabase = await createSupabaseServerClient();
  const path = viewer.avatarPath;

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", viewer.id)
    .select("id");
  if (error) return fail("UNEXPECTED", "saveFailed");
  if (!updated || updated.length === 0) return fail("FORBIDDEN", "saveFailed");

  // Delete only the owner's own previously-recorded object.
  if (isOwnedAvatarPath(path, viewer.id))
    await supabase.storage.from(AVATAR_BUCKET).remove([path as string]);

  revalidatePath("/", "layout");
  return ok("avatarRemoved");
}

export async function changeEmailAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const locale = localeFrom(formData.get("locale"));
  const viewer = await requireAccountOwner();
  if (!viewer) return fail("AUTH_REQUIRED", "sessionExpired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");

  const parsed = z
    .object({ email: z.email().trim().toLowerCase() })
    .safeParse({ email: formData.get("email") });
  if (!parsed.success) return invalid(parsed);
  if (parsed.data.email === viewer.email.toLowerCase())
    return fail("VALIDATION", "sameEmail", {
      fieldErrors: { email: ["sameEmail"] },
    });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    {
      // Return the confirming click to the settings page the caller actually
      // uses: an Administrator has no access to the customer account area.
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(
        localizedPath(
          locale,
          viewer.role === "ADMIN" ? "/admin/account" : "/account/settings",
        ),
      )}`,
    },
  );
  // The change only takes effect once the link sent to the new address is
  // followed, so nothing is committed here.
  if (error) return fail("UNEXPECTED", "saveFailed");
  return ok("emailChangeSent");
}

export async function changePasswordAction(
  _: ActionFormState,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireAccountOwner();
  if (!viewer) return fail("AUTH_REQUIRED", "sessionExpired");
  if (!isSupabaseConfigured()) return fail("CONFIGURATION", "configuration");

  const parsed = z
    .object({
      currentPassword: z.string().min(1),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((value) => value.password === value.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match",
    })
    .safeParse({
      currentPassword: formData.get("currentPassword"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
  if (!parsed.success) return invalid(parsed);

  const supabase = await createSupabaseServerClient();
  // Re-authenticate before allowing a credential change. The password is only
  // ever handed to Supabase Auth — never stored, logged, or echoed back.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: viewer.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError)
    return fail("FORBIDDEN", "wrongPassword", {
      fieldErrors: { currentPassword: ["wrongPassword"] },
    });

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return fail("UNEXPECTED", "saveFailed");
  return ok("passwordUpdated");
}

/**
 * Adds or removes one coffee from the caller's own favourites.
 *
 * This action used to return nothing at all: an expired session, a malformed
 * id and a rejected write were all indistinguishable from success, because
 * every failure path was a bare `return`. It now answers on the approved
 * contract like every other action, so the button can say what happened
 * instead of appearing to do nothing.
 */
type FavoriteState = { favorite: boolean };

export async function toggleFavoriteAction(
  _state: ActionFormState<FavoriteState>,
  formData: FormData,
): Promise<ActionResult<FavoriteState>> {
  const viewer = await requireVerifiedUser();
  if (!viewer) return fail("AUTH_REQUIRED", "sessionExpired");
  const parsed = z
    .object({
      coffeeId: z.string().uuid(),
      returnTo: z.string().startsWith("/"),
    })
    .safeParse({
      coffeeId: formData.get("coffeeId"),
      returnTo: formData.get("returnTo") || "/account/favorites",
    });
  if (!parsed.success) return fail("VALIDATION", "validation");

  // Every statement is scoped to the caller's own id; RLS is the backstop.
  const db = await createSupabaseServerClient();
  const { data, error: readFailed } = await db
    .from("favorites")
    .select("coffee_id")
    .eq("user_id", viewer.id)
    .eq("coffee_id", parsed.data.coffeeId)
    .maybeSingle();
  if (readFailed) return favoriteFailed(readFailed);

  const { error: writeFailed } = data
    ? await db
        .from("favorites")
        .delete()
        .eq("user_id", viewer.id)
        .eq("coffee_id", parsed.data.coffeeId)
    : await db.from("favorites").insert({
        user_id: viewer.id,
        coffee_id: parsed.data.coffeeId,
        created_at: new Date().toISOString(),
      });
  if (writeFailed) return favoriteFailed(writeFailed);

  revalidatePath(parsed.data.returnTo);
  revalidatePath("/account/favorites");
  // `favorite` is the state the coffee is now in, so the button can relabel
  // itself without waiting for the revalidated page to arrive.
  return ok(data ? "favoriteRemoved" : "favoriteSaved", {
    favorite: !data,
  });
}

/** The code identifies the fault; the row data that may sit in the message does not. */
function favoriteFailed(error: { code?: string }): ActionResult<never> {
  console.error(`[account] favorite toggle failed: ${error.code ?? "upstream"}`);
  return fail("UNEXPECTED", "saveFailed");
}

/** Exposed for the settings UI so limits stay in one place. */
export async function getAvatarConstraints() {
  return {
    maxBytes: AVATAR_MAX_BYTES,
    accept: AVATAR_MIME_TYPES.join(","),
  };
}
