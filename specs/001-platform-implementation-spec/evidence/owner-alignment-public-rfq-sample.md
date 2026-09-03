# Pre-Phase 12 Owner Alignment Addendum — implementation evidence

**Live resume checkpoint.** Updated as work completes so an interrupted or
compacted session can continue without repeating proven work.

**Status: OA-T01 through OA-T11 COMPLETE. Gate PASSED.**

---

## Migrations

| Migration | File | Applied | Verified |
|---|---|---|---|
| A — reconciliation | `migrations/PP12-T01_inquiries_public_rfq_sample_reconciliation.sql` | Delta was already live before this addendum; file reconciles the repo | Empirically re-probed 2026-09-03: `SAMPLE_REQUEST`+NULL user accepted · `PRODUCT`+NULL user rejected `23514` · duplicate normalized email+coffee rejected `23505` · padded/uppercase email still collided (proves `lower(btrim(email))`) |
| B — public write boundary | `migrations/PP12-T02_submit_public_inquiry_function.sql` | **APPLIED LIVE by the owner** via Supabase SQL Editor ("Success. No rows returned.") | Its own OID-resolved `DO` block passed at apply time (it aborts otherwise). Independently re-confirmed after application: `anon` executes it; a malformed email returns `P0001 public_inquiry_invalid_field`; a real `authenticated` session is denied |

**No existing migration was edited, renamed, moved, or rewritten.** Neither
new file contains a policy statement — verified by grep for
`create/alter/drop policy`, `row level security`, and table grants; the only
match is a comment. **RLS was not widened.**

### Hardening applied to Migration B before the owner ran it

1. **Bounded validation inside the function.** `anon` holds `EXECUTE`, so the
   RPC is reachable directly through PostgREST — the Zod schema is a
   convenience, not the boundary. Name ≤200, email ≤320 + shape, phone against
   the project's exact `PHONE_PATTERN`, message 10–2000, address ≤400, company
   ≤160, subject ≤160, country exactly two letters. New token
   `public_inquiry_invalid_field`, mapped to `VALIDATION`.
2. **Concurrency-safe per-email limit.** `pg_advisory_xact_lock(hashtextextended(email,0))`
   before the count — transaction-scoped, keyed on the normalized email, so a
   read-then-write race cannot lift the hourly ceiling.
3. **Exact-signature verification** via `to_regprocedure(...)` and the
   resolved OID. Fixed a real defect while doing it:
   `has_function_privilege('public', …)` would have **errored** (`public` is a
   pseudo-role, not in `pg_authid`) and failed the migration for the wrong
   reason — PUBLIC is now checked through `aclexplode(proacl)` for grantee `0`,
   with a separate guard for a `NULL` proacl (default `EXECUTE`-to-PUBLIC).
4. **Error-raising normalized** to the default `P0001` used by
   `admin_list_users`, removing the risk of PostgREST mapping a custom
   `ERRCODE` class to an unexpected HTTP status.

---

## Integration proof (real database, `anon` role through PostgREST)

`tests/integration/public-inquiry.test.ts` — **17/17 passing**:

- direct anonymous `INSERT` into `inquiries` **denied (42501)**
- a real `authenticated` session **denied EXECUTE** on the function
- anonymous `SELECT` on `inquiries` returns nothing
- `GENERAL` row created: `status=NEW`, `user_id=NULL`, `coffee_id=NULL`,
  `offer_id=NULL`, request code returned and matching the stored row
- repeated `GENERAL` submissions accepted (no duplicate rule — FR-075)
- `SAMPLE_REQUEST` created with `coffee_id` **derived server-side** from the
  trusted offer, snapshot populated, `country_code` normalized
- sample without address/country → `public_inquiry_missing_field`
- offer that is not publicly visible → `public_inquiry_invalid_offer`
- second active request, same normalized email + coffee (deliberately messy
  casing/whitespace) → `23505` on `uq_inquiries_active_sample_anon_email_coffee`
