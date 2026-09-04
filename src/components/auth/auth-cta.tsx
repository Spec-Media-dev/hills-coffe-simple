import { Link } from "@/i18n/navigation";
import type { PublicPersona } from "@/lib/auth/persona";

/**
 * Shared presentation for a public call to action that must read correctly for
 * every persona.
 *
 * The branching lives here once. Sections still supply their own copy and their
 * own classes, because a gold marketing band and a catalog pricing banner
 * should not say — or look like — the same thing; what they must not do is each
 * re-derive who the visitor is. That is what produced a "Sign in" button for
 * someone already signed in.
 *
 * There is no authorization logic in this file. It renders a label and an href.
 */

export type CtaTarget = { label: string; href: string } | null;

/**
 * A persona → target map. `anonymous` is required because every public surface
 * must say something to a first-time visitor; the rest fall back to it, so a
 * caller only spells out the personas whose wording genuinely differs.
 *
 * `null` is meaningful and distinct from "not specified": it means *render
 * nothing for this persona*, which is how a customer account band disappears
 * for an Administrator instead of being reworded into something odd.
 */
export type CtaMap = { anonymous: CtaTarget } & Partial<
  Record<Exclude<PublicPersona, "anonymous">, CtaTarget>
>;

export function resolveCta(persona: PublicPersona, map: CtaMap): CtaTarget {
  // `in` rather than a truthiness check, so an explicit `null` is honoured
  // instead of silently falling back to the anonymous call to action.
  return persona in map
    ? ((map as Record<PublicPersona, CtaTarget>)[persona] ?? null)
    : map.anonymous;
}

export function AuthCta({
  persona,
  map,
  className,
  children,
}: {
  persona: PublicPersona;
  map: CtaMap;
  className?: string;
  /** Optional trailing decoration, e.g. an arrow icon. */
  children?: React.ReactNode;
}) {
  const target = resolveCta(persona, map);
  if (!target) return null;
  return (
    <Link href={target.href} className={className}>
      {target.label}
      {children}
    </Link>
  );
}
