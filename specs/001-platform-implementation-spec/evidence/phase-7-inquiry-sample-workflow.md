# Phase 7 Evidence — Inquiry and sample delivery workflow

**Recorded**: 2026-09-01
**Branch**: `main`; Phases 0–5 committed, Phases 6–7 uncommitted
**Phases 0–6**: not redone; re-run as regressions only.
**Database**: **unchanged**. No migration, function, trigger, RLS policy, index
or bucket was created, altered or dropped. The pending N32 Variety translation
migration was not touched.

---

## The starting picture

Phase 7 did not begin from nothing — an inquiry action, a sample-request
orchestrator and a customer request timeline all existed. A live-database audit
of the four objects Phase 7 depends on, read against that code, found the
existing implementation disagreed with the database on three points that each
broke the feature outright.

The authoritative live contract, read from the database itself:

| Object                                   | Contract                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inquiry_status` enum                    | `NEW`, `RECEIVED`, `CONTACTED`, `SAMPLE_SENT`, `DELIVERED`, `CLOSED`                                                                                                                                                                                                                                                             |
| `inquiry_type` enum                      | `GENERAL`, `PRODUCT`, `SAMPLE_REQUEST`                                                                                                                                                                                                                                                                                           |
| `uq_inquiries_active_sample_user_coffee` | partial unique on `(user_id, coffee_id)` where `type = 'SAMPLE_REQUEST'` and `status = ANY('{NEW,RECEIVED,CONTACTED,SAMPLE_SENT,DELIVERED}')`                                                                                                                                                                                    |
| `validate_inquiry_status_transition()`   | `BEFORE UPDATE OF status`. SAMPLE_REQUEST: NEW→(RECEIVED\|CLOSED), RECEIVED→(CONTACTED\|CLOSED), CONTACTED→(SAMPLE_SENT\|CLOSED), SAMPLE_SENT→(DELIVERED\|CLOSED), DELIVERED→CLOSED. PRODUCT/GENERAL: NEW→(RECEIVED\|CLOSED), RECEIVED→(CONTACTED\|CLOSED), CONTACTED→CLOSED. `CLOSED` terminal. All rejections raise **23514**. |
| `hydrate_inquiry_context()`              | `SECURITY DEFINER`, `BEFORE INSERT`. Sets `user_id = auth.uid()`, derives `coffee_id` from `offer_id`, snapshots offer reference / warehouse code / coffee name.                                                                                                                                                                 |
| `track_inquiry_status()`                 | `AFTER INSERT` and `AFTER UPDATE OF status`. **The sole writer of `inquiry_status_history`.**                                                                                                                                                                                                                                    |

Four defects, all found before any Phase 7 feature work:

**N42 (CRITICAL) — the duplicate rule covered three statuses, not five.**
`ACTIVE_SAMPLE_STATUSES` was `[NEW, RECEIVED, CONTACTED]`. The live index
predicate covers `SAMPLE_SENT` and `DELIVERED` as well. The application
pre-check therefore believed a request that had reached "sample sent" was
inactive and let a customer submit again — where the index refused it and the
customer got a generic failure instead of "you already have one".

**N43 (CRITICAL) — the whole sample lifecycle was untypeable.**
`types.generated.ts` declared `InquiryStatus` as four values. The database has
had six all along. `SAMPLE_SENT`/`DELIVERED` could not be referenced in typed
code at all. (This is the third time this curated file has drifted from the
live schema — see N25, N30.)

**N44 (HIGH) — a blocked customer and an Administrator could both create
requests.** Both inquiry actions gated on a bare `getViewer()` plus an
`emailVerified` check. That is neither of the project's two authorization
models: it admits a blocked user holding a valid session, and it admits an
ADMIN acting as a customer. Constitution Principle V requires
authenticated + confirmed + unblocked + `role = 'USER'`.

**N45 (HIGH) — a second, weaker status writer existed.**
`updateWorkflowStatusAction` in `admin-operations.ts` also wrote
`inquiries.status`. It validated against a four-value enum (so `SAMPLE_SENT`
and `DELIVERED` were unreachable through the Admin UI) and returned
`error.message` — the provider's own text — straight to the client. The
transition trigger's wording would have gone on screen verbatim.

---

## P7-T01 — Unique violation → `DUPLICATE_SAMPLE` — **PASS**

`ACTIVE_SAMPLE_STATUSES` now mirrors the index predicate exactly, with the
predicate quoted in the source so the next edit has to confront it.

The application pre-check is kept, but it is not the guarantee — the index is.
`insertRequest` returns the sentinel `"DUPLICATE"` on **23505**; the
orchestrator then re-reads the surviving request and returns
`DUPLICATE_SAMPLE` with `conflict.requestCode`. No constraint name, SQLSTATE or
provider text crosses the wire; the client receives a message key it resolves
in its own locale.

The duplicate identity is `user_id + coffee_id + type`, never `offer_id`.

**Runtime proof** — `tests/integration/inquiry-lifecycle.test.ts`:

- _FLOW B_: an active request on offer A; the same customer submitting for
  offer B (a different warehouse, same coffee) is refused with **23505**, while
  a different coffee succeeds.
- _FLOW C_: two `insertSample` calls issued in the same
  `Promise.all` — exactly one row survives, the other returns 23505, no raw
  error escapes.

**Browser proof** — `tests/e2e/inquiry-workflow.spec.ts` FLOW A/B: the refusal
reads "You already have an active sample request for this coffee", carries the
surviving code, offers a link to open it, and is asserted **not** to match
`/duplicate key|uq_inquiries|23505|violat/i`.

---

## P7-T02 — Transition rejection → `CONFLICT` — **PASS**

`updateInquiryStatusAction` does not carry a copy of the transition graph. It
`requireAdmin()`s, attempts the write, and translates the outcome. A **23514**
whose message names one of the trigger's three rejection reasons becomes
`CONFLICT` + `statusTransitionRejected`.

Optimistic concurrency: the UPDATE is scoped `.eq("status", expectedStatus)` —
the status the Admin's page was rendered with. A stale page matches zero rows,
which is also mapped to `CONFLICT`. It cannot overwrite newer state.

`allowedNextStatuses()` lives in `src/lib/inquiries/transitions.ts`, is
documented as presentation-only, and is deliberately **not** exported from the
`"use server"` module (every export of a server-action file must be an async
server function — it would not have built).

`track_inquiry_status()` remains the only writer of history; nothing in the
application inserts there.

**Runtime proof** — live database:

| Attempt                                  | Result                                      |
| ---------------------------------------- | ------------------------------------------- |
| PRODUCT → `SAMPLE_SENT`                  | 23514, status unchanged, **no history row** |
| PRODUCT → `DELIVERED`                    | 23514, status unchanged, **no history row** |
| NEW → `CONTACTED` (skipping RECEIVED)    | 23514                                       |
| RECEIVED → `NEW` (backward)              | 23514                                       |
| CLOSED → `RECEIVED` (terminal)           | 23514                                       |
| stale update (`expectedStatus` outdated) | 0 rows; the newer status survives           |
| customer updating their own request      | 0 rows; status unchanged                    |

**Browser proof**: the stale-page test opens the same request in two Admin
tabs, lets one advance it, and asserts the other is told "This request has
changed…" and that the text does not match
`/23514|trigger|constraint|invalid_inquiry/i`.

---

## P7-T03 — Admin Lead Inbox — **PASS**

`src/lib/data/lead-inbox.ts` + `/admin/inquiries` and `/admin/inquiries/[id]`.
`"inquiries"` was removed from the generic `[module]` renderer, and the legacy
`updateWorkflowStatusAction` inquiry branch was deleted (N45).

Everything is evaluated by the database: `count: "exact"` + `.range()` for
pagination, `.eq()` for the type/status filters, one `.or(...)` of `ilike`
across request code, customer name, email and coffee name for search. There is
no full-table fetch and no client-side filtering. `PGRST103` (a page past the
last row) returns an empty page with the true total rather than an error.

Filter values are validated against `LEAD_TYPES` / `LEAD_STATUSES` before
reaching PostgREST: a hand-edited query string cannot turn into an enum
comparison error.

The detail page shows customer, coffee, offer and warehouse context, the
customer's own message, the complete `inquiry_status_history` timeline, and —
for a sample request — prior same-coffee requests with each one's status, which
is what distinguishes a legitimate post-CLOSED request from an active duplicate
(FR-040).

Status actions are task-oriented buttons derived from
`allowedNextStatuses(type, status)`. There is no free-form status dropdown; the
suite asserts `form select[name="status"]` has **count 0**.

**Browser proof**: searching a request code returns exactly one row; a type
filter that excludes it renders the real empty state; a PRODUCT inquiry is
offered "Mark received" and "Close request" but **not** "Record sample sent" or
"Record delivery"; after RECEIVED, "Mark received" is gone.

---

## P7-T04 — Customer status wording — **PASS**

The gap was worse than two missing labels. Three separate copies of this
vocabulary existed: `account.statuses` (six values), the
`account.requestDetail.statuses` map (four), and hardcoded type labels. The
request **list** and request **detail** pages read the four-value copy, so a
customer whose sample had actually been sent saw the raw string `SAMPLE_SENT`,
while the dashboard — reading the other copy — showed it correctly.

Three copies of one vocabulary is what allowed that. They are collapsed into a
single top-level `inquiryStatus` / `inquiryType` namespace, resolved through
`src/lib/inquiries/labels.ts`, read by every customer and Admin surface. A
missing key now fails the EN/AR parity test instead of reaching a customer.

Wording follows the specification, not the previous catalogue:

| Status        | EN               | AR              |
| ------------- | ---------------- | --------------- |
| `NEW`         | Submitted        | تم الإرسال      |
| `RECEIVED`    | Request received | تم استلام الطلب |
| `CONTACTED`   | Contacted        | تم التواصل      |
| `SAMPLE_SENT` | Sample sent      | تم إرسال العينة |
| `DELIVERED`   | Sample delivered | تم تسليم العينة |
| `CLOSED`      | Closed           | مغلق            |

`DELIVERED` had been labelled "Delivered", which reads as a fact about a
parcel. FR-043 is explicit that it means an administrator **recorded**
confirmation of physical delivery, and states "Sample delivered" verbatim.
Nothing in the copy implies automatic dispatch, guaranteed delivery, customer
self-confirmation or stock reservation.

A `locale === "ar" ? {…} : {…}` label table on the coffee detail page was also
removed in favour of an `inquiry` message namespace — that pattern is precisely
how a label gets added in one language only.

---

## P7-T05 — Dialog accessibility — **PASS**

The dialog shell is now the shared `src/components/ui/modal-dialog.tsx`, the
behaviour Phase 4's `ConfirmDialog` established, written once rather than
twice. The form logic inside it was not changed by this task.

`tasks.md` suggested `@base-ui/react`'s primitive. The project's own shell was
used instead: it is already proven in production here, and adopting a second
dialog implementation for one component would have left the codebase with two.

Two real defects the keyboard test found:

**N46 — focus landed on the spam honeypot.** The focusable-node selector
matched `input:not([type="hidden"])` regardless of `tabindex="-1"` or
`aria-hidden`. The honeypot is an off-screen, aria-hidden, `tabindex="-1"`
input — and it is the first non-button node in the dialog, so a keyboard user
opening the dialog landed on a field they could neither see nor be told about.
The filter now excludes `tabIndex === -1` and `aria-hidden="true"` nodes.

**N47 — a rejected submission erased the form.** React resets uncontrolled
fields once a form action settles, so a validation failure threw away
everything the customer had typed. Both inquiry forms now hold their own
values.

**Runtime proof**: `aria-modal="true"`, `aria-labelledby` and
`aria-describedby` all present; focus lands on the message field (not the close
button); 8 forward and 8 backward Tab presses never leave the dialog;
`body` computes `overflow: hidden`; Escape closes and returns focus to the
trigger.

---

## P7-T06 — Lifecycle test matrix — **PASS**

### Live-database suite — `tests/integration/inquiry-lifecycle.test.ts` — 11/11

| #   | Proves                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | FLOW A — insert snapshots context from `auth.uid()`/`offer_id`; all five transitions; **6 history rows, one per transition**, in order, with correct `old_status` chain |
| 2   | FLOW E — a CLOSED request no longer blocks a new one; the old history is untouched                                                                                      |
| 3   | FLOW B — a different offer for the same coffee is refused; a different coffee is not                                                                                    |
| 4   | FLOW C — two concurrent inserts, exactly one survivor, the other 23505                                                                                                  |
| 5   | PRODUCT → SAMPLE_SENT/DELIVERED rejected; no history written; status unchanged                                                                                          |
| 6   | skipped, backward and post-CLOSED transitions all rejected; history stays `[NEW, RECEIVED, CLOSED]`                                                                     |
| 7   | a stale update matches zero rows; the newer status survives                                                                                                             |
| 8   | anonymous insert denied; blocked-user insert denied; customer B cannot read customer A's row by id **or** by request code                                               |
| 9   | a customer cannot change their own request's status                                                                                                                     |
| 10  | **zero fulfillment side effects** — the offer row is byte-for-byte identical (`SELECT *` before/after) across NEW→RECEIVED→CONTACTED→SAMPLE_SENT→DELIVERED              |
| 11  | no `quantity` and no `bags` column exists on `inquiries`                                                                                                                |

### Browser suite — `tests/e2e/inquiry-workflow.spec.ts` — 9/9

FLOW A/B, FLOW D + PRODUCT-only action set, FLOW A/E full sample lifecycle with
the customer seeing each recorded status, the stale-Admin refusal, the
incomplete-profile path, inline validation with value preservation, the
keyboard script, cross-customer isolation, and the Arabic Lead Inbox.

Isolation detail: `/account/requests/<someone else's code>` returns **404**,
identical to a code that belongs to nobody — a 404 never reveals that a request
exists. `/admin/inquiries` and `/admin/inquiries/<id>` are closed to a customer.

