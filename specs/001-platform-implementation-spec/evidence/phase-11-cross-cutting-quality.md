# Phase 11 — Cross-cutting accessibility, i18n, theme, and domain-error closure

**Status: COMPLETE — GATE PASS**

Scope: cross-cutting quality only. No schema change, no migration, and no
change to RLS, Auth semantics, roles, blocking, protected pricing,
inquiry/sample rules, CMS schema or Media schema. No public or Admin redesign.

Phases 8, 9 and 10 were accepted as the starting point. Nothing from them was
reverted; where this phase touched their code it was to close a defect the
phase's own audit found, and each is recorded below.

---

## P11-T01 — `ActionResult` repo-wide, and the raw-error audit

### Every server action

12 action modules carry `"use server"`, exporting **51** actions. All were
read, not assumed:

| Module | Actions | On the contract |
|---|---|---|
| `account.ts` | 7 | 7 |
| `admin-articles.ts` | 2 | 2 |
| `admin-branding.ts` | 1 | 1 |
| `admin-catalog.ts` | 8 | 8 |
| `admin-cms.ts` | 6 | 6 |
| `admin-inquiries.ts` | 1 | 1 |
| `admin-media.ts` | 5 | 5 |
| `admin-operations.ts` | 7 | 7 |
| `admin-origin-media.ts` | 4 | 4 |
| `admin-users.ts` | 1 | 1 |
| `auth.ts` | 7 | 6 + 1 redirect-only |
| `inquiries.ts` | 2 | 2 |

**One straggler was found and migrated: `toggleFavoriteAction`.** It returned
nothing at all — every failure path was a bare `return`, so an expired
session, a malformed id and a rejected write were indistinguishable from
success. The button appeared to do nothing and said nothing. It now returns
`ActionResult<{ favorite: boolean }>` with `AUTH_REQUIRED`, `VALIDATION` and
`UNEXPECTED` paths, and a new `FavoriteButton` client component renders the
outcome. Business behaviour is unchanged: the same read, the same insert or
delete, the same revalidation.

Two actions are compliant by design and are recorded here so the exception is
explicit, not silent:

- `signOutAction` always `redirect()`s and returns nothing to render;
- `getAvatarConstraints` is a constant getter, exported only because a
  `"use server"` module may export nothing but async functions.

**Dead contract scaffolding removed.** `LegacyActionResult` and
`idleLegacyActionResult` were declared in Phase 3 as a "temporary
compatibility shape … scheduled for the Phase 11 domain-result migration".
Phase 10 removed the last consumer; both were deleted with zero references
remaining.

### Raw-error leaks

A repo-wide scan of `error.message`, `error.code`, `error.details`,
`String(error)` and `JSON.stringify(error)` found 12 call sites. Each was read
in place:

- **9 are server-side logs** carrying only the upstream code, which never
  reach a client.
- **2 read a constraint name to choose which field owns the message**
  (`admin-catalog.ts`, `admin-inquiries.ts`). The name is compared server-side
  and discarded; only a message key is returned.
- **1 maps an RPC error through a closed switch** (`admin-users.ts`), whose
  default is `UNEXPECTED`.

Three data loaders throw `new Error("… (${code})")`, which reaches the locale
error boundary. The boundary destructures only `reset` and never renders
`error`, so the code cannot appear on screen — verified by driving the failure
in a browser, not by reading the file.

**Runtime proof.** `tests/e2e/phase11-cross-cutting.spec.ts` drives real
failures — a missing route in both languages, three unresolvable detail slugs,
rejected credentials, a recovery page with no state, an invalid Admin create, a
duplicate-slug conflict, a customer at three Admin URLs, and an anonymous
visitor at three Admin URLs — and scans everything rendered against nine
signature families: SQLSTATE/PGRST codes, constraint-name shapes, Postgres
error prose, RLS wording, Supabase/PostgREST identifiers, stack-trace shapes,
schema identifiers, internal function names, and raw translation keys.

