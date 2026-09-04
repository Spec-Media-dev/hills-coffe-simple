# Phase 12 — Authenticated E2E, Visual Regression, Staging Acceptance

Run date: 2026-09-04 · Run id: `E2E-HILLS-mtm4uk2mwvx` · Status: **P12-T01–T05 PASS, T06 partial, T07 PENDING**

---

## Environment

| Item                  | Value                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Target project        | owner-approved Supabase project, ref masked `qfzv…qkjo`                                               |
| Classification        | NON-PRODUCTION (owner decision: the platform is pre-release; no production project exists)            |
| Approved ref verified | YES — `HILLS_E2E_ALLOWED_PROJECT_REF` matched the ref parsed from `NEXT_PUBLIC_SUPABASE_URL`          |
| Markers required      | `HILLS_E2E_ENVIRONMENT=staging`, `HILLS_E2E_ALLOW_MUTATION=true`, plus the ref and a service-role key |

The approved project holds real pre-existing development data, so it was treated
as read-only throughout. Every mutation in this phase went to fixtures this run
created and owns.

---

## Safety machinery

Four independent mechanisms, each of which fails closed.

**1. Staging guard** — `scripts/e2e/staging-guard.mjs`. Requires all five
conditions above simultaneously; any one missing aborts before a client is
constructed. It also owns `PROTECTED_ACCOUNT_EMAILS`, so the untouchable account
is enforced in one place rather than remembered at each call site.
`scripts/e2e/staging-guard.test.mjs` — **22/22 pass**, covering the happy path,
each condition removed individually, a wrong-project ref, a near-miss ref
(one character different), case/whitespace tolerance, over-matching on the
protected address, and assertions that no secret appears in any error message.

Wrong-project rejection was exercised, not merely coded: a deliberately
incorrect `HILLS_E2E_ALLOWED_PROJECT_REF` was refused with the ref masked.

**2. Pre-run baseline** — `captureBaseline()` inventories 19 mutable
application-owned tables by primary key plus `updated_at`, and records whether
the protected account exists. Capture failure is fatal: a baseline that cannot
be captured is not a baseline, and silently capturing zero rows would make the
"nothing was touched" proof vacuous.

**3. Write-through run manifest** — every created id and storage path is
persisted at the moment of creation, not at the end of the run, so a crash
mid-seed still leaves provable ownership.

**4. Exact-id cleanup** — `scripts/e2e/cleanup.mjs` deletes only ids present in
the active manifest, in reverse foreign-key order across 21 steps. There is no
`TRUNCATE`, no timestamp window, no email-domain sweep and no name matching
anywhere in the file. Storage paths must start with `e2e/<run-id>/` or they are
refused. The protected account is re-checked immediately before every auth
delete.

---

## P12-T01 — fixture dataset · PASS

4 genuine Supabase Auth users, 137 database rows, 11 storage objects under
`e2e/mtm4uk2mwvx/`.

Personas are real Auth users created through `auth.admin.createUser`, in the
exact states required: unverified (email genuinely unconfirmed), verified,
a dedicated user for the block journey, and a dedicated Admin. No existing
account was reused; the protected account was never touched.

Dataset: 3 origins with EN/AR translations, regions and hero media · 7 coffees
(5 PUBLISHED, 1 DRAFT, 1 ARCHIVED boundary) with EN/AR translations, varieties,
tags and certifications · 4 offers across Egypt and Dubai with 2 protected price
tiers each · 2 Knowledge articles with distinct EN/AR slugs · 2 run-scoped CMS
pages · isolated logo media · 1 favorite · 6 inquiries spanning every status plus
a prior CLOSED same-coffee sample request.

`node scripts/e2e/verify-dataset.mjs` — **26/26 acceptance checks pass**, each
reading back by manifest id. Includes "live home/about CMS rows untouched
(still DRAFT)".

### Singleton — OWNER ACTION REQUIRED

The site logo is a singleton in `site_settings`. Attaching a fixture logo would
overwrite the owner's existing record, which the existing-data rule forbids. Per
the singleton instruction this was **not** mutated automatically. The fixture
logo media row was created and isolated instead, and the logo-attachment
acceptance is left for the owner. Acceptance was not silently lowered.

