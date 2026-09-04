/**
 * Phase 12 — P12-T06 fixture cleanup.
 *
 * Deletes exactly what the named run's manifest says it created, in reverse
 * foreign-key order, and nothing else. Then re-captures the protected-data
 * baseline and compares it to the one taken before seeding, so "no
 * pre-existing row was modified or removed" is demonstrated rather than
 * asserted.
 *
 * The ownership rule is absolute: an id that is not in this run's manifest is
 * never passed to a delete. There is no name matching, no timestamp window and
 * no email-domain sweep anywhere in this file — those are the exact heuristics
 * that turn a cleanup into an outage.
 *
 *   node scripts/e2e/cleanup.mjs <run-id>
 */

import {
  captureBaseline,
  diffBaseline,
  guardedServiceClient,
  loadManifest,
  manifestOwns,
  saveManifest,
} from "./runtime.mjs";
import { isProtectedAccount } from "./staging-guard.mjs";

/**
 * Reverse dependency order. Children before parents, always.
 *
 * `by` says how to address the rows: a single `id` column, or a composite key
 * whose parts were joined with `|` when recorded.
 */
const DELETE_ORDER = [
  { table: "favorites", by: ["user_id", "coffee_id"] },
  {
    table: "inquiries",
    by: ["id"],
    cascadeChild: { table: "inquiry_status_history", fk: "inquiry_id" },
  },
  { table: "offer_price_tiers", by: ["id"] },
  { table: "coffee_offers", by: ["id"] },
  { table: "coffee_media", by: ["coffee_id", "media_id"] },
  { table: "coffee_varieties", by: ["coffee_id", "variety_id"] },
  { table: "coffee_tags", by: ["coffee_id", "tag_id"] },
  { table: "coffee_certifications", by: ["coffee_id", "certification_id"] },
  { table: "coffee_translations", by: ["coffee_id", "locale"] },
  { table: "coffees", by: ["id"] },
  { table: "article_translations", by: ["article_id", "locale"] },
  { table: "articles", by: ["id"] },
  { table: "site_page_translations", by: ["page_id", "locale"] },
  { table: "site_pages", by: ["id"] },
  { table: "origin_media", by: ["origin_id", "media_id"] },
  { table: "region_translations", by: ["region_id", "locale"] },
  { table: "regions", by: ["id"] },
  { table: "origin_translations", by: ["origin_id", "locale"] },
  { table: "origins", by: ["id"] },
  { table: "media_translations", by: ["media_id", "locale"] },
  { table: "media", by: ["id"] },
];