RTL detail: `html[dir=rtl]`, `lang=ar`, localized option labels (not raw
enums), request-code links carry `dir="ltr"`, and the document does not scroll
horizontally.

### Full regression

| Suite                             | Result                                        |
| --------------------------------- | --------------------------------------------- |
| `npm test` (hermetic unit)        | **103 passed**, 12 files                      |
| `npm run test:integration` (live) | **85 passed**, 6 files                        |
| Playwright `--project=desktop`    | **138 passed, 8 skipped, 0 failed** (8.4 min) |
| Playwright `--project=mobile`     | **71 passed, 75 skipped, 0 failed** (1.9 min) |
| Playwright dev config             | **73 passed, 0 failed**                       |
| `npm run typecheck`               | clean                                         |
| `npm run lint`                    | clean                                         |
| `npm run build`                   | clean                                         |

Per the Phase 6 N39 lesson, the production server was rebuilt from a cleared
`.next` and **verified before every run** (`/robots.txt` → 200, `/admin` → 307,
`/admin/inquiries` → 307) rather than trusting `reuseExistingServer`.

### Scope checks

- **No sample quantity** anywhere: actions, orchestrator, adapters, Admin
  detail, customer UI, fixtures. Only the assertion that it must not exist.
- **No Realtime** added. `grep` for `.channel(` / `postgres_changes` across
  `src/` returns nothing. Phase 7 acceptance does not require it.