---

## P12-T02 — real authenticated sessions · PASS

`tests/e2e/p12-fixtures.ts`. Every session is produced by filling and submitting
the application's own sign-in form with real credentials. There is deliberately
no helper that writes a cookie, mints a token, or borrows the service-role client
as a user — a faked session would make every authorization assertion downstream
meaningless. `expectRealSession` asserts a genuine `sb-*-auth-token` cookie.

Credentials live in a gitignored file the seed writes and never reach the
repository or test output.

One behaviour worth recording: an Administrator signing in at the customer form
is deliberately signed out and redirected to the Admin portal (approved Phase 3
behaviour), so the Admin persona signs in at `/dashboard-admin`. Using `/sign-in`
for it would test the redirect rather than the session.

---

## P12-T03 / P12-T04 — persona matrix and runtime gate · PASS

`tests/e2e/p12-persona-matrix.spec.ts` — **desktop 19/19, mobile 19/19**.

| Persona    | Result                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous  | public access works; protected prices absent; protected actions, account and Admin all denied                                                 |
| Unverified | sign-in correctly refused with no session (Supabase rejects unconfirmed emails); `/account` → `/sign-in`; pricing and Admin denied            |
| Verified   | protected per-kg pricing authorized (`true`); favorites, sample requests, inquiry history, account and settings all work; no Admin capability |
| Blocked    | fixture user only; sign-in refused, no session, account unreachable; pricing and Admin denied                                                 |
| Admin      | Admin entry and dashboard, users, Lead Inbox, CRUD against fixture records only; correct separation from the customer role                    |

Role separation is proven positively and negatively: the verified persona sees
per-kg pricing; anonymous, unverified and Admin do not.

The block journey normalises the fixture user to unblocked first, then proves the
false → true transition, so an aborted run cannot leave it in a state that makes
the next run pass for the wrong reason. Blocking is performed through the real
Admin UI workflow, not a direct write — `admin_set_user_blocked` correctly
refuses a service-role caller because it requires a genuine Admin `auth.uid()`.

Every authenticated test fails on unexpected `console.error`, `pageerror`,
hydration warning or Dev Overlay error. EN → AR → EN was repeated inside both the
customer account and the Admin workspace with the gate active, including
query-string preservation; both round-trips were clean.

---

## P12-T05 — authenticated visual regression · CAPTURED AND TECHNICALLY VALIDATED

`tests/e2e/p12-visual.spec.ts` — **3/3 pass**, 70 images.

64 baselines = 8 surfaces × EN/AR × desktop 1440 / mobile 375 × light/dark:
Account, Account settings, Account favorites, Account requests, Admin dashboard,
Admin Users, Admin user detail, Lead Inbox. Plus 2 mobile authenticated menu
captures and 4 block/unblock dialog captures.

Each capture is gated on: the theme having actually applied (polled, not assumed),
correct `dir` and `lang`, a rendered `main`, and the suite's existing
`auditScreen` — raw translation keys, broken images, unreadable text, and genuine
horizontal overflow. `auditScreen` was reused deliberately rather than writing a
fresh `scrollWidth` check, because it already distinguishes a page that scrolls
sideways from a wide table inside its own scroller.

The block/unblock dialog opens in both directions and both themes, sits inside
the viewport in RTL as well as LTR, and closes on Escape leaving a clean runtime.
It is only opened, never submitted — the transition itself is proven in the
persona matrix.

### Baseline location and why it is not in the repository

`tests/e2e/.p12-runs/visual/mtm4uk2mwvx/` (gitignored, 6.9 MB).

Several of these screens legitimately show protected per-kg pricing to a verified
customer or an Administrator. Committing them would place protected commercial
data into a shared artifact, so the images stay local for the owner to review.

**AUTHENTICATED VISUAL REVIEW: PENDING — OWNER REVIEW REQUIRED.** No baseline is
marked approved; nothing was redesigned to make a diff disappear.

---

## P12-T06 — cleanup · PASS · real email acceptance · PENDING

`node scripts/e2e/cleanup.mjs mtm4uk2mwvx`:

