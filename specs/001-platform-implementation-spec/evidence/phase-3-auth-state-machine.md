# Phase 3 Evidence — Auth state machine and authorization policy

**Recorded**: 2026-09-01
**Branch**: `main` · base commit `f08ca2d` ("add and finish PHASE 2")
**Phases 0–2**: COMPLETE, gates PASSED — not re-run, only regression-tested.

**Phase 3 task IDs**: `P3-T01` … `P3-T06`.

This phase was worked in three passes: Claude opened it, Codex carried most of
the implementation, and this pass reconciled the tree, root-caused the
owner-observed runtime blocker, and closed the phase out.

---

## The owner-observed blocker

The owner manually ran the real journey — real signup form, real Supabase
confirmation email to Gmail, real click on the confirmation link — and reported
that the flow returned to `localhost` and **sign-in did not work**.

That observation was correct and it overrode the automated suite, which was
green at the time. Reproducing it exposed a defect no existing test could see.

### Reproduction

Driven with a genuine Supabase-minted confirmation token
(`auth.admin.generateLink`, which produces the exact token and URL a real
confirmation email carries) clicked in a real browser against a freshly
started dev server. Observed chain **before** the fix:

```
[303] https://<ref>.supabase.co/auth/v1/verify?token=<redacted>&type=signup&redirect_to=…
[303] http://localhost:3000/auth/callback?next=%2Faccount        <- no ?code, no ?token_hash
[200] http://localhost:3000/verify-email?error=link_expired      <- "That link is no longer valid"
```

Final URL carried the session in the **fragment**:
`…/verify-email?error=link_expired#access_token=<redacted>&refresh_token=<redacted>&type=signup`

Authoritative state at that moment: `email_confirmed_at` **SET**, profile
present, `role = USER`, `is_blocked = false` — **the confirmation had actually
succeeded** — while the application displayed a hard failure and established
**zero session cookies**.

### Root cause

Supabase's `/auth/v1/verify` endpoint returns the resulting session one of two
ways. When the originating request registered a PKCE challenge it redirects
with `?code=`; otherwise it falls back to the **implicit flow** and returns
`#access_token=…&refresh_token=…`.

**A URL fragment is never transmitted to the server.** `/auth/callback` is a
route handler, so on an implicit-flow confirmation it sees a callback with
neither `code` nor `token_hash`, cannot distinguish a valid confirmation from a
malformed link, and fell through to its `link_expired` branch. A successful
email confirmation therefore rendered as a broken link with no session — which
is exactly what the owner saw.

Two further defects surfaced while fixing it:

1. **`/auth-continue` was unroutable.** The proxy matcher excludes `auth`, and
   the alternatives are prefixes, not whole segments — so `/auth-continue`
   matched the exclusion, was never locale-rewritten, and returned 404. Since
   `actionRedirectPath()` pointed every Server Action redirect at it, that hop
   was broken as well. Attempting to anchor the matcher with `(?:/|$)` broke
   Next's matcher parsing and 404'd every unprefixed English route, so the
   matcher was restored **byte-identical to HEAD** and the route was renamed
   instead.
2. **StrictMode aborted the fix.** The first fragment-handler implementation
   used a cleanup-set `cancelled` flag. React's development StrictMode mounts,
   cleans up, and remounts, so the first (real) run's in-flight navigation was
   cancelled by its own cleanup and the page stalled on "Completing sign-in…".

### Fix

