# Data Model: Hills Coffee Platform Implementation

This describes the **already-live** Supabase schema relevant to this plan,
sourced directly from `docs/HILLS_SUPABASE_CURRENT_STATE.md` (authoritative,
current). No column, table, enum, or constraint listed here is proposed —
all of it already exists. This document exists so implementation work has a
single accurate reference instead of re-deriving field names from the
15,000-line raw snapshot repeatedly.

No migration is implied or required by this document.

## Enums (already live)

| Enum | Values |
|---|---|
| `app_role` | `USER`, `ADMIN` |
| `inquiry_type` | `GENERAL`, `PRODUCT`, `SAMPLE_REQUEST` |
| `inquiry_status` | `NEW`, `RECEIVED`, `CONTACTED`, `CLOSED`, `SAMPLE_SENT`, `DELIVERED` |
| `coffee_status` / `article_status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `offer_status` | `ARRIVING_SOON`, `NEW_ARRIVAL`, `IN_STORE`, `DISCOUNT`, `SOLD_OUT`, `INACTIVE` |
| `content_locale` | `en`, `ar` |

## Entity: Profile (`public.profiles`)

Maps to spec **Customer/Administrator Profile**.

| Column | Notes |
|---|---|
| `id` | = `auth.users.id` |
| `full_name`, `phone`, `company_name`, `address`, `country_code` | customer-editable fields (FR-017); never include role/block fields |
| `role` | `app_role`; authoritative per Constitution Principle IV |
| `avatar_path` | nullable, max 500 chars (`profiles_avatar_path_length_check`); private-bucket object path, never a public URL |
| `is_blocked` | boolean, default false; authoritative blocking flag (FR-014, FR-026, FR-029) |
| `blocked_at`, `blocked_by` | audit timestamp + FK to blocking admin's `profiles.id` |
| `block_reason` | nullable, max 1000 chars (`profiles_block_reason_length_check`); internal-only, never shown to the blocked customer (FR-014, FR-026) |

**Protected-field enforcement (already live)**: trigger
`protect_profile_block_fields()` rejects any change to
`is_blocked`/`blocked_at`/`blocked_by`/`block_reason` unless the acting
session is `hills_is_admin()`, and additionally rejects an admin targeting
their own row or a non-`USER` row — this is the database-level backstop for
FR-015 and FR-027, independent of application-layer checks.

**Helper functions (already live)**, used to implement the state machine in
`spec.md` User Story 1:
- `hills_is_blocked()` — current-session block check.
- `hills_is_verified_user()` — `role = 'USER' AND is_blocked = false AND
  auth.users.email_confirmed_at IS NOT NULL` for the current session; this is
  the single source of truth for "protected customer capability" (FR-004,
  FR-030, FR-036).
- `is_admin()` — `role = 'ADMIN' AND is_blocked = false` for the current
  session.
- `admin_set_user_blocked(target_user_id, blocked, reason)` — the sole write
  path for block/unblock; raises on self-target, non-`USER` target, or
  non-admin caller (implements FR-026, FR-027).

## Entity: Avatar Image (Supabase Storage, not a table)

Maps to spec **Avatar Image**.

- Bucket `avatars`: private, `file_size_limit` 5,242,880 bytes (5 MiB),
  `allowed_mime_types` = `image/jpeg`, `image/png`, `image/webp`.
- Storage policies scope every command (`SELECT`/`INSERT`/`UPDATE`/`DELETE`)
  to `(storage.foldername(name))[1] = auth.uid()::text` — owner isolation is
  enforced at the storage layer, not only in application code (FR-020).
- Distinct from bucket `hills-public` (public, 10 MiB limit, adds
  `image/avif`), which holds business/CMS/logo media — this physical
  separation is what implements FR-022.

## Entity: Coffee (`public.coffees`)

Maps to spec **Coffee / Offer / Price Tier** (coffee half).

Columns: `id`, `slug`, `status` (`coffee_status`), `origin_id`, `region_id`,
`coffee_type_id`, `processing_method_id`, `grade`, `altitude_min_meters`,
`altitude_max_meters`, `farm_size_hectares`, `harvest_months`,
`is_featured`, `featured_sort_order`, `deleted_at`, `created_by`,
`updated_by`, timestamps.

**Constraint already enforced**: `region_id` must belong to `origin_id`
(existing validation trigger) — this is the database backstop for FR-035.

## Entity: Offer (`public.coffee_offers`)

Columns: `id`, `coffee_id`, `warehouse_id`, `reference_number`, `status`
(`offer_status`), `is_visible`, `bags_quantity`, `bag_weight_kg`,
`packaging_type_id`, `cup_score`, `currency_code`, `pricing_unit`,
`available_from`, `deleted_at`, timestamps.

## Entity: Price Tier (`public.offer_price_tiers`)

Columns: `id`, `offer_id`, `min_bags`, `price_per_kg_usd`, timestamps. **Not**
in the Realtime publication (confirmed) — must only ever be read through the
dedicated protected-price query path (FR-031), never subscribed to.

## Entity: Origin (`public.origins`) / Region (`public.regions`)

Maps to spec **Origin / Region**.

- `origins`: `id`, `slug`, `country_code`, `continent`, `harvest_months`,
  `is_active`, `is_featured`, `featured_sort_order`, `deleted_at`,
  timestamps.
- `regions`: `id`, `slug`, `origin_id` (FK, dependent — FR-033/FR-035),
  `is_active`, `deleted_at`, timestamps.

## Entity: Inquiry (`public.inquiries`)

Maps to spec **Inquiry (Product / Sample Request)**.

Columns: `id`, `inquiry_number`, `request_code`, `type` (`inquiry_type`),
`status` (`inquiry_status`), `user_id`, `coffee_id`, `offer_id`,
`coffee_name_snapshot`, `offer_reference_snapshot`,
`warehouse_code_snapshot`, `full_name`, `email`, `phone`, `company_name`,
`address`, `country_code`, `subject`, `message`, timestamps. **No quantity
column exists** — this is the schema-level guarantee behind FR-037.

**Concurrency-safety (already live)**: unique index
`uq_inquiries_active_sample_user_coffee` on `(user_id, coffee_id)` **WHERE**
`type = 'SAMPLE_REQUEST' AND status IN ('NEW','RECEIVED','CONTACTED',
'SAMPLE_SENT','DELIVERED')`. This is the authoritative, race-safe
implementation of FR-038/FR-039/SC-005 — the prior application-only
read-then-insert check is now backstopped by a real database constraint, and
a unique-violation on insert must be caught and mapped to the
`DUPLICATE_SAMPLE` domain error with the winning request's code looked up
and returned.

**Status-transition enforcement (already live)**: trigger function
`validate_inquiry_status_transition()`, `BEFORE UPDATE OF status`. Same-value
update is a no-op. For `SAMPLE_REQUEST`: `NEW→{RECEIVED,CLOSED}`,
`RECEIVED→{CONTACTED,CLOSED}`, `CONTACTED→{SAMPLE_SENT,CLOSED}`,
`SAMPLE_SENT→{DELIVERED,CLOSED}`, `DELIVERED→CLOSED`. For any other type:
`NEW→{RECEIVED,CLOSED}`, `RECEIVED→{CONTACTED,CLOSED}`, `CONTACTED→CLOSED`,
and `SAMPLE_SENT`/`DELIVERED` are explicitly rejected. `CLOSED` is terminal.
This is the database-level implementation of FR-041/FR-043; the application
must treat a rejected transition (raised exception) as the `CONFLICT` domain
error and must not attempt to pre-validate and skip calling the database.
This function is untouched by the Pre-Phase 12 addendum below (owner
requirement #7: "no status-transition-function change").

**Row-creation derivation (already live, unchanged by this addendum)**:
`BEFORE INSERT` trigger `hills_hydrate_inquiry_context` →
`hydrate_inquiry_context()`, `SECURITY DEFINER`, owner `postgres`. Sets
`new.user_id = auth.uid()` **only when `auth.uid()` is not null** — for an
anonymous caller it leaves `user_id` exactly as the INSERT supplied it
(nothing, i.e. `NULL`). When `offer_id` is present it derives `coffee_id`,
`offer_reference_snapshot`, and `warehouse_code_snapshot` from the offer/
warehouse rows and raises `'Invalid offer'` / `'Offer does not belong to
selected coffee'` if the offer doesn't resolve; it then derives
`coffee_name_snapshot` from the coffee's English translation (or slug). Both
the authenticated path and the addendum's new anonymous path rely on this
same trigger for coffee-context resolution — see "Pre-Phase 12 Owner
Alignment Addendum" below.

