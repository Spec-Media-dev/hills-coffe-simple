/**
 * Phase 12 — P12-T01 fixture seed.
 *
 * Creates the five personas and the minimum dataset tasks.md requires, all of
 * it new and all of it recorded in a run manifest before anything else can
 * touch it. Nothing that already existed in the project is written to: static
 * reference data (warehouses, coffee types, processing methods, varieties,
 * tags, certifications, sensory notes, article categories) is consumed
 * read-only, exactly as the owner's data-protection rule permits.
 *
 * Two deliberate departures from a naive reading of the dataset list, both
 * because the alternative would mutate protected data:
 *
 *  - **CMS Home/About.** `getSitePage()` resolves by `page_key`, so inserting a
 *    row keyed `home` would silently replace the live home page for every
 *    visitor for the duration of the run. The fixture pages therefore use
 *    run-scoped keys, which exercises the same CMS rendering path without
 *    hijacking a real route.
 *  - **The temporary logo.** The logo is `site_settings.org_logo_media_id` on a
 *    single global row. Pointing it at a fixture asset would be a mutation of
 *    pre-existing data, so the seed creates the isolated media object and
 *    stops there; attaching it is left as an explicit owner decision.
 *
 *   node scripts/e2e/seed.mjs
 */

import sharp from "sharp";
import {
  captureBaseline,
  CURRENT_POINTER,
  guardedServiceClient,
  newManifest,
  recordAuthUser,
  recordRow,
  recordStoragePath,
  saveManifest,
} from "./runtime.mjs";
import { assertNotProtectedAccount } from "./staging-guard.mjs";

const BUCKET = "hills-public";

const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const P = `e2e-hills-${runId}`; // slug prefix
const LABEL = `E2E-HILLS-${runId}`; // human-visible prefix

/** Fixture passwords never appear in output; they live only in the manifest-free runtime. */
const PASSWORD = `E2E-${Math.random().toString(36).slice(2)}!Aa9`;

const log = (...parts) => console.log(...parts);