| File                                       | Change                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/auth/confirm-fragment.tsx` | **new** — client component that reads the fragment, hands the tokens to the browser Supabase client via `setSession`, clears the fragment from the address bar/history, then returns to the server for classification. Guarded by a `useRef` so the destructive one-shot read survives StrictMode; no cleanup-based cancellation. |
| `src/app/[locale]/continue/page.tsx`       | renamed from `auth-continue/` (the `auth` prefix collided with the proxy exclusion); gained `mode=confirm`, which renders the fragment handler.                                                                                                                                                                                   |
| `src/app/auth/callback/route.ts`           | when nothing is exchangeable, delegates to the fragment handler instead of declaring the link expired — the fragment survives because the `Location` header carries none (RFC 7231 §7.1.2). Accepts `settled=1` on the return trip and then runs the **same** server-side classification.                                         |
| `src/lib/auth/redirects.ts`                | `actionRedirectPath` retargeted to the renamed route.                                                                                                                                                                                                                                                                             |
| `messages/en.json`, `messages/ar.json`     | `auth.responses.completing`, `auth.responses.continueManually`.                                                                                                                                                                                                                                                                   |

The client never decides entitlement. It only transports a session that the
server then re-reads and judges — `email_confirmed_at`, profile presence,
`is_blocked`, `role`, and the live `hills_is_verified_user()` / `is_admin()`
helpers all still run server-side in the callback.

### Verified after the fix

```
[303] https://<ref>.supabase.co/auth/v1/verify?token=<redacted>&type=signup&redirect_to=…
[303] http://localhost:3000/auth/callback?next=%2Faccount
[200] http://localhost:3000/continue?mode=confirm&next=%2Faccount
[200] https://<ref>.supabase.co/auth/v1/user                       <- setSession
[303] http://localhost:3000/auth/callback?settled=1&next=%2Faccount <- server classification
[200] http://localhost:3000/account                                 <- protected destination
```

| Check                           | Result                                       |
| ------------------------------- | -------------------------------------------- |
| auth user exists                | YES                                          |
| `email_confirmed_at`            | **SET**                                      |
| session established             | YES — 1 `sb-*` cookie, domain `localhost`    |
| profile exists                  | YES                                          |
| `profile.role`                  | `USER`                                       |
| `profile.is_blocked`            | `false`                                      |
| `company_name`                  | **persisted** (`"Probe Co"`)                 |
| callback host                   | `localhost` throughout — one coherent origin |
| cookies valid for final host    | YES                                          |
| `signInWithPassword`            | SUCCESS                                      |
| application customer guard      | **PASS** (`hills_is_verified_user() = true`) |
| landed on protected destination | YES — `/account`                             |

---

## Host / cookie and Supabase URL audit

- `NEXT_PUBLIC_SITE_URL` is `http://localhost:3000`; `emailRedirectTo` is built
  from it, and the whole journey stayed on `localhost` — no `localhost` vs
  `127.0.0.1` split. The callback deliberately emits **relative** `Location`
  headers so a redirect cannot migrate the browser to a different canonical
  host and strand host-only Auth cookies.
- **Supabase URL shape**: the client must receive the bare project origin. The
  configured value in this environment carries a `/rest/v1/` suffix, which
  `getSupabaseConfig()` (`src/lib/supabase/config.ts`) normalises defensively;
  every client in `src/` goes through that helper, so nothing is broken today.
  `.env.example` previously did not document `NEXT_PUBLIC_SUPABASE_URL` at all
  — it now documents the correct shape explicitly, and
  `src/lib/supabase/config.test.ts` (**new**) pins the normalisation so a raw
  `createClient()` call can never silently regress it.

---

## Environmental findings that shape real-email QA

Both discovered empirically against the live project:

1. **The public signup path rejects `@example.com`** with
   `email_address_invalid`, while the Admin API accepts it. Fixtures must be
   provisioned through the Admin API.
2. **Outbound email is rate-limited** — repeated real signups return
   `429 email rate limit exceeded`. Automated tests therefore mint confirmation
   tokens with `auth.admin.generateLink`, which exercises the identical
   Supabase verify → callback path without depending on SMTP.

---

## Task outcomes

| Task                                           | Status    | Evidence                                                                                                                                                                          |
| ---------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P3-T01` `ActionResult` contract               | **PASS**  | closed domain-code set in `src/lib/actions.ts`; actions return `messageKey`, never a localized or raw provider string, so no `locale === "ar" ?` branching remains in action code |
| `P3-T02` sign-in / admin sign-in state machine | **PASS**  | `src/lib/auth/policy.ts` encodes the exact ordering; 12/12 real-persona tests                                                                                                     |
| `P3-T03` three-minute UX presentational-only   | **PASS**  | account is neither deleted nor invalidated when the window elapses; resend rate limit enforced server-side via cookie, independent of the client countdown                        |
| `P3-T04` callback real-state re-verification   | **PASS**  | re-reads user _and_ session; **plus** the implicit-fragment path fixed this pass                                                                                                  |
| `P3-T05` recovery-session enforcement          | **PASS**  | signed flow token binds a recovery intent to the email; recovery context is a server-set marker, single-use                                                                       |
| `P3-T06` **PHASE 3 GATE**                      | see below |                                                                                                                                                                                   |

### N1 (HIGH) — closed

`requireVerifiedUser()` now requires **authenticated AND email-confirmed AND
`role = USER` AND not blocked**, and composes the live
`hills_is_verified_user()` helper rather than becoming a second, drifting
definition. `getViewer()` selects `is_blocked`, which it previously did not.
A blocked customer holding a valid session loses capability on the next
request — proven by the real-persona test "an active USER session loses
capability on the next request after blocking".

ADMIN does not inherit customer entitlement: `requireVerifiedUser()` rejects
`role !== "USER"`, matching the database helper exactly (Constitution VI).

---

## Test results

| Suite                                                      | Result                                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` (unit)                                          | **53/53**, 9 files                                                                                                                    |
| `npm run test:integration` (Phase 1 security/RLS)          | **50/50**                                                                                                                             |
| `npx playwright test auth-state-machine --project=desktop` | **12/12** real-backend Auth personas                                                                                                  |
| `npm run test:e2e` (production gate)                       | **146 passed, 32 skipped, 0 failed**                                                                                                  |
| `npm run test:e2e:dev` (dev gate, Phase 2 locale/runtime)  | **72 passed, 1 flaky** (dev-compile latency, passes on retry)                                                                         |
| `npm run typecheck`                                        | PASS, 0 errors                                                                                                                        |
| `npm run lint`                                             | PASS, 0/0                                                                                                                             |
| `npm run build`                                            | PASS, **54/54** static pages                                                                                                          |
| `npm run format:check`                                     | 41 files, all documentation/tooling (`.agents` 10, `.claude` 10, `.specify` 10, `specs` 10, `docs` 1); **0 in `src/`, 0 in `tests/`** |

