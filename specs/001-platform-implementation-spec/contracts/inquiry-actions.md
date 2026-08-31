# Contract: Product & Sample Inquiry Actions

All results use `ActionResult`. Creation actions require
`requireVerifiedUser()` (FR-036). Status-change actions require
`requireAdmin()`.

## `createProductInquiry({offerId, subject, message})`

- **Effect**: server resolves `coffee_id` from the trusted, visible
  `offerId` (never trusts a client-supplied coffee id); inserts an
  `inquiries` row with `type = 'PRODUCT'`.
- **Preconditions checked in order**: verified unblocked USER →
  profile completeness (phone, address, country present — FR-036) → offer
  visible/published.
- **Returns**: `VERIFICATION_REQUIRED`, `VALIDATION` (with `fieldErrors`
  naming the missing profile field), `NOT_FOUND` (offer not visible), or
  `OK` with the new `requestCode`.

## `createSampleRequest({offerId})`

- Same precondition ordering as `createProductInquiry`.
- **Effect**: resolves `coffee_id` from the trusted offer; attempts an
  insert with `type = 'SAMPLE_REQUEST'`. No quantity input is ever accepted
  (FR-037).
- **Duplicate handling**: the insert may fail on
  `uq_inquiries_active_sample_user_coffee`. On that specific
  unique-violation, the action MUST catch it, look up the caller's existing
  active request for that `coffee_id`, and return `DUPLICATE_SAMPLE` with
  `conflict.requestCode` set (FR-039, SC-005) — it MUST NOT surface the raw
  constraint violation.
- **Returns**: `VERIFICATION_REQUIRED`, `VALIDATION`, `NOT_FOUND`,
  `DUPLICATE_SAMPLE`, or `OK` with the new `requestCode`.

## `updateInquiryStatus(inquiryId, newStatus)` (Admin, Lead Inbox)

- **Effect**: performs a plain `UPDATE ... SET status = newStatus`; the
  live `validate_inquiry_status_transition()` trigger is the sole arbiter of
  whether the transition is legal (FR-041) and the sole writer of
  `inquiry_status_history` (FR-042). The application MUST NOT pre-validate
  and silently no-op an illegal transition — it must attempt the write and
  translate the resulting database exception.
- **Returns**: `CONFLICT` (mapped from `invalid_inquiry_status_transition` /
  `invalid_sample_request_status_transition` / `sample_status_not_allowed_
  for_inquiry_type`), `NOT_FOUND` (inquiry not visible/deleted), or `OK`.
- **`DELIVERED`** always means an Admin's own recorded confirmation of
  physical delivery (FR-043) — this action is never triggered by anything
  other than an explicit Admin selection.

## `listLeadInbox({type?, status?, warehouseSlug?, dateRange?, query?, page, pageSize})` (Admin)

- Server-side search/filter/pagination, URL-persisted by the caller.
- For a `SAMPLE_REQUEST` row, the response includes the count and summary of
  the same customer's **other** requests for the same `coffee_id` (any
  status) so Admin can see prior history including previously `CLOSED`
  requests (FR-040).

## `getInquiryDetail(inquiryId)` (Admin) / `getOwnInquiryDetail(requestCode)` (customer)

- Admin variant: any inquiry. Customer variant: only rows where
  `user_id = auth.uid()`; returns `NOT_FOUND` otherwise (no enumeration).
- Both return the full immutable `inquiry_status_history` timeline.