**`inquiries_coffee_or_offer_required` (existing, unchanged)**:
`CHECK (type = 'GENERAL' OR coffee_id IS NOT NULL)` — a `GENERAL` inquiry may
have no coffee; `PRODUCT`/`SAMPLE_REQUEST` must resolve one (via `offer_id`,
enforced by the trigger above, not by this constraint directly).

## Entity: Inquiry Status History (`public.inquiry_status_history`)

Columns: `id`, `inquiry_id`, `old_status`, `new_status`, `changed_by`,
`created_at`. Populated automatically alongside every successful transition
— implements FR-042's "exactly one history entry per change."

## Entity: Favorite (`public.favorites`)

Columns: `user_id`, `coffee_id`, `created_at`. Composite ownership key;
maps to spec **Favorite**.

## Entity: Media / Site Settings (`public.media`, `public.site_settings`)

Maps to spec **Media Item / Site Settings**.

- `media`: `id`, `storage_bucket`, `storage_path` (unique pair), `mime_type`,
  `width`, `height`, `file_size_bytes`, `is_public`, `deleted_at`,
  `uploaded_by`, timestamps.
- `site_settings`: singleton row — `org_brand_name`, `org_legal_name`,
  `org_email`, `org_phone`, `org_same_as`, `org_logo_media_id` (FK to
  `media.id` — the existing, reused logo relation per FR-047),
  `org_default_og_media_id`, `default_seo_title_template`,
  `default_seo_description`, `low_stock_threshold`, `updated_by`.