```
fixture rows deleted        : 133
fixture auth users deleted  : 4
refused (not manifest-owned): 0
pre-existing rows missing   : 0
pre-existing rows modified  : 0
fixture residue remaining   : 0
protected account present   : true (baseline true)
CLEANUP: PASS
```

133 rows plus 4 profiles removed by auth cascade accounts for all 137 seeded rows.

Independent post-cleanup verification, run separately from the cleanup script:

- storage `hills-public` at `e2e/mtm4uk2mwvx/` → **0 objects**
- fixture auth users still present → **0 of 4**
- protected account present **true**, not banned **true**, confirmed **true**,
  profile `role=USER is_blocked=false` — unchanged

### REAL EMAIL ACCEPTANCE: PENDING — OWNER MANUAL CLICK REQUIRED

### REAL PASSWORD-RECOVERY ACCEPTANCE: PENDING — OWNER MANUAL CLICK REQUIRED

Fixture personas use `@example.com`, which is IANA-reserved and cannot receive
mail — by design, so seeding could never send anything to a real inbox. Both
acceptances therefore need an owner-supplied real address. Neither was faked,
bypassed, or marked PASS, and email confirmation was not disabled to make a test
green.

---

## P12-T07 — acceptance gate · PENDING

Blocked on three items only: authenticated visual review, real email
confirmation, and real password recovery. Every automated condition passes.

---

## Findings

No product regressions. Five items were classified during execution:

| #   | Finding                                                             | Class                      | Resolution                                                                                                                                            |
| --- | ------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Unverified persona holds no auth cookie                             | B — stale test expectation | Correct product behaviour; Supabase refuses unconfirmed emails, matching `auth-state-machine.spec.ts`. Assertion corrected.                           |
| 2   | `admin_set_user_blocked` → `admin_access_required` for service-role | B                          | Correct: the function requires a real Admin `auth.uid()`. The direct-write fixture was deleted and blocking routed through the Admin UI.              |
| 3   | Blocked sign-in message differed from the Phase-3 fixture path      | B                          | The Admin UI blocks at two layers (`is_blocked` and Auth `banned_until`), so Auth refuses first. Assertion made outcome-based rather than copy-based. |
| 4   | Configured Supabase URL carries a path                              | C — environment            | Runtime normalises the origin, matching what `auth-fixtures.ts` already did.                                                                          |
| 5   | Logo singleton                                                      | E — owner dependency       | Reported above; not mutated.                                                                                                                          |

No security or business rule was weakened to obtain a pass. No schema, RLS or
security-model change was required or made.

---

## Files added (uncommitted, for owner review)

`scripts/e2e/staging-guard.mjs` · `scripts/e2e/staging-guard.test.mjs` ·
`scripts/e2e/runtime.mjs` · `scripts/e2e/seed.mjs` · `scripts/e2e/cleanup.mjs` ·
`scripts/e2e/verify-dataset.mjs` · `tests/e2e/p12-fixtures.ts` ·
`tests/e2e/p12-persona-matrix.spec.ts` · `tests/e2e/p12-visual.spec.ts` ·
`.gitignore` (adds `tests/e2e/.p12-runs/`)

---

# Addendum — critical authorization regression found by the owner

Reported after the first Phase-12 pass: completing the public customer sign-up /
email-verification flow landed the browser inside the Admin workspace at
`/admin`, showing an Admin identity. Phase 12 was reopened; run
`E2E-HILLS-mtm8t63k0qe` was seeded for the investigation.

## Root cause

**A public customer flow selected a privileged destination from an identity it
had not established.**

The chain, reproduced end to end:

1. The browser already held an Administrator session from earlier work.
2. `signUpAction` called `supabase.auth.signUp()` **without replacing that
   incompatible session**. Email confirmation is required, so no new session was
   returned and the Administrator's cookies survived the customer sign-up.
3. `signUpAction` redirects every new customer to `/verify-email?email=…`.
4. `verify-email/page.tsx` called `getViewer()` — which returned the **stale
   Administrator** — and, because that viewer was verified with `role ==
"ADMIN"`, redirected to `/admin`.
5. `/admin`'s `requireAdmin()` admitted the request. Correctly: the visitor
   genuinely _was_ that Administrator.

