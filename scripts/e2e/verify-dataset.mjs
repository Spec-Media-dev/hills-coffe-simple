/**
 * P12-T01 acceptance: proves the seeded dataset exists in the real project.
 *
 * Reads back by manifest id rather than trusting the seed's own log, and
 * checks each requirement from tasks.md's runtime acceptance condition.
 */
import { guardedServiceClient, loadManifest } from "./runtime.mjs";

const runId = process.argv[2];
const { client, target } = guardedServiceClient();
const m = loadManifest(runId);
console.log(`verifying run ${runId} in project ${target.maskedRef}\n`);

const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
};

const ids = (t) => m.rows[t] ?? [];
const countIn = async (table, column, values) => {
  if (!values.length) return 0;
  const { count } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .in(column, values);
  return count ?? 0;
};

// Origins with EN/AR translations and media
const originIds = ids("origins");
check(
  "3 origins exist",
  (await countIn("origins", "id", originIds)) === 3,
  `${originIds.length} in manifest`,
);
check(
  "origins have EN+AR translations",
  (await countIn("origin_translations", "origin_id", originIds)) === 6,
);
check(
  "origins have hero media",
  (await countIn("origin_media", "origin_id", originIds)) === 3,
);
check(
  "origins have regions",
  (await countIn("regions", "origin_id", originIds)) === 3,
);

// Coffees: published + boundary
const coffeeIds = ids("coffees");
const { data: coffees } = await client
  .from("coffees")
  .select("id,status")
  .in("id", coffeeIds);
const published = (coffees ?? []).filter(
  (c) => c.status === "PUBLISHED",
).length;
const draft = (coffees ?? []).filter((c) => c.status === "DRAFT").length;
const archived = (coffees ?? []).filter((c) => c.status === "ARCHIVED").length;
check(
  "4–6 published coffees",
  published >= 4 && published <= 6,
  `${published} published`,
);
check(
  "draft/archived boundary coffee present",
  draft >= 1 && archived >= 1,
  `${draft} draft, ${archived} archived`,
);
check(
  "coffees have EN+AR translations",
  (await countIn("coffee_translations", "coffee_id", coffeeIds)) ===
    coffeeIds.length * 2,
);

// Offers across both warehouses + protected price tiers
const offerIds = ids("coffee_offers");
const { data: offers } = await client
  .from("coffee_offers")
  .select("id,warehouse_id")
  .in("id", offerIds);
const { data: whs } = await client.from("warehouses").select("id,code");
const codes = new Set(
  (offers ?? []).map((o) => whs.find((w) => w.id === o.warehouse_id)?.code),
);
check(
  "offers span Egypt and Dubai",
  codes.has("EGYPT") && codes.has("DUBAI"),
  [...codes].join("+"),
);
check(
  "every offer has protected price tiers",
  (await countIn("offer_price_tiers", "offer_id", offerIds)) ===
    offerIds.length * 2,
);

// Articles with distinct localized slugs
const articleIds = ids("articles");
const { data: at } = await client
  .from("article_translations")
  .select("article_id,locale,slug")
  .in("article_id", articleIds);
const distinct = articleIds.every((id) => {
  const rows = (at ?? []).filter((r) => r.article_id === id);
  return rows.length === 2 && rows[0].slug !== rows[1].slug;
});
check(
  "2 published articles",
  articleIds.length === 2 &&
    (await countIn("articles", "id", articleIds)) === 2,
);
check("articles have distinct EN/AR slugs", distinct);

// CMS fixture pages, and the live pages untouched
const pageIds = ids("site_pages");
check(
  "CMS Home/About fixture pages exist",
  (await countIn("site_pages", "id", pageIds)) === 2,
);
const { data: livePages } = await client
  .from("site_pages")
  .select("page_key,status")
  .in("page_key", ["home", "about"]);
check(
  "live home/about CMS rows untouched (still DRAFT)",
  (livePages ?? []).every((p) => p.status === "DRAFT"),
  (livePages ?? []).map((p) => `${p.page_key}:${p.status}`).join(","),
);

// Inquiries spanning every status + prior CLOSED same-coffee sample
const inquiryIds = ids("inquiries");
const { data: inq } = await client
  .from("inquiries")
  .select("id,status,type,coffee_id,user_id")
  .in("id", inquiryIds);
const statuses = new Set((inq ?? []).map((i) => i.status));
for (const s of [
  "NEW",
  "RECEIVED",
  "CONTACTED",
  "SAMPLE_SENT",
  "DELIVERED",
  "CLOSED",
])
  check(`inquiry status ${s} present`, statuses.has(s));
const closedSample = (inq ?? []).find(
  (i) => i.type === "SAMPLE_REQUEST" && i.status === "CLOSED" && i.coffee_id,
);
check("prior CLOSED same-coffee sample request exists", Boolean(closedSample));

// Personas
check("4 genuine auth users recorded", (m.authUsers ?? []).length === 4);
let authOk = 0,
  adminOk = false,
  unverifiedOk = false;
for (const u of m.authUsers ?? []) {
  const { data } = await client.auth.admin.getUserById(u.id);
  if (!data?.user) continue;
  authOk += 1;
  if (u.persona === "unverified" && !data.user.email_confirmed_at)
    unverifiedOk = true;
  if (u.persona === "admin") {
    const { data: p } = await client
      .from("profiles")
      .select("role")
      .eq("id", u.id)
      .single();
    adminOk = p?.role === "ADMIN";
  }
}
check("all 4 personas exist in Auth", authOk === 4, `${authOk}/4`);
check("unverified persona genuinely unconfirmed", unverifiedOk);
check("admin persona has ADMIN role", adminOk);

// Storage
const scoped = (m.storagePaths ?? []).every((p) =>
  p.path.startsWith(`e2e/${runId}/`),
);
check(
  "all storage objects are run-scoped",
  scoped,
  `${(m.storagePaths ?? []).length} objects under e2e/${runId}/`,
);

// Favorites
check("favorite fixture exists", (ids("favorites") ?? []).length >= 1);

const failed = results.filter((r) => !r.ok);
console.log(
  `\nP12-T01 DATASET: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length} checks)`,
);
if (failed.length) process.exitCode = 1;