One production-suite expectation was updated, not weakened: the Phase 2 test
`/auth/callback stays outside locale routing` allowed `[200, 307, 308]`, and
the callback now answers **303** when delegating to the fragment handler. The
allowed set gained `303` and the test additionally asserts the callback never
redirects into a locale-prefixed copy of itself — a stronger guarantee than
before.

`src/lib/security-boundaries.test.ts` expectations were retargeted from
`/en/auth-continue` to `/en/continue` to follow the route rename. The
assertions still pin exact output.

## Phase 2 regression

`src/proxy.ts` is **byte-identical to HEAD** (verified with
`git diff --ignore-all-space`); only its line endings were normalised. The
locale-switch suite is green (44/44), `/en` still 308s away, `/auth/callback`
remains outside locale routing, and `/ar/auth/callback` still 404s.

## Phase 1 regression

50/50. No migration, no schema change, no policy change, no Realtime change in
this phase. Blocked-user RLS, avatar policies, protected pricing, inquiry
policies, sample uniqueness and `admin_list_users` authorization are all
untouched and still enforced.

---

## Real email QA

The confirmation **code path** is proven end to end with a genuine
Supabase-issued confirmation token clicked in a real browser, and the resulting
authoritative Supabase state and successful sign-in are recorded above.

The one segment that cannot be automated here is Gmail delivery plus a human
click. That is marked **MANUAL EMAIL CLICK REQUIRED** and is not claimed as
passed.

## New findings

| #       | Severity   | Finding                                                                                                                                                                                                                                                       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N13** | **HIGH**   | Supabase confirmation links may return the session in the URL **fragment** (implicit flow) rather than `?code=`. Any future change to `/auth/callback` must keep the fragment delegation, or successful confirmations will silently present as expired links. |
| **N14** | **MEDIUM** | The proxy matcher's exclusions (`api`, `auth`, `trpc`) are **prefixes, not whole segments**, so any locale-routed page whose path starts with those letters becomes unroutable. Anchoring them with `(?:/                                                     | $)` breaks Next's matcher parser; the working mitigation is to avoid such route names. |
| **N15** | **MEDIUM** | Server Action redirects are applied by the App Router client against the internally-rewritten tree, so they must target `/${locale}/…` to force the proxy's 308 and a fresh document request. Using the canonical unprefixed path yields a client-side 404.   |
| **N16** | **LOW**    | Outbound email is rate-limited and the public signup path rejects `@example.com`; automated Auth fixtures must use the Admin API and `generateLink`.                                                                                                          |

---

# ADDENDUM — 2026-09-01, orphan reconciliation, error UX, password visibility

This pass acted on the owner's orphan-account scan and closed the remaining
Phase 3 UX gaps. `P3-T06` deliberately stays open pending one manual
confirmation.

## Current provisioning trigger — PASS

Proven before changing anything, with one controlled Admin-API fixture:

| Check                         | Result                                       |
| ----------------------------- | -------------------------------------------- |
| `auth.users` created          | YES                                          |
| `public.profiles` created     | **YES**                                      |
| `profiles.id = auth.users.id` | true                                         |
| `profiles.role`               | `USER`                                       |
| `profiles.is_blocked`         | `false`                                      |
| `full_name` persisted         | `"Trigger Probe"`                            |
| `phone` persisted             | `"+201234500001"`                            |
| `company_name`                | `null` (trigger does not set it — by design) |

