/**
 * Phase 12 — shared runtime for the fixture seed and cleanup scripts.
 *
 * Three responsibilities, deliberately kept together because they are the
 * safety story and should be read as one thing:
 *
 *  1. Build a Supabase service client only *after* the staging guard accepts
 *     the target, so no code path can obtain a writable client by accident.
 *  2. Read and write the run manifest, which is the only permitted source of
 *     truth for what cleanup may delete.
 *  3. Capture and re-verify a baseline of pre-existing data, so "we did not
 *     touch anything that was already here" is a measurement rather than a
 *     claim.
 *
 * The baseline records `id` *and* `updated_at` for every pre-existing row in
 * every table Phase 12 can write to. Comparing both afterwards catches an
 * in-place edit, which a row count alone would miss entirely.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { assertStagingTarget, isProtectedAccount } from "./staging-guard.mjs";

export const MANIFEST_DIR = join("tests", "e2e", ".p12-runs");

/**
 * The "which fixtures are live" pointer the seed writes and the suite reads.
 *
 * It carries the run id and the persona credentials, so it is both the thing
 * that tells `hasP12Fixtures` a run exists and a file that should not outlive
 * the accounts it describes.
 */
export const CURRENT_POINTER = join(MANIFEST_DIR, "current.json");

/** Every table Phase 12 may create rows in, in dependency order. */
export const SEEDED_TABLES = Object.freeze([
  "media",
  "media_translations",
  "origins",
  "origin_translations",
  "origin_media",
  "regions",
  "region_translations",
  "coffees",
  "coffee_translations",
  "coffee_media",
  "coffee_varieties",
  "coffee_tags",
  "coffee_certifications",
  "coffee_offers",
  "offer_price_tiers",
  "articles",
  "article_translations",
  "site_pages",
  "site_page_translations",
  "inquiries",
  "favorites",
  "profiles",
]);

/**
 * Tables whose pre-existing contents must be provably untouched.
 *
 * `hasUpdatedAt` drives whether the baseline can detect an in-place edit as
 * well as a deletion. Composite-key link tables have no single `id`, so they
 * are fingerprinted by their whole row instead.
 */
export const PROTECTED_TABLES = Object.freeze([
  { table: "origins", key: "id", hasUpdatedAt: true },
  { table: "origin_translations", key: "origin_id,locale", hasUpdatedAt: true },
  { table: "regions", key: "id", hasUpdatedAt: true },
  { table: "coffees", key: "id", hasUpdatedAt: true },
  { table: "coffee_translations", key: "coffee_id,locale", hasUpdatedAt: true },
  { table: "coffee_offers", key: "id", hasUpdatedAt: true },
  { table: "offer_price_tiers", key: "id", hasUpdatedAt: true },
  { table: "media", key: "id", hasUpdatedAt: true },
  { table: "media_translations", key: "media_id,locale", hasUpdatedAt: true },
  { table: "coffee_media", key: "coffee_id,media_id", hasUpdatedAt: false },
  { table: "origin_media", key: "origin_id,media_id", hasUpdatedAt: false },
  { table: "articles", key: "id", hasUpdatedAt: true },
  {
    table: "article_translations",
    key: "article_id,locale",
    hasUpdatedAt: true,
  },
  { table: "inquiries", key: "id", hasUpdatedAt: true },
  { table: "favorites", key: "user_id,coffee_id", hasUpdatedAt: false },
  { table: "profiles", key: "id", hasUpdatedAt: true },
  { table: "site_pages", key: "id", hasUpdatedAt: true },
  { table: "site_settings", key: "id", hasUpdatedAt: true },
  { table: "warehouses", key: "id", hasUpdatedAt: true },
]);

/** Loads `.env.local` without overwriting anything already in the process. */
export function loadEnv() {
  if (!existsSync(".env.local")) return process.env;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("="))
      continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return process.env;
}

