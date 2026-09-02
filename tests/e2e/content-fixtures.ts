import { hasAuthFixtureCredentials, service } from "./auth-fixtures";

export { hasAuthFixtureCredentials, service };

/**
 * Phase 8 personas and QA content.
 *
 * Accounts are namespaced `e2e-hills-p8-…@example.com` and deleted in
 * `cleanup()`. Every page, article, media row and storage object this run
 * creates is namespaced `qa-p8-…` and removed too — unlike the Phase 6 QA
 * catalog, content rows are not owner-approved fixtures to keep.
 */

export type Persona = { id: string; email: string; password: string };

async function createPersona(
  label: string,
  role: "USER" | "ADMIN",
): Promise<Persona> {
  const tag = `${label}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e-hills-p8-${tag}@example.com`;
  const password = `P8-Fx-${Math.random().toString(36).slice(2)}!Aa9`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E P8 ${label}` },
  });
  if (error) throw new Error(`create ${label}: ${error.message}`);
  const id = data.user.id;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data: row } = await service
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (row) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (role === "ADMIN") {
    const { error: roleError } = await service
      .from("profiles")
      .update({ role })
      .eq("id", id);
    if (roleError) throw new Error(`promote ${label}: ${roleError.message}`);
  }
  return { id, email, password };
}

/** A real 24x16 PNG, so the header parser reads genuine dimensions. */
export const PNG_24x16 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAYAAAAMJL+VAAAAJElEQVR42mP8//8/AzGAiYFIMKpwVOGowlGFowpHFY4qHFVIfoUAyKcEAcLIvJgAAAAASUVORK5CYII=",
  "base64",
);

/** Not an image at all, despite what its name and declared type will claim. */
export const FAKE_PNG = Buffer.from(
  "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
  "utf8",
);

export type ContentPersonas = {
  admin: Persona;
  customer: Persona;
  /** Namespace shared by every row this run creates. */
  tag: string;
  cleanup: () => Promise<void>;
};

export async function createContentPersonas(): Promise<ContentPersonas> {
  const admin = await createPersona("admin", "ADMIN");
  const customer = await createPersona("cust", "USER");
  const tag = `qa-p8-${Date.now().toString(36)}`;

  return {
    admin,
    customer,
    tag,
    cleanup: async () => {
      // Restore the logo relation before anything referencing it is removed.
      const settings = (
        await service.from("site_settings").select("id").limit(1).maybeSingle()
      ).data;
      if (settings)
        await service
          .from("site_settings")
          .update({ org_logo_media_id: null })
          .eq("id", settings.id);

      // Articles and pages first: their sections and translations cascade.
      const articles = (
        await service
          .from("article_translations")
          .select("article_id")
          .like("slug", `${tag}%`)
      ).data;
      for (const row of articles ?? [])
        await service.from("articles").delete().eq("id", row.article_id);

      const pages = (
        await service
          .from("site_pages")
          .select("id")
          .like("page_key", `${tag}%`)
      ).data;
      for (const row of pages ?? [])
        await service.from("site_pages").delete().eq("id", row.id);

      // Then the media this run uploaded, with their storage objects.
      const media = (
        await service
          .from("media")
          .select("id,storage_bucket,storage_path")
          .like("storage_path", "media/%")
      ).data;
      for (const row of media ?? []) {
        const { data: translations } = await service
          .from("media_translations")
          .select("alt_text")
          .eq("media_id", row.id);
        const mine = (translations ?? []).some((t) =>
          String(t.alt_text ?? "").includes("[QA-P8]"),
        );
        if (!mine) continue;
        await service.from("media").delete().eq("id", row.id);
        await service.storage
          .from(String(row.storage_bucket))
          .remove([String(row.storage_path)]);
      }

      for (const persona of [customer, admin])
        await service.auth.admin.deleteUser(persona.id);
    },
  };
}