Two further controlled fixtures confirmed:

- **`company_name` never blocks provisioning.** A signup with no
  `company_name` still produced a correct `USER` profile with
  `company_name = null`.
- **Role can never come from metadata.** A fixture created with hostile
  `user_metadata.role = "ADMIN"` still received `role = USER`. The trigger
  hard-codes `'USER'` and `prevent_profile_role_escalation` guards changes.

`handle_hills_new_user()` was **not modified**. The owner's hypothesis was
correct: the orphan is historical, not a current trigger failure.

## The orphan — diagnosis and repair

| Field                | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| orphan count         | **1**                                                          |
| account              | `sh***@gmail.com` (`6be11094-…`)                               |
| `email_confirmed_at` | SET                                                            |
| `created_at`         | 2026-08-31T11:54:56Z                                           |
| `last_sign_in_at`    | 2026-09-01T03:07:32Z                                           |
| metadata             | `full_name`, `phone` present; **no** `company_name`; no `role` |

This is the same orphan first recorded as **N6** during Phase 1, so it predates
Phase 3 entirely. It could not be reproduced with the current trigger, which
provisions correctly. Root cause is therefore historical — the account was
created before the current provisioning path, or its profile was removed — and
is not diagnosable further from the data available.

**It was also the second root cause of the owner's original "sign-in did not
work" report.** With no profile row, `customerSignInDecision` saw `role: null`,
fell through to `FORBIDDEN`, and the customer was told _"This account cannot
access protected customer features."_ — for an ordinary, correctly confirmed
account.

**Repair**: a single targeted, service-role `INSERT`, deterministic and
idempotent-guarded. It refuses to run if more than one orphan exists (no mass
backfill), refuses if a profile already exists (no duplicate rows), takes
`full_name`/`phone` only from authoritative Auth metadata, and hard-codes
`role = 'USER'`, `is_blocked = false`. Role was never read from metadata.

Verified after: profile exists, `id` matches, `role = USER`,
`is_blocked = false`, **0 orphans remaining, exactly 1 row for that id**.

Final database state: 2 auth users / 2 profiles / **0 orphans**.

## Missing-profile error UX

`customerSignInDecision` gained a distinct **`PROFILE_MISSING`** outcome, placed
after the verification and blocked checks so precedence is preserved (an
unconfirmed or blocked account is still classified on that basis first, even
when the profile is also absent).

It grants nothing — a missing profile still means no capability — but it is now:

- reported with its own localized message
  (`auth.responses.accountSetupIncomplete`), not the misleading
  "cannot access protected customer features";
- logged server-side with the Auth id only, never DB internals, so it is
  diagnosable;
- mapped to the contract's designated last-resort `UNEXPECTED` code rather than
  inventing a new one, keeping the closed `DomainErrorCode` set intact. The
  precision lives in the `messageKey`, which is what drives UX.

A failed profile _lookup_ is treated the same way, for the same reason.

The dedicated Admin entry still collapses every denial to `FORBIDDEN` and
discloses nothing.

## Signup vs resend rate limiting

Audited separately, as instructed. They are **not** merged:

| Operation           | Application cooldown                                                                                 | Provider limit                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Resend verification | 60s, server-enforced via the `hills-verification-resend` cookie, independent of the client countdown | surfaced as `RATE_LIMITED`                             |
| Sign-up             | **none**                                                                                             | genuine Supabase/SMTP `429` surfaced as `RATE_LIMITED` |

`signUpAction` never reads the resend cookie, so changing to a different signup
email cannot inherit stale resend state. The message the owner saw during
signup was therefore a **real provider limit**, correctly surfaced — but it
carried resend-flavoured wording. Signup now has its own
`auth.responses.signupRateLimited` copy that says the details were not lost.
Neither is ever presented as a capability error.

## Password visibility control

Added to the shared `Field` in `src/components/forms/auth-forms.tsx`, so every
Auth password input gets it: sign-up (password **and** confirm password),
sign-in, and reset password — all five password inputs render through that one
component.

Design notes:

- Only the input's `type` changes, so the DOM preserves the typed value. The
  value is never copied into React state, a URL, storage, analytics, or a log.
- The button is **outside** the `<label>` element: a `<button>` inside a label
  re-dispatches the click to the labelled control in some browsers.
- `type="button"`, so it can never submit the form.
- `aria-pressed` reflects state; `aria-controls` points at the input;
  `aria-label` is localized (`Show password` / `Hide password` ·
  `إظهار كلمة المرور` / `إخفاء كلمة المرور`).