- **Service role** untouched — still confined to `admin-users.ts` and
  `admin-users.ts`'s read path, both Phase 5 modules.
- **No marketplace surface** added: no cart, checkout, payment, vendor,
  reservation, shipment, tracking or automatic fulfillment.

### Test-data lifecycle

Every fixture account is `e2e-hills-p7-…@example.com` or
`p1fx-p7…@example.com` — the reserved `example.com` domain with a per-run tag —
and every inquiry a run creates is deleted with it. Verified after the final
run against the live database:

```
stray P7 fixture accounts: 0
inquiries rows: 0 | history rows: 0
QA catalog preserved -> coffees: 2 offers: 3
```

The owner-approved Phase 6 QA catalog was **not** touched. Unlike catalog rows,
lead rows are not owner fixtures to keep, so Phase 7 leaves none behind.

---

## P7-T07 — PHASE 7 ACCEPTANCE GATE — **PASS**

Every P7-T06 condition holds with the runtime and database evidence recorded
above. No claim in this document rests on source inspection.

### Findings closed in Phase 7

| ID  | Severity | Finding                                                                             |
| --- | -------- | ----------------------------------------------------------------------------------- |
| N42 | CRITICAL | active-sample status set covered 3 of the index's 5 statuses                        |
| N43 | CRITICAL | `InquiryStatus` missing `SAMPLE_SENT`/`DELIVERED`                                   |
| N44 | HIGH     | blocked users and Administrators could create customer requests                     |
| N45 | HIGH     | a second status writer returned raw provider text and knew 4 statuses               |
| N46 | MEDIUM   | dialog focus landed on the aria-hidden honeypot input                               |
| N47 | MEDIUM   | a rejected submission erased the customer's typed values                            |
| N48 | MEDIUM   | the final legal transition confirmed nothing to the Administrator                   |
| —   | LOW      | `SAMPLE_SENT`/`DELIVERED` rendered as raw enum names on two customer pages (P7-T04) |

### Deliberately not done

- **N32** (Variety Arabic translations) — untouched, still awaiting owner
  approval, as instructed.
- **Admin visual redesign** — Phase 10.
- **Realtime** — optional and not required by this gate.
- `updateWorkflowStatusAction` still returns `error.message` for its **offers**
  and **content** branches. That is a pre-existing Phase 6 surface and a
  Constitution Principle XII concern, but it is outside Phase 7's scope and was
  not widened into. **Recorded as N49 (MEDIUM) for Phase 11.**

### Carried forward

- **P3-T06** remains PENDING on one manual Gmail confirmation.
- **N23** still needs an owner decision.
