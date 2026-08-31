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