## Entity: Audit Log Entry (`public.audit_logs`)

Admin-only readable; **not** in the Realtime publication (confirmed) — must
only ever be read via a paginated server query, never subscribed to
(implements FR-050 alongside Constitution Principle XVIII).

## State transitions summary

```text
Viewer authorization state (derived, not stored as one column):
  ANONYMOUS
    -> SIGNUP_PENDING -> UNVERIFIED
  UNVERIFIED
    -> (confirm email) -> VERIFIED (transitional)
  VERIFIED
    -> role=USER, is_blocked=false -> AUTHENTICATED_USER
    -> role=ADMIN, is_blocked=false, via /dashboard-admin -> AUTHENTICATED_ADMIN
    -> is_blocked=true -> BLOCKED
  BLOCKED -> (admin unblock + new sign-in) -> AUTHENTICATED_USER
  any -> PASSWORD_RECOVERY -> SIGNED_OUT
  any -> SIGNED_OUT -> ANONYMOUS

Inquiry status (stored, DB-enforced):
  SAMPLE_REQUEST: NEW -> RECEIVED -> CONTACTED -> SAMPLE_SENT -> DELIVERED -> CLOSED
                  (CLOSED reachable directly from NEW/RECEIVED/CONTACTED/SAMPLE_SENT/DELIVERED)
  GENERAL/PRODUCT: NEW -> RECEIVED -> CONTACTED -> CLOSED
                  (CLOSED reachable directly from NEW/RECEIVED/CONTACTED)
```

---

# Pre-Phase 12 Owner Alignment Addendum: Data Model

Implements `spec.md` FR-069–FR-083. Extends the `Inquiry` entity above; adds
no table, column, or enum (per owner requirement — see `research.md` #11–20
for how this was verified rather than assumed).

## Already-applied delta on `public.inquiries` (verified live, 2026-09-03)