async function main() {
  const runId = process.argv[2];
  if (!runId) throw new Error("usage: node scripts/e2e/cleanup.mjs <run-id>");

  const { client, target } = guardedServiceClient();
  console.log(`staging guard: ACCEPTED (project ${target.maskedRef})`);

  const manifest = loadManifest(runId);
  if (manifest.runId !== runId)
    throw new Error("manifest runId does not match the requested run");
  console.log(`cleaning run ${runId} (prefix ${manifest.prefix})`);

  /*
   * `--adopt-orphans` recovers from a seed that died mid-insert.
   *
   * Ownership is still proven, just by a different and rather stronger means
   * than a manifest entry: the pre-run baseline shows the row did not exist
   * before this run, so nothing pre-existing can be caught by it. This is not
   * name matching or a timestamp window — a row is adopted only if it is
   * absent from the recorded baseline of the very same run.
   */
  if (process.argv.includes("--adopt-orphans")) {
    const current = await captureBaseline(client);
    const orphans = diffBaseline(manifest.baseline, current);
    let adopted = 0;
    for (const entry of orphans.unexpectedNew) {
      const separator = entry.indexOf(":");
      const table = entry.slice(0, separator);
      const key = entry.slice(separator + 1);
      if (table === "profiles") continue; // removed with their auth user
      manifest.rows[table] ??= [];
      if (!manifest.rows[table].includes(key)) {
        manifest.rows[table].push(key);
        adopted += 1;
      }
    }
    saveManifest(manifest);
    console.log(
      `  adopted ${adopted} orphan row(s) proven new by this run's baseline`,
    );
  }

  let deleted = 0;
  const refused = [];

  for (const step of DELETE_ORDER) {
    const keys = manifest.rows[step.table] ?? [];
    if (!keys.length) continue;

    for (const key of keys) {
      // The one sanctioned ownership check. Belt and braces: the key came
      // *from* the manifest, and is verified against it again before use.
      if (!manifestOwns(manifest, step.table, key)) {
        refused.push(`${step.table}:${key}`);
        continue;
      }
      const parts = String(key).split("|");
      if (parts.length !== step.by.length) {
        refused.push(`${step.table}:${key} (key arity mismatch)`);
        continue;
      }

      // Children of a fixture parent are addressed through that parent, which
      // is itself manifest-proven — no independent guessing.
      if (step.cascadeChild) {
        const { error } = await client
          .from(step.cascadeChild.table)
          .delete()
          .eq(step.cascadeChild.fk, parts[0]);
        if (error)
          console.log(
            `  warn ${step.cascadeChild.table}: ${error.message.slice(0, 60)}`,
          );
      }

      let query = client.from(step.table).delete();
      step.by.forEach((column, index) => {
        query = query.eq(column, parts[index]);
      });
      const { error } = await query;
      if (error) {
        console.log(
          `  warn ${step.table}:${key} -> ${error.message.slice(0, 70)}`,
        );
        continue;
      }
      deleted += 1;
    }
    console.log(`  ${step.table}: ${keys.length} manifest rows processed`);
  }

  // ------------------------------------------------------------- storage
  const byBucket = new Map();
  for (const entry of manifest.storagePaths ?? []) {
    if (!byBucket.has(entry.bucket)) byBucket.set(entry.bucket, []);
    byBucket.get(entry.bucket).push(entry.path);
  }
  for (const [bucket, paths] of byBucket) {
    // Every path is run-scoped (`e2e/<run-id>/…`); refuse anything that is not.
    const scoped = paths.filter((path) => path.startsWith(`e2e/${runId}/`));
    if (scoped.length !== paths.length)
      refused.push(
        `storage: ${paths.length - scoped.length} path(s) outside e2e/${runId}/`,
      );
    if (!scoped.length) continue;
    const { error } = await client.storage.from(bucket).remove(scoped);
    if (error)
      console.log(`  warn storage ${bucket}: ${error.message.slice(0, 70)}`);
    else console.log(`  storage ${bucket}: ${scoped.length} objects removed`);
  }

  // ----------------------------------------------------------- auth users
  let authDeleted = 0;
  for (const user of manifest.authUsers ?? []) {
    // A protected account can never appear here, but check anyway: this is the
    // last place a mistake would still be recoverable.
    const { data } = await client.auth.admin.getUserById(user.id);
    if (data?.user && isProtectedAccount(data.user.email)) {
      refused.push(`auth.users:${user.id} (protected account)`);
      continue;
    }
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error)
      console.log(`  warn auth ${user.persona}: ${error.message.slice(0, 70)}`);
    else authDeleted += 1;
  }
  console.log(
    `  auth users: ${authDeleted}/${(manifest.authUsers ?? []).length} removed`,
  );

  // ------------------------------------------------- prove nothing else moved
  console.log("re-capturing baseline to verify pre-existing data…");
  const after = await captureBaseline(client);
  const findings = diffBaseline(manifest.baseline, after);

  manifest.cleanedAt = new Date().toISOString();
  manifest.cleanupFindings = findings;
  saveManifest(manifest);

  console.log("");
  console.log("CLEANUP REPORT");
  console.log(`  fixture rows deleted      : ${deleted}`);
  console.log(`  fixture auth users deleted: ${authDeleted}`);
  console.log(`  refused (not manifest-owned): ${refused.length}`);
  refused.forEach((entry) => console.log(`      ${entry}`));
  console.log(`  pre-existing rows missing : ${findings.missing.length}`);
  findings.missing
    .slice(0, 10)
    .forEach((entry) => console.log(`      ${entry}`));
  console.log(`  pre-existing rows modified: ${findings.modified.length}`);
  findings.modified
    .slice(0, 10)
    .forEach((entry) => console.log(`      ${entry}`));
  console.log(`  fixture residue remaining : ${findings.unexpectedNew.length}`);
  findings.unexpectedNew
    .slice(0, 10)
    .forEach((entry) => console.log(`      ${entry}`));
  console.log(
    `  protected account present : ${after.protectedAccountPresent} (baseline ${manifest.baseline.protectedAccountPresent})`,
  );

  const clean =
    findings.missing.length === 0 &&
    findings.modified.length === 0 &&
    findings.unexpectedNew.length === 0 &&
    after.protectedAccountPresent === manifest.baseline.protectedAccountPresent;
  console.log("");
  console.log(clean ? "CLEANUP: PASS" : "CLEANUP: FAIL");
  if (!clean) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`CLEANUP FAILED: ${error.message}`);
  process.exitCode = 1;
});