- same email, **different** coffee → succeeds independently
- after the first reaches `CLOSED` → the same pair is accepted again
- `PRODUCT` anonymously impossible → `23514` on `inquiries_product_needs_user`
- field bounds enforced for a direct RPC caller (8 cases) and a country code
  that is not exactly two letters
- no rejection carries table/column/constraint/SQL text
- per-email hourly limit engages
- **10 concurrent same-email submissions cannot exceed the ceiling** — the
  advisory-lock proof

---

## Application layer

Built and proven in a real browser before Migration B existed (so these are
independent of it):

- `/request-a-quote` anonymous branch renders the RFQ form; H1 reads
  "Request an offer" for a visitor, and the signed-in branches are untouched
- empty submit → per-field inline errors + summary, `novalidate`, **no native
  browser popup**
- typed values survive a rejection; focus moves to the first invalid field
- honeypot filled → refused, indistinguishable from ordinary validation
- sample dialog on the coffee/offer surface: 9 fields incl. honeypot and
  hidden `offerId`, 3-step explainer, 6 inline errors on empty submit
- the `PRODUCT` control for an anonymous visitor still links to `/sign-in`
- **zero protected-price leak** on `/`, `/ar`, `/request-a-quote`,
  `/ar/request-a-quote`
- 14/14 app-layer browser tests: EN/AR × light/dark, 360px and 375px, axe,
  keyboard, reduced motion

Static gates at last run: typecheck ✅ · lint ✅ · build ✅ · unit 139/139 ✅ ·
message parity ✅ (both catalogues, +54 keys each, no key added in one
language only).

---

## Browser proof — real submissions, real rows, real Lead Inbox

`tests/e2e/public-inquiry.spec.ts` — **19/19 passing** (desktop). Adds to the
app-layer coverage above:

- an anonymous `GENERAL` RFQ submitted in the browser returns a real
  `HC-XXXXXXXXXX` code, in EN and in AR (rendered `dir="ltr"` inside RTL)
- an anonymous `SAMPLE_REQUEST` submitted from a real coffee page does the same
- a second active request for the same normalized email + coffee is refused
  **without disclosing a code or a constraint name**
- **per-IP throttle proven in-browser**: one address sending its own
  `x-forwarded-for` is allowed through, then refused, and stays refused. It
  submits a well-formed but nonexistent offer id, so every attempt reaches the
  limiter and **no rows are written** — the answer changing from "offer
  unavailable" to "too many requests" is what proves the limiter spoke rather
  than the database

`tests/e2e/public-inquiry-admin.spec.ts` — **3/3 passing**. The FR-080 chain,
end to end, with a real Administrator session:

| Proof | Result |
|---|---|
| Anonymous `GENERAL` → row `type=GENERAL`, `status=NEW`, `user_id=NULL` → code visible in the existing Lead Inbox searched by the submitter's email | PASS |
| Anonymous `SAMPLE_REQUEST` → row with server-derived `coffee_id` + snapshot → visible in the same inbox | PASS |
| Administrator advances an anonymous lead using the **existing** status control (`button[name="status"]`, no anonymous-only affordance) and the transition persists | PASS |

One real defect was found and fixed in the test, not the product: the status
assertion raced the server action's revalidation. `waitForLoadState`
("networkidle") can resolve before the transition commits, so the assertion is
now polled against the database. The refusal alert is also surfaced explicitly,
so a genuine rejection would be reported as a rejection rather than as a stale
status.

---

## Runtime-error gate (development mode, where React's dev warnings exist)

`tests/e2e/dev-runtime.spec.ts` already covered `/request-a-quote` as a page.
Extended with the interaction, which is where hydration and dev-only warnings
actually surface: **3/3 passing** for RFQ submit (EN), RFQ submit (AR) and the
sample dialog submit. For each: `console.error` = 0, `pageerror` = 0, hydration
= 0, Next.js Dev Overlay = absent, and no client-rendered `<script>`.

---

## Protected pricing — checked against the real numbers

