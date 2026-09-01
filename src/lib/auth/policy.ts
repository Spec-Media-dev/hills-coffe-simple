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