async function main() {
  const { client, target } = guardedServiceClient();
  log(
    `staging guard: ACCEPTED (project ${target.maskedRef}, ${target.environment})`,
  );
  log(`run id: ${runId}   fixture prefix: ${LABEL}`);

  log("capturing pre-existing baseline…");
  const baseline = await captureBaseline(client);
  log(
    `  baseline: ${Object.values(baseline.counts).reduce((a, b) => a + b, 0)} rows across ${Object.keys(baseline.counts).length} tables, ${baseline.authUserCount} auth users` +
      `, protected account present: ${baseline.protectedAccountPresent}`,
  );

  const manifest = newManifest(runId, target);
  manifest.baseline = baseline;
  saveManifest(manifest);
  log(`  manifest written before any fixture exists`);

  const must = (label, { data, error }) => {
    if (error) throw new Error(`${label}: ${error.message}`);
    return data;
  };

  // ---------------------------------------------------------------- personas
  const personas = {};
  for (const [name, confirmed, role] of [
    ["unverified", false, "USER"],
    ["verified", true, "USER"],
    ["blocked", true, "USER"],
    ["admin", true, "ADMIN"],
  ]) {
    const email = `${P}-${name}@example.com`;
    assertNotProtectedAccount(email, "create");
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: confirmed,
      user_metadata: { full_name: `${LABEL} ${name}`, phone: "+201000000000" },
    });
    if (error) throw new Error(`persona ${name}: ${error.message}`);
    personas[name] = { id: data.user.id, email };
    recordAuthUser(manifest, name, data.user.id, email);
    recordRow(manifest, "profiles", data.user.id);
    saveManifest(manifest);

    // The profile row is created by a trigger; set role only for the Admin.
    if (role === "ADMIN")
      must(
        `admin role`,
        await client.from("profiles").update({ role }).eq("id", data.user.id),
      );
  }
  log(`personas: 4 genuine Auth users created (+ Anonymous needs none)`);

  // -------------------------------------------------------- reference lookup
  const ref = async (table) =>
    (await client.from(table).select("id,slug").limit(10)).data ?? [];
  const types = await ref("coffee_types");
  const processes = await ref("processing_methods");
  const packaging = await ref("packaging_types");
  const varieties = await ref("varieties");
  const tags = await ref("tags");
  const certs = await ref("certifications");
  const categories = await ref("article_categories");
  const warehouses =
    (await client.from("warehouses").select("id,code").limit(10)).data ?? [];
  const egypt = warehouses.find((w) => w.code === "EGYPT");
  const dubai = warehouses.find((w) => w.code === "DUBAI");
  if (!egypt || !dubai)
    throw new Error("EGYPT/DUBAI warehouses are required and were not found");
  log(`reference data resolved read-only (warehouses EGYPT + DUBAI present)`);

  // ------------------------------------------------------------------ media
  async function makeMedia(name, alt, tint) {
    const buffer = await sharp({
      create: {
        width: 480,
        height: 360,
        channels: 3,
        background: tint,
      },
    })
      .webp({ quality: 70 })
      .toBuffer();
    const path = `e2e/${runId}/${name}.webp`;
    const up = await client.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "image/webp", upsert: false });
    if (up.error) throw new Error(`storage ${path}: ${up.error.message}`);
    recordStoragePath(manifest, BUCKET, path);

    const media = must(
      `media ${name}`,
      await client
        .from("media")
        .insert({
          storage_bucket: BUCKET,
          storage_path: path,
          mime_type: "image/webp",
          width: 480,
          height: 360,
          file_size_bytes: buffer.length,
          is_public: true,
        })
        .select("id")
        .single(),
    );
    recordRow(manifest, "media", media.id);
    for (const [locale, text] of [
      ["en", alt],
      ["ar", `${alt} (AR)`],
    ]) {
      must(
        `media_translations ${name}/${locale}`,
        await client
          .from("media_translations")
          .insert({ media_id: media.id, locale, alt_text: text }),
      );
      recordRow(manifest, "media_translations", `${media.id}|${locale}`);
    }
    return media.id;
  }

  // ---------------------------------------------------------------- origins
  const originIds = [];
  const originSpecs = [
    [
      "ethiopia",
      "Ethiopia",
      "إثيوبيا",
      "Africa",
      "ET",
      { r: 120, g: 90, b: 60 },
    ],
    [
      "colombia",
      "Colombia",
      "كولومبيا",
      "South America",
      "CO",
      { r: 90, g: 110, b: 70 },
    ],
    ["yemen", "Yemen", "اليمن", "Asia", "YE", { r: 140, g: 110, b: 80 }],
  ];
  for (const [key, en, ar, continent, country, tint] of originSpecs) {
    const origin = must(
      `origin ${key}`,
      await client
        .from("origins")
        .insert({
          slug: `${P}-${key}`,
          country_code: country,
          continent,
          is_active: true,
        })
        .select("id")
        .single(),
    );
    recordRow(manifest, "origins", origin.id);
    originIds.push(origin.id);

    for (const [locale, name] of [
      ["en", `${LABEL} ${en}`],
      ["ar", `${LABEL} ${ar}`],
    ]) {
      must(
        `origin_translations ${key}/${locale}`,
        await client.from("origin_translations").insert({
          origin_id: origin.id,
          locale,
          name,
          summary:
            locale === "en"
              ? `Fixture origin for Phase 12 (${en}).`
              : `منشأ اختباري للمرحلة ١٢ (${ar}).`,
          sourcing_story:
            locale === "en" ? "Fixture sourcing story." : "قصة توريد اختبارية.",
          cultivation_processing:
            locale === "en" ? "Fixture cultivation." : "زراعة اختبارية.",
        }),
      );
      recordRow(manifest, "origin_translations", `${origin.id}|${locale}`);
    }

    const mediaId = await makeMedia(
      `origin-${key}`,
      `${en} fixture origin`,
      tint,
    );
    must(
      `origin_media ${key}`,
      await client.from("origin_media").insert({
        origin_id: origin.id,
        media_id: mediaId,
        role: "HERO",
        sort_order: 0,
      }),
    );
    recordRow(manifest, "origin_media", `${origin.id}|${mediaId}`);

    const region = must(
      `region ${key}`,
      await client
        .from("regions")
        .insert({
          origin_id: origin.id,
          slug: `${P}-${key}-region`,
          is_active: true,
        })
        .select("id")
        .single(),
    );
    recordRow(manifest, "regions", region.id);
    for (const [locale, name] of [
      ["en", `${LABEL} ${en} Region`],
      ["ar", `${LABEL} منطقة ${ar}`],
    ]) {
      must(
        `region_translations ${key}/${locale}`,
        await client
          .from("region_translations")
          .insert({ region_id: region.id, locale, name }),
      );
      recordRow(manifest, "region_translations", `${region.id}|${locale}`);
    }
    saveManifest(manifest);
  }
  log(
    `origins: 3 created with EN/AR translations, hero media and a region each`,
  );

  // ---------------------------------------------------------------- coffees
  const coffeeIds = [];
  const coffeeSpecs = [
    ["alpha", "PUBLISHED"],
    ["bravo", "PUBLISHED"],
    ["charlie", "PUBLISHED"],
    ["delta", "PUBLISHED"],
    ["echo", "PUBLISHED"],
    ["boundary-draft", "DRAFT"],
    ["boundary-archived", "ARCHIVED"],
  ];
  for (const [key, status] of coffeeSpecs) {
    const originId = originIds[coffeeIds.length % originIds.length];
    const coffee = must(
      `coffee ${key}`,
      await client
        .from("coffees")
        .insert({
          slug: `${P}-${key}`,
          coffee_type_id: types[0].id,
          origin_id: originId,
          processing_method_id: processes[0].id,
          status,
          grade: "Fixture Grade 17/18",
          published_at:
            status === "PUBLISHED" ? new Date().toISOString() : null,
        })
        .select("id")
        .single(),
    );
    recordRow(manifest, "coffees", coffee.id);
    coffeeIds.push(coffee.id);

    for (const [locale, name] of [
      ["en", `${LABEL} Coffee ${key}`],
      ["ar", `${LABEL} قهوة ${key}`],
    ]) {
      must(
        `coffee_translations ${key}/${locale}`,
        await client.from("coffee_translations").insert({
          coffee_id: coffee.id,
          locale,
          name,
          short_description:
            locale === "en"
              ? "Phase 12 fixture coffee."
              : "قهوة اختبارية للمرحلة ١٢.",
        }),
      );
      recordRow(manifest, "coffee_translations", `${coffee.id}|${locale}`);
    }

    if (status === "PUBLISHED") {
      const mediaId = await makeMedia(
        `coffee-${key}`,
        `${key} fixture coffee`,
        {
          r: 100,
          g: 120,
          b: 80,
        },
      );
      must(
        `coffee_media ${key}`,
        // `coffee_media_role` rejects HERO; the coffee table's main-image
        // role is MAIN (origin_media is the one that uses HERO).
        await client.from("coffee_media").insert({
          coffee_id: coffee.id,
          media_id: mediaId,
          role: "MAIN",
          sort_order: 0,
        }),
      );
      recordRow(manifest, "coffee_media", `${coffee.id}|${mediaId}`);
    }

    if (varieties[0]) {
      must(
        `coffee_varieties ${key}`,
        await client
          .from("coffee_varieties")
          .insert({ coffee_id: coffee.id, variety_id: varieties[0].id }),
      );
      recordRow(
        manifest,
        "coffee_varieties",
        `${coffee.id}|${varieties[0].id}`,
      );
    }
    if (tags[0]) {
      must(
        `coffee_tags ${key}`,
        await client
          .from("coffee_tags")
          .insert({ coffee_id: coffee.id, tag_id: tags[0].id }),
      );
      recordRow(manifest, "coffee_tags", `${coffee.id}|${tags[0].id}`);
    }
    if (certs[0]) {
      must(
        `coffee_certifications ${key}`,
        await client
          .from("coffee_certifications")
          .insert({ coffee_id: coffee.id, certification_id: certs[0].id }),
      );
      recordRow(
        manifest,
        "coffee_certifications",
        `${coffee.id}|${certs[0].id}`,
      );
    }
    saveManifest(manifest);
  }
  log(`coffees: 5 published + 1 DRAFT + 1 ARCHIVED boundary record`);

  // ----------------------------------------------------------------- offers
  const offerIds = [];
  let counter = 0;
  for (const warehouse of [egypt, dubai, egypt, dubai]) {
    const coffeeId = coffeeIds[counter % 5]; // published coffees only
    const offer = must(
      `offer ${counter}`,
      await client
        .from("coffee_offers")
        .insert({
          coffee_id: coffeeId,
          warehouse_id: warehouse.id,
          reference_number: `${LABEL}-OFF-${counter + 1}`,
          bags_quantity: 120 + counter * 10,
          bag_weight_kg: 60,
          packaging_type_id: packaging[0]?.id ?? null,
          status: "IN_STORE",
          cup_score: 84 + counter,
          currency_code: "USD",
          pricing_unit: "KG",
          is_visible: true,
        })
        .select("id")
        .single(),
    );
    recordRow(manifest, "coffee_offers", offer.id);
    offerIds.push(offer.id);

    for (const [minBags, price] of [
      [1, 7.5 + counter * 0.25],
      [100, 6.75 + counter * 0.25],
    ]) {
      const tier = must(
        `price tier ${counter}/${minBags}`,
        await client
          .from("offer_price_tiers")
          .insert({
            offer_id: offer.id,
            min_bags: minBags,
            price_per_kg_usd: price,
          })
          .select("id")
          .single(),
      );
      recordRow(manifest, "offer_price_tiers", tier.id);
    }
    counter += 1;
    saveManifest(manifest);
  }
  log(
    `offers: 4 created across Egypt and Dubai, each with 2 protected price tiers`,
  );

  // --------------------------------------------------------------- articles
  for (const [key, enTitle, arTitle] of [
    ["guide", "Phase 12 Fixture Guide", "دليل اختباري للمرحلة ١٢"],
    ["report", "Phase 12 Fixture Report", "تقرير اختباري للمرحلة ١٢"],
  ]) {
    const mediaId = await makeMedia(
      `article-${key}`,
      `${key} fixture article`,
      {
        r: 80,
        g: 100,
        b: 120,
      },
    );
    const article = must(
      `article ${key}`,
      await client
        .from("articles")
        .insert({
          category_id: categories[0]?.id ?? null,
          featured_media_id: mediaId,
          status: "PUBLISHED",
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
    );
    recordRow(manifest, "articles", article.id);
    for (const [locale, title, slug] of [
      ["en", `${LABEL} ${enTitle}`, `${P}-${key}-en`],
      ["ar", `${LABEL} ${arTitle}`, `${P}-${key}-ar`],
    ]) {
      must(
        `article_translations ${key}/${locale}`,
        await client.from("article_translations").insert({
          article_id: article.id,
          locale,
          slug,
          title,
          excerpt: locale === "en" ? "Fixture excerpt." : "مقتطف اختباري.",
          body_markdown:
            locale === "en"
              ? "## Fixture body\n\nPhase 12."
              : "## نص اختباري\n\nالمرحلة ١٢.",
        }),
      );
      recordRow(manifest, "article_translations", `${article.id}|${locale}`);
    }
    saveManifest(manifest);
  }
  log(
    `articles: 2 published with EN/AR translations and distinct localized slugs`,
  );

  // -------------------------------------------------------------- CMS pages
  /*
   * `template` is a fixed vocabulary (HOME, ABOUT, COMMERCIAL, …) and
   * `route_path` is constrained to a trailing slash. The page_key stays
   * run-scoped: a `home` key already exists (as DRAFT), so reusing it would
   * both collide on the unique index and hijack the live route if published.
   */
  for (const [key, template, enTitle, arTitle] of [
    ["home", "HOME", "Fixture Home", "الرئيسية الاختبارية"],
    ["about", "ABOUT", "Fixture About", "من نحن الاختبارية"],
  ]) {
    const pageKey = `${P}-${key}`;
    const page = must(
      `site_page ${key}`,
      await client
        .from("site_pages")
        .insert({
          page_key: pageKey,
          template,
          route_path: `/${pageKey}/`,
          status: "PUBLISHED",
          published_at: new Date().toISOString(),
          sort_order: 0,
          is_active: true,
        })
        .select("id")
        .single(),
    );
    recordRow(manifest, "site_pages", page.id);
    for (const [locale, title] of [
      ["en", `${LABEL} ${enTitle}`],
      ["ar", `${LABEL} ${arTitle}`],
    ]) {
      must(
        `site_page_translations ${key}/${locale}`,
        await client.from("site_page_translations").insert({
          page_id: page.id,
          locale,
          title,
          h1: title,
          summary:
            locale === "en" ? "Fixture CMS page." : "صفحة محتوى اختبارية.",
          body_markdown: locale === "en" ? "Fixture body." : "نص اختباري.",
        }),
      );
      recordRow(manifest, "site_page_translations", `${page.id}|${locale}`);
    }
    saveManifest(manifest);
  }
  log(
    `CMS: fixture Home/About pages created under run-scoped keys (live pages untouched)`,
  );

  // ---------------------------------------------- isolated logo media asset
  const logoMediaId = await makeMedia("logo", "Fixture logo", {
    r: 23,
    g: 60,
    b: 50,
  });
  manifest.notes.push(
    "Temporary logo media created and recorded, but NOT attached to site_settings.org_logo_media_id: that is a single global row and attaching would mutate protected pre-existing data. Owner approval required to exercise the logo swap.",
  );
  log(
    `logo: isolated media asset created; singleton attachment deliberately skipped`,
  );

  // -------------------------------------------------------------- favorites
  must(
    "favorite",
    await client
      .from("favorites")
      .insert({ user_id: personas.verified.id, coffee_id: coffeeIds[0] }),
  );
  recordRow(manifest, "favorites", `${personas.verified.id}|${coffeeIds[0]}`);

  // -------------------------------------------------------------- inquiries
  const statuses = [
    "NEW",
    "RECEIVED",
    "CONTACTED",
    "SAMPLE_SENT",
    "DELIVERED",
    "CLOSED",
  ];
  for (const status of statuses) {
    const inquiry = must(
      `inquiry ${status}`,
      await client
        .from("inquiries")
        .insert({
          type: "GENERAL",
          full_name: `${LABEL} Buyer`,
          email: `${P}-inq-${status.toLowerCase()}@example.com`,
          phone: "+201000000000",
          message: `Phase 12 fixture inquiry in ${status}.`,
          status,
        })
        .select("id")
        .single(),
    );
    recordRow(manifest, "inquiries", inquiry.id);
  }

  // A prior CLOSED sample request for the same coffee, so the duplicate rule's
  // "CLOSED permits a new request" branch has real history to work against.
  const closedSample = must(
    "closed sample request",
    await client
      .from("inquiries")
      .insert({
        type: "SAMPLE_REQUEST",
        user_id: personas.verified.id,
        coffee_id: coffeeIds[0],
        full_name: `${LABEL} Buyer`,
        email: personas.verified.email,
        phone: "+201000000000",
        address: "1 Fixture Street, Dubai",
        country_code: "AE",
        message: "Prior sample request, already closed.",
        status: "CLOSED",
      })
      .select("id")
      .single(),
  );
  recordRow(manifest, "inquiries", closedSample.id);
  log(
    `inquiries: 6 spanning every status + 1 prior CLOSED same-coffee sample request`,
  );

  manifest.completedAt = new Date().toISOString();
  manifest.password = "(withheld — regenerate personas to obtain a new one)";
  const path = saveManifest(manifest);

  const total = Object.values(manifest.rows).reduce((a, b) => a + b.length, 0);
  log("");
  log(`SEED COMPLETE`);
  log(`  run id           : ${runId}`);
  log(`  manifest         : ${path}`);
  log(`  auth users       : ${manifest.authUsers.length}`);
  log(`  database rows    : ${total}`);
  log(`  storage objects  : ${manifest.storagePaths.length}`);
  log(`  password         : withheld from output by design`);
  // Written to a gitignored file so Playwright can sign in for real. The
  // path is the shared constant cleanup retires, so the two cannot drift.
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    CURRENT_POINTER,
    `${JSON.stringify({ runId, password: PASSWORD, personas }, null, 2)}\n`,
  );
  log(`  credentials      : ${CURRENT_POINTER} (gitignored)`);
}

main().catch((error) => {
  console.error(`SEED FAILED: ${error.message}`);
  process.exitCode = 1;
});