/**
 * A writable service client, or a thrown guard error.
 *
 * There is no unguarded way to get one of these: the guard runs first, every
 * time, and its result is returned alongside so callers can log the redacted
 * target they were authorised for.
 */
export function guardedServiceClient() {
  loadEnv();
  const target = assertStagingTarget(process.env);
  /*
   * Normalised to a bare origin before use. The configured value carries a
   * path, and supabase-js appends its own — the result is a malformed request
   * URL and every call fails with "Invalid path specified in request URL".
   * `tests/e2e/auth-fixtures.ts` already does this; the seed must too.
   */
  const origin = (() => {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  })();
  const client = createClient(origin, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return { client, target };
}

/** Stable, non-reversible stand-in for an address, so manifests hold no PII. */
export function emailFingerprint(email) {
  return createHash("sha256")
    .update(String(email).trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

function rowKey(row, key) {
  return key
    .split(",")
    .map((part) => String(row[part.trim()]))
    .join("|");
}

/** Fingerprints a row so an in-place edit is detectable. */
function rowFingerprint(row, spec) {
  if (spec.hasUpdatedAt) return String(row.updated_at ?? "");
  // No updated_at to compare, so the whole row becomes the fingerprint.
  return createHash("sha256")
    .update(JSON.stringify(row, Object.keys(row).sort()))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Reads every pre-existing row's identity and fingerprint.
 *
 * Paged, because a `select` without a range silently caps at 1000 rows and a
 * truncated baseline would quietly stop protecting the rows past the cap.
 */
export async function captureBaseline(client) {
  const tables = {};
  for (const spec of PROTECTED_TABLES) {
    const columns = spec.hasUpdatedAt
      ? `${spec.key.split(",").join(",")},updated_at`
      : "*";
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client
        .from(spec.table)
        .select(columns)
        .range(from, from + 999);
      /*
       * Deliberately fatal. An unreadable table would otherwise be recorded as
       * "zero pre-existing rows", and the post-run comparison would then
       * cheerfully confirm that nothing was touched — while protecting
       * nothing at all. A baseline that cannot be captured is not a baseline.
       */
      if (error)
        throw new Error(
          `baseline capture failed for ${spec.table}: ${error.message}`,
        );
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const entries = {};
    for (const row of rows)
      entries[rowKey(row, spec.key)] = rowFingerprint(row, spec);
    tables[spec.table] = entries;
  }

  // Auth users: ids plus fingerprinted addresses, never the addresses.
  const authUsers = {};
  let protectedFound = false;
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error)
      throw new Error(
        `baseline capture failed for auth.users: ${error.message}`,
      );
    for (const user of data.users) {
      authUsers[user.id] = {
        emailFingerprint: emailFingerprint(user.email ?? ""),
        confirmed: Boolean(user.email_confirmed_at),
        protected: isProtectedAccount(user.email),
      };
      if (isProtectedAccount(user.email)) protectedFound = true;
    }
    if (data.users.length < 200) break;
  }

  return {
    capturedAt: new Date().toISOString(),
    tables,
    authUsers,
    protectedAccountPresent: protectedFound,
    counts: Object.fromEntries(
      Object.entries(tables).map(([t, rows]) => [t, Object.keys(rows).length]),
    ),
    authUserCount: Object.keys(authUsers).length,
  };
}

/**
 * Compares a fresh capture against the baseline.
 *
 * `expectedNewKeys` are the rows this run legitimately created, so they are not
 * reported as unexpected additions before cleanup runs.
 */
export function diffBaseline(before, after, expectedNewKeys = {}) {
  const findings = { missing: [], modified: [], unexpectedNew: [] };
  for (const spec of PROTECTED_TABLES) {
    const a = before.tables[spec.table] ?? {};
    const b = after.tables[spec.table] ?? {};
    const allowed = new Set(expectedNewKeys[spec.table] ?? []);
    for (const [key, fingerprint] of Object.entries(a)) {
      if (!(key in b)) findings.missing.push(`${spec.table}:${key}`);
      else if (b[key] !== fingerprint)
        findings.modified.push(`${spec.table}:${key}`);
    }
    for (const key of Object.keys(b))
      if (!(key in a) && !allowed.has(key))
        findings.unexpectedNew.push(`${spec.table}:${key}`);
  }

  for (const [id, info] of Object.entries(before.authUsers)) {
    const now = after.authUsers[id];
    if (!now) findings.missing.push(`auth.users:${id}`);
    else if (now.emailFingerprint !== info.emailFingerprint)
      findings.modified.push(`auth.users:${id}(email)`);
    else if (now.confirmed !== info.confirmed)
      findings.modified.push(`auth.users:${id}(confirmation)`);
  }

  return findings;
}

/** Creates an empty manifest. Written to disk *before* any fixture exists. */
export function newManifest(runId, target) {
  return {
    runId,
    prefix: `E2E-HILLS-${runId}`,
    project: target.maskedRef,
    environment: target.environment,
    startedAt: new Date().toISOString(),
    completedAt: null,
    authUsers: [],
    rows: {},
    storagePaths: [],
    notes: [],
  };
}

export function manifestPath(runId) {
  return join(MANIFEST_DIR, `${runId}.json`);
}

export function saveManifest(manifest) {
  const path = manifestPath(manifest.runId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
}

export function loadManifest(runId) {
  return JSON.parse(readFileSync(manifestPath(runId), "utf8"));
}

/*
 * Every record* helper writes the manifest straight through to disk.
 *
 * Batching these was a real bug: the seed saved once per loop iteration, so a
 * failure part-way through an iteration left rows in the database that the
 * manifest had never heard of — and cleanup, correctly, refuses to delete what
 * it cannot prove it owns. The manifest must never be behind the database, so
 * the extra writes are the point rather than a cost.
 */

/** Records a created row. Every insert must go through this. */
export function recordRow(manifest, table, key) {
  manifest.rows[table] ??= [];
  const value = String(key);
  if (!manifest.rows[table].includes(value)) manifest.rows[table].push(value);
  saveManifest(manifest);
}

export function recordAuthUser(manifest, persona, id, email) {
  manifest.authUsers.push({
    persona,
    id,
    emailFingerprint: emailFingerprint(email),
  });
  saveManifest(manifest);
}

export function recordStoragePath(manifest, bucket, path) {
  manifest.storagePaths.push({ bucket, path });
  saveManifest(manifest);
}

/** The only sanctioned ownership check before a delete. */
export function manifestOwns(manifest, table, key) {
  return (manifest.rows[table] ?? []).includes(String(key));
}

/**
 * Retires the current-fixtures pointer once its run has been cleaned up.
 *
 * Cleanup used to delete the rows, the storage objects and the auth users and
 * leave this file behind. The suite then still reported `hasP12Fixtures ===
 * true` and drove every authenticated test against accounts that no longer
 * existed: sign-in produced no session, and fixture-dependent tests burned
 * their full timeout instead of skipping. A whole regression sweep was spent
 * that way before the cause was found.
 *
 * Deliberately narrow. It removes exactly one known path, only when that file
 * names the run just cleaned, and never when it cannot be parsed — a pointer
 * whose contents are unreadable might belong to a live run, and guessing is
 * how a cleanup starts deleting things it does not own. A pointer for a
 * *different* run is left strictly alone.
 *
 * Returns what it did, so the caller can say so in its report rather than
 * claiming a removal that did not happen.
 */
export function clearCurrentPointer(runId, pointerPath = CURRENT_POINTER) {
  if (!existsSync(pointerPath)) return "absent";
  let pointer;
  try {
    pointer = JSON.parse(readFileSync(pointerPath, "utf8"));
  } catch {
    return "unreadable";
  }
  if (!pointer || pointer.runId !== runId) return "other-run";
  rmSync(pointerPath, { force: true });
  return "removed";
}