**Result: 0 leaks.**

One finding came out of the copy rather than the code: two catalogue strings
told the visitor about "a connected Supabase project" and "Supabase
environment variables". Both keys proved to be unreferenced, so nothing
rendered them, but the copy was rewritten in both languages so the hazard
cannot be wired up later.

---

## P11-T02 — Hardcoded locale copy, and message parity

### What was found

Phase 9's public pages selected copy with inline
`locale === "ar" ? { … } : { … }` blocks — the pattern §7 names. **6 files,
44 English/Arabic pairs**, none of them visible to the parity test, so a key
added in one language and forgotten in the other could never have been caught.

| File | Pairs |
|---|---|
| `(site)/page.tsx` | 20 |
| `(site)/coffee-origins/page.tsx` | 9 |
| `(site)/knowledge/page.tsx` | 7 |
| `(site)/coffee-origins/[slug]/page.tsx` | 4 |
| `(site)/green-coffee-offer-list/[slug]/page.tsx` | 3 |
| `(site)/green-coffee-offer-list/page.tsx` | 1 |

All 44 moved into `messages/en.json` and `messages/ar.json` verbatim — the
wording is Phase 9's, only its location changed. **The scan now returns 0.**

The remaining 20 `locale === "ar"` expressions were each read and kept: they
compute `dir`, narrow a type to `"ar" | "en"`, select a translated row from the
database, build a localized path, or mirror a chevron. None selects copy.

**One accepted exception, recorded rather than hidden.**
`publicContinentLabel` holds an Arabic lookup for continent names that arrive
as English free text from the `origins.continent` column, with a pass-through
fallback for anything unlisted. It is a translation table for database values,
not UI copy selection, and moving it to the catalogue would require dynamic
keys that neither the type system nor the parity test can check. Flagged for
the owner's judgement.

### The boundaries nobody had translated

`app/[locale]/error.tsx`, `app/[locale]/not-found.tsx` and `app/not-found.tsx`
were entirely hardcoded English. `/ar/nonexistent-page` rendered
`lang="ar" dir="rtl"` with English copy.

The locale-tree not-found could not simply call `useTranslations`: it can
render without next-intl's request context, and throwing there drops Next.js
to its unbranded error document — a real constraint, documented in the file.
The fix reads the locale from the `x-next-intl-locale` header, exactly as the
root layout already does for `<html lang>`, and passes it explicitly to
`getTranslations`. That works in all three boundaries, including the global one
outside the locale tree.

Verified in a browser: `/ar/nonexistent-page` now renders
**"هذه الصفحة غير متاحة."** at `lang=ar`, and all six public routes render
their own language with no raw keys.

### Parity

`src/i18n/messages.test.ts` was run, not replaced. **+37 keys per language**
(35 for the migrated copy, 2 for the favourite outcomes), and all three of its
assertions hold: identical key sets, no empty values, and no English left
untranslated in the Arabic catalogue.

- Missing EN keys: **0**
- Missing AR keys: **0**
- Raw message keys visible at runtime: **0**

---

## P11-T03 — Interactive primitives

Every dialog, menu, drawer, popover and live region was inventoried and
audited. Primitives already proven correct were not rebuilt.

| Primitive | Verdict |
|---|---|
| `ModalDialog` (inquiry dialog, media picker) | Correct — trap, Escape, restore, inert backdrop, scroll lock, accessible name |
| `ConfirmDialog` (sign-out, archive, block/unblock) | Correct — same guarantees |
| Mobile navigation drawer | **Defect found and fixed** (below) |
| Account menu | Correct — `role="menu"`, Escape, outside click, focus restore |
| Catalog mega menu | Correct — Escape, focus restore, `aria-expanded` |
| Catalog filter panel | Correct — a disclosure, not a popover; children unmount when collapsed, so nothing is focusable-but-invisible |
| Media picker | Correct — built on `ModalDialog` |
| Offer picker | Correct — inline list with a single status region |
| Admin navigation | Correct — a scrolling nav bar, not a modal drawer; no trap required |
| Admin CRUD / archive / lead-status dialogs | Correct — built on `ConfirmDialog` |

