/**
 * Phase 12 — fail-closed staging target guard.
 *
 * Every Phase 12 action that writes anything (seeding the five-persona fixture
 * dataset, creating Auth users, uploading storage objects, deleting fixtures)
 * must call `assertStagingTarget()` first. It throws unless the caller has
 * proven, explicitly and redundantly, that the target is the project the owner
 * approved for Phase 12.
 *
 * The owner's environment decision is that the *current* Supabase project is
 * pre-production and is the approved Phase-12 staging target, while every row,
 * Auth user and storage object that already existed there is immutable. That
 * decision changes which project is allowed — it does not relax the guard.
 * A marker alone is still not sufficient: the exact project ref must be
 * declared and must match the project actually being talked to, so that
 * pointing the app somewhere else while leaving the marker set fails closed.
 *
 * Each condition blocks a different accident:
 *
 *  - `HILLS_E2E_ENVIRONMENT === "staging"` is the explicit environment marker
 *    the master rebuild plan requires as a Phase-12 prerequisite.
 *  - `HILLS_E2E_ALLOWED_PROJECT_REF` must equal the ref inside the Supabase
 *    URL in use, so a correct marker pointed at the wrong project is refused.
 *  - `HILLS_E2E_ALLOW_MUTATION === "true"` is the separate seed/cleanup
 *    authorization, so a read-only session cannot silently begin writing.
 *  - A service-role credential must be present, since seeding needs one.
 *
 * Nothing here ever prints a key, a password, or a full project ref.
 */

/** The one-line reason a target was refused, for logs and test assertions. */
export class StagingGuardError extends Error {
  constructor(reason, detail) {
    super(reason);
    this.name = "StagingGuardError";
    this.reason = reason;
    this.detail = detail ?? null;
  }
}

/** `https://abcdefghijklmnop.supabase.co` -> `abcdefghijklmnop`. */
export function projectRefOf(url) {
  if (typeof url !== "string" || !url) return null;
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.(co|in)/i);
  return match ? match[1].toLowerCase() : null;
}

/** Enough of a ref to identify it in a log, not enough to be the whole thing. */
export function maskRef(ref) {
  if (!ref) return "(none)";
  return ref.length > 8 ? `${ref.slice(0, 4)}…${ref.slice(-4)}` : "(short)";
}

/**
 * Throws `StagingGuardError` unless `env` describes the owner-approved staging
 * project, explicitly marked and explicitly authorised for mutation.
 *
 * Returns a redacted description of the accepted target on success.
 */
export function assertStagingTarget(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const marker = env.HILLS_E2E_ENVIRONMENT;
  const allowedRef = env.HILLS_E2E_ALLOWED_PROJECT_REF;
  const allowMutation = env.HILLS_E2E_ALLOW_MUTATION;

  if (marker !== "staging")
    throw new StagingGuardError(
      `HILLS_E2E_ENVIRONMENT must be exactly "staging" (got ${marker ? `"${marker}"` : "unset"})`,
      "This is the explicit environment marker the master rebuild plan requires as a Phase-12 prerequisite.",
    );

  if (!url) throw new StagingGuardError("NEXT_PUBLIC_SUPABASE_URL is not set");

  const ref = projectRefOf(url);
  if (!ref)
    throw new StagingGuardError(
      "NEXT_PUBLIC_SUPABASE_URL is not a recognisable Supabase project URL",
    );

  if (!allowedRef)
    throw new StagingGuardError(
      "HILLS_E2E_ALLOWED_PROJECT_REF is not set",
      "The approved project ref must be declared explicitly; a staging marker on its own authorises nothing.",
    );

  if (allowedRef.trim().toLowerCase() !== ref)
    throw new StagingGuardError(
      "HILLS_E2E_ALLOWED_PROJECT_REF does not match the Supabase project in use",
      `approved ${maskRef(allowedRef.trim().toLowerCase())} vs target ${maskRef(ref)}`,
    );

  if (!key)
    throw new StagingGuardError(
      "SUPABASE_SERVICE_ROLE_KEY is not set",
      "Seeding needs a service-role credential supplied from local/CI secret storage.",
    );

  if (allowMutation !== "true")
    throw new StagingGuardError(
      `HILLS_E2E_ALLOW_MUTATION must be exactly "true" (got ${allowMutation ? `"${allowMutation}"` : "unset"})`,
      "Seed and cleanup are separately authorised so a read-only staging session cannot begin writing.",
    );

  return { ref, maskedRef: maskRef(ref), environment: "staging" };
}

/** True/false form, for callers that want to branch rather than throw. */
export function isStagingTarget(env = process.env) {
  try {
    assertStagingTarget(env);
    return true;
  } catch {
    return false;
  }
}

/**
 * Accounts that Phase 12 must never touch, in any way, for any reason.
 *
 * The owner named this address explicitly: it is a real pre-existing account
 * and is not a persona. Seeding, blocking, role changes, password recovery and
 * cleanup all consult this list, so "skip it" is enforced in one place rather
 * than remembered at each call site.
 */
export const PROTECTED_ACCOUNT_EMAILS = Object.freeze([
  "shadyshref2001@gmail.com",
]);

/** Case-insensitive membership test for the protected-account list. */
export function isProtectedAccount(email) {
  if (!email) return false;
  const needle = String(email).trim().toLowerCase();
  return PROTECTED_ACCOUNT_EMAILS.some(
    (protectedEmail) => protectedEmail.toLowerCase() === needle,
  );
}

/** Throws if a caller is about to act on a protected account. */
export function assertNotProtectedAccount(email, action = "modify") {
  if (isProtectedAccount(email))
    throw new StagingGuardError(
      `refusing to ${action} an explicitly protected account`,
      "This address is owner-protected pre-existing data and is never a Phase-12 persona.",
    );
}
