<!--
Sync Impact Report
==================
Version change: (unratified template) → 1.0.0
Rationale: Initial ratification. The prior file at this path was an unfilled
generic scaffold (all placeholder tokens, no project-specific content), so
this is treated as the first real constitution, not an amendment — hence
MAJOR version 1.0.0 rather than a bump from a prior baseline.

Modified principles: none (first ratification)

Added sections:
- Core Principles I–XIX (all 19 principles supplied by the project owner,
  verbatim in substance, phrased as normative MUST/NEVER rules)
- Authoritative Sources (Section 2)
- Quality Gates (Section 3)
- Governance

Removed sections: none (template placeholders only)

Templates requiring alignment (not modified by this command; flagged for the
next spec/plan/tasks pass):
- .specify/templates/plan-template.md — should cite Principles IV–VIII, XIV
  when gating authorization/pricing/routing work
- .specify/templates/spec-template.md — should require EN/AR + role-matrix
  acceptance criteria per Principles II, V, VI, XI
- .specify/templates/tasks-template.md — should require evidence artifacts
  (not "route exists") per Principle XIV

Deferred / follow-up items: none. No placeholder tokens remain in this file.
-->

# Hills Coffee Constitution

## Core Principles

### I. Platform Identity & Scope

Hills Coffee is a premium green-coffee sourcing platform. It is NOT a
marketplace, checkout, payment, seller, custody, or trading platform. Features
MUST NOT introduce carts, payment processing, seller onboarding, custody
workflows, or trading mechanics. Any request that would move the product
toward those categories MUST be rejected or escalated to the owner before
implementation.

### II. Bilingual Routing & Parity

English routes are unprefixed; Arabic routes are served under `/ar`. Public,
Auth, Account, and Admin surfaces MUST ship with complete EN/AR parity —
same functionality, same fields, same states — before a feature is
considered done. A feature that works only in one locale is incomplete, not
partially complete.

### III. Canonical Admin Implementation

There MUST be exactly one canonical Admin implementation, localized for
EN/AR, never two parallel admin code paths. The dedicated Admin
authentication entry point is `/dashboard-admin`. No alternate admin login
route may be introduced or left active as a second source of entry.

### IV. Authoritative Authorization Source

`public.profiles.role` is the sole authoritative source for application
authorization decisions. Client-supplied state, editable user metadata, or
any value the end user can influence MUST NEVER be trusted for authorization.
Every authorization check MUST resolve role from `public.profiles.role` on
the server.

### V. Protected Customer Access Gate

Protected customer functionality (pricing, gated content, and equivalent
customer-only actions) requires ALL of: authenticated session, confirmed
email, account not blocked, and `role = USER`. Missing any one of these
conditions MUST deny access; partial credentials are not partial access.

### VI. Admin/Customer Entitlement Separation

ADMIN accounts MUST NEVER inherit customer protected-price entitlement
merely because their email is verified. Admin and customer entitlements are
distinct grants; verifying an admin's email does not authorize customer-side
protected functionality, and vice versa.

### VII. Blocked-User Enforcement at Every Boundary

A blocked user MUST be denied at every layer where the check applies: Auth,
application logic, server-side handlers, and RLS. A block that only holds at
one layer is not compliant — defense must be redundant across all
applicable boundaries.

### VIII. Protected Price Confidentiality

Protected prices MUST NEVER enter unauthorized HTML, RSC payloads, metadata,
JSON-LD, sitemaps, logs, Realtime subscription payloads, or shared/public
caches. Price data is authorized-viewer-only at every rendering and
transport layer, with no exceptions for convenience or caching.

### IX. Static vs. Dynamic Media Separation

`public/images` contains only static Hills editorial and brand assets.
Dynamic coffee, origin, article, CMS, and managed site media MUST come from
Supabase, not from the static asset folder. Static and dynamic media are not
interchangeable storage locations.

### X. Avatar/Media Independence

User and Admin avatars are a distinct media category from business media
(coffee/origin/article/CMS assets) and from project branding assets. They
MUST be modeled, stored, and managed separately, never conflated with brand
or business media pipelines.

### XI. Full-Surface Localization & Responsiveness

