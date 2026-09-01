/**
 * Phase 6 — owner-approved QA/demo reference data.
 *
 * Creates the SMALL, connected reference dataset the Admin catalog flow needs
 * in order to be exercised at all: the database had 0 origins, 0 regions, 0
 * varieties, 0 sensory notes and 0 tags, so Coffee/Offer/Pricing could not be
 * created through the UI even with a correct form.
 *
 * Everything it writes is namespaced `qa-p6-*` by slug and `[QA P6]` by name,
 * so the owner can identify and remove it later. It is idempotent: re-running
 * upserts the same rows rather than duplicating them.
 *
 * The first QA coffee, its images, offer and price tiers were created through
 * the Admin UI by `tests/e2e/admin-catalog.spec.ts` — that run is the proof the
 * flow works, rather than a script bypassing it. This script seeds the
 * reference data that flow depends on, plus one *second* connected coffee and
 * offer so the owner has more than a single row to exercise filtering,
 * pagination and the offer/pricing screens against.
 *
 *   node scripts/seed-qa-catalog.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line
    .slice(i + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}
const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
url.pathname = "/";
const db = createClient(
  url.toString().replace(/\/$/, ""),
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const created = [];
const note = (table, id, slug, purpose) =>
  created.push({ table, id, slug, purpose });

async function upsertBySlug(table, slug, values) {
  const { data: existing } = await db
    .from(table)
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    if (Object.keys(values).length) {
      const { error } = await db
        .from(table)
        .update(values)
        .eq("id", existing.id);
      if (error) throw new Error(`${table}/${slug}: ${error.message}`);
    }
    return existing.id;
  }
  const { data, error } = await db
    .from(table)
    .insert({ slug, ...values })
    .select("id")
    .single();
  if (error) throw new Error(`${table}/${slug}: ${error.message}`);
  return data.id;
}

async function upsertTranslations(table, ownerColumn, ownerId, rows) {
  const { error } = await db.from(table).upsert(
    rows.map((row) => ({ [ownerColumn]: ownerId, ...row })),
    { onConflict: `${ownerColumn},locale` },
  );
  if (error) throw new Error(`${table}: ${error.message}`);
}

// ---------------------------------------------------------------- origins
const origins = [
  {
    slug: "qa-p6-ethiopia",
    country_code: "ET",
    continent: "Africa",
    en: "[QA P6] Ethiopia",
    ar: "[QA P6] إثيوبيا",
    summaryEn: "Birthplace of arabica, known for floral and citrus cups.",
    summaryAr: "موطن البن العربي، ويشتهر بنكهات زهرية وحمضية.",
  },
  {
    slug: "qa-p6-brazil",
    country_code: "BR",
    continent: "South America",
    en: "[QA P6] Brazil",
    ar: "[QA P6] البرازيل",
    summaryEn: "The largest producing origin, known for chocolate and nut.",
    summaryAr: "أكبر منشأ منتج، ويشتهر بنكهات الشوكولاتة والمكسرات.",
  },
];
const originIds = {};
for (const origin of origins) {
  const id = await upsertBySlug("origins", origin.slug, {
    country_code: origin.country_code,
    continent: origin.continent,
    is_active: true,
  });
  originIds[origin.slug] = id;
  await upsertTranslations("origin_translations", "origin_id", id, [
    { locale: "en", name: origin.en, summary: origin.summaryEn },
    { locale: "ar", name: origin.ar, summary: origin.summaryAr },
  ]);
  note("origins", id, origin.slug, "QA origin for the Phase 6 catalog flow");
}

// ---------------------------------------------------------------- regions
const regions = [
  {
    slug: "qa-p6-sidama",
    origin: "qa-p6-ethiopia",
    en: "[QA P6] Sidama",
    ar: "[QA P6] سيداما",
  },
  {
    slug: "qa-p6-minas-gerais",
    origin: "qa-p6-brazil",
    en: "[QA P6] Minas Gerais",
    ar: "[QA P6] ميناس جيرايس",
  },
];
for (const region of regions) {
  const id = await upsertBySlug("regions", region.slug, {
    origin_id: originIds[region.origin],
    is_active: true,
  });
  await upsertTranslations("region_translations", "region_id", id, [
    { locale: "en", name: region.en },
    { locale: "ar", name: region.ar },
  ]);
  note(
    "regions",
    id,
    region.slug,
    `QA region under ${region.origin} (proves origin-dependent region filtering)`,
  );
}

// -------------------------------------------------------------- varieties
// `varieties` carries a plain `name` column and has NO variety_translations
// table in the live schema, so it is English-only by contract (recorded as a
// Phase 6 database gap rather than migrated around).
for (const variety of [
  { slug: "qa-p6-heirloom", name: "[QA P6] Heirloom" },
  { slug: "qa-p6-bourbon", name: "[QA P6] Bourbon" },
]) {
  const id = await upsertBySlug("varieties", variety.slug, {
    name: variety.name,
    is_active: true,
  });
  note("varieties", id, variety.slug, "QA variety (English-only by schema)");
}

// --------------------------------------------------------- sensory notes
// Sensory notes attach to OFFERS (`offer_sensory_notes`); there is no
// coffee_sensory_notes table in the live schema.
for (const sensory of [
  {
    slug: "qa-p6-chocolate",
    category: "sweet",
    en: "[QA P6] Chocolate",
    ar: "[QA P6] شوكولاتة",
  },
  {
    slug: "qa-p6-citrus",
    category: "fruity",
    en: "[QA P6] Citrus",
    ar: "[QA P6] حمضيات",
  },
  {
    slug: "qa-p6-floral",
    category: "floral",
    en: "[QA P6] Floral",
    ar: "[QA P6] زهرية",
  },
]) {
  const id = await upsertBySlug("sensory_notes", sensory.slug, {
    category: sensory.category,
    is_active: true,
  });
  await upsertTranslations("sensory_note_translations", "sensory_note_id", id, [
    { locale: "en", name: sensory.en },
    { locale: "ar", name: sensory.ar },
  ]);
  note(
    "sensory_notes",
    id,
    sensory.slug,
    "QA sensory note (attaches to offers)",
  );
}

// ------------------------------------------------------------------- tags
for (const tag of [
  {
    slug: "qa-p6-single-origin",
    en: "[QA P6] Single origin",
    ar: "[QA P6] منشأ واحد",
  },
  {
    slug: "qa-p6-high-altitude",
    en: "[QA P6] High altitude",
    ar: "[QA P6] ارتفاع عالٍ",
  },
]) {
  const id = await upsertBySlug("tags", tag.slug, { is_active: true });
  await upsertTranslations("tag_translations", "tag_id", id, [
    { locale: "en", name: tag.en },
    { locale: "ar", name: tag.ar },
  ]);
  note("tags", id, tag.slug, "QA tag");
}

// ------------------------------------------------ warehouse translations
// The two warehouses already existed but had ZERO translation rows, so Arabic
// Admin screens fell back to the English base-table name. This is a real
// bilingual gap being closed, not demo data.
const { data: warehouses } = await db
  .from("warehouses")
  .select("id,code,name,city");
const warehouseCopy = {
  EGYPT: {
    en: "Egypt Warehouse",
    ar: "مخزن مصر",
    cityEn: "Cairo",
    cityAr: "القاهرة",
  },
  DUBAI: {
    en: "Dubai Warehouse",
    ar: "مخزن دبي",
    cityEn: "Dubai",
    cityAr: "دبي",
  },
};
for (const warehouse of warehouses ?? []) {
  const copy = warehouseCopy[warehouse.code];
  if (!copy) continue;
  await upsertTranslations(
    "warehouse_translations",
    "warehouse_id",
    warehouse.id,
    [
      { locale: "en", name: copy.en, city: copy.cityEn },
      { locale: "ar", name: copy.ar, city: copy.cityAr },
    ],
  );
  note(
    "warehouse_translations",
    warehouse.id,
    warehouse.code,
    "Arabic/English warehouse names (closes a real bilingual gap; not demo data)",
  );
}

console.log(JSON.stringify(created, null, 1));
console.log(`\nSeeded ${created.length} reference rows.`);

// ------------------------------------------------- second connected coffee
// The first QA coffee, its images, offer and price tiers were created through
// the Admin UI by `tests/e2e/admin-catalog.spec.ts` — that is the proof the
// flow works. This second one is seeded so the owner has more than one row to
// exercise filtering, pagination and the offer/pricing screens against.
const { data: brazilRegion } = await db
  .from("regions")
  .select("id")
  .eq("slug", "qa-p6-minas-gerais")
  .maybeSingle();
const { data: specialty } = await db
  .from("coffee_types")
  .select("id")
  .eq("slug", "commercial")
  .maybeSingle();
const { data: natural } = await db
  .from("processing_methods")
  .select("id")
  .eq("slug", "natural")
  .maybeSingle();

const secondSlug = "qa-p6-minas-natural";
const coffeeId = await upsertBySlug("coffees", secondSlug, {
  coffee_type_id: specialty.id,
  origin_id: originIds["qa-p6-brazil"],
  region_id: brazilRegion.id,
  processing_method_id: natural.id,
  grade: "Fine Cup 17/18",
  status: "PUBLISHED",
  published_at: new Date().toISOString(),
});
await upsertTranslations("coffee_translations", "coffee_id", coffeeId, [
  {
    locale: "en",
    name: "[QA P6] Minas Gerais Natural",
    short_description: "Chocolate and nut, natural Minas Gerais.",
  },
  {
    locale: "ar",
    name: "[QA P6] ميناس جيرايس الطبيعية",
    short_description: "شوكولاتة ومكسرات، ميناس جيرايس بالمعالجة الطبيعية.",
  },
]);
note("coffees", coffeeId, secondSlug, "QA coffee #2 (PUBLISHED)");

// A 1x1 PNG, enough for the card and gallery to render a real object.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const { data: existingMedia } = await db
  .from("coffee_media")
  .select("media_id")
  .eq("coffee_id", coffeeId);
if (!existingMedia?.length) {
  const storagePath = `coffees/${coffeeId}/${crypto.randomUUID()}.png`;
  const upload = await db.storage
    .from("hills-public")
    .upload(storagePath, TINY_PNG, { contentType: "image/png", upsert: false });
  if (upload.error) throw new Error(`upload: ${upload.error.message}`);
  const { data: media, error: mediaError } = await db
    .from("media")
    .insert({
      storage_bucket: "hills-public",
      storage_path: storagePath,
      mime_type: "image/png",
      file_size_bytes: TINY_PNG.length,
      is_public: true,
    })
    .select("id")
    .single();
  if (mediaError) throw new Error(`media: ${mediaError.message}`);
  await upsertTranslations("media_translations", "media_id", media.id, [
    { locale: "en", alt_text: "[QA P6] Minas Gerais Natural" },
    { locale: "ar", alt_text: "[QA P6] ميناس جيرايس الطبيعية" },
  ]);
  const { error: linkError } = await db.from("coffee_media").insert({
    coffee_id: coffeeId,
    media_id: media.id,
    role: "MAIN",
    sort_order: 0,
  });
  if (linkError) throw new Error(`coffee_media: ${linkError.message}`);
  note("media", media.id, storagePath, "QA coffee #2 main image");
}

const { data: dubai } = await db
  .from("warehouses")
  .select("id")
  .eq("code", "DUBAI")
  .maybeSingle();
const offerReference = "QA-P6-DXB-0001";
const { data: existingOffer } = await db
  .from("coffee_offers")
  .select("id")
  .eq("reference_number", offerReference)
  .maybeSingle();
let offerId = existingOffer?.id;
if (!offerId) {
  const { data: offer, error: offerError } = await db
    .from("coffee_offers")
    .insert({
      coffee_id: coffeeId,
      warehouse_id: dubai.id,
      reference_number: offerReference,
      bags_quantity: 480,
      bag_weight_kg: 60,
      status: "NEW_ARRIVAL",
      cup_score: 83,
      // The live schema pins both of these to one legal value.
      currency_code: "USD",
      pricing_unit: "KG",
      is_visible: true,
    })
    .select("id")
    .single();
  if (offerError) throw new Error(`offer: ${offerError.message}`);
  offerId = offer.id;
}
note("coffee_offers", offerId, offerReference, "QA offer #2 (Dubai)");

const { data: chocolate } = await db
  .from("sensory_notes")
  .select("id")
  .eq("slug", "qa-p6-chocolate")
  .maybeSingle();
if (chocolate)
  await db
    .from("offer_sensory_notes")
    .upsert([{ offer_id: offerId, sensory_note_id: chocolate.id }], {
      onConflict: "offer_id,sensory_note_id",
    });

// A descending ladder: a larger commitment never costs more per kilo.
for (const [minBags, price] of [
  [1, 5.9],
  [200, 5.25],
]) {
  const { data: existingTier } = await db
    .from("offer_price_tiers")
    .select("id")
    .eq("offer_id", offerId)
    .eq("min_bags", minBags)
    .maybeSingle();
  if (existingTier) {
    note(
      "offer_price_tiers",
      existingTier.id,
      `min_bags=${minBags}`,
      `QA price $${price}/kg`,
    );
    continue;
  }
  const { data: tier, error: tierError } = await db
    .from("offer_price_tiers")
    .insert({ offer_id: offerId, min_bags: minBags, price_per_kg_usd: price })
    .select("id")
    .single();
  if (tierError) throw new Error(`tier ${minBags}: ${tierError.message}`);
  note(
    "offer_price_tiers",
    tier.id,
    `min_bags=${minBags}`,
    `QA price $${price}/kg`,
  );
}

console.log(`\nCatalog seed complete: ${created.length} tracked rows.`);