### Finding: the mobile drawer opened off-screen on any scrolled page

Phase 9 gave `<header class="site-header">` a `view-transition-name`. A named
element is a **containing block for fixed descendants**, and the drawer is
`position: fixed; inset: 0` *inside* the header. Measured in the browser at
scroll offset 528: the drawer's fixed layer resolved to the header's box —
**80px tall, top −528** — instead of the 780px viewport. The menu opened
where the user could not see it, and taps aimed at it landed on the footer.

It survived the existing tests because they open the menu at scroll position
zero, where the header's box and the viewport happen to coincide.

Fixed by portalling the drawer to `document.body`, the same remedy Phase 10
applied to the dialogs for the same root cause. Phase 9's view transitions are
untouched. Verified at 390×780 in both languages: the layer spans the full
viewport, three probe points inside the drawer all hit the drawer, Tab cannot
escape after 25 presses, Escape closes it, and focus returns to the trigger.

### Finding: a countdown announced itself once a second

`verify-email-form.tsx` wrapped its whole waiting panel in
`aria-live="polite"`, including a `mm:ss` countdown that ticks every second —
so a screen reader re-announced the entire panel once per second. The live
region now covers only the heading, which changes exactly once when the wait
elapses. The digits remain readable on demand.

### Finding: every account form outcome announced twice

`useFormAction` raised a Sonner toast carrying the same message that
`FormStatus` already rendered. Sonner publishes through a live region of its
own, so each success and each failure was announced twice. All five consumers
render `FormStatus`, so the toast was pure duplication; it was removed and the
inline status kept — it sits with the form, persists instead of dismissing,
and is what a field error is read alongside.

All other live regions were checked and are mutually exclusive by
construction; `FieldError` carries no live role at all, so field messages are
read on focus rather than announced en masse.

---

## Findings on the public and account forms

Two defects §22 and §23 name, on Phase 3/5 surfaces that earlier phases fixed
only inside the Admin.

**Native validation popups.** Eight forms — sign-in, admin sign-in, sign-up,
forgot-password, reset-password, profile, email change, password change and
verification resend — carried `required` with no `noValidate`, so the final
word on an empty field was the browser's own untranslated popup. `noValidate`
was added to all eight; `required` stays on the inputs so assistive technology
still hears it.

Confirmed in the browser that this did not trade a popup for nothing — an
empty submit now reaches the server and returns per-field messages:

- English: *"Enter a valid email address."* / *"Use at least 10 characters
  with a letter and a number."*
- Arabic: *"أدخل عنوان بريد إلكتروني صالحًا."* / *"استخدم 10 أحرف على الأقل
  تتضمن حرفًا ورقمًا."*

with `aria-invalid` on both controls and one summary announcement.

**Values discarded after a rejection.** Both field components held their value
with `defaultValue`. React resets a form once its action settles, so an
uncontrolled input reverted — a mistyped password cleared the email address
too. Both are now controlled, and adopt new defaults when a save succeeds.
Passwords stay deliberately uncontrolled: the existing comment promises the
value is never copied into state, and losing it on a failed attempt is
expected. Verified: the typed email survives a failed sign-in in both
languages.

---

## Theme findings

**The toast ignored dark mode and failed contrast.** `<Toaster richColors />`
was given no `theme`, so Sonner stayed on its light palette while the page
followed the user's dark preference, and axe flagged its title as a serious
contrast failure on the verification notice. It now reads `resolvedTheme` and
paints with `--card`/`--foreground` — the same pairs the rest of the interface
is measured against — instead of carrying a palette of its own.

