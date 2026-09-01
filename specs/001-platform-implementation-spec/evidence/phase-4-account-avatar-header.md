# Phase 4 Evidence — Customer account, avatar, and header identity

**Recorded**: 2026-09-01
**Branch**: `main` · base commit `f08ca2d`, with Phase 3 committed
**Phases 0–3**: completed baselines — not redone, only regression-tested.

**Scope check before editing**: `plan.md:549` and `tasks.md:372` both define
Phase 4 as "Customer account, avatar, and header identity". That matches the
expected workstream, so no mismatch was reported and implementation proceeded.

**Note on sequencing**: Phase 3's `P3-T06` gate is still open pending one
manual Gmail confirmation. Phase 4 was executed on instruction. It does not
depend on that click — it depends on the Auth guards, which are proven by the
12/12 real-persona suite and the 50/50 Phase 1 security suite.

---

## Starting state

`src/actions/account.ts` still carried the `LegacyActionResult` shape with a
hardcoded `locale === "ar" ? … : …` copy table, and **no avatar code existed
anywhere** in `src/` beyond the generated `avatar_path` column type. Every
account page authorised with a bare `getViewer()`.

---

## P4-T01 — Avatar upload/delete — **PASS**

New `src/lib/avatar.ts` (pure, no I/O) and `src/lib/data/avatar.ts`
(server-only resolver, shared with Phase 5's Admin viewer).

Enforcement, in order:

1. **Bytes decide, not the browser.** `File.type` and `File.size` are
   attacker-controlled, so the action reads the buffer, re-measures the length
   against the 5 MiB limit, and sniffs the magic bytes. A file is accepted only
   when its declared type and its actual signature agree — a PNG announced as
   JPEG, or a shell script named `.png`, is refused (FR-019).
2. **The path is derived from `auth.uid()`**, never from client input, so a
   traversal or foreign-folder path cannot be requested. Each upload gets a
   unique object name, so a replacement never serves a stale cached image.
3. **The owner-scoped storage policy is the real boundary.** Everything above
   is the first line of defence, not the only one.

Ordering, per the contract: upload the new object → point `profiles.avatar_path`
at it → only then delete the old one. If the profile update fails the new
object is removed rather than orphaned; if the old-object delete fails the
avatar still works, so it is logged rather than surfaced.

`deleteAvatar` clears `avatar_path` and removes only the owner's own
previously-recorded path.

**Storage cache finding.** `remove()` genuinely deletes the object — the
service-role listing returns `[]` — but Supabase Storage keeps serving a
deleted object from its edge cache for the cache lifetime. A test asserting
"download now fails" was therefore testing the CDN, not the delete. Two
consequences: uploads now set `cacheControl: "60"` so a removed avatar stops
being fetchable quickly, and the test asserts the **bucket listing**, which is
authoritative. Residual exposure is bounded anyway by the 10-minute signed-URL
TTL and requires already holding that exact URL.

**Contract migration.** `account.ts` moved onto the real `ActionResult` with
`messageKey`, which is what removed the `locale === "ar"` branching: the server
returns a catalog key and the client resolves it in the active locale
(Constitution XII). `form-primitives.tsx` was migrated to match, and gained the
same password visibility control the Auth forms received in Phase 3.

## P4-T02 — Header avatar/account menu — **PASS**

`src/components/navigation/account-menu.tsx`, wired into `site-header.tsx`.

The header now resolves its persona with **`requireVerifiedUser()`** rather
than the bare `getViewer()` it used before. That single change is what makes
the persona table below correct: an Administrator and a blocked customer both
fail that gate, so neither is rendered as a protected-pricing customer
(Constitution VI and VII).

Accessibility: `aria-haspopup="menu"`, `aria-expanded`, `role="menu"` /
`role="menuitem"`, arrow-key roving focus, Escape closes and returns focus to
the trigger, outside-click closes, 44px targets, and `end-0` placement so the
panel stays on-screen in RTL. **The menu is never given an Admin link** — the
master plan requires the Admin portal to stay out of public navigation.

## P4-T03 — Sign-out confirmation dialog — **PASS**

`src/components/ui/confirm-dialog.tsx`, deliberately generic so Phase 5's Admin
sign-out and Phase 7's destructive actions reuse it rather than each growing
their own. `role="dialog"`, `aria-modal`, focus moved in, focus trapped on Tab
and Shift+Tab, Escape cancels, focus returned to the trigger, body scroll
locked, logical button order for RTL.

Wired into the header menu and — via `sign-out-control.tsx` — into the account
settings page, as `P4-T03` requires.

## P4-T04 — Account overview — **PASS**

Every figure is now a real query scoped to the caller: favorites count, active
sample requests (`type = 'SAMPLE_REQUEST' AND status != 'CLOSED'`), and the five
most recent requests. The previous page showed a single all-inquiries count.
Request codes render `dir="ltr"` inside RTL.

## P4-T05 — Favorites cross-user isolation — **PASS**

Proven against RLS, not just application code: a customer's read returns only
their own rows, filtering by another customer's id returns nothing, a
cross-user insert is refused, and a blocked customer cannot write favorites at
all.

## P4-T06 — Request history — **PASS**

Ownership proven at the database layer: a customer reads only their own
inquiries, and querying another customer's rows returns empty rather than
raising — which is what keeps a foreign request code a `NOT_FOUND` and not an
enumeration oracle.

## P4-T07 — `account/settings` consolidation — **PASS**

New `account/settings` carries photo, profile, email, password and sign-out.
`account/profile` and `account/security` became `permanentRedirect` stubs, so
no bookmark breaks, and the account nav now points at `settings`. Nothing was
dropped in the merge.

## Account authorization hardening

Every account page moved from `getViewer()` to `requireVerifiedUser()`. The
layout deliberately keeps `getViewer()` because it needs the _reason_ for
denial — blocked, unverified, or wrong role — to route to the right place.

---

## Runtime evidence

### Browser verification — 43/43 assertions, 0 console errors

| Area                  | Result                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Anonymous header      | sign-in CTA shown, no account menu                                                              |
| Verified USER         | menu present, CTA gone, initials fallback                                                       |
| Menu a11y             | `aria-expanded` toggles, Escape closes, **no Admin link**                                       |
| Avatar upload         | `avatar_path` recorded, inside the owner's folder                                               |
| Avatar display        | header renders the image after upload                                                           |
| Avatar replace        | new path issued, **old object cleaned up (1 object remains)**                                   |
| Avatar delete         | `avatar_path` null, **0 objects in bucket**                                                     |
| Legacy redirects      | `/account/profile` and `/account/security` → `/account/settings`                                |
| Sign-out dialog       | opens, `aria-modal`, cancel keeps session, confirm clears it                                    |
| Header after sign-out | resets to sign-in CTA; `/account` denied                                                        |
| **ADMIN**             | no customer menu; cannot enter `/account`                                                       |
| **Blocked customer**  | no customer menu; cannot enter `/account`                                                       |
| EN/AR                 | `/account`, `/ar/account`, `/account/settings`, `/ar/account/settings` all correct `lang`/`dir` |
| Dark mode             | settings renders, avatar control operable                                                       |
| Responsive            | no horizontal overflow at 390 / 820 / 1440                                                      |

### Anonymous route matrix

All ten account routes (EN and AR) return `307` to the locale-correct
`sign-in?next=…`.

---

## Test results

| Suite                                           | Result                                                     |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `npm test` (unit)                               | **67/67**, 10 files                                        |
| `npm run test:integration`                      | **62/62** — Phase 1's 50 plus 12 new Phase 4               |
| `auth-state-machine` (Phase 3 personas)         | **12/12**                                                  |
| `npm run test:e2e` (production)                 | **146 passed, 32 skipped, 0 failed**                       |
| `npm run test:e2e:dev` (Phase 2 locale/runtime) | **73/73**                                                  |
| `npm run build`                                 | PASS, **56/56** static pages                               |
| `npm run typecheck`                             | PASS, 0 errors                                             |
| `npm run lint`                                  | PASS, 0 errors / 0 warnings                                |
| `npm run format:check`                          | documentation/tooling only; **0 in `src/`, 0 in `tests/`** |

### Two test changes, neither weakened

1. **Phase 3's customer sign-out test.** Phase 4 moved sign-out into the header
   menu behind a confirmation dialog, so the old `getByRole("button", {name:
/sign out/i})` on `/account` no longer existed. The test now opens the menu,
   chooses sign out, and confirms in the dialog — it exercises strictly more
   than before. This was a real gap I introduced and then closed: I had removed
   the account-page sign-out without yet adding one to `settings`.
2. **The avatar-delete assertion**, retargeted from the CDN-cached download to
   the authoritative bucket listing (see the storage cache finding above).

### Playwright determinism

Two full production runs failed on _different, unrelated_ tests
(`accessibility → not-found`, then `auth-state-machine → verified USER`), each
passing in isolation. Running with `--workers=1` was clean, so the cause was
worker contention: `auth-state-machine.spec.ts` creates, blocks and deletes
real Supabase accounts, and that shared backend state cannot safely race other
specs. The config is now `fullyParallel: false, workers: 1` — about a minute
slower, and deterministic.

---

## Database and storage changes

**None.** No migration, no schema change, no policy change, no bucket
reconfiguration. The `avatars` bucket remains private (`public = false`,
asserted in the integration suite) and every `avatars_owner_*` policy is
untouched. Phase 1's contract re-ran green at 50/50.

Fixtures created during verification were namespaced and removed; a leftover
avatar folder from a deleted fixture was also cleared. Final state: 2 auth
users, 2 profiles, 0 orphans, empty `avatars` bucket.

---

## New findings

| #       | Severity   | Finding                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N19** | **MEDIUM** | Supabase Storage serves a deleted object from its edge cache for the cache lifetime. Any test asserting deletion must check the bucket listing, not a download. Mitigated with `cacheControl: "60"` on avatar uploads; bounded further by the 10-minute signed-URL TTL.                                                                                                                                    |
| **N20** | **MEDIUM** | The real-backend Auth persona spec mutates shared Supabase state and cannot run in parallel with other specs — it produced intermittent failures in unrelated tests. The suite now runs single-worker. Any future real-backend spec needs the same treatment.                                                                                                                                              |
| **N21** | **MEDIUM** | Concurrent dev servers corrupt `.next` and produce a global `SyntaxError: Unexpected non-whitespace character after JSON` on **every** route, including static ones like `/robots.txt`, while `npm run build` still succeeds. Ten stray node processes were found. Kill all node and delete `.next` before trusting a dev-server symptom — this is the same class as the Phase 2 stale-Turbopack incident. |
| **N22** | **LOW**    | `getViewer()` remains in the account layout on purpose: it needs the denial _reason_ to route correctly. It should not be "hardened" to `requireVerifiedUser()` by a later pass.                                                                                                                                                                                                                           |