`expectNoPriceLeak` matches a *shape* (`$12.50/kg`) in rendered text and JSON-LD.
That cannot catch the leak that matters most here: a server component that
fetches a protected price, declines to render it, and still ships it to the
browser inside the RSC flight payload. Nothing is displayed, so a text scan
passes while the number sits in view-source.

So a dedicated test reads the **real** `offer_price_tiers.price_per_kg_usd`
values (7.25, 6.40, 5.90, 5.25 … up to 50 tiers) and asserts each is absent
from, on `/`, `/green-coffee-offer-list`, `/ar/green-coffee-offer-list` and
`/request-a-quote`:

- the **raw HTML source** — every meta tag, inline script and the whole flight
  payload
- the body of **every** `text`/`json`/`javascript` response the page fetched

Matching is bounded by non-digits so `5.25` cannot "leak" out of a hash or a CSS
length, and the test refuses to run if no priced tier exists — a vacuous scan
would be worse than no scan. **Zero leaks.** It also asserts the catalog
actually rendered offers, so the clean result cannot come from an empty page.

Separately, the built output was scanned for the service-role credential:
**546 files** across `.next/static` and `.next/server/app`, **0** containing the
secret value and **0** mentioning `SUPABASE_SERVICE_ROLE` by name.

---

## Final regression gate — one authoritative pass

| Gate | Result |
|---|---|
| `tsc --noEmit` | PASS |
| `eslint .` | PASS |
| `next build` | PASS |
| Unit (Vitest) | **139/139** |
| Integration, live database (Vitest) | **122/122** across 9 files |
| Playwright desktop | **227 passed, 5 skipped, 0 failed** (25.4m) |
| Playwright mobile | **126 passed, 105 skipped, 0 failed** (8.0m) |
| Playwright dev-mode runtime | **76/76** (2.1m) |
| Playwright cross-browser (chromium + firefox) | **84 passed, 8 skipped, 0 failed** — ImageReveal healthy on both engines |

### Three failures were seen along the way, and none was a product defect

Recorded because "it passed on the re-run" is only honest if the reason is
known:

1. **Two Admin origin-CRUD tests** failed in one desktop run. Cause: that run
   was executing while other Playwright commands were being run by hand against
   the same server and database. Re-run in isolation: **19/19**. The only edits
   between the green run and that one were to test files.
2. **The Arabic Lead Inbox RTL test** failed in a contended run that took 2.0h
   instead of 25m. Re-run alone and again in file context: **9/9**. The final
   clean gate above includes it, green.
3. **My own per-IP browser test** failed on mobile with "throttled at attempt
   1". That one was real, and the test was right to fail: it used a fixed
   address, and the limiter's ten-minute window meant the desktop run's bucket
   was still full when the mobile run reached it. Fixed by claiming a fresh
   address per run.

### Two tests were strengthened, not weakened

- **`still sends an anonymous visitor to sign-in for a PRODUCT inquiry`** used
  a page-wide `a[href*="/sign-in"]` with `.first()`. That matched the *header's*
  sign-in link, not the inquiry panel's — so it passed on desktop for the wrong
  reason and failed on mobile by matching a hidden nav link. It now anchors on
  the sample control and asserts the PRODUCT sibling is a link, which is what
  FR-079 actually says. The product was correct throughout.
- **The Admin workflow test** asserted the status immediately after
  `waitForLoadState`, which can resolve before the server action's revalidation
  commits. It now polls the database and surfaces any refusal alert explicitly,
  so a genuine rejection is reported as a rejection rather than as a stale
  status.

---

## Scope boundaries held

No schema change beyond the two migrations. No RLS policy added or widened.
No new table, column, or enum. No cart/checkout/payment/seller/custody
mechanic. The authenticated sample flow (`user_id` + coffee) and every
existing Admin behaviour are untouched. Deferred by approved scope only:
transactional confirmation email, third-party CAPTCHA/Turnstile, and any
dedicated marketing route beyond the canonical `/request-a-quote`.