**Admin sidebar labels failed AA.** `text-white/35` on the `#13241b` sidebar
measures ≈3.2:1 and `text-white/40` ≈3.7:1, both carrying 11–12px text, which
WCAG counts as small and requires 4.5:1. Three instances were raised to
`text-white/60` (≈6.5:1), which stays visibly secondary. `text-white/65`
(≈7.6:1) already passed and was left alone.

---

## P11-T04 — Cross-persona accessibility pass

All five personas were exercised. **None was faked**: the four authenticated
ones are created through the service role by the existing Phase 3 fixture set
and removed afterwards.

| Persona | Coverage | Result |
|---|---|---|
| Anonymous | Home, catalogue, coffee, origins, knowledge, contact, 404s, Admin URLs | PASS |
| Unverified | Sign-in outcome and verification state, axe | PASS |
| Verified | Account shell EN + AR, invalid profile submission, three Admin URLs refused | PASS |
| Blocked | Refused at sign-in and at a protected route directly | PASS |
| Admin | Dashboard EN + AR, invalid create, duplicate conflict, three Arabic Admin routes | PASS |

The suite previously carried
`test.skip("accessibility: BLOCKED — STAGING CREDENTIALS REQUIRED …")`. That
placeholder was **not** true of this environment — the personas are creatable
locally — so it was replaced with the real coverage rather than left standing.

**Authorization vs not found**: a customer and an anonymous visitor at
`/admin`, `/admin/users` and `/admin/settings` are both redirected away from
the Admin, with no raw error and nothing that distinguishes "no such record"
from "not yours". Authorization semantics were not changed.

---

## Test results

| Suite | Result |
|---|---|
| `vitest run` (incl. message parity) | **139 passed** (16 files) |
| `npm run test:integration` | **105 passed** (8 files) |
| Playwright desktop (unsharded, full project) | **188 passed**, 5 skipped |
| Playwright mobile | **88 passed**, 105 skipped |
| Playwright dev-server config | **73 passed** |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | clean |

**Total: 593 passing checks, 0 failing.**

Phase 9 regression: PASS. Phase 10 regression: PASS — the Admin sweep's 360
audited screens, unified form behaviour, inline validation, preserved values
and dependent selects all still hold.

### A note on sharding

A `--shard=3/3` run reported one failure that an unsharded run does not.
`phase8-ui-sweep.spec.ts` is a serial describe whose later tests consume media
the earlier ones upload, and adding this phase's spec shifted the shard
boundary so the block was split across shards. The product is not at fault and
nothing was changed for it, but the suite is not currently shard-safe: if the
owner shards in CI, that file's tests must stay together, or each test must
create what it needs. Recorded as a finding.

---

## QA data

Fixtures are namespaced `qa-p11-` / `[QA-P11]`. The duplicate-conflict check
must create a real row to collide with, so the suite now deletes what it
creates in `afterAll`; five rows from earlier runs were removed. Verified
against the live database afterwards:

- `qa-p10` / `qa-p11` rows across all reference tables: **0**
- fixture auth accounts: **0**
- storage reconciliation: **3 media rows ↔ 3 storage files, 0 orphans**

No production or customer data was modified. The owner-approved persistent
Phase 6 QA rows were preserved, and the pending N32 Variety translation
migration was not touched.

---

## Deferred to Phase 12

Phase 12 owns what this phase deliberately did not start: staging project
provisioning, the staging five-persona fixture dataset, reusable authenticated
Playwright session fixtures, the full automated journey matrix against
staging, and visual-regression acceptance. The persona coverage above runs
against the local production build with fixtures created and destroyed per
run — it is real, but it is not the staging proof Phase 12 exists to produce.

---

## Gate result

**PHASE 11: COMPLETE — GATE PASS.**

Phases 8, 9 and 10 remain complete and were not reverted. No Phase 12 work was
started. Nothing was committed.
