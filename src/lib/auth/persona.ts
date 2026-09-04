import "server-only";
import { cache } from "react";
import { getViewer } from "@/lib/auth/session";
import { personaOf, type PublicPersona } from "@/lib/auth/policy";

/**
 * Server-side resolution of the public presentation persona.
 *
 * The decision itself is a pure function in `policy.ts`, beside the sign-in
 * decisions, so it can be unit-tested without a request. This module only
 * supplies it with a viewer.
 *
 * It composes `getViewer()` rather than `requireVerifiedUser()` deliberately.
 * `requireVerifiedUser()` calls `supabase.auth.signOut()` when the viewer is
 * blocked — correct on an entitlement path, but on a public marketing page
 * that would sign a visitor out as a side effect of rendering a button.
 * `getViewer()` is non-throwing and side-effect free.
 *
 * `cache()` here is request memoization, never a shared cache: the value lives
 * for one render pass and is never reused across requests or viewers, which is
 * the only caching an identity-derived value may have.
 */
export const getPublicPersona = cache(async (): Promise<PublicPersona> => {
  const viewer = await getViewer();
  return personaOf(
    viewer && {
      emailConfirmed: viewer.emailVerified,
      role: viewer.role,
      isBlocked: viewer.isBlocked,
    },
  );
});

export type { PublicPersona };
