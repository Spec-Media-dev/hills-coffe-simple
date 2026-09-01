import { hasAuthFixtureCredentials, service } from "./auth-fixtures";

export { hasAuthFixtureCredentials, service };

/**
 * Phase 7 personas.
 *
 * Every account created here is namespaced `e2e-hills-p7-…@example.com` and
 * deleted in `cleanup()`; no real customer account is ever touched. The
 * inquiries a run creates are removed too — unlike the Phase 6 QA catalog,
 * lead rows are not owner-approved fixtures to keep.
 */

export type Persona = {
  id: string;
  email: string;
  password: string;
};

type ProfileFields = {
  phone?: string | null;
  address?: string | null;
  country_code?: string | null;
  company_name?: string | null;
};

async function createPersona(
  label: string,
  role: "USER" | "ADMIN",
  profile: ProfileFields,
): Promise<Persona> {
  const tag = `${label}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-hills-p7-${tag}@example.com`;
  const password = `P7-Fx-${Math.random().toString(36).slice(2)}!Aa9`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E P7 ${label}` },
  });
  if (error) throw new Error(`create ${label}: ${error.message}`);
  const id = data.user.id;

  // Wait for the profile-provisioning trigger before writing to the row.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data: row } = await service
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (row) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const { error: updateError } = await service
    .from("profiles")
    .update({ ...profile, ...(role === "ADMIN" ? { role } : {}) })
    .eq("id", id);
  if (updateError) throw new Error(`profile ${label}: ${updateError.message}`);

  return { id, email, password };
}

export type InquiryPersonas = {
  /** Verified, unblocked, complete profile — may create requests. */
  customer: Persona;
  /** Verified and unblocked but missing phone/address/country. */
  incomplete: Persona;
  admin: Persona;
  /** A published coffee with two visible offers in different warehouses. */
  coffeeId: string;
  offerA: string;
  offerB: string;
  coffeeSlug: string;
  cleanup: () => Promise<void>;
};

export async function createInquiryPersonas(): Promise<InquiryPersonas> {
  const customer = await createPersona("cust", "USER", {
    phone: "+201000000001",
    address: "12 Phase Seven Street, Cairo",
    country_code: "EG",
    company_name: "E2E P7 Trading",
  });
  const incomplete = await createPersona("incomplete", "USER", {
    phone: null,
    address: null,
    country_code: null,
  });
  const admin = await createPersona("admin", "ADMIN", {
    phone: "+201000000002",
  });

  // Resolve real catalog rows rather than seeding new ones: Phase 7 must not
  // create catalog data, and the persisted Phase 6 QA coffee already has the
  // two-offers-one-coffee shape the duplicate rule needs.
  const { data: rows, error } = await service
    .from("coffee_offers")
    .select("id,coffee_id,coffees!inner(id,slug,status,deleted_at)")
    .eq("is_visible", true)
    .neq("status", "INACTIVE")
    .is("deleted_at", null)
    .eq("coffees.status", "PUBLISHED");
  if (error) throw new Error(`resolve offers: ${error.message}`);

  const grouped = new Map<string, { id: string; slug: string }[]>();
  for (const row of rows ?? []) {
    const key = row.coffee_id as string;
    const list = grouped.get(key) ?? [];
    list.push({
      id: row.id as string,
      slug: (row.coffees as unknown as { slug: string }).slug,
    });
    grouped.set(key, list);
  }
  const pair = [...grouped.entries()].find(([, list]) => list.length >= 2);
  if (!pair)
    throw new Error(
      "Phase 7 e2e needs one published coffee with two visible offers.",
    );

  const personas = [customer, incomplete, admin];
  return {
    customer,
    incomplete,
    admin,
    coffeeId: pair[0],
    offerA: pair[1][0].id,
    offerB: pair[1][1].id,
    coffeeSlug: pair[1][0].slug,
    cleanup: async () => {
      for (const persona of personas)
        await service.from("inquiries").delete().eq("user_id", persona.id);
      // USER rows first: `profiles.blocked_by` references the Administrator.
      for (const persona of personas.filter((p) => p.id !== admin.id))
        await service.auth.admin.deleteUser(persona.id);
      await service.auth.admin.deleteUser(admin.id);
    },
  };
}