The new customer was never granted ADMIN, and the Admin guard never failed. What
failed was step 4 choosing a destination from an identity step 1–3 did not
establish.

### Proof, isolated from email entirely

With an Administrator session live and no confirmation link involved:

```
EN  /verify-email?email=new-customer@example.com  ->  /admin
AR  /ar/verify-email?email=new-customer@example.com  ->  /ar/admin
header identity rendered: "مساحة الإدارة | E2E-HILLS-mtm8t63k0qe admin"
```

Independently confirmed that the new account was **not** privileged: no
`profiles` row for any sign-up-form account carried `role = ADMIN`, and in the
reproducing run the provider's sign-up mail quota meant no account was created
at all — the redirect happened regardless, which is itself the point.

### A second door in the same class

Investigating the owner's hypothesis list surfaced a second, independent
instance and it was reproduced before being fixed:

```
Admin session + GET /auth/callback?settled=1&next=/account  ->  /admin
```

`settled=1` is an unauthenticated query parameter. The callback treated it as
proof that a confirmation had just completed, then classified **whatever session
the cookies already held** and forwarded it. A public callback URL that had
confirmed nothing routed a stale Administrator into the Admin workspace.

## Fix

Three changes, each the minimum that is correct. No guard was weakened, no role
granted, no RLS or schema touched.