Every user-facing feature MUST support EN/AR, LTR/RTL, light/dark themes,
responsive layout, and localized feedback messages (errors, confirmations,
empty states). A feature missing any one of these is not complete.

### XII. No Raw Backend Error Exposure

Raw Supabase, Postgres, or other internal server errors MUST NEVER be shown
to users. All user-facing error output MUST be a safe, localized,
human-readable message; internal error detail is for logs only.

### XIII. Preserve Correct Existing Business Logic

Existing business logic that is correct MUST be retained. It may be changed
only when evidence demonstrates a conflict with the approved specification —
never removed or rewritten on stylistic preference or unverified assumption
alone.

### XIV. Evidence-Based Completion

A route or component existing does NOT make a feature complete. Completion
claims MUST be backed by runtime evidence, database verification,
authorization verification, and end-to-end test evidence. Absent that
evidence, the feature MUST be reported as unverified, not as done.

### XV. Database Contract Governance

`docs/HILLS_SUPABASE_CURRENT_STATE.md` is the current authoritative
statement of database schema and RLS. Implementation work MUST conform to
that contract as written. Any schema or RLS migration requires explicit
owner approval before it is applied — no silent or inferred migrations.

### XVI. Security and Correctness Precedence

Security, authentication, and database correctness take precedence over
cosmetic or visual work. When trade-offs are required under time or scope
pressure, security/Auth/DB correctness MUST be resolved first; cosmetic
polish may be deferred.

### XVII. Inspiration-Only External References

Sucafina (or any similar external reference) may inform interaction quality
and information architecture only. Its copyrighted content, photography,
brand assets, and identity MUST NEVER be copied into Hills Coffee.

### XVIII. Realtime Is Not an Authorization Boundary

Realtime subscriptions do not replace RLS or server-side authorization.
Every subscription MUST be scoped to what the current viewer is authorized
to see on the current page — Realtime is a delivery mechanism, not a
security control.

### XIX. npm-Only Tooling

npm is the only supported package manager for this project. No other
package manager's lockfiles, configuration, or workflows may be introduced
or reintroduced.

## Authoritative Sources

`docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md` and
`docs/HILLS_SUPABASE_CURRENT_STATE.md` are the authoritative references for
product scope/plan and database contract, respectively. Where any other
document, prior report, or inferred convention conflicts with these two
files, these two files govern. Product discovery and repository research are
out of scope for constitution maintenance — this document records governing
rules, not investigation findings.

## Quality Gates

Every feature MUST pass these gates before it is reported as complete:

- **Role-matrix gate**: verified against Anonymous, Unverified USER, Verified
  USER, and ADMIN personas per Principles IV–VII.
- **Locale-parity gate**: EN and AR both exercised per Principles II and XI,
  including RTL and both themes.
- **Price-confidentiality gate**: no protected price reachable by an
  unauthorized viewer through any surface listed in Principle VIII.
- **Evidence gate**: runtime, database, authorization, and E2E evidence
  attached per Principle XIV — "the route exists" is not sufficient evidence.
- **Schema-conformance gate**: any database-touching change is checked
  against `docs/HILLS_SUPABASE_CURRENT_STATE.md`; any deviation requires
  documented owner approval before implementation per Principle XV.

## Governance

This constitution supersedes any conflicting prior practice, informal
convention, or ad hoc decision. All specs, plans, and task breakdowns
produced under Spec Kit workflows MUST be checked against this document
before implementation begins.

**Amendment procedure**: amendments are proposed by editing this file,
stating the principle(s) affected and the rationale, and require explicit
owner approval before taking effect. On approval, the amendment is recorded
via an updated Sync Impact Report at the top of this file.

**Versioning policy**: semantic versioning applies —
MAJOR for backward-incompatible principle removal or redefinition, MINOR for
new principles or materially expanded guidance, PATCH for clarifications and
non-semantic wording fixes.

**Compliance review**: every plan and task-breakdown pass MUST verify
compliance with the Core Principles and Quality Gates above. Any complexity
or deviation introduced during implementation MUST be justified against this
document, not merely against convenience.

**Version**: 1.0.0 | **Ratified**: 2026-08-31 | **Last Amended**: 2026-08-31
