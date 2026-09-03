# Contract: Public (Anonymous) Inquiry Actions

Pre-Phase 12 Owner Alignment Addendum. Implements `spec.md` FR-069–FR-082.
Sibling to `contracts/inquiry-actions.md` (the authenticated actions), which
this contract does not modify: a signed-in verified customer continues to
use `createProductInquiry`/`createSampleRequestInquiry` unchanged (FR-076).
These two new actions are reachable with **no session at all**.

All results use `ActionResult` (`contracts/action-result.md`). Neither
action calls `requireVerifiedUser()` — that is the entire point — but both
independently re-derive every field they write; nothing from the client is
trusted beyond "a value was submitted for this field."

## `submitPublicRfq({fullName, email, phone, message, website})`

- **Effect**: calls `public.submit_public_inquiry(p_full_name, p_email,
  p_phone, p_offer_id => null, p_subject => null, p_message, ...)` via the
  ordinary anon-key server client (`createSupabaseServerClient()` — the same
  helper the authenticated actions already use; no service-role key). The
  database function inserts `type = 'GENERAL'`, `status = 'NEW'`, `user_id`
  left null.
- **`website` is a honeypot** (`z.string().max(0)`), matching the exact
  field name and shape already used by `createProductInquiry`/
  `createSampleRequestInquiry`. A non-empty value is rejected as `VALIDATION`
  without revealing that a honeypot check exists.
- **Rate limiting**: rejected as `RATE_LIMITED` if the per-IP in-process
  counter (server-action layer) or the per-normalized-email counter (inside
  `submit_public_inquiry`, against `public.inquiries.email`/`created_at`) is
  exceeded. Neither check's failure is distinguishable from the other in the
  response — both map to the same `RATE_LIMITED` code and the same
  `messageKey`, so neither signal is usable to fingerprint which control
  tripped.
- **Preconditions checked in order**: honeypot empty → field validation
  (full name, email, phone, message present and well-formed) → rate limit
  (IP, then normalized email) → database insert.
- **Returns**: `VALIDATION` (with `fieldErrors`), `RATE_LIMITED`,
  `CONFIGURATION` (Supabase not configured), or `OK` with the new
  `requestCode` (FR-077 — no confirmation email is sent; the code is the
  entire confirmation).
- **Never returns**: `VERIFICATION_REQUIRED`, `AUTH_REQUIRED`,
  `DUPLICATE_SAMPLE` — a `GENERAL` inquiry has no duplicate-identity rule
  (FR-075).

## `submitPublicSampleRequest({offerId, fullName, email, phone, address, countryCode, message, website})`

- **Effect**: calls `public.submit_public_inquiry(...)` with `p_offer_id`
  set, so the database function builds `type = 'SAMPLE_REQUEST'`. The
  existing `hydrate_inquiry_context()` trigger resolves `coffee_id` from the
  offer and raises if the offer doesn't exist, is archived, or its coffee is
  unpublished — this action does not pre-check offer visibility itself; it
  relies on the same server-side resolution guarantee FR-037/FR-071 already
  require, and translates the resulting exception rather than re-deriving
  the check.
- **`website` honeypot and rate limiting**: identical shape and precedence
  to `submitPublicRfq` above.
- **Address/country are required here and only here** (FR-071) — a
  `GENERAL` submission through `submitPublicRfq` never asks for them.
- **Duplicate handling**: the insert may fail on
  `uq_inquiries_active_sample_anon_email_coffee`. On that specific
  unique-violation the action MUST catch it and return `DUPLICATE_SAMPLE`
  with the localized "already active" message (FR-073, FR-074). It MUST NOT
  surface the raw constraint name.

  **It MUST NOT return `conflict.requestCode`.** This is the one place the
  anonymous path deliberately differs from `createSampleRequestInquiry`, and
  the difference is intentional. A signed-in customer's duplicate is proven
  to be *theirs* by `user_id = auth.uid()`, so returning their own code is
  correct. An anonymous submitter types whatever email they like — returning
  the code would let anyone probe "does this person have an active request
  for this coffee, and what is its reference?" about a third party who never
  consented. The refusal itself already discloses the minimum needed to
  explain why the request was declined; the reference adds nothing the
  submitter is entitled to.

  This is also why no lookup is attempted: `anon` cannot read `inquiries`
  (RLS denies it), and the fix for that would be either widening a policy or
  moving the read into the `SECURITY DEFINER` function — both of which would
  build the disclosure described above rather than avoid it.
- **Preconditions checked in order**: honeypot empty → field validation
  (including address/country) → offer resolved server-side (delegated to the
  database function/trigger, per above) → rate limit → insert → duplicate
  mapping.
- **Returns**: `VALIDATION`, `RATE_LIMITED`, `NOT_FOUND` (offer not
  visible/resolvable — mapped from the trigger's raised exception, never
  shown as raw exception text), `DUPLICATE_SAMPLE`, `CONFIGURATION`, or `OK`
  with the new `requestCode`.
- **Never accepts**: a quantity value, a `user_id`, or any snapshot field —
  same guarantee as the authenticated path (FR-037), inherited from the same
  trigger rather than re-implemented.

## What is explicitly unchanged

- `createProductInquiry`, `createSampleRequestInquiry`,
  `updateInquiryStatus`, `listLeadInbox`, `getInquiryDetail`/
  `getOwnInquiryDetail` (`contracts/inquiry-actions.md`) — no signature,
  precondition, or return-shape change.
- `uq_inquiries_active_sample_user_coffee` and every status-transition rule
  in `data-model.md` — untouched (FR-076, owner requirement #7).
- The Admin Lead Inbox reads `full_name`/`email`/`phone`/`company_name`
  directly off the `inquiries` row already, independent of `user_id`
  (`lead-inbox.ts`) — an anonymous row needs no new Admin-side query or
  column mapping to appear there correctly (FR-080).
