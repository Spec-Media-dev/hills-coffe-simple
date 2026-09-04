import type { AppRole } from "@/lib/supabase/types.generated";

export type AuthCandidate = {
  emailConfirmed: boolean;
  role: AppRole | null;
  isBlocked: boolean;
};

export type CustomerSignInDecision =
  | "OK"
  | "VERIFICATION_REQUIRED"
  | "BLOCKED"
  | "ADMIN_PORTAL_REQUIRED"
  | "PROFILE_MISSING"
  | "FORBIDDEN";

/** Exact customer-entry ordering required by FR-004/008/014. */
export function customerSignInDecision(
  candidate: AuthCandidate,
): CustomerSignInDecision {
  if (!candidate.emailConfirmed) return "VERIFICATION_REQUIRED";
  if (candidate.isBlocked) return "BLOCKED";
  if (candidate.role === "ADMIN") return "ADMIN_PORTAL_REQUIRED";
  // A confirmed account with no profile row is an account-provisioning
  // inconsistency, not an authorization refusal. Collapsing it into FORBIDDEN
  // told a perfectly ordinary customer that their account "cannot access
  // protected customer features", which is both wrong and unactionable. It
  // still grants nothing — a missing profile means no capability until the
  // account is reconciled — but it is reported and logged distinctly.
  if (candidate.role === null) return "PROFILE_MISSING";
  if (candidate.role !== "USER") return "FORBIDDEN";
  return "OK";
}

/** The dedicated Admin entry deliberately collapses all denials to FORBIDDEN. */
export function adminSignInDecision(
  candidate: AuthCandidate,
): "OK" | "FORBIDDEN" {
  return candidate.emailConfirmed &&
    candidate.role === "ADMIN" &&
    !candidate.isBlocked
    ? "OK"
    : "FORBIDDEN";
}

/**
 * The public presentation persona.
 *
 * It lives beside the sign-in decisions because it is the same kind of thing:
 * a pure function from an already-resolved identity to a label. It grants
 * nothing. Protected pricing still goes through `requireVerifiedUser()` and
 * the `hills_is_verified_user()` RPC; Admin routes still go through
 * `requireAdmin()`. Changing an outcome here changes what a button *says*,
 * never what a request may read.
 *
 * Ordering is the substance. `blocked` is tested before both `admin` and
 * `verified` so a restricted account never falls through to an entitled
 * branch, and `admin` before `verified` so an Administrator is never presented
 * as a customer — the two rules the scattered per-section checks kept getting
 * wrong.
 */
export type PublicPersona =
  "anonymous" | "unverified" | "verified" | "blocked" | "admin";

export function personaOf(
  candidate: AuthCandidate | null | undefined,
): PublicPersona {
  if (!candidate) return "anonymous";
  if (candidate.isBlocked) return "blocked";
  if (candidate.role === "ADMIN") return "admin";
  if (!candidate.emailConfirmed) return "unverified";
  return "verified";
}

/** True when the persona is the one the pricing presentation is written for. */
export const personaSeesPricing = (persona: PublicPersona) =>
  persona === "verified";