- **`inquiries_product_needs_user`** (CHECK, modified): now
  `type = 'PRODUCT' → user_id IS NOT NULL` is the only case enforced;
  `GENERAL` and `SAMPLE_REQUEST` may both have `user_id IS NULL`. Empirically
  confirmed by direct probe (see `research.md` #11) — `PRODUCT` + NULL
  `user_id` still raises `23514`; `SAMPLE_REQUEST` + NULL `user_id` no longer
  does.
- **`uq_inquiries_active_sample_anon_email_coffee`** (UNIQUE INDEX, new,
  already live): partial unique index on
  `(lower(btrim(email)), coffee_id)` **WHERE** `type = 'SAMPLE_REQUEST' AND
  user_id IS NULL AND status IN ('NEW','RECEIVED','CONTACTED','SAMPLE_SENT',
  'DELIVERED')`. This is the anonymous-identity twin of
  `uq_inquiries_active_sample_user_coffee`, which is unchanged and continues
  to key on `(user_id, coffee_id)` for authenticated requests. The two
  indexes never interact: an anonymous submission with `user_id IS NULL`
  cannot collide with either index's predicate for a signed-in customer's row
  and vice versa (FR-073).
- Confirmed empirically that these are independent: submitting the same
  normalized email + coffee twice while `NEW` (anonymous) raises `23505` on
  the new index; nothing about that probe touched or could touch the
  existing authenticated index, since its predicate requires `user_id IS NOT
  NULL`.

FR-083's **Migration A** (name/location decided in `plan.md`) is the
repository's record of this already-live state — see `plan.md` section A for
the exact statements and their idempotency reasoning (`research.md` #15).
It is one of two new migrations this addendum plans; see below for the
second.

## New database object: `public.submit_public_inquiry(...)` (proposed, NOT yet applied — Migration B)

A `SECURITY DEFINER` function, owned by `postgres`, `GRANT EXECUTE`d to
`anon` only. This is the public write boundary FR-081 requires. Unlike the
reconciliation above, **this function does not exist yet** — planning
proposes it; it is not a fact about the current database.

**Parameters** (the complete allow-list — nothing else is writable through
this path):

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `p_full_name` | text | always | |
| `p_email` | text | always | normalized (`lower(btrim())`) inside the function before use in the duplicate check |
| `p_phone` | text | always | |
| `p_offer_id` | uuid | only for a sample request | presence of this parameter is what tells the function to build a `SAMPLE_REQUEST` rather than a `GENERAL` row (FR-070/FR-071) |
| `p_address` | text | only for a sample request | rejected as missing (not silently ignored) if `p_offer_id` is set and this is null/blank |
| `p_country_code` | text | only for a sample request | same rule as `p_address` |
| `p_subject` | text | never required | `GENERAL` only; ignored/null for a sample request |
| `p_message` | text | always | |

**Not parameters, by design** (FR-072, FR-081): `user_id`, `type`, `status`,
`coffee_id`, `coffee_name_snapshot`, `offer_reference_snapshot`,
`warehouse_code_snapshot`. The function decides `type`/`status` internally
and lets the existing `hydrate_inquiry_context()` trigger derive the rest,
exactly as it already does for the authenticated path.

**Behavior**:

1. If `p_offer_id` is null → `type = 'GENERAL'`; requires
   `p_full_name`/`p_email`/`p_phone`/`p_message` (FR-070). No coffee/offer
   validation applies — a `GENERAL` row may have `coffee_id IS NULL`
   (existing `inquiries_coffee_or_offer_required` constraint already permits
   this).
2. If `p_offer_id` is present → `type = 'SAMPLE_REQUEST'`; additionally
   requires `p_address`/`p_country_code` (FR-071). The INSERT supplies
   `offer_id`; the existing trigger resolves `coffee_id` and raises if the
   offer doesn't exist or doesn't belong to the coffee — this function does
   not re-implement that check.
3. `status` is always inserted as `'NEW'`; `user_id` is never set (left for
   `hydrate_inquiry_context()` to leave alone, since `auth.uid()` is null for
   an `anon`-role call).
4. The per-normalized-email rate check (`research.md` #16) runs as a
   `COUNT(*) ... WHERE lower(btrim(email)) = <normalized p_email> AND
   created_at > now() - interval '<window>'` against `public.inquiries`
   itself, before the INSERT — no new table.
5. Returns `request_code` (and `id`) of the created row on success.
6. On a `23505` against `uq_inquiries_active_sample_anon_email_coffee`, the
   exception is allowed to propagate with its constraint name intact; the
   calling Next.js server action — not this function — is responsible for
   catching it and mapping it to the closed `DUPLICATE_SAMPLE` domain error
   with the existing row's `request_code` looked up, exactly mirroring how
   `createSampleRequestInquiry` already handles the authenticated case
   (`contracts/inquiry-actions.md`). The database layer's job is correctness
   (never let two active rows coexist); the safe, localized error shape is
   the application layer's job, per `spec.md` FR-060.

## Deliberately not proposed: a rate-limit table

A durable, cross-instance, per-IP counter would need a new table (`inquiries`
has no IP column and gains none — see `research.md` #16). This addendum
does not propose one. If the owner later wants durable per-IP rate limiting
badly enough to approve new schema for it, that is a new, separate migration
requiring its own explicit approval under Constitution Principle XV — it is
named here only so the gap is visible, not filled without approval.