| File                                            | Change                                                                                                                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/actions/auth.ts`                           | Public sign-up replaces an incompatible existing session before calling `signUp`. `scope: "local"` clears only this browser's auth context — other devices and all data are untouched.                          |
| `src/app/[locale]/(site)/verify-email/page.tsx` | Only a verified **customer** is forwarded to `/account`. Any other role goes to the public home page — never `/admin`, never `/dashboard-admin`.                                                                |
| `src/app/auth/callback/route.ts`                | `settled=1` is now honoured only when accompanied by `hills-auth-settle`, an HttpOnly, 10-minute, single-use marker cookie that this same route sets at the one moment a fragment hand-off legitimately begins. |

Authorization remains server-authoritative throughout: `requireAdmin()`,
`requireVerifiedUser()` and the `is_admin()` / `hills_is_verified_user()` RPCs
are unchanged, and role still comes from `public.profiles`. Nothing was fixed
with a client-side redirect, hidden navigation, or a pathname check.

## Separate pre-existing defect found and fixed

`CASE H` surfaced `ERR_TOO_MANY_REDIRECTS`. It is **not** related to the
authorization regression — it reproduces identically on the pre-fix build, which
was verified by stashing the fix, rebuilding, and re-running.

The `/dashboard-admin` link rendered in the `ADMIN_PORTAL_REQUIRED` refusal
appears inside a Server Action result, where the client route tree is the
internally `/en`-rewritten one. Its prefetch requested
`/en/dashboard-admin?_rsc=…`, the proxy 308'd back to `/dashboard-admin`, and the
two bounced until the browser gave up. It had never been caught because that
link exists only in that one refusal state. Fixed with `prefetch={false}` on that
link — no routing or locale behaviour was changed. Classification: **D,
pre-existing, unrelated**.

## Permanent regression coverage

`tests/e2e/auth-session-isolation.spec.ts` — permanent, not a throwaway proof.
Written against the _class_ of bug rather than the single URL, and deliberately
independent of the provider's mail quota: a security test that silently stops
exercising the bug when a quota runs out is worse than no test.

**Verified to fail against the broken behaviour.** With the fix stashed and the
pre-fix code rebuilt:

```
✘ CASE B (en) — the public verification screen resolved to /admin
✘ CASE B (ar) — the public verification screen resolved to /ar/admin
✘ CASE B      — a forged settle callback resolved to /admin
✘ CASE B      — the Administrator session survived a public signup
```

With the fix applied: **desktop 13/13, mobile 13/13**.

| Case                                                                                | Result |
| ----------------------------------------------------------------------------------- | ------ |
| A — fresh anonymous signup → customer destination                                   | PASS   |
| A — signup destination serves customers, never bridges to Admin (EN, deterministic) | PASS   |
| B — Admin session → customer verification screen (EN + AR)                          | PASS   |
| B — forged settle callback                                                          | PASS   |
| B — public signup leaves no Administrator session live                              | PASS   |
| C — verified customer session → new signup                                          | PASS   |
| D — verified USER → `/admin`, `/admin/users`, `/admin/inquiries` denied             | PASS   |
| E — unverified USER → denied                                                        | PASS   |
| F — blocked USER → denied                                                           | PASS   |
| G — ADMIN via `/dashboard-admin` → workspace (EN + AR)                              | PASS   |
| H — ADMIN via public customer sign-in → refused, no customer capability             | PASS   |

The console / pageerror / hydration / Dev-Overlay gate is applied to every case.

### Honest limitation

Supabase's sign-up mail quota was exhausted during the investigation, so the
end-to-end path _through a delivered email_ was not exercised in this run. The
suite detects the rate-limited response and still asserts the security-critical
half — never `/admin`, and no Administrator session surviving — which holds
whether or not the provider accepts the sign-up. The positive destination
contract is proven deterministically instead by driving `/verify-email`, the
exact destination `signUpAction` produces.

## Re-verification after the fix

| Suite                                             | Result                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `auth-session-isolation.spec.ts` desktop / mobile | 13/13 · 13/13                                                                               |
| `p12-persona-matrix.spec.ts` desktop              | 19/19                                                                                       |
| `auth-state-machine.spec.ts` desktop              | 12/12 (includes "malformed and wrong-context callbacks never reach protected destinations") |
| `routing-auth.spec.ts` desktop + mobile           | all pass                                                                                    |
| Unit (`vitest run`)                               | 161/161 across 17 files                                                                     |
| Typecheck · lint · build                          | clean                                                                                       |

Mobile skips in `auth-state-machine.spec.ts` are the suite's own documented
design ("real persona writes run once on desktop"), not new.

## Full-suite regression after the fix, and what it exposed

`npx playwright test --project=desktop` (1.3h): **239 passed, 3 failed, 5 skipped,
20 did not run.**

All three failures were caused by the Phase-12 fixture dataset being resident in
the shared database while the _public and admin_ suites ran. None is a product
regression and none touches the authorization fix. Proven by re-running the same
three files after fixture cleanup: **45/45 pass**, which also covers the 20 that
had been cut short by serial-mode cascade.

| Failure                                                          | Cause                                                                                                                                      | Class |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `admin-catalog` — "reference data comes from the database"       | `hasText: "Ethiopia"` is a substring match; a fixture origin also matched, so the option count was 2 instead of 1                          | C     |
| `admin-reference` — "varieties: create reaches the coffee form"  | Passed in isolation; it was a serial-cascade artifact of the earlier failure                                                               | C     |
| `public-inquiry` — "a real offer's price is absent from source…" | The fixture price `7.5` matched inside a Lucide shield-check **SVG path** (`3.5 7.5-7.66`) on an `aria-hidden` icon — not a rendered price | C     |

**Recommendation, not applied:** that last assertion scans raw HTML for the price
as a bare substring, so any short numeric price can collide with SVG geometry or
CSS. A real offer priced 7.50 would fail it spuriously, and a security test that
cries wolf gets ignored. Hardening it (excluding SVG path data, or requiring a
token boundary) would preserve the property while removing the fragility. Left
for owner review rather than changed unilaterally, since altering a security
assertion is the owner's call and it passes against real data today.

## P12-T06 — cleanup of run `mtm8t63k0qe`

```
fixture rows deleted        : 133
fixture auth users deleted  : 4
refused (not manifest-owned): 0
pre-existing rows missing   : 0
pre-existing rows modified  : 1   -> site_settings:1
fixture residue remaining   : 4   -> four inquiries
protected account present   : true (baseline true)
```

Independently verified afterwards: storage `e2e/mtm8t63k0qe/` → **0 objects**;
fixture auth users → **0 of 4**; protected account present, not banned,
confirmed, `role=USER is_blocked=false`.

Every Phase-12 fixture is gone. The two flagged items are **not** Phase-12's, and
both were attributed from evidence rather than assumed:

**`site_settings:1`.** The baseline was captured at `00:55:55Z`, when
`updated_at` was `2026-09-03T21:51:22Z`; it now reads `2026-09-04T02:49:10Z` —
during the full e2e suite, hours after seeding. It carries no Phase-12
fingerprint: `updated_by` is null, `org_logo_media_id` and
`org_default_og_media_id` are both null and were never fixture media (so cleanup
left nothing dangling), and `org_brand_name` is intact. The project's own Phase-8
CMS/branding tests exercise this form; that is their approved behaviour. Phase 12
never wrote to this row — it deliberately skipped the logo singleton, and the
earlier `mtm4uk2mwvx` cleanup reported zero modified rows.

**Four inquiries.** Created `02:51Z`, addressed `qa-oa-*@example.invalid` — the
Owner-Alignment public-inquiry convention, not Phase-12's
`e2e-hills-<run>-…@example.com`. **0 of 4 appear in this run's manifest**, so
cleanup correctly refused to touch them. They are the `public-inquiry` suite's
own leftovers. They were left in place: deleting a row whose ownership cannot be
proven from the active manifest is exactly what the Phase-12 rules forbid, and
the safety machinery behaving this way is the mechanism working, not failing.

`CLEANUP: FAIL` in the script output reflects those two non-Phase-12 items. The
Phase-12 fixture lifecycle itself is clean: 133 rows, 4 auth users, 11 storage
objects created and removed, nothing pre-existing deleted, nothing dangling.

### Finding worth the owner's attention

Running the **full project e2e suite** against this shared non-production project
mutates `site_settings` and leaves inquiry rows behind. That is a property of the
pre-existing suite, not of Phase 12. The "zero pre-existing rows modified"
guarantee holds for the Phase-12 fixture lifecycle; it does not extend to a full
suite run against the owner's project.

---

# Phase 12 closure — evaluated against the official gate

Re-evaluated strictly against `tasks.md` P12-T01–T07, `plan.md` "Phase 12", and
`spec.md`. Owner confirmations recorded: authenticated visual review
**APPROVED**; real confirmation-email acceptance **PASS**; the signup/Admin
session-isolation regression fixed and permanently regression-tested.

## Is a real password-recovery inbox click part of the official gate? NO

The official P12-T06 names exactly **one** manual step, and it is the
confirmation email:

- **Goal**: "record the one manual step — _a real confirmation-email
  click-through_ — as a signed acceptance rather than an assumed pass."
- **Tests required**: "a post-cleanup query confirming zero residue; a recorded,
  signed observation of _the manual email click_ producing a genuinely
  `email_confirmed_at`-set account."

Searching the whole P12 task block (`tasks.md` lines 1035–1132) for
`recovery|reset|forgot|password` returns exactly one hit, and it is about
fixture-password storage hygiene — not a recovery acceptance. `plan.md`'s
Phase 12 section requires "an approved staging Supabase project with an approved
email-testing strategy" and says nothing about recovery delivery. P12-T07 adds
no requirement of its own: "all conditions in P12-T06 hold with recorded
evidence."

**Conclusion: a real password-recovery inbox click is not an official P12
acceptance-gate requirement.** It entered through later conversational prompts
only, so per the closure instruction it does not block P12-T07. The Supabase 429
is classified as an **environment / provider rate-limit limitation**, not a
product regression.

### What was actually observed on the recovery path

| Item                                                                | Result                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Application recovery request path (`POST /auth/v1/recover` reached) | PASS                                                                                                                                  |
| Supabase response                                                   | **429 rate limited**                                                                                                                  |
| Real recovery email delivery                                        | **NOT EXECUTED — provider rate limit**                                                                                                |
| Neutral anti-enumeration UI response preserved                      | PASS — `forgotPasswordAction` returns `ok("recoveryEmailSent")` unconditionally, including for missing accounts and provider failures |
| Raw provider error exposed publicly                                 | NO                                                                                                                                    |
| Recovery security automated coverage                                | PASS                                                                                                                                  |

Recovery security coverage that genuinely ran and passed:
`auth-state-machine.spec.ts:175` "genuine recovery token is single-use and reset
invalidates its session"; `auth-state-machine.spec.ts:250` "malformed and
wrong-context callbacks never reach protected destinations"; and 14/14
`flow-token` + `policy` unit tests covering the signed recovery-intent binding
that stops a signup token being re-labelled recovery by editing `next`. No real
recovery email was received, and none is claimed.

## P12-T06 conditions, item by item

| Official condition                                                              | Evidence                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cleanup removes exactly what P12-T01 created, reverse FK order, manifest-driven | 133 rows + 4 auth users + 11 storage objects per run; 0 refused; 21-step reverse-FK order                                                                                                                                                                       |
| **DB contract:** zero remaining `E2E-HILLS-` rows after a full run              | Verified by query: `coffees`, `origins`, `regions`, `site_pages` → 0; `media.storage_path ilike 'e2e/%'` → 0; both runs `0/4` auth users remaining and 0 users matching either run id                                                                           |
| Post-cleanup residue query                                                      | Run and recorded above                                                                                                                                                                                                                                          |
| Signed manual confirmation-email acceptance                                     | **Owner-confirmed PASS**                                                                                                                                                                                                                                        |
| No fixture secret or PII in any log/screenshot artifact                         | `tests/e2e/.p12-runs/current.json` (the only file holding a fixture password) **purged** after cleanup. Visual baselines contain no secret and no real PII — only synthetic `@example.com` addresses of now-deleted accounts — and are gitignored               |
| **EN/AR:** manual email once per locale, _or noted if only one template exists_ | Only one template exists. There is no locale-aware email template in the repository (`grep` for email/mail template across `src/` and `supabase/` returns nothing); Supabase's built-in single global template is used. Explicitly noted, as the clause permits |
| Zero unexplained failures/skips in the required automated matrix                | 3 full-suite failures, all explained and re-verified 45/45 after cleanup; skips are the suites' own documented design                                                                                                                                           |
| Visual diffs reviewed and approved                                              | **Owner-confirmed APPROVED**                                                                                                                                                                                                                                    |
| Console clean across every persona                                              | Gate active on every authenticated test; all green                                                                                                                                                                                                              |

## Non-Phase-12 residue — reported, deliberately not deleted

Ownership could not be proven from an active run manifest for any of these, so
per the absolute cleanup rule none was touched.

1. **`site_settings.updated_at`** bumped at `02:49Z` by the project's own Phase-8
   branding tests during the full suite. No Phase-12 fingerprint: `updated_by`
   null, both media columns null and never fixture media, brand name intact.
2. **Four inquiries** (`qa-oa-*@example.invalid`, `02:51Z`) from the
   `public-inquiry` suite. 0 of 4 in the Phase-12 manifest.
3. **21 `e2e-hills-` auth users** from **earlier phases** — email prefixes `p3`
   and `p5desk…`, created 2026-09-01 and 2026-09-03, i.e. _before_ the Phase-12
   baseline at `2026-09-04T00:55:55Z`. All `manifestOwned=NO`. These are Phase-3
   and Phase-5 suite leftovers and are protected pre-existing data under the
   owner's rule.
4. **One orphaned storage object** at `e2e/mtm4nv6r27j/` from an aborted seed
   whose manifest no longer exists on disk. No `media` row references anything
   under `e2e/`, so it is inert. Left in place for the same reason.

Items 3 and 4 are pre-existing test hygiene the owner may wish to clear
separately; Phase 12 has no manifest proof of ownership and therefore did not.

## Final status

| Task                                      | Status                |
| ----------------------------------------- | --------------------- |
| P12-T01 fixture dataset                   | PASS                  |
| P12-T02 real authenticated sessions       | PASS                  |
| P12-T03 five-persona matrix               | PASS                  |
| P12-T04 console/runtime gate              | PASS                  |
| P12-T05 authenticated visual regression   | PASS (owner approved) |
| P12-T06 cleanup + manual email acceptance | PASS                  |
| P12-T07 acceptance gate                   | PASS                  |

No schema, RLS, or security-model change was made. `requireAdmin()`,
`requireVerifiedUser()`, `requireAccountOwner()` and the authoritative
`profiles.role` contract are unchanged. No assertion was weakened to obtain a
pass.