- Positioned with logical properties (`end-0`, `pe-12`, `rounded-e-xl`) so it
  flips correctly in RTL.
- Uses the existing lucide icon set — no new dependency.

**Runtime verification: 75/75 assertions, 0 console errors**, covering
`/sign-up`, `/ar/sign-up`, `/sign-in`, `/ar/sign-in` — hidden by default, type
flips both ways, value preserved across both toggles, label and `aria-pressed`
flip, reachable by Tab, never submits, and operable in dark mode.

`/reset-password` correctly renders **no** password input without a genuine
recovery context, which is the Phase 3 guard working. A probe that attempted
recovery without an app-minted recovery intent was refused to
`/sign-in?error=link_expired` — also correct. The reset form's two fields use
the same `Field` component, so they inherit the control by construction, and
the genuine recovery journey is covered by the passing real-persona test
"genuine recovery token is single-use and reset invalidates its session".

## Host / cookie consistency

Unchanged from the previous pass and re-confirmed: `NEXT_PUBLIC_SITE_URL` is
the single origin `emailRedirectTo` is built from, the callback emits
**relative** `Location` headers so a redirect cannot migrate the browser to a
different canonical host, and the whole journey stayed on one origin with the
session cookie scoped to it. No host is hard-coded in application logic.
`.env.example` documents the required bare-origin Supabase URL shape, and
`src/lib/supabase/config.test.ts` pins the normalisation.

## Regression gates

| Gate                                                  | Result                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `npm test` (unit)                                     | **55/55**, 9 files                                         |
| `npm run test:integration` (Phase 1 security/RLS)     | **50/50**                                                  |
| `auth-state-machine` (real Supabase personas)         | **12/12**                                                  |
| `npm run test:e2e` (production)                       | **146 passed, 32 skipped, 0 failed**                       |
| `npm run test:e2e:dev` (dev / Phase 2 locale-runtime) | **73/73**, no flakes                                       |
| `npm run build`                                       | PASS, **54/54** static pages                               |
| `npm run typecheck`                                   | PASS, 0 errors                                             |
| `npm run lint`                                        | PASS, 0 errors / 0 warnings                                |
| `npm run format:check`                                | documentation/tooling only; **0 in `src/`, 0 in `tests/`** |

Two test expectations were updated, neither weakened:

1. `policy.test.ts` expected `role=null → FORBIDDEN`. That is the behaviour the
   owner directed changing, so the case now expects `PROFILE_MISSING`, and two
   precedence cases were **added** (unconfirmed-and-missing, blocked-and-missing).
2. `routing-auth.spec.ts` used `getByLabel(/password/i)`, which became ambiguous
   once the toggle gained a "password" accessible label. It is now scoped to the
   input with `.and(page.locator("input"))` — a more precise assertion, still
   requiring the password field to be visible.

## Findings

| #       | Severity   | Finding                                                                                                                                                                                                                                                                                          |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **N17** | **MEDIUM** | A confirmed account with no `profiles` row is silent at the database layer and previously surfaced as a generic authorization refusal. The `PROFILE_MISSING` path now logs it server-side; if it ever recurs, that log is the signal — investigate provisioning rather than reconciling by hand. |
| **N18** | **LOW**    | Any accessible label containing "password" now collides with `getByLabel(/password/i)`. Future Auth tests should scope such queries to the input element.                                                                                                                                        |

**N6 is closed** — the orphan it recorded has been reconciled and the scan
returns zero.

### Correction — the reconciled account was subsequently removed

Recorded for accuracy. A later verification found that the account repaired
above (`sh***@gmail.com`, `6be11094-…`) no longer exists: `getUserById`
returns "User not found", its `profiles` row is absent, and full pagination
shows a single remaining auth user.

The deletion did not originate from this work. Every diagnostic script deleted
only ids it had created itself within the same run, and the reconciliation
script performs an `INSERT` only. The most plausible explanation is direct
removal in the Supabase dashboard, but that cannot be established from the data
available, so it is left unattributed.

Consequences:

- The reconciliation is **moot** — there is nothing left to repair, and the
  orphan scan returns zero for the trivial reason that the account is gone.
- The **diagnosis stands**: a confirmed account with no `profiles` row was a
  genuine second root cause of the owner's original "sign-in did not work"
  report.
- The **code change stands and is the durable outcome**: `PROFILE_MISSING` is
  now a distinct decision with localized copy and a server-side diagnostic, so
  this class of inconsistency can never again surface as
  "This account cannot access protected customer features".

Database state at time of writing: 1 auth user (Administrator, confirmed),
1 profile, 0 orphans, no leaked test fixtures.
