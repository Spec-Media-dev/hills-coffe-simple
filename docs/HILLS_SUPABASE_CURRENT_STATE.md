# Hills Coffee — Current Supabase State

**Snapshot date:** 2026-08-31
**Status:** Authoritative pre-implementation database contract
**Purpose:** Primary Supabase reference for Spec Kit and Claude implementation.

> This snapshot reflects the database after the approved Master Rebuild
> pre-SpecKit migrations, including avatars, blocking, sample lifecycle,
> race-safe sample uniqueness, Realtime publication configuration and
> protected USER authorization boundaries.

## Phase 1 verification (2026-09-01) — APPLIED, contract updated

Both approved Phase 1 migrations have been **applied** and re-verified against
the live database. Full record:
`specs/001-platform-implementation-spec/evidence/phase-1-authorization-contract.md`.

### Changes now live

| Object | Change |
|---|---|
| `hills_profiles_update_own` | `USING` and `WITH CHECK` now additionally require `NOT public.hills_is_blocked()` |
| `avatars_owner_insert` | `WITH CHECK` now additionally requires `NOT public.hills_is_blocked()` |
| `avatars_owner_select` | `USING` now additionally requires `NOT public.hills_is_blocked()` |
| `avatars_owner_update` | both clauses now additionally require `NOT public.hills_is_blocked()` |
| `avatars_owner_delete` | `USING` now additionally requires `NOT public.hills_is_blocked()` |
| `admin_list_users` | replaced by a single parameterized function — see below |

`admin_list_users(email_query text DEFAULT NULL, name_query text DEFAULT NULL,
blocked_filter boolean DEFAULT NULL, page integer DEFAULT 1,
page_size integer DEFAULT 25)` returns fourteen columns: the original nine plus
`is_blocked`, `blocked_at`, `block_reason`, `avatar_path`, `total_count`.
`LANGUAGE plpgsql STABLE SECURITY DEFINER`, `search_path` =
`pg_catalog, public, auth`, `is_admin()` guard unchanged, `role = 'USER'`
filter unchanged, `page_size` clamped to 100. Execute revoked from `PUBLIC`
and `anon`, granted to `authenticated`. Every parameter is optional, so the
previous no-argument call still works.

**Unchanged:** `hills_is_blocked()`, `hills_is_verified_user()`, `is_admin()`,
`hills_is_admin()`, `protect_profile_block_fields()`, every other RLS policy,
the `hills-public` bucket policies, and the `avatars` bucket's `public = false`.

### Behavior confirmed live by test

| Check | Result |
|---|---|
| blocked customer `UPDATE` own `profiles` row | denied — RLS filters the row; `204 No Content`, `RETURNING` empty, nothing persisted |
| blocked customer avatar upload / replace | denied — `new row violates row-level security policy` |
| blocked customer avatar read | denied — `Object not found` |
| blocked customer avatar delete | denied — no-op, object still present |
| unblocked customer, ADMIN, service role | full access retained |
| unblocked customer tampering with block fields | `42501 profile_security_fields_not_editable` |
| ADMIN unblock | restores `hills_is_verified_user() = true` and all self-service |

> **Denial semantics worth knowing before writing application code.** Because
> the blocked-state predicate lives in the policy's `USING` clause, a blocked
> customer's `UPDATE` matches **zero rows** rather than raising. PostgreSQL does
> not error on an RLS-filtered `UPDATE`, and the row never reaches
> `protect_profile_block_fields()`. Server actions must therefore treat "zero
> rows affected" as a denial, not as success — check the affected-row count,
> not just the error field.

Two behaviors that surprise callers, both still true:

1. **The service-role key is not an Administrator.** It carries no
   `auth.uid()`, so `is_admin()` is false for it and both
   `admin_set_user_blocked()` and `admin_list_users()` refuse it.
2. **An Administrator session cannot read a customer avatar.**
   `avatars_owner_select` is owner-scoped and the bucket has no admin-read
   policy. `profiles.avatar_path` *is* Admin-readable. Admin avatar viewing must
   go through a server-side service-role signed URL.

## Important Rules

- `public.profiles.role` is authoritative for application roles.
- Protected customer capabilities require authenticated + verified + unblocked USER.
- ADMIN does not receive customer protected pricing through the USER policy.
- `avatars` is private and owner-scoped.
- `offer_price_tiers` is not Realtime-enabled.
- `audit_logs` is not Realtime-enabled.
- Active SAMPLE_REQUEST uniqueness is enforced by `user_id + coffee_id`.
- Supabase Auth/dashboard configuration is external to this SQL snapshot.

## Raw Supabase Snapshot

```json
{
    "auth": {
        "providers": [
            {
                "users": 2,
                "provider": "email"
            }
        ],
        "security_note": "This snapshot intentionally excludes user emails, passwords, tokens and user metadata.",
        "aggregate_state": {
            "total_users": 2,
            "email_confirmed_users": 1,
            "currently_banned_users": 0,
            "email_unconfirmed_users": 1
        }
    },
    "storage": {
        "buckets": [
            {
                "id": "avatars",
                "name": "avatars",
                "public": false,
                "created_at": "2026-08-31T14:07:37.48499+00:00",
                "updated_at": "2026-08-31T14:07:37.48499+00:00",
                "file_size_limit": 5242880,
                "allowed_mime_types": [
                    "image/jpeg",
                    "image/png",
                    "image/webp"
                ]
            },
            {
                "id": "hills-public",
                "name": "hills-public",
                "public": true,
                "created_at": "2026-08-30T14:17:24.643287+00:00",
                "updated_at": "2026-08-30T14:17:24.643287+00:00",
                "file_size_limit": 10485760,
                "allowed_mime_types": [
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/avif"
                ]
            }
        ],
        "policies": [
            {
                "roles": [
                    "authenticated"
                ],
                "table": "objects",
                "using": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
                "policy": "avatars_owner_delete",
                "command": "DELETE",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "objects",
                "using": null,
                "policy": "avatars_owner_insert",
                "command": "INSERT",
                "permissive": "PERMISSIVE",
                "with_check": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "objects",
                "using": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
                "policy": "avatars_owner_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "objects",
                "using": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
                "policy": "avatars_owner_update",
                "command": "UPDATE",
                "permissive": "PERMISSIVE",
                "with_check": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "objects",
                "using": "((bucket_id = 'hills-public'::text) AND is_admin())",
                "policy": "hills_storage_admin_delete",
                "command": "DELETE",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "objects",
                "using": null,
                "policy": "hills_storage_admin_insert",
                "command": "INSERT",
                "permissive": "PERMISSIVE",
                "with_check": "((bucket_id = 'hills-public'::text) AND is_admin())"
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "objects",
                "using": "((bucket_id = 'hills-public'::text) AND is_admin())",
                "policy": "hills_storage_admin_update",
                "command": "UPDATE",
                "permissive": "PERMISSIVE",
                "with_check": "((bucket_id = 'hills-public'::text) AND is_admin())"
            },
            {
                "roles": [
                    "public"
                ],
                "table": "objects",
                "using": "(bucket_id = 'hills-public'::text)",
                "policy": "hills_storage_public_read",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            }
        ],
        "object_counts": [
        ]
    },
    "database": {
        "database": "postgres",
        "timezone": "UTC",
        "current_role": "postgres",
        "postgres_version": "17.6"
    },
    "realtime": {
        "design_note": "Realtime publication membership does not replace RLS or server authorization. Client subscriptions must remain page/user scoped.",
        "publications": [
            {
                "delete": true,
                "insert": true,
                "update": true,
                "truncate": true,
                "all_tables": false,
                "publication": "supabase_realtime"
            }
        ],
        "publication_tables": [
            {
                "table": "article_categories",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "article_category_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "article_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "articles",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "certification_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "certifications",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffee_certifications",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffee_media",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffee_offers",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffee_tags",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffee_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffee_type_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffee_types",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffee_varieties",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "coffees",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "favorites",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "inquiries",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "inquiry_status_history",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "media",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "media_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "offer_sensory_notes",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "offer_tags",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "origin_media",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "origin_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "origins",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "packaging_type_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "packaging_types",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "processing_method_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "processing_methods",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "profiles",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "region_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "regions",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "sensory_note_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "sensory_notes",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "site_page_section_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "site_page_sections",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "site_page_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "site_pages",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "site_settings",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "site_settings_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "tag_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "tags",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "varieties",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "warehouse_translations",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            },
            {
                "table": "warehouses",
                "schema": "public",
                "publication": "supabase_realtime",
                "rls_enabled": true,
                "replica_identity": "DEFAULT"
            }
        ]
    },
    "snapshot": {
        "purpose": "Hills Coffee current Supabase architecture contract",
        "generated_at": "2026-08-31T16:18:15.023607+00:00",
        "emails_included": false,
        "secrets_included": false,
        "row_data_included": false
    },
    "extensions": [
        {
            "name": "pg_stat_statements",
            "schema": "extensions",
            "version": "1.11"
        },
        {
            "name": "pg_trgm",
            "schema": "public",
            "version": "1.6"
        },
        {
            "name": "pgcrypto",
            "schema": "extensions",
            "version": "1.3"
        },
        {
            "name": "plpgsql",
            "schema": "pg_catalog",
            "version": "1.0"
        },
        {
            "name": "supabase_vault",
            "schema": "vault",
            "version": "0.3.1"
        },
        {
            "name": "uuid-ossp",
            "schema": "extensions",
            "version": "1.1"
        }
    ],
    "public_schema": {
        "enums": [
            {
                "enum": "app_role",
                "values": [
                    "USER",
                    "ADMIN"
                ]
            },
            {
                "enum": "article_status",
                "values": [
                    "DRAFT",
                    "PUBLISHED",
                    "ARCHIVED"
                ]
            },
            {
                "enum": "coffee_status",
                "values": [
                    "DRAFT",
                    "PUBLISHED",
                    "ARCHIVED"
                ]
            },
            {
                "enum": "content_locale",
                "values": [
                    "en",
                    "ar"
                ]
            },
            {
                "enum": "inquiry_status",
                "values": [
                    "NEW",
                    "RECEIVED",
                    "CONTACTED",
                    "CLOSED",
                    "SAMPLE_SENT",
                    "DELIVERED"
                ]
            },
            {
                "enum": "inquiry_type",
                "values": [
                    "GENERAL",
                    "PRODUCT",
                    "SAMPLE_REQUEST"
                ]
            },
            {
                "enum": "offer_status",
                "values": [
                    "ARRIVING_SOON",
                    "NEW_ARRIVAL",
                    "IN_STORE",
                    "DISCOUNT",
                    "SOLD_OUT",
                    "INACTIVE"
                ]
            }
        ],
        "views": [
        ],
        "tables": [
            {
                "owner": "postgres",
                "table": "article_categories",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "article_category_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "article_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "articles",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "audit_logs",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "certification_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "certifications",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffee_certifications",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffee_media",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffee_offers",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffee_tags",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffee_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffee_type_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffee_types",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffee_varieties",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "coffees",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "favorites",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "inquiries",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "inquiry_status_history",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "media",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "media_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "offer_price_tiers",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "offer_sensory_notes",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "offer_tags",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "origin_media",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "origin_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "origins",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "packaging_type_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "packaging_types",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "processing_method_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "processing_methods",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "profiles",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 1,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "region_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "regions",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "sensory_note_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "sensory_notes",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "site_page_section_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "site_page_sections",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "site_page_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "site_pages",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "site_settings",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "site_settings_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "tag_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "tags",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "varieties",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "warehouse_translations",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            },
            {
                "owner": "postgres",
                "table": "warehouses",
                "comment": null,
                "rls_forced": false,
                "rls_enabled": true,
                "estimated_rows": 0,
                "replica_identity": "DEFAULT"
            }
        ],
        "columns": [
            {
                "table": "article_categories",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_categories",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_categories",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_categories",
                "column": "sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_categories",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_categories",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_category_translations",
                "column": "category_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_category_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_category_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_category_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_category_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "article_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "title",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "excerpt",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "body_markdown",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "seo_title",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "seo_description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 9,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "article_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 10,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "category_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "featured_media_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "status",
                "comment": null,
                "default": "'DRAFT'::article_status",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "article_status",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "is_featured",
                "comment": null,
                "default": "false",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "published_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "created_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "updated_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 9,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 10,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "articles",
                "column": "deleted_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 11,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "audit_logs",
                "column": "id",
                "comment": null,
                "default": null,
                "identity": "YES",
                "nullable": "NO",
                "position": 1,
                "udt_name": "int8",
                "data_type": "bigint",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 64,
                "identity_generation": "BY DEFAULT",
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "audit_logs",
                "column": "actor_user_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "audit_logs",
                "column": "entity_type",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "audit_logs",
                "column": "entity_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "audit_logs",
                "column": "action",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "audit_logs",
                "column": "old_data",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "jsonb",
                "data_type": "jsonb",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "audit_logs",
                "column": "new_data",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "jsonb",
                "data_type": "jsonb",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "audit_logs",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certification_translations",
                "column": "certification_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certification_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certification_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certification_translations",
                "column": "description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certification_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certification_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certifications",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certifications",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certifications",
                "column": "short_code",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certifications",
                "column": "website_url",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certifications",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certifications",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "certifications",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 7,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_certifications",
                "column": "coffee_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_certifications",
                "column": "certification_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_certifications",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_media",
                "column": "coffee_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_media",
                "column": "media_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_media",
                "column": "role",
                "comment": null,
                "default": "'GALLERY'::text",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_media",
                "column": "sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_media",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "coffee_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "warehouse_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "reference_number",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "bags_quantity",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "bag_weight_kg",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "numeric",
                "data_type": "numeric",
                "generated": "NEVER",
                "numeric_scale": 3,
                "numeric_precision": 10,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "packaging_type_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "status",
                "comment": null,
                "default": "'IN_STORE'::offer_status",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "offer_status",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "cup_score",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "numeric",
                "data_type": "numeric",
                "generated": "NEVER",
                "numeric_scale": 2,
                "numeric_precision": 5,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "currency_code",
                "comment": null,
                "default": "'USD'::character varying",
                "identity": "NO",
                "nullable": "NO",
                "position": 10,
                "udt_name": "varchar",
                "data_type": "character varying",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": 3
            },
            {
                "table": "coffee_offers",
                "column": "pricing_unit",
                "comment": null,
                "default": "'KG'::character varying",
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "varchar",
                "data_type": "character varying",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": 10
            },
            {
                "table": "coffee_offers",
                "column": "available_from",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 12,
                "udt_name": "date",
                "data_type": "date",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "is_visible",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 13,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "created_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 14,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "updated_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 15,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 16,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 17,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_offers",
                "column": "deleted_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 18,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_tags",
                "column": "coffee_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_tags",
                "column": "tag_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_tags",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "coffee_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "short_description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "subregion_town",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "farm_coop_station",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "owner_producer",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "about_this_coffee",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "cultivation",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "harvest_post_harvest",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 10,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "processing_story",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 11,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "origin_story",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 12,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "sustainability",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 13,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "traceability",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 14,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "seo_title",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 15,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "seo_description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 16,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 17,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 18,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_type_translations",
                "column": "coffee_type_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_type_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_type_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_type_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_type_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_types",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_types",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_types",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_types",
                "column": "sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_types",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_types",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_varieties",
                "column": "coffee_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_varieties",
                "column": "variety_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffee_varieties",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "coffee_type_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "origin_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "region_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "processing_method_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "status",
                "comment": null,
                "default": "'DRAFT'::coffee_status",
                "identity": "NO",
                "nullable": "NO",
                "position": 7,
                "udt_name": "coffee_status",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "grade",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "altitude_min_meters",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "altitude_max_meters",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 10,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "farm_size_hectares",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 11,
                "udt_name": "numeric",
                "data_type": "numeric",
                "generated": "NEVER",
                "numeric_scale": 2,
                "numeric_precision": 12,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "harvest_months",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 12,
                "udt_name": "_int2",
                "data_type": "ARRAY",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "published_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 13,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "created_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 14,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "updated_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 15,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 16,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 17,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "deleted_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 18,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "is_featured",
                "comment": null,
                "default": "false",
                "identity": "NO",
                "nullable": "NO",
                "position": 19,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "coffees",
                "column": "featured_sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 20,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "favorites",
                "column": "user_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "favorites",
                "column": "coffee_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "favorites",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "inquiry_number",
                "comment": null,
                "default": null,
                "identity": "YES",
                "nullable": "NO",
                "position": 2,
                "udt_name": "int8",
                "data_type": "bigint",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 64,
                "identity_generation": "BY DEFAULT",
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "request_code",
                "comment": null,
                "default": "('HC-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10)))",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "type",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "inquiry_type",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "user_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "coffee_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "offer_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "coffee_name_snapshot",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "offer_reference_snapshot",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "warehouse_code_snapshot",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 10,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "full_name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "company_name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 12,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "email",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 13,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "phone",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 14,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "address",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 15,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "country_code",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 16,
                "udt_name": "varchar",
                "data_type": "character varying",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": 2
            },
            {
                "table": "inquiries",
                "column": "subject",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 17,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "message",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 18,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "status",
                "comment": null,
                "default": "'NEW'::inquiry_status",
                "identity": "NO",
                "nullable": "NO",
                "position": 19,
                "udt_name": "inquiry_status",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 20,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiries",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 21,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiry_status_history",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiry_status_history",
                "column": "inquiry_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiry_status_history",
                "column": "old_status",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "inquiry_status",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiry_status_history",
                "column": "new_status",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "inquiry_status",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiry_status_history",
                "column": "changed_by",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "inquiry_status_history",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "storage_bucket",
                "comment": null,
                "default": "'hills-public'::text",
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "storage_path",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "mime_type",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "width",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "height",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "file_size_bytes",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "int8",
                "data_type": "bigint",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 64,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "is_public",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "uploaded_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 10,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media",
                "column": "deleted_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 12,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media_translations",
                "column": "media_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media_translations",
                "column": "alt_text",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media_translations",
                "column": "caption",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "media_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_price_tiers",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_price_tiers",
                "column": "offer_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_price_tiers",
                "column": "min_bags",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_price_tiers",
                "column": "price_per_kg_usd",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "numeric",
                "data_type": "numeric",
                "generated": "NEVER",
                "numeric_scale": 4,
                "numeric_precision": 12,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_price_tiers",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_price_tiers",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_sensory_notes",
                "column": "offer_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_sensory_notes",
                "column": "sensory_note_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_sensory_notes",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_tags",
                "column": "offer_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_tags",
                "column": "tag_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "offer_tags",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_media",
                "column": "origin_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_media",
                "column": "media_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_media",
                "column": "role",
                "comment": null,
                "default": "'GALLERY'::text",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_media",
                "column": "sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_media",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "origin_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "summary",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "coffee_history",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "cultivation_processing",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "sourcing_story",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "sustainability",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "seo_title",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "seo_description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 10,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origin_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 12,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "country_code",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "varchar",
                "data_type": "character varying",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": 2
            },
            {
                "table": "origins",
                "column": "continent",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "harvest_months",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "_int2",
                "data_type": "ARRAY",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "created_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "updated_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 9,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 10,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "deleted_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 11,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "is_featured",
                "comment": null,
                "default": "false",
                "identity": "NO",
                "nullable": "NO",
                "position": 12,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "origins",
                "column": "featured_sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 13,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_type_translations",
                "column": "packaging_type_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_type_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_type_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_type_translations",
                "column": "description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_type_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_type_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_types",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_types",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_types",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_types",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "packaging_types",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_method_translations",
                "column": "processing_method_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_method_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_method_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_method_translations",
                "column": "description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_method_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_method_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_methods",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_methods",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_methods",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_methods",
                "column": "sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_methods",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "processing_methods",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "full_name",
                "comment": null,
                "default": "''::text",
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "phone",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "company_name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "address",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "country_code",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "varchar",
                "data_type": "character varying",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": 2
            },
            {
                "table": "profiles",
                "column": "role",
                "comment": null,
                "default": "'USER'::app_role",
                "identity": "NO",
                "nullable": "NO",
                "position": 7,
                "udt_name": "app_role",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 9,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "avatar_path",
                "comment": "Storage object path for the user profile avatar in the avatars bucket",
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 10,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "is_blocked",
                "comment": null,
                "default": "false",
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "blocked_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 12,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "blocked_by",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 13,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "profiles",
                "column": "block_reason",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 14,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "region_translations",
                "column": "region_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "region_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "region_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "region_translations",
                "column": "description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "region_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "region_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "origin_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "created_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "updated_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 7,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "regions",
                "column": "deleted_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_note_translations",
                "column": "sensory_note_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_note_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_note_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_note_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_note_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_notes",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_notes",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_notes",
                "column": "category",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_notes",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_notes",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "sensory_notes",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_section_translations",
                "column": "section_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_section_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_section_translations",
                "column": "heading",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_section_translations",
                "column": "subheading",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_section_translations",
                "column": "body_markdown",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_section_translations",
                "column": "cta_label",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_section_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 7,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_section_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "page_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "section_key",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "section_type",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "is_visible",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "media_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "cta_href",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "entity_ref",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "entity_limit",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 10,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_sections",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 12,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "page_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "title",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "h1",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "summary",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "body_markdown",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "seo_title",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "seo_description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "cta_label",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 10,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_page_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "page_key",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "template",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "route_path",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "status",
                "comment": null,
                "default": "'DRAFT'::article_status",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "article_status",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "published_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "sort_order",
                "comment": null,
                "default": "0",
                "identity": "NO",
                "nullable": "NO",
                "position": 7,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "og_media_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "created_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 10,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "updated_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 11,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 12,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 13,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_pages",
                "column": "deleted_at",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 14,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "id",
                "comment": null,
                "default": "1",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "int2",
                "data_type": "smallint",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 16,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "org_legal_name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "org_brand_name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "org_email",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "org_phone",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "org_logo_media_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "org_default_og_media_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "org_same_as",
                "comment": null,
                "default": "'{}'::text[]",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "_text",
                "data_type": "ARRAY",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "default_seo_title_template",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "default_seo_description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 10,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "low_stock_threshold",
                "comment": null,
                "default": "30",
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "int4",
                "data_type": "integer",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 32,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "updated_by",
                "comment": null,
                "default": "auth.uid()",
                "identity": "NO",
                "nullable": "YES",
                "position": 12,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 13,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 14,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "settings_id",
                "comment": null,
                "default": "1",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "int2",
                "data_type": "smallint",
                "generated": "NEVER",
                "numeric_scale": 0,
                "numeric_precision": 16,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "org_display_name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "org_tagline",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "org_address",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "default_seo_title",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "default_seo_description",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "global_cta_label",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 9,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "site_settings_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 10,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tag_translations",
                "column": "tag_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tag_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tag_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tag_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tag_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tags",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tags",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tags",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tags",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "tags",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "varieties",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "varieties",
                "column": "slug",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "varieties",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "varieties",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "varieties",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 5,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "varieties",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 6,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouse_translations",
                "column": "warehouse_id",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouse_translations",
                "column": "locale",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "content_locale",
                "data_type": "USER-DEFINED",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouse_translations",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouse_translations",
                "column": "city",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 4,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouse_translations",
                "column": "address",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouse_translations",
                "column": "service_region",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouse_translations",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 7,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouse_translations",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 8,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "id",
                "comment": null,
                "default": "gen_random_uuid()",
                "identity": "NO",
                "nullable": "NO",
                "position": 1,
                "udt_name": "uuid",
                "data_type": "uuid",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "code",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 2,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "name",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 3,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "country_code",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "NO",
                "position": 4,
                "udt_name": "varchar",
                "data_type": "character varying",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": 2
            },
            {
                "table": "warehouses",
                "column": "city",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 5,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "address",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 6,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "phone",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 7,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "email",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 8,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "service_region",
                "comment": null,
                "default": null,
                "identity": "NO",
                "nullable": "YES",
                "position": 9,
                "udt_name": "text",
                "data_type": "text",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "is_active",
                "comment": null,
                "default": "true",
                "identity": "NO",
                "nullable": "NO",
                "position": 10,
                "udt_name": "bool",
                "data_type": "boolean",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "created_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 11,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            },
            {
                "table": "warehouses",
                "column": "updated_at",
                "comment": null,
                "default": "now()",
                "identity": "NO",
                "nullable": "NO",
                "position": 12,
                "udt_name": "timestamptz",
                "data_type": "timestamp with time zone",
                "generated": "NEVER",
                "numeric_scale": null,
                "numeric_precision": null,
                "identity_generation": null,
                "generation_expression": null,
                "character_maximum_length": null
            }
        ],
        "indexes": [
            {
                "index": "article_categories_pkey",
                "table": "article_categories",
                "definition": "CREATE UNIQUE INDEX article_categories_pkey ON public.article_categories USING btree (id)"
            },
            {
                "index": "article_categories_slug_key",
                "table": "article_categories",
                "definition": "CREATE UNIQUE INDEX article_categories_slug_key ON public.article_categories USING btree (slug)"
            },
            {
                "index": "article_category_translations_pkey",
                "table": "article_category_translations",
                "definition": "CREATE UNIQUE INDEX article_category_translations_pkey ON public.article_category_translations USING btree (category_id, locale)"
            },
            {
                "index": "article_translations_locale_slug_key",
                "table": "article_translations",
                "definition": "CREATE UNIQUE INDEX article_translations_locale_slug_key ON public.article_translations USING btree (locale, slug)"
            },
            {
                "index": "article_translations_pkey",
                "table": "article_translations",
                "definition": "CREATE UNIQUE INDEX article_translations_pkey ON public.article_translations USING btree (article_id, locale)"
            },
            {
                "index": "idx_article_translations_title_trgm",
                "table": "article_translations",
                "definition": "CREATE INDEX idx_article_translations_title_trgm ON public.article_translations USING gin (title gin_trgm_ops)"
            },
            {
                "index": "articles_pkey",
                "table": "articles",
                "definition": "CREATE UNIQUE INDEX articles_pkey ON public.articles USING btree (id)"
            },
            {
                "index": "idx_articles_status_published",
                "table": "articles",
                "definition": "CREATE INDEX idx_articles_status_published ON public.articles USING btree (status, published_at DESC)"
            },
            {
                "index": "audit_logs_pkey",
                "table": "audit_logs",
                "definition": "CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)"
            },
            {
                "index": "idx_audit_logs_actor",
                "table": "audit_logs",
                "definition": "CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_user_id, created_at DESC)"
            },
            {
                "index": "idx_audit_logs_entity",
                "table": "audit_logs",
                "definition": "CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id, created_at DESC)"
            },
            {
                "index": "certification_translations_pkey",
                "table": "certification_translations",
                "definition": "CREATE UNIQUE INDEX certification_translations_pkey ON public.certification_translations USING btree (certification_id, locale)"
            },
            {
                "index": "certifications_pkey",
                "table": "certifications",
                "definition": "CREATE UNIQUE INDEX certifications_pkey ON public.certifications USING btree (id)"
            },
            {
                "index": "certifications_slug_key",
                "table": "certifications",
                "definition": "CREATE UNIQUE INDEX certifications_slug_key ON public.certifications USING btree (slug)"
            },
            {
                "index": "coffee_certifications_pkey",
                "table": "coffee_certifications",
                "definition": "CREATE UNIQUE INDEX coffee_certifications_pkey ON public.coffee_certifications USING btree (coffee_id, certification_id)"
            },
            {
                "index": "coffee_media_one_main_image",
                "table": "coffee_media",
                "definition": "CREATE UNIQUE INDEX coffee_media_one_main_image ON public.coffee_media USING btree (coffee_id) WHERE (role = 'MAIN'::text)"
            },
            {
                "index": "coffee_media_pkey",
                "table": "coffee_media",
                "definition": "CREATE UNIQUE INDEX coffee_media_pkey ON public.coffee_media USING btree (coffee_id, media_id)"
            },
            {
                "index": "coffee_offers_pkey",
                "table": "coffee_offers",
                "definition": "CREATE UNIQUE INDEX coffee_offers_pkey ON public.coffee_offers USING btree (id)"
            },
            {
                "index": "coffee_offers_unique_active_coffee_warehouse",
                "table": "coffee_offers",
                "definition": "CREATE UNIQUE INDEX coffee_offers_unique_active_coffee_warehouse ON public.coffee_offers USING btree (coffee_id, warehouse_id) WHERE (deleted_at IS NULL)"
            },
            {
                "index": "coffee_offers_unique_active_reference_number",
                "table": "coffee_offers",
                "definition": "CREATE UNIQUE INDEX coffee_offers_unique_active_reference_number ON public.coffee_offers USING btree (reference_number) WHERE (deleted_at IS NULL)"
            },
            {
                "index": "idx_coffee_offers_bags",
                "table": "coffee_offers",
                "definition": "CREATE INDEX idx_coffee_offers_bags ON public.coffee_offers USING btree (bags_quantity)"
            },
            {
                "index": "idx_coffee_offers_coffee",
                "table": "coffee_offers",
                "definition": "CREATE INDEX idx_coffee_offers_coffee ON public.coffee_offers USING btree (coffee_id)"
            },
            {
                "index": "idx_coffee_offers_reference_trgm",
                "table": "coffee_offers",
                "definition": "CREATE INDEX idx_coffee_offers_reference_trgm ON public.coffee_offers USING gin (reference_number gin_trgm_ops)"
            },
            {
                "index": "idx_coffee_offers_status",
                "table": "coffee_offers",
                "definition": "CREATE INDEX idx_coffee_offers_status ON public.coffee_offers USING btree (status)"
            },
            {
                "index": "idx_coffee_offers_warehouse",
                "table": "coffee_offers",
                "definition": "CREATE INDEX idx_coffee_offers_warehouse ON public.coffee_offers USING btree (warehouse_id)"
            },
            {
                "index": "coffee_tags_pkey",
                "table": "coffee_tags",
                "definition": "CREATE UNIQUE INDEX coffee_tags_pkey ON public.coffee_tags USING btree (coffee_id, tag_id)"
            },
            {
                "index": "coffee_translations_pkey",
                "table": "coffee_translations",
                "definition": "CREATE UNIQUE INDEX coffee_translations_pkey ON public.coffee_translations USING btree (coffee_id, locale)"
            },
            {
                "index": "idx_coffee_translations_name_trgm",
                "table": "coffee_translations",
                "definition": "CREATE INDEX idx_coffee_translations_name_trgm ON public.coffee_translations USING gin (name gin_trgm_ops)"
            },
            {
                "index": "coffee_type_translations_pkey",
                "table": "coffee_type_translations",
                "definition": "CREATE UNIQUE INDEX coffee_type_translations_pkey ON public.coffee_type_translations USING btree (coffee_type_id, locale)"
            },
            {
                "index": "coffee_types_pkey",
                "table": "coffee_types",
                "definition": "CREATE UNIQUE INDEX coffee_types_pkey ON public.coffee_types USING btree (id)"
            },
            {
                "index": "coffee_types_slug_key",
                "table": "coffee_types",
                "definition": "CREATE UNIQUE INDEX coffee_types_slug_key ON public.coffee_types USING btree (slug)"
            },
            {
                "index": "coffee_varieties_pkey",
                "table": "coffee_varieties",
                "definition": "CREATE UNIQUE INDEX coffee_varieties_pkey ON public.coffee_varieties USING btree (coffee_id, variety_id)"
            },
            {
                "index": "coffees_pkey",
                "table": "coffees",
                "definition": "CREATE UNIQUE INDEX coffees_pkey ON public.coffees USING btree (id)"
            },
            {
                "index": "coffees_slug_key",
                "table": "coffees",
                "definition": "CREATE UNIQUE INDEX coffees_slug_key ON public.coffees USING btree (slug)"
            },
            {
                "index": "idx_coffees_featured",
                "table": "coffees",
                "definition": "CREATE INDEX idx_coffees_featured ON public.coffees USING btree (featured_sort_order, published_at DESC) WHERE ((is_featured = true) AND (status = 'PUBLISHED'::coffee_status) AND (deleted_at IS NULL))"
            },
            {
                "index": "idx_coffees_origin",
                "table": "coffees",
                "definition": "CREATE INDEX idx_coffees_origin ON public.coffees USING btree (origin_id)"
            },
            {
                "index": "idx_coffees_processing",
                "table": "coffees",
                "definition": "CREATE INDEX idx_coffees_processing ON public.coffees USING btree (processing_method_id)"
            },
            {
                "index": "idx_coffees_published",
                "table": "coffees",
                "definition": "CREATE INDEX idx_coffees_published ON public.coffees USING btree (published_at DESC) WHERE ((status = 'PUBLISHED'::coffee_status) AND (deleted_at IS NULL))"
            },
            {
                "index": "idx_coffees_region",
                "table": "coffees",
                "definition": "CREATE INDEX idx_coffees_region ON public.coffees USING btree (region_id)"
            },
            {
                "index": "idx_coffees_status",
                "table": "coffees",
                "definition": "CREATE INDEX idx_coffees_status ON public.coffees USING btree (status)"
            },
            {
                "index": "idx_coffees_type",
                "table": "coffees",
                "definition": "CREATE INDEX idx_coffees_type ON public.coffees USING btree (coffee_type_id)"
            },
            {
                "index": "favorites_pkey",
                "table": "favorites",
                "definition": "CREATE UNIQUE INDEX favorites_pkey ON public.favorites USING btree (user_id, coffee_id)"
            },
            {
                "index": "idx_favorites_coffee",
                "table": "favorites",
                "definition": "CREATE INDEX idx_favorites_coffee ON public.favorites USING btree (coffee_id)"
            },
            {
                "index": "idx_favorites_user",
                "table": "favorites",
                "definition": "CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id)"
            },
            {
                "index": "idx_inquiries_coffee",
                "table": "inquiries",
                "definition": "CREATE INDEX idx_inquiries_coffee ON public.inquiries USING btree (coffee_id)"
            },
            {
                "index": "idx_inquiries_created_at",
                "table": "inquiries",
                "definition": "CREATE INDEX idx_inquiries_created_at ON public.inquiries USING btree (created_at DESC)"
            },
            {
                "index": "idx_inquiries_offer",
                "table": "inquiries",
                "definition": "CREATE INDEX idx_inquiries_offer ON public.inquiries USING btree (offer_id)"
            },
            {
                "index": "idx_inquiries_status",
                "table": "inquiries",
                "definition": "CREATE INDEX idx_inquiries_status ON public.inquiries USING btree (status)"
            },
            {
                "index": "idx_inquiries_user",
                "table": "inquiries",
                "definition": "CREATE INDEX idx_inquiries_user ON public.inquiries USING btree (user_id)"
            },
            {
                "index": "inquiries_inquiry_number_key",
                "table": "inquiries",
                "definition": "CREATE UNIQUE INDEX inquiries_inquiry_number_key ON public.inquiries USING btree (inquiry_number)"
            },
            {
                "index": "inquiries_pkey",
                "table": "inquiries",
                "definition": "CREATE UNIQUE INDEX inquiries_pkey ON public.inquiries USING btree (id)"
            },
            {
                "index": "inquiries_request_code_key",
                "table": "inquiries",
                "definition": "CREATE UNIQUE INDEX inquiries_request_code_key ON public.inquiries USING btree (request_code)"
            },
            {
                "index": "uq_inquiries_active_sample_user_coffee",
                "table": "inquiries",
                "definition": "CREATE UNIQUE INDEX uq_inquiries_active_sample_user_coffee ON public.inquiries USING btree (user_id, coffee_id) WHERE ((type = 'SAMPLE_REQUEST'::inquiry_type) AND (status = ANY (ARRAY['NEW'::inquiry_status, 'RECEIVED'::inquiry_status, 'CONTACTED'::inquiry_status, 'SAMPLE_SENT'::inquiry_status, 'DELIVERED'::inquiry_status])))"
            },
            {
                "index": "idx_inquiry_status_history_inquiry",
                "table": "inquiry_status_history",
                "definition": "CREATE INDEX idx_inquiry_status_history_inquiry ON public.inquiry_status_history USING btree (inquiry_id, created_at)"
            },
            {
                "index": "inquiry_status_history_pkey",
                "table": "inquiry_status_history",
                "definition": "CREATE UNIQUE INDEX inquiry_status_history_pkey ON public.inquiry_status_history USING btree (id)"
            },
            {
                "index": "media_pkey",
                "table": "media",
                "definition": "CREATE UNIQUE INDEX media_pkey ON public.media USING btree (id)"
            },
            {
                "index": "media_storage_bucket_storage_path_key",
                "table": "media",
                "definition": "CREATE UNIQUE INDEX media_storage_bucket_storage_path_key ON public.media USING btree (storage_bucket, storage_path)"
            },
            {
                "index": "media_translations_pkey",
                "table": "media_translations",
                "definition": "CREATE UNIQUE INDEX media_translations_pkey ON public.media_translations USING btree (media_id, locale)"
            },
            {
                "index": "idx_offer_price_tiers_offer",
                "table": "offer_price_tiers",
                "definition": "CREATE INDEX idx_offer_price_tiers_offer ON public.offer_price_tiers USING btree (offer_id, min_bags)"
            },
            {
                "index": "offer_price_tiers_offer_id_min_bags_key",
                "table": "offer_price_tiers",
                "definition": "CREATE UNIQUE INDEX offer_price_tiers_offer_id_min_bags_key ON public.offer_price_tiers USING btree (offer_id, min_bags)"
            },
            {
                "index": "offer_price_tiers_pkey",
                "table": "offer_price_tiers",
                "definition": "CREATE UNIQUE INDEX offer_price_tiers_pkey ON public.offer_price_tiers USING btree (id)"
            },
            {
                "index": "offer_sensory_notes_pkey",
                "table": "offer_sensory_notes",
                "definition": "CREATE UNIQUE INDEX offer_sensory_notes_pkey ON public.offer_sensory_notes USING btree (offer_id, sensory_note_id)"
            },
            {
                "index": "offer_tags_pkey",
                "table": "offer_tags",
                "definition": "CREATE UNIQUE INDEX offer_tags_pkey ON public.offer_tags USING btree (offer_id, tag_id)"
            },
            {
                "index": "origin_media_one_hero_image",
                "table": "origin_media",
                "definition": "CREATE UNIQUE INDEX origin_media_one_hero_image ON public.origin_media USING btree (origin_id) WHERE (role = 'HERO'::text)"
            },
            {
                "index": "origin_media_pkey",
                "table": "origin_media",
                "definition": "CREATE UNIQUE INDEX origin_media_pkey ON public.origin_media USING btree (origin_id, media_id)"
            },
            {
                "index": "idx_origin_translations_name_trgm",
                "table": "origin_translations",
                "definition": "CREATE INDEX idx_origin_translations_name_trgm ON public.origin_translations USING gin (name gin_trgm_ops)"
            },
            {
                "index": "origin_translations_pkey",
                "table": "origin_translations",
                "definition": "CREATE UNIQUE INDEX origin_translations_pkey ON public.origin_translations USING btree (origin_id, locale)"
            },
            {
                "index": "idx_origins_featured",
                "table": "origins",
                "definition": "CREATE INDEX idx_origins_featured ON public.origins USING btree (featured_sort_order) WHERE ((is_featured = true) AND (is_active = true) AND (deleted_at IS NULL))"
            },
            {
                "index": "origins_pkey",
                "table": "origins",
                "definition": "CREATE UNIQUE INDEX origins_pkey ON public.origins USING btree (id)"
            },
            {
                "index": "origins_slug_key",
                "table": "origins",
                "definition": "CREATE UNIQUE INDEX origins_slug_key ON public.origins USING btree (slug)"
            },
            {
                "index": "packaging_type_translations_pkey",
                "table": "packaging_type_translations",
                "definition": "CREATE UNIQUE INDEX packaging_type_translations_pkey ON public.packaging_type_translations USING btree (packaging_type_id, locale)"
            },
            {
                "index": "packaging_types_pkey",
                "table": "packaging_types",
                "definition": "CREATE UNIQUE INDEX packaging_types_pkey ON public.packaging_types USING btree (id)"
            },
            {
                "index": "packaging_types_slug_key",
                "table": "packaging_types",
                "definition": "CREATE UNIQUE INDEX packaging_types_slug_key ON public.packaging_types USING btree (slug)"
            },
            {
                "index": "processing_method_translations_pkey",
                "table": "processing_method_translations",
                "definition": "CREATE UNIQUE INDEX processing_method_translations_pkey ON public.processing_method_translations USING btree (processing_method_id, locale)"
            },
            {
                "index": "processing_methods_pkey",
                "table": "processing_methods",
                "definition": "CREATE UNIQUE INDEX processing_methods_pkey ON public.processing_methods USING btree (id)"
            },
            {
                "index": "processing_methods_slug_key",
                "table": "processing_methods",
                "definition": "CREATE UNIQUE INDEX processing_methods_slug_key ON public.processing_methods USING btree (slug)"
            },
            {
                "index": "idx_profiles_blocked_by",
                "table": "profiles",
                "definition": "CREATE INDEX idx_profiles_blocked_by ON public.profiles USING btree (blocked_by) WHERE (blocked_by IS NOT NULL)"
            },
            {
                "index": "idx_profiles_is_blocked",
                "table": "profiles",
                "definition": "CREATE INDEX idx_profiles_is_blocked ON public.profiles USING btree (is_blocked)"
            },
            {
                "index": "profiles_pkey",
                "table": "profiles",
                "definition": "CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)"
            },
            {
                "index": "region_translations_pkey",
                "table": "region_translations",
                "definition": "CREATE UNIQUE INDEX region_translations_pkey ON public.region_translations USING btree (region_id, locale)"
            },
            {
                "index": "idx_regions_origin",
                "table": "regions",
                "definition": "CREATE INDEX idx_regions_origin ON public.regions USING btree (origin_id)"
            },
            {
                "index": "regions_origin_id_slug_key",
                "table": "regions",
                "definition": "CREATE UNIQUE INDEX regions_origin_id_slug_key ON public.regions USING btree (origin_id, slug)"
            },
            {
                "index": "regions_pkey",
                "table": "regions",
                "definition": "CREATE UNIQUE INDEX regions_pkey ON public.regions USING btree (id)"
            },
            {
                "index": "sensory_note_translations_pkey",
                "table": "sensory_note_translations",
                "definition": "CREATE UNIQUE INDEX sensory_note_translations_pkey ON public.sensory_note_translations USING btree (sensory_note_id, locale)"
            },
            {
                "index": "sensory_notes_pkey",
                "table": "sensory_notes",
                "definition": "CREATE UNIQUE INDEX sensory_notes_pkey ON public.sensory_notes USING btree (id)"
            },
            {
                "index": "sensory_notes_slug_key",
                "table": "sensory_notes",
                "definition": "CREATE UNIQUE INDEX sensory_notes_slug_key ON public.sensory_notes USING btree (slug)"
            },
            {
                "index": "site_page_section_translations_pkey",
                "table": "site_page_section_translations",
                "definition": "CREATE UNIQUE INDEX site_page_section_translations_pkey ON public.site_page_section_translations USING btree (section_id, locale)"
            },
            {
                "index": "idx_site_page_sections_page_order",
                "table": "site_page_sections",
                "definition": "CREATE INDEX idx_site_page_sections_page_order ON public.site_page_sections USING btree (page_id, sort_order)"
            },
            {
                "index": "site_page_sections_page_key_unique",
                "table": "site_page_sections",
                "definition": "CREATE UNIQUE INDEX site_page_sections_page_key_unique ON public.site_page_sections USING btree (page_id, section_key)"
            },
            {
                "index": "site_page_sections_pkey",
                "table": "site_page_sections",
                "definition": "CREATE UNIQUE INDEX site_page_sections_pkey ON public.site_page_sections USING btree (id)"
            },
            {
                "index": "idx_site_page_translations_locale",
                "table": "site_page_translations",
                "definition": "CREATE INDEX idx_site_page_translations_locale ON public.site_page_translations USING btree (locale)"
            },
            {
                "index": "site_page_translations_pkey",
                "table": "site_page_translations",
                "definition": "CREATE UNIQUE INDEX site_page_translations_pkey ON public.site_page_translations USING btree (page_id, locale)"
            },
            {
                "index": "idx_site_pages_status_published",
                "table": "site_pages",
                "definition": "CREATE INDEX idx_site_pages_status_published ON public.site_pages USING btree (status, published_at DESC) WHERE (deleted_at IS NULL)"
            },
            {
                "index": "idx_site_pages_template_sort",
                "table": "site_pages",
                "definition": "CREATE INDEX idx_site_pages_template_sort ON public.site_pages USING btree (template, sort_order) WHERE ((deleted_at IS NULL) AND (is_active = true))"
            },
            {
                "index": "site_pages_page_key_key",
                "table": "site_pages",
                "definition": "CREATE UNIQUE INDEX site_pages_page_key_key ON public.site_pages USING btree (page_key)"
            },
            {
                "index": "site_pages_pkey",
                "table": "site_pages",
                "definition": "CREATE UNIQUE INDEX site_pages_pkey ON public.site_pages USING btree (id)"
            },
            {
                "index": "site_pages_route_path_key",
                "table": "site_pages",
                "definition": "CREATE UNIQUE INDEX site_pages_route_path_key ON public.site_pages USING btree (route_path)"
            },
            {
                "index": "site_settings_pkey",
                "table": "site_settings",
                "definition": "CREATE UNIQUE INDEX site_settings_pkey ON public.site_settings USING btree (id)"
            },
            {
                "index": "site_settings_translations_pkey",
                "table": "site_settings_translations",
                "definition": "CREATE UNIQUE INDEX site_settings_translations_pkey ON public.site_settings_translations USING btree (settings_id, locale)"
            },
            {
                "index": "tag_translations_pkey",
                "table": "tag_translations",
                "definition": "CREATE UNIQUE INDEX tag_translations_pkey ON public.tag_translations USING btree (tag_id, locale)"
            },
            {
                "index": "tags_pkey",
                "table": "tags",
                "definition": "CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id)"
            },
            {
                "index": "tags_slug_key",
                "table": "tags",
                "definition": "CREATE UNIQUE INDEX tags_slug_key ON public.tags USING btree (slug)"
            },
            {
                "index": "varieties_pkey",
                "table": "varieties",
                "definition": "CREATE UNIQUE INDEX varieties_pkey ON public.varieties USING btree (id)"
            },
            {
                "index": "varieties_slug_key",
                "table": "varieties",
                "definition": "CREATE UNIQUE INDEX varieties_slug_key ON public.varieties USING btree (slug)"
            },
            {
                "index": "idx_warehouse_translations_locale",
                "table": "warehouse_translations",
                "definition": "CREATE INDEX idx_warehouse_translations_locale ON public.warehouse_translations USING btree (locale)"
            },
            {
                "index": "warehouse_translations_pkey",
                "table": "warehouse_translations",
                "definition": "CREATE UNIQUE INDEX warehouse_translations_pkey ON public.warehouse_translations USING btree (warehouse_id, locale)"
            },
            {
                "index": "warehouses_code_key",
                "table": "warehouses",
                "definition": "CREATE UNIQUE INDEX warehouses_code_key ON public.warehouses USING btree (code)"
            },
            {
                "index": "warehouses_pkey",
                "table": "warehouses",
                "definition": "CREATE UNIQUE INDEX warehouses_pkey ON public.warehouses USING btree (id)"
            }
        ],
        "triggers": [
            {
                "table": "article_categories",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON article_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "article_category_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON article_category_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "article_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON article_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "articles",
                "enabled": "ORIGIN",
                "trigger": "hills_audit_articles",
                "definition": "CREATE TRIGGER hills_audit_articles AFTER INSERT OR DELETE OR UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION audit_hills_changes()"
            },
            {
                "table": "articles",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at_user",
                "definition": "CREATE TRIGGER hills_updated_at_user BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_user()"
            },
            {
                "table": "certification_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON certification_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "certifications",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON certifications FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "coffee_offers",
                "enabled": "ORIGIN",
                "trigger": "hills_audit_coffee_offers",
                "definition": "CREATE TRIGGER hills_audit_coffee_offers AFTER INSERT OR DELETE OR UPDATE ON coffee_offers FOR EACH ROW EXECUTE FUNCTION audit_hills_changes()"
            },
            {
                "table": "coffee_offers",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at_user",
                "definition": "CREATE TRIGGER hills_updated_at_user BEFORE UPDATE ON coffee_offers FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_user()"
            },
            {
                "table": "coffee_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON coffee_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "coffee_type_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON coffee_type_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "coffee_types",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON coffee_types FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "coffees",
                "enabled": "ORIGIN",
                "trigger": "hills_audit_coffees",
                "definition": "CREATE TRIGGER hills_audit_coffees AFTER INSERT OR DELETE OR UPDATE ON coffees FOR EACH ROW EXECUTE FUNCTION audit_hills_changes()"
            },
            {
                "table": "coffees",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at_user",
                "definition": "CREATE TRIGGER hills_updated_at_user BEFORE UPDATE ON coffees FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_user()"
            },
            {
                "table": "coffees",
                "enabled": "ORIGIN",
                "trigger": "hills_validate_coffee_region_origin",
                "definition": "CREATE TRIGGER hills_validate_coffee_region_origin BEFORE INSERT OR UPDATE OF origin_id, region_id ON coffees FOR EACH ROW EXECUTE FUNCTION validate_coffee_region_origin()"
            },
            {
                "table": "inquiries",
                "enabled": "ORIGIN",
                "trigger": "hills_hydrate_inquiry_context",
                "definition": "CREATE TRIGGER hills_hydrate_inquiry_context BEFORE INSERT ON inquiries FOR EACH ROW EXECUTE FUNCTION hydrate_inquiry_context()"
            },
            {
                "table": "inquiries",
                "enabled": "ORIGIN",
                "trigger": "hills_track_inquiry_status_insert",
                "definition": "CREATE TRIGGER hills_track_inquiry_status_insert AFTER INSERT ON inquiries FOR EACH ROW EXECUTE FUNCTION track_inquiry_status()"
            },
            {
                "table": "inquiries",
                "enabled": "ORIGIN",
                "trigger": "hills_track_inquiry_status_update",
                "definition": "CREATE TRIGGER hills_track_inquiry_status_update AFTER UPDATE OF status ON inquiries FOR EACH ROW EXECUTE FUNCTION track_inquiry_status()"
            },
            {
                "table": "inquiries",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "inquiries",
                "enabled": "ORIGIN",
                "trigger": "trg_validate_inquiry_status_transition",
                "definition": "CREATE TRIGGER trg_validate_inquiry_status_transition BEFORE UPDATE OF status ON inquiries FOR EACH ROW EXECUTE FUNCTION validate_inquiry_status_transition()"
            },
            {
                "table": "media",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON media FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "media_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON media_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "offer_price_tiers",
                "enabled": "ORIGIN",
                "trigger": "hills_audit_offer_price_tiers",
                "definition": "CREATE TRIGGER hills_audit_offer_price_tiers AFTER INSERT OR DELETE OR UPDATE ON offer_price_tiers FOR EACH ROW EXECUTE FUNCTION audit_hills_changes()"
            },
            {
                "table": "offer_price_tiers",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON offer_price_tiers FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "origin_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON origin_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "origins",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at_user",
                "definition": "CREATE TRIGGER hills_updated_at_user BEFORE UPDATE ON origins FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_user()"
            },
            {
                "table": "packaging_type_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON packaging_type_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "packaging_types",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON packaging_types FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "processing_method_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON processing_method_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "processing_methods",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON processing_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "profiles",
                "enabled": "ORIGIN",
                "trigger": "hills_prevent_profile_role_escalation",
                "definition": "CREATE TRIGGER hills_prevent_profile_role_escalation BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION prevent_profile_role_escalation()"
            },
            {
                "table": "profiles",
                "enabled": "ORIGIN",
                "trigger": "hills_profiles_updated_at",
                "definition": "CREATE TRIGGER hills_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "profiles",
                "enabled": "ORIGIN",
                "trigger": "trg_protect_profile_block_fields",
                "definition": "CREATE TRIGGER trg_protect_profile_block_fields BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_block_fields()"
            },
            {
                "table": "region_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON region_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "regions",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at_user",
                "definition": "CREATE TRIGGER hills_updated_at_user BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_user()"
            },
            {
                "table": "sensory_note_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON sensory_note_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "sensory_notes",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON sensory_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "site_page_section_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_site_page_section_translations_updated_at",
                "definition": "CREATE TRIGGER hills_site_page_section_translations_updated_at BEFORE UPDATE ON site_page_section_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "site_page_sections",
                "enabled": "ORIGIN",
                "trigger": "hills_site_page_sections_updated_at",
                "definition": "CREATE TRIGGER hills_site_page_sections_updated_at BEFORE UPDATE ON site_page_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "site_page_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_site_page_translations_updated_at",
                "definition": "CREATE TRIGGER hills_site_page_translations_updated_at BEFORE UPDATE ON site_page_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "site_pages",
                "enabled": "ORIGIN",
                "trigger": "hills_audit_site_pages",
                "definition": "CREATE TRIGGER hills_audit_site_pages AFTER INSERT OR DELETE OR UPDATE ON site_pages FOR EACH ROW EXECUTE FUNCTION audit_hills_changes()"
            },
            {
                "table": "site_pages",
                "enabled": "ORIGIN",
                "trigger": "hills_site_pages_updated_at_user",
                "definition": "CREATE TRIGGER hills_site_pages_updated_at_user BEFORE UPDATE ON site_pages FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_user()"
            },
            {
                "table": "site_settings",
                "enabled": "ORIGIN",
                "trigger": "hills_site_settings_updated_at_user",
                "definition": "CREATE TRIGGER hills_site_settings_updated_at_user BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_user()"
            },
            {
                "table": "site_settings_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_site_settings_translations_updated_at",
                "definition": "CREATE TRIGGER hills_site_settings_translations_updated_at BEFORE UPDATE ON site_settings_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "tag_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON tag_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "tags",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "varieties",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON varieties FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "warehouse_translations",
                "enabled": "ORIGIN",
                "trigger": "hills_warehouse_translations_updated_at",
                "definition": "CREATE TRIGGER hills_warehouse_translations_updated_at BEFORE UPDATE ON warehouse_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            },
            {
                "table": "warehouses",
                "enabled": "ORIGIN",
                "trigger": "hills_updated_at",
                "definition": "CREATE TRIGGER hills_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
            }
        ],
        "functions": [
            {
                "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "admin_list_users",
                "owner": "postgres",
                "result": "TABLE(id uuid, full_name text, phone text, company_name text, email text, email_verified boolean, registered_at timestamp with time zone, favorites_count bigint, inquiries_count bigint)",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.admin_list_users()\n RETURNS TABLE(id uuid, full_name text, phone text, company_name text, email text, email_verified boolean, registered_at timestamp with time zone, favorites_count bigint, inquiries_count bigint)\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'auth'\nAS $function$\r\nbegin\r\n\r\n    if not public.is_admin() then\r\n        raise exception 'Forbidden';\r\n    end if;\r\n\r\n    return query\r\n\r\n    select\r\n        p.id,\r\n        p.full_name,\r\n        p.phone,\r\n        p.company_name,\r\n        u.email::text,\r\n        (u.email_confirmed_at is not null),\r\n        u.created_at,\r\n\r\n        (\r\n            select count(*)\r\n            from public.favorites f\r\n            where f.user_id = p.id\r\n        )::bigint,\r\n\r\n        (\r\n            select count(*)\r\n            from public.inquiries i\r\n            where i.user_id = p.id\r\n        )::bigint\r\n\r\n    from public.profiles p\r\n\r\n    join auth.users u\r\n      on u.id = p.id\r\n\r\n    where p.role = 'USER'\r\n\r\n    order by u.created_at desc;\r\n\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "admin_set_user_blocked",
                "owner": "postgres",
                "result": "void",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.admin_set_user_blocked(target_user_id uuid, blocked boolean, reason text DEFAULT NULL::text)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nDECLARE\r\n  target_role text;\r\nBEGIN\r\n\r\n  IF NOT public.hills_is_admin() THEN\r\n    RAISE EXCEPTION\r\n      USING\r\n        ERRCODE = '42501',\r\n        MESSAGE = 'admin_access_required';\r\n  END IF;\r\n\r\n  IF target_user_id IS NULL THEN\r\n    RAISE EXCEPTION\r\n      USING\r\n        ERRCODE = '22004',\r\n        MESSAGE = 'target_user_required';\r\n  END IF;\r\n\r\n  IF target_user_id = auth.uid() THEN\r\n    RAISE EXCEPTION\r\n      USING\r\n        ERRCODE = '42501',\r\n        MESSAGE = 'admin_cannot_block_self';\r\n  END IF;\r\n\r\n  SELECT p.role::text\r\n  INTO target_role\r\n  FROM public.profiles p\r\n  WHERE p.id = target_user_id;\r\n\r\n  IF NOT FOUND THEN\r\n    RAISE EXCEPTION\r\n      USING\r\n        ERRCODE = 'P0002',\r\n        MESSAGE = 'target_user_not_found';\r\n  END IF;\r\n\r\n  IF target_role <> 'USER' THEN\r\n    RAISE EXCEPTION\r\n      USING\r\n        ERRCODE = '42501',\r\n        MESSAGE = 'only_user_accounts_can_be_blocked';\r\n  END IF;\r\n\r\n  IF blocked THEN\r\n\r\n    UPDATE public.profiles\r\n    SET\r\n      is_blocked = true,\r\n      blocked_at = now(),\r\n      blocked_by = auth.uid(),\r\n      block_reason = NULLIF(trim(reason), ''),\r\n      updated_at = now()\r\n    WHERE id = target_user_id;\r\n\r\n  ELSE\r\n\r\n    UPDATE public.profiles\r\n    SET\r\n      is_blocked = false,\r\n      blocked_at = NULL,\r\n      blocked_by = NULL,\r\n      block_reason = NULL,\r\n      updated_at = now()\r\n    WHERE id = target_user_id;\r\n\r\n  END IF;\r\n\r\nEND;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=pg_catalog, public"
                ],
                "security_definer": true,
                "identity_arguments": "target_user_id uuid, blocked boolean, reason text"
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "audit_hills_changes",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.audit_hills_changes()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'auth'\nAS $function$\r\ndeclare\r\n    entity_uuid uuid;\r\nbegin\r\n\r\n    if tg_op = 'INSERT' then\r\n\r\n        entity_uuid = new.id;\r\n\r\n        insert into public.audit_logs (\r\n            actor_user_id,\r\n            entity_type,\r\n            entity_id,\r\n            action,\r\n            old_data,\r\n            new_data\r\n        )\r\n        values (\r\n            auth.uid(),\r\n            tg_table_name,\r\n            entity_uuid,\r\n            'INSERT',\r\n            null,\r\n            to_jsonb(new)\r\n        );\r\n\r\n        return new;\r\n\r\n    elsif tg_op = 'UPDATE' then\r\n\r\n        entity_uuid = new.id;\r\n\r\n        insert into public.audit_logs (\r\n            actor_user_id,\r\n            entity_type,\r\n            entity_id,\r\n            action,\r\n            old_data,\r\n            new_data\r\n        )\r\n        values (\r\n            auth.uid(),\r\n            tg_table_name,\r\n            entity_uuid,\r\n            'UPDATE',\r\n            to_jsonb(old),\r\n            to_jsonb(new)\r\n        );\r\n\r\n        return new;\r\n\r\n    elsif tg_op = 'DELETE' then\r\n\r\n        entity_uuid = old.id;\r\n\r\n        insert into public.audit_logs (\r\n            actor_user_id,\r\n            entity_type,\r\n            entity_id,\r\n            action,\r\n            old_data,\r\n            new_data\r\n        )\r\n        values (\r\n            auth.uid(),\r\n            tg_table_name,\r\n            entity_uuid,\r\n            'DELETE',\r\n            to_jsonb(old),\r\n            null\r\n        );\r\n\r\n        return old;\r\n\r\n    end if;\r\n\r\n    return null;\r\n\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gin_extract_query_trgm",
                "owner": "supabase_admin",
                "result": "internal",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)\n RETURNS internal\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, internal, smallint, internal, internal, internal, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gin_extract_value_trgm",
                "owner": "supabase_admin",
                "result": "internal",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)\n RETURNS internal\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gin_trgm_consistent",
                "owner": "supabase_admin",
                "result": "boolean",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal, smallint, text, integer, internal, internal, internal, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gin_trgm_triconsistent",
                "owner": "supabase_admin",
                "result": "\"char\"",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)\n RETURNS \"char\"\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal, smallint, text, integer, internal, internal, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_compress",
                "owner": "supabase_admin",
                "result": "internal",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)\n RETURNS internal\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_compress$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_consistent",
                "owner": "supabase_admin",
                "result": "boolean",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)\n RETURNS boolean\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_consistent$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal, text, smallint, oid, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_decompress",
                "owner": "supabase_admin",
                "result": "internal",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)\n RETURNS internal\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_decompress$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_distance",
                "owner": "supabase_admin",
                "result": "double precision",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)\n RETURNS double precision\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_distance$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal, text, smallint, oid, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_in",
                "owner": "supabase_admin",
                "result": "gtrgm",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)\n RETURNS gtrgm\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_in$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "cstring"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_options",
                "owner": "supabase_admin",
                "result": "void",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)\n RETURNS void\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE\nAS '$libdir/pg_trgm', $function$gtrgm_options$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_out",
                "owner": "supabase_admin",
                "result": "cstring",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)\n RETURNS cstring\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_out$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "gtrgm"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_penalty",
                "owner": "supabase_admin",
                "result": "internal",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)\n RETURNS internal\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_penalty$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal, internal, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_picksplit",
                "owner": "supabase_admin",
                "result": "internal",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)\n RETURNS internal\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_same",
                "owner": "supabase_admin",
                "result": "internal",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)\n RETURNS internal\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_same$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "gtrgm, gtrgm, internal"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "gtrgm_union",
                "owner": "supabase_admin",
                "result": "gtrgm",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)\n RETURNS gtrgm\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$gtrgm_union$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "internal, internal"
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "handle_hills_new_user",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.handle_hills_new_user()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'auth'\nAS $function$\r\nbegin\r\n\r\n    insert into public.profiles (\r\n        id,\r\n        full_name,\r\n        phone,\r\n        role\r\n    )\r\n    values (\r\n        new.id,\r\n\r\n        coalesce(\r\n            new.raw_user_meta_data ->> 'full_name',\r\n            ''\r\n        ),\r\n\r\n        nullif(\r\n            new.raw_user_meta_data ->> 'phone',\r\n            ''\r\n        ),\r\n\r\n        'USER'\r\n    )\r\n    on conflict (id) do nothing;\r\n\r\n    return new;\r\n\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "hills_is_admin",
                "owner": "postgres",
                "result": "boolean",
                "language": "sql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.hills_is_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n  SELECT public.is_admin();\r\n$function$\n",
                "volatility": "STABLE",
                "configuration": [
                    "search_path=pg_catalog, public"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "hills_is_blocked",
                "owner": "postgres",
                "result": "boolean",
                "language": "sql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.hills_is_blocked()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n  SELECT COALESCE(\r\n    (\r\n      SELECT p.is_blocked\r\n      FROM public.profiles p\r\n      WHERE p.id = auth.uid()\r\n    ),\r\n    false\r\n  );\r\n$function$\n",
                "volatility": "STABLE",
                "configuration": [
                    "search_path=pg_catalog, public"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "hills_is_verified_user",
                "owner": "postgres",
                "result": "boolean",
                "language": "sql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.hills_is_verified_user()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public', 'auth'\nAS $function$\r\n  SELECT EXISTS (\r\n    SELECT 1\r\n    FROM public.profiles p\r\n    JOIN auth.users u\r\n      ON u.id = p.id\r\n    WHERE p.id = auth.uid()\r\n      AND p.role = 'USER'::public.app_role\r\n      AND COALESCE(p.is_blocked, false) = false\r\n      AND u.email_confirmed_at IS NOT NULL\r\n  );\r\n$function$\n",
                "volatility": "STABLE",
                "configuration": [
                    "search_path=pg_catalog, public, auth"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "hydrate_inquiry_context",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.hydrate_inquiry_context()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'auth'\nAS $function$\r\ndeclare\r\n    offer_coffee_id uuid;\r\n    offer_reference text;\r\n    warehouse_code text;\r\n    coffee_name text;\r\nbegin\r\n\r\n    -- Authenticated users are always tied to their actual account.\r\n\r\n    if auth.uid() is not null then\r\n        new.user_id = auth.uid();\r\n    end if;\r\n\r\n\r\n    -- If offer exists, derive Coffee + Warehouse from DB.\r\n\r\n    if new.offer_id is not null then\r\n\r\n        select\r\n            o.coffee_id,\r\n            o.reference_number,\r\n            w.code\r\n        into\r\n            offer_coffee_id,\r\n            offer_reference,\r\n            warehouse_code\r\n        from public.coffee_offers o\r\n        join public.warehouses w\r\n          on w.id = o.warehouse_id\r\n        where o.id = new.offer_id\r\n          and o.deleted_at is null;\r\n\r\n        if offer_coffee_id is null then\r\n            raise exception 'Invalid offer';\r\n        end if;\r\n\r\n        if new.coffee_id is null then\r\n            new.coffee_id = offer_coffee_id;\r\n        elsif new.coffee_id <> offer_coffee_id then\r\n            raise exception\r\n                'Offer does not belong to selected coffee';\r\n        end if;\r\n\r\n        new.offer_reference_snapshot = offer_reference;\r\n        new.warehouse_code_snapshot = warehouse_code;\r\n\r\n    end if;\r\n\r\n\r\n    -- Snapshot English name if available.\r\n    -- Fallback to slug.\r\n\r\n    if new.coffee_id is not null then\r\n\r\n        select\r\n            coalesce(\r\n                (\r\n                    select ct.name\r\n                    from public.coffee_translations ct\r\n                    where ct.coffee_id = c.id\r\n                      and ct.locale = 'en'\r\n                    limit 1\r\n                ),\r\n                c.slug\r\n            )\r\n        into coffee_name\r\n        from public.coffees c\r\n        where c.id = new.coffee_id;\r\n\r\n        if coffee_name is null then\r\n            raise exception 'Invalid coffee';\r\n        end if;\r\n\r\n        new.coffee_name_snapshot = coffee_name;\r\n\r\n    end if;\r\n\r\n    return new;\r\n\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "is_admin",
                "owner": "postgres",
                "result": "boolean",
                "language": "sql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.is_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\n  SELECT EXISTS (\r\n    SELECT 1\r\n    FROM public.profiles p\r\n    WHERE p.id = auth.uid()\r\n      AND p.role = 'ADMIN'::public.app_role\r\n      AND COALESCE(p.is_blocked, false) = false\r\n  );\r\n$function$\n",
                "volatility": "STABLE",
                "configuration": [
                    "search_path=pg_catalog, public"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "is_email_verified",
                "owner": "postgres",
                "result": "boolean",
                "language": "sql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.is_email_verified()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public', 'auth'\nAS $function$\r\n    select exists (\r\n        select 1\r\n        from auth.users u\r\n        where u.id = auth.uid()\r\n          and u.email_confirmed_at is not null\r\n    );\r\n$function$\n",
                "volatility": "STABLE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "is_valid_month_array",
                "owner": "postgres",
                "result": "boolean",
                "language": "sql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.is_valid_month_array(value smallint[])\n RETURNS boolean\n LANGUAGE sql\n IMMUTABLE\n SET search_path TO 'public', 'auth'\nAS $function$\r\n    select\r\n        value is null\r\n        or (\r\n            cardinality(value) <= 12\r\n            and not exists (\r\n                select 1\r\n                from unnest(value) as m\r\n                where m < 1 or m > 12\r\n            )\r\n        );\r\n$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": false,
                "identity_arguments": "value smallint[]"
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "prevent_profile_role_escalation",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public', 'auth'\nAS $function$\r\nbegin\r\n\r\n    if new.role is distinct from old.role then\r\n\r\n        if\r\n            current_user <> 'postgres'\r\n            and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'\r\n        then\r\n\r\n            raise exception\r\n                'Profile role cannot be changed from the public application';\r\n\r\n        end if;\r\n\r\n    end if;\r\n\r\n    return new;\r\n\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": false,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "protect_profile_block_fields",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.protect_profile_block_fields()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nBEGIN\r\n\r\n  IF\r\n    NEW.is_blocked IS DISTINCT FROM OLD.is_blocked\r\n    OR NEW.blocked_at IS DISTINCT FROM OLD.blocked_at\r\n    OR NEW.blocked_by IS DISTINCT FROM OLD.blocked_by\r\n    OR NEW.block_reason IS DISTINCT FROM OLD.block_reason\r\n  THEN\r\n\r\n    IF NOT public.hills_is_admin() THEN\r\n      RAISE EXCEPTION\r\n        USING\r\n          ERRCODE = '42501',\r\n          MESSAGE = 'profile_security_fields_not_editable';\r\n    END IF;\r\n\r\n    IF OLD.id = auth.uid() THEN\r\n      RAISE EXCEPTION\r\n        USING\r\n          ERRCODE = '42501',\r\n          MESSAGE = 'admin_cannot_block_self';\r\n    END IF;\r\n\r\n    IF OLD.role::text <> 'USER' THEN\r\n      RAISE EXCEPTION\r\n        USING\r\n          ERRCODE = '42501',\r\n          MESSAGE = 'customer_block_action_requires_user_role';\r\n    END IF;\r\n\r\n  END IF;\r\n\r\n  RETURN NEW;\r\nEND;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=pg_catalog, public"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "set_limit",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.set_limit(real)\n RETURNS real\n LANGUAGE c\n STRICT\nAS '$libdir/pg_trgm', $function$set_limit$function$\n",
                "volatility": "VOLATILE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "real"
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "set_updated_at",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.set_updated_at()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public', 'auth'\nAS $function$\r\nbegin\r\n    new.updated_at = now();\r\n    return new;\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": false,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "set_updated_at_and_user",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.set_updated_at_and_user()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public', 'auth'\nAS $function$\r\nbegin\r\n    new.updated_at = now();\r\n\r\n    if auth.uid() is not null then\r\n        new.updated_by = auth.uid();\r\n    end if;\r\n\r\n    return new;\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": false,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "show_limit",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.show_limit()\n RETURNS real\n LANGUAGE c\n STABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$show_limit$function$\n",
                "volatility": "STABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "show_trgm",
                "owner": "supabase_admin",
                "result": "text[]",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.show_trgm(text)\n RETURNS text[]\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$show_trgm$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "similarity",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.similarity(text, text)\n RETURNS real\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$similarity$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "similarity_dist",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)\n RETURNS real\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$similarity_dist$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "similarity_op",
                "owner": "supabase_admin",
                "result": "boolean",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.similarity_op(text, text)\n RETURNS boolean\n LANGUAGE c\n STABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$similarity_op$function$\n",
                "volatility": "STABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "strict_word_similarity",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)\n RETURNS real\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$strict_word_similarity$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "strict_word_similarity_commutator_op",
                "owner": "supabase_admin",
                "result": "boolean",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)\n RETURNS boolean\n LANGUAGE c\n STABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$\n",
                "volatility": "STABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "strict_word_similarity_dist_commutator_op",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)\n RETURNS real\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "strict_word_similarity_dist_op",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)\n RETURNS real\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "strict_word_similarity_op",
                "owner": "supabase_admin",
                "result": "boolean",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)\n RETURNS boolean\n LANGUAGE c\n STABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$\n",
                "volatility": "STABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "track_inquiry_status",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.track_inquiry_status()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public', 'auth'\nAS $function$\r\nbegin\r\n\r\n    if tg_op = 'INSERT' then\r\n\r\n        insert into public.inquiry_status_history (\r\n            inquiry_id,\r\n            old_status,\r\n            new_status,\r\n            changed_by\r\n        )\r\n        values (\r\n            new.id,\r\n            null,\r\n            new.status,\r\n            auth.uid()\r\n        );\r\n\r\n    elsif\r\n        new.status is distinct from old.status\r\n    then\r\n\r\n        insert into public.inquiry_status_history (\r\n            inquiry_id,\r\n            old_status,\r\n            new_status,\r\n            changed_by\r\n        )\r\n        values (\r\n            new.id,\r\n            old.status,\r\n            new.status,\r\n            auth.uid()\r\n        );\r\n\r\n    end if;\r\n\r\n    return new;\r\n\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": true,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "validate_coffee_region_origin",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.validate_coffee_region_origin()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'public', 'auth'\nAS $function$\r\ndeclare\r\n    region_origin_id uuid;\r\nbegin\r\n\r\n    if new.region_id is null then\r\n        return new;\r\n    end if;\r\n\r\n    select r.origin_id\r\n    into region_origin_id\r\n    from public.regions r\r\n    where r.id = new.region_id;\r\n\r\n    if region_origin_id is null then\r\n        raise exception 'Region does not exist';\r\n    end if;\r\n\r\n    if region_origin_id <> new.origin_id then\r\n        raise exception\r\n            'Coffee region must belong to the selected origin';\r\n    end if;\r\n\r\n    return new;\r\n\r\nend;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=public, auth"
                ],
                "security_definer": false,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
                "name": "validate_inquiry_status_transition",
                "owner": "postgres",
                "result": "trigger",
                "language": "plpgsql",
                "parallel": "UNSAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.validate_inquiry_status_transition()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'public'\nAS $function$\r\nBEGIN\r\n\r\n  IF NEW.status = OLD.status THEN\r\n    RETURN NEW;\r\n  END IF;\r\n\r\n\r\n  -- CLOSED is terminal\r\n  IF OLD.status::text = 'CLOSED' THEN\r\n    RAISE EXCEPTION\r\n      USING\r\n        ERRCODE = '23514',\r\n        MESSAGE = 'invalid_inquiry_status_transition';\r\n  END IF;\r\n\r\n\r\n  -- SAMPLE REQUEST\r\n  IF NEW.type::text = 'SAMPLE_REQUEST' THEN\r\n\r\n    IF NOT (\r\n      (OLD.status::text = 'NEW'\r\n        AND NEW.status::text IN ('RECEIVED', 'CLOSED'))\r\n\r\n      OR\r\n\r\n      (OLD.status::text = 'RECEIVED'\r\n        AND NEW.status::text IN ('CONTACTED', 'CLOSED'))\r\n\r\n      OR\r\n\r\n      (OLD.status::text = 'CONTACTED'\r\n        AND NEW.status::text IN ('SAMPLE_SENT', 'CLOSED'))\r\n\r\n      OR\r\n\r\n      (OLD.status::text = 'SAMPLE_SENT'\r\n        AND NEW.status::text IN ('DELIVERED', 'CLOSED'))\r\n\r\n      OR\r\n\r\n      (OLD.status::text = 'DELIVERED'\r\n        AND NEW.status::text = 'CLOSED')\r\n    ) THEN\r\n\r\n      RAISE EXCEPTION\r\n        USING\r\n          ERRCODE = '23514',\r\n          MESSAGE = 'invalid_sample_request_status_transition';\r\n\r\n    END IF;\r\n\r\n\r\n  -- PRODUCT / other inquiry types\r\n  ELSE\r\n\r\n    -- physical sample statuses are forbidden\r\n    IF NEW.status::text IN ('SAMPLE_SENT', 'DELIVERED') THEN\r\n\r\n      RAISE EXCEPTION\r\n        USING\r\n          ERRCODE = '23514',\r\n          MESSAGE = 'sample_status_not_allowed_for_inquiry_type';\r\n\r\n    END IF;\r\n\r\n\r\n    IF NOT (\r\n      (OLD.status::text = 'NEW'\r\n        AND NEW.status::text IN ('RECEIVED', 'CLOSED'))\r\n\r\n      OR\r\n\r\n      (OLD.status::text = 'RECEIVED'\r\n        AND NEW.status::text IN ('CONTACTED', 'CLOSED'))\r\n\r\n      OR\r\n\r\n      (OLD.status::text = 'CONTACTED'\r\n        AND NEW.status::text = 'CLOSED')\r\n    ) THEN\r\n\r\n      RAISE EXCEPTION\r\n        USING\r\n          ERRCODE = '23514',\r\n          MESSAGE = 'invalid_inquiry_status_transition';\r\n\r\n    END IF;\r\n\r\n  END IF;\r\n\r\n\r\n  RETURN NEW;\r\nEND;\r\n$function$\n",
                "volatility": "VOLATILE",
                "configuration": [
                    "search_path=pg_catalog, public"
                ],
                "security_definer": false,
                "identity_arguments": ""
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "word_similarity",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.word_similarity(text, text)\n RETURNS real\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$word_similarity$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "word_similarity_commutator_op",
                "owner": "supabase_admin",
                "result": "boolean",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)\n RETURNS boolean\n LANGUAGE c\n STABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$word_similarity_commutator_op$function$\n",
                "volatility": "STABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "word_similarity_dist_commutator_op",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)\n RETURNS real\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "word_similarity_dist_op",
                "owner": "supabase_admin",
                "result": "real",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)\n RETURNS real\n LANGUAGE c\n IMMUTABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$\n",
                "volatility": "IMMUTABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            },
            {
                "acl": "{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}",
                "name": "word_similarity_op",
                "owner": "supabase_admin",
                "result": "boolean",
                "language": "c",
                "parallel": "SAFE",
                "definition": "CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)\n RETURNS boolean\n LANGUAGE c\n STABLE PARALLEL SAFE STRICT\nAS '$libdir/pg_trgm', $function$word_similarity_op$function$\n",
                "volatility": "STABLE",
                "configuration": null,
                "security_definer": false,
                "identity_arguments": "text, text"
            }
        ],
        "constraints": [
            {
                "type": "PRIMARY_KEY",
                "table": "article_categories",
                "validated": true,
                "constraint": "article_categories_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "article_categories",
                "validated": true,
                "constraint": "article_categories_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "article_category_translations",
                "validated": true,
                "constraint": "article_category_translations_category_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (category_id) REFERENCES article_categories(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "article_category_translations",
                "validated": true,
                "constraint": "article_category_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (category_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "article_translations",
                "validated": true,
                "constraint": "article_translation_title_not_empty",
                "deferrable": false,
                "definition": "CHECK (char_length(TRIM(BOTH FROM title)) > 0)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "article_translations",
                "validated": true,
                "constraint": "article_translations_article_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "article_translations",
                "validated": true,
                "constraint": "article_translations_locale_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (locale, slug)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "article_translations",
                "validated": true,
                "constraint": "article_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (article_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "articles",
                "validated": true,
                "constraint": "articles_category_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (category_id) REFERENCES article_categories(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "articles",
                "validated": true,
                "constraint": "articles_created_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "articles",
                "validated": true,
                "constraint": "articles_featured_media_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (featured_media_id) REFERENCES media(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "articles",
                "validated": true,
                "constraint": "articles_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "articles",
                "validated": true,
                "constraint": "articles_published_requires_date",
                "deferrable": false,
                "definition": "CHECK (status <> 'PUBLISHED'::article_status OR published_at IS NOT NULL)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "articles",
                "validated": true,
                "constraint": "articles_updated_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "audit_logs",
                "validated": true,
                "constraint": "audit_logs_actor_user_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "audit_logs",
                "validated": true,
                "constraint": "audit_logs_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "certification_translations",
                "validated": true,
                "constraint": "certification_translations_certification_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "certification_translations",
                "validated": true,
                "constraint": "certification_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (certification_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "certifications",
                "validated": true,
                "constraint": "certifications_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "certifications",
                "validated": true,
                "constraint": "certifications_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_certifications",
                "validated": true,
                "constraint": "coffee_certifications_certification_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_certifications",
                "validated": true,
                "constraint": "coffee_certifications_coffee_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffee_certifications",
                "validated": true,
                "constraint": "coffee_certifications_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (coffee_id, certification_id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_media",
                "validated": true,
                "constraint": "coffee_media_coffee_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_media",
                "validated": true,
                "constraint": "coffee_media_media_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffee_media",
                "validated": true,
                "constraint": "coffee_media_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (coffee_id, media_id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffee_media",
                "validated": true,
                "constraint": "coffee_media_role",
                "deferrable": false,
                "definition": "CHECK (role = ANY (ARRAY['MAIN'::text, 'GALLERY'::text]))",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_bag_weight_positive",
                "deferrable": false,
                "definition": "CHECK (bag_weight_kg > 0::numeric)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_bags_non_negative",
                "deferrable": false,
                "definition": "CHECK (bags_quantity >= 0)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_coffee_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_created_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_cup_score",
                "deferrable": false,
                "definition": "CHECK (cup_score IS NULL OR cup_score >= 0::numeric AND cup_score <= 100::numeric)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_currency_usd",
                "deferrable": false,
                "definition": "CHECK (currency_code::text = 'USD'::text)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_packaging_type_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (packaging_type_id) REFERENCES packaging_types(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_pricing_unit_kg",
                "deferrable": false,
                "definition": "CHECK (pricing_unit::text = 'KG'::text)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_updated_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_offers",
                "validated": true,
                "constraint": "coffee_offers_warehouse_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_tags",
                "validated": true,
                "constraint": "coffee_tags_coffee_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffee_tags",
                "validated": true,
                "constraint": "coffee_tags_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (coffee_id, tag_id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_tags",
                "validated": true,
                "constraint": "coffee_tags_tag_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffee_translations",
                "validated": true,
                "constraint": "coffee_translation_name_not_empty",
                "deferrable": false,
                "definition": "CHECK (char_length(TRIM(BOTH FROM name)) > 0)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_translations",
                "validated": true,
                "constraint": "coffee_translations_coffee_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffee_translations",
                "validated": true,
                "constraint": "coffee_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (coffee_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_type_translations",
                "validated": true,
                "constraint": "coffee_type_translations_coffee_type_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_type_id) REFERENCES coffee_types(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffee_type_translations",
                "validated": true,
                "constraint": "coffee_type_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (coffee_type_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffee_types",
                "validated": true,
                "constraint": "coffee_types_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffee_types",
                "validated": true,
                "constraint": "coffee_types_slug_format",
                "deferrable": false,
                "definition": "CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "coffee_types",
                "validated": true,
                "constraint": "coffee_types_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_varieties",
                "validated": true,
                "constraint": "coffee_varieties_coffee_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffee_varieties",
                "validated": true,
                "constraint": "coffee_varieties_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (coffee_id, variety_id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffee_varieties",
                "validated": true,
                "constraint": "coffee_varieties_variety_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (variety_id) REFERENCES varieties(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_altitude_max_positive",
                "deferrable": false,
                "definition": "CHECK (altitude_max_meters IS NULL OR altitude_max_meters >= 0)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_altitude_min_positive",
                "deferrable": false,
                "definition": "CHECK (altitude_min_meters IS NULL OR altitude_min_meters >= 0)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_altitude_range",
                "deferrable": false,
                "definition": "CHECK (altitude_min_meters IS NULL OR altitude_max_meters IS NULL OR altitude_max_meters >= altitude_min_meters)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_coffee_type_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_type_id) REFERENCES coffee_types(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_created_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_farm_size_positive",
                "deferrable": false,
                "definition": "CHECK (farm_size_hectares IS NULL OR farm_size_hectares >= 0::numeric)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_harvest_months",
                "deferrable": false,
                "definition": "CHECK (is_valid_month_array(harvest_months))",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_origin_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_processing_method_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (processing_method_id) REFERENCES processing_methods(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_published_requires_date",
                "deferrable": false,
                "definition": "CHECK (status <> 'PUBLISHED'::coffee_status OR published_at IS NOT NULL)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_region_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_slug_format",
                "deferrable": false,
                "definition": "CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "coffees",
                "validated": true,
                "constraint": "coffees_updated_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "favorites",
                "validated": true,
                "constraint": "favorites_coffee_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "favorites",
                "validated": true,
                "constraint": "favorites_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (user_id, coffee_id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "favorites",
                "validated": true,
                "constraint": "favorites_user_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_coffee_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_country_code_length",
                "deferrable": false,
                "definition": "CHECK (country_code IS NULL OR char_length(country_code::text) = 2)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_email_not_empty",
                "deferrable": false,
                "definition": "CHECK (char_length(TRIM(BOTH FROM email)) > 0)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_full_name_not_empty",
                "deferrable": false,
                "definition": "CHECK (char_length(TRIM(BOTH FROM full_name)) > 0)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_inquiry_number_key",
                "deferrable": false,
                "definition": "UNIQUE (inquiry_number)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_offer_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_phone_not_empty",
                "deferrable": false,
                "definition": "CHECK (char_length(TRIM(BOTH FROM phone)) > 0)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_product_needs_coffee",
                "deferrable": false,
                "definition": "CHECK (type = 'GENERAL'::inquiry_type OR coffee_id IS NOT NULL)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_product_needs_user",
                "deferrable": false,
                "definition": "CHECK (type = 'GENERAL'::inquiry_type OR user_id IS NOT NULL)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_request_code_key",
                "deferrable": false,
                "definition": "UNIQUE (request_code)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "inquiries",
                "validated": true,
                "constraint": "inquiries_user_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "inquiry_status_history",
                "validated": true,
                "constraint": "inquiry_status_history_changed_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "inquiry_status_history",
                "validated": true,
                "constraint": "inquiry_status_history_inquiry_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "inquiry_status_history",
                "validated": true,
                "constraint": "inquiry_status_history_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "media",
                "validated": true,
                "constraint": "media_file_size_positive",
                "deferrable": false,
                "definition": "CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "media",
                "validated": true,
                "constraint": "media_height_positive",
                "deferrable": false,
                "definition": "CHECK (height IS NULL OR height > 0)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "media",
                "validated": true,
                "constraint": "media_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "media",
                "validated": true,
                "constraint": "media_storage_bucket_storage_path_key",
                "deferrable": false,
                "definition": "UNIQUE (storage_bucket, storage_path)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "media",
                "validated": true,
                "constraint": "media_uploaded_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "media",
                "validated": true,
                "constraint": "media_width_positive",
                "deferrable": false,
                "definition": "CHECK (width IS NULL OR width > 0)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "media_translations",
                "validated": true,
                "constraint": "media_translations_media_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "media_translations",
                "validated": true,
                "constraint": "media_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (media_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "offer_price_tiers",
                "validated": true,
                "constraint": "offer_price_tiers_min_bags_positive",
                "deferrable": false,
                "definition": "CHECK (min_bags >= 1)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "offer_price_tiers",
                "validated": true,
                "constraint": "offer_price_tiers_offer_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "offer_price_tiers",
                "validated": true,
                "constraint": "offer_price_tiers_offer_id_min_bags_key",
                "deferrable": false,
                "definition": "UNIQUE (offer_id, min_bags)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "offer_price_tiers",
                "validated": true,
                "constraint": "offer_price_tiers_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "offer_price_tiers",
                "validated": true,
                "constraint": "offer_price_tiers_price_positive",
                "deferrable": false,
                "definition": "CHECK (price_per_kg_usd > 0::numeric)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "offer_sensory_notes",
                "validated": true,
                "constraint": "offer_sensory_notes_offer_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "offer_sensory_notes",
                "validated": true,
                "constraint": "offer_sensory_notes_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (offer_id, sensory_note_id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "offer_sensory_notes",
                "validated": true,
                "constraint": "offer_sensory_notes_sensory_note_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (sensory_note_id) REFERENCES sensory_notes(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "offer_tags",
                "validated": true,
                "constraint": "offer_tags_offer_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "offer_tags",
                "validated": true,
                "constraint": "offer_tags_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (offer_id, tag_id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "offer_tags",
                "validated": true,
                "constraint": "offer_tags_tag_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "origin_media",
                "validated": true,
                "constraint": "origin_media_media_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "origin_media",
                "validated": true,
                "constraint": "origin_media_origin_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "origin_media",
                "validated": true,
                "constraint": "origin_media_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (origin_id, media_id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "origin_media",
                "validated": true,
                "constraint": "origin_media_role",
                "deferrable": false,
                "definition": "CHECK (role = ANY (ARRAY['HERO'::text, 'GALLERY'::text]))",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "origin_translations",
                "validated": true,
                "constraint": "origin_translations_origin_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "origin_translations",
                "validated": true,
                "constraint": "origin_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (origin_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "origins",
                "validated": true,
                "constraint": "origins_country_code_length",
                "deferrable": false,
                "definition": "CHECK (country_code IS NULL OR char_length(country_code::text) = 2)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "origins",
                "validated": true,
                "constraint": "origins_created_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "origins",
                "validated": true,
                "constraint": "origins_harvest_months",
                "deferrable": false,
                "definition": "CHECK (is_valid_month_array(harvest_months))",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "origins",
                "validated": true,
                "constraint": "origins_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "origins",
                "validated": true,
                "constraint": "origins_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "origins",
                "validated": true,
                "constraint": "origins_updated_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "packaging_type_translations",
                "validated": true,
                "constraint": "packaging_type_translations_packaging_type_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (packaging_type_id) REFERENCES packaging_types(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "packaging_type_translations",
                "validated": true,
                "constraint": "packaging_type_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (packaging_type_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "packaging_types",
                "validated": true,
                "constraint": "packaging_types_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "packaging_types",
                "validated": true,
                "constraint": "packaging_types_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "processing_method_translations",
                "validated": true,
                "constraint": "processing_method_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (processing_method_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "processing_method_translations",
                "validated": true,
                "constraint": "processing_method_translations_processing_method_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (processing_method_id) REFERENCES processing_methods(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "processing_methods",
                "validated": true,
                "constraint": "processing_methods_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "processing_methods",
                "validated": true,
                "constraint": "processing_methods_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "profiles",
                "validated": true,
                "constraint": "profiles_avatar_path_length_check",
                "deferrable": false,
                "definition": "CHECK (avatar_path IS NULL OR char_length(avatar_path) <= 500)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "profiles",
                "validated": true,
                "constraint": "profiles_block_reason_length_check",
                "deferrable": false,
                "definition": "CHECK (block_reason IS NULL OR char_length(block_reason) <= 1000)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "profiles",
                "validated": true,
                "constraint": "profiles_blocked_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (blocked_by) REFERENCES profiles(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "profiles",
                "validated": true,
                "constraint": "profiles_country_code_length",
                "deferrable": false,
                "definition": "CHECK (country_code IS NULL OR char_length(country_code::text) = 2)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "profiles",
                "validated": true,
                "constraint": "profiles_full_name_length",
                "deferrable": false,
                "definition": "CHECK (char_length(full_name) <= 200)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "profiles",
                "validated": true,
                "constraint": "profiles_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "profiles",
                "validated": true,
                "constraint": "profiles_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "region_translations",
                "validated": true,
                "constraint": "region_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (region_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "region_translations",
                "validated": true,
                "constraint": "region_translations_region_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "regions",
                "validated": true,
                "constraint": "regions_created_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "regions",
                "validated": true,
                "constraint": "regions_origin_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE RESTRICT",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "regions",
                "validated": true,
                "constraint": "regions_origin_id_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (origin_id, slug)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "regions",
                "validated": true,
                "constraint": "regions_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "regions",
                "validated": true,
                "constraint": "regions_updated_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "sensory_note_translations",
                "validated": true,
                "constraint": "sensory_note_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (sensory_note_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "sensory_note_translations",
                "validated": true,
                "constraint": "sensory_note_translations_sensory_note_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (sensory_note_id) REFERENCES sensory_notes(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "sensory_notes",
                "validated": true,
                "constraint": "sensory_notes_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "sensory_notes",
                "validated": true,
                "constraint": "sensory_notes_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "site_page_section_translations",
                "validated": true,
                "constraint": "site_page_section_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (section_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_page_section_translations",
                "validated": true,
                "constraint": "site_page_section_translations_section_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (section_id) REFERENCES site_page_sections(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_cta_href_check",
                "deferrable": false,
                "definition": "CHECK (cta_href IS NULL OR \"left\"(cta_href, 1) = '/'::text AND \"left\"(cta_href, 2) <> '//'::text)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_entity_limit_check",
                "deferrable": false,
                "definition": "CHECK (entity_limit IS NULL OR entity_limit >= 1 AND entity_limit <= 50)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_entity_ref_check",
                "deferrable": false,
                "definition": "CHECK (entity_ref IS NULL OR (entity_ref = ANY (ARRAY['FEATURED_COFFEES'::text, 'FEATURED_ORIGINS'::text, 'WAREHOUSES'::text, 'LATEST_ARTICLES'::text, 'COMMERCIAL_PAGES'::text])))",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_key_format",
                "deferrable": false,
                "definition": "CHECK (section_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_media_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_page_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_page_key_unique",
                "deferrable": false,
                "definition": "UNIQUE (page_id, section_key)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_page_sections",
                "validated": true,
                "constraint": "site_page_sections_type_check",
                "deferrable": false,
                "definition": "CHECK (section_type = ANY (ARRAY['HERO'::text, 'RICH_TEXT'::text, 'CARD_GRID'::text, 'MEDIA_SPLIT'::text, 'CTA'::text, 'STAT_ROW'::text, 'FAQ'::text, 'ENTITY_LIST'::text]))",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_page_translations",
                "validated": true,
                "constraint": "site_page_translations_page_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "site_page_translations",
                "validated": true,
                "constraint": "site_page_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (page_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_page_translations",
                "validated": true,
                "constraint": "site_page_translations_title_check",
                "deferrable": false,
                "definition": "CHECK (char_length(TRIM(BOTH FROM title)) > 0)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_created_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_og_media_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (og_media_id) REFERENCES media(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_page_key_format",
                "deferrable": false,
                "definition": "CHECK (page_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_page_key_key",
                "deferrable": false,
                "definition": "UNIQUE (page_key)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_publish_check",
                "deferrable": false,
                "definition": "CHECK (status <> 'PUBLISHED'::article_status OR published_at IS NOT NULL)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_route_path_check",
                "deferrable": false,
                "definition": "CHECK (route_path IS NULL OR \"left\"(route_path, 1) = '/'::text AND \"right\"(route_path, 1) = '/'::text AND POSITION(('//'::text) IN (route_path)) = 0)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_route_path_key",
                "deferrable": false,
                "definition": "UNIQUE (route_path)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_template_check",
                "deferrable": false,
                "definition": "CHECK (template = ANY (ARRAY['HOME'::text, 'ABOUT'::text, 'COMMERCIAL'::text, 'SEGMENT'::text, 'PRICING'::text, 'SUPPORT'::text, 'LEGAL'::text, 'CONTACT'::text]))",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_pages",
                "validated": true,
                "constraint": "site_pages_updated_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_settings",
                "validated": true,
                "constraint": "site_settings_logo_media_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (org_logo_media_id) REFERENCES media(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_settings",
                "validated": true,
                "constraint": "site_settings_low_stock_check",
                "deferrable": false,
                "definition": "CHECK (low_stock_threshold >= 0)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_settings",
                "validated": true,
                "constraint": "site_settings_og_media_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (org_default_og_media_id) REFERENCES media(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "site_settings",
                "validated": true,
                "constraint": "site_settings_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "site_settings",
                "validated": true,
                "constraint": "site_settings_singleton_check",
                "deferrable": false,
                "definition": "CHECK (id = 1)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_settings",
                "validated": true,
                "constraint": "site_settings_updated_by_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "site_settings_translations",
                "validated": true,
                "constraint": "site_settings_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (settings_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "site_settings_translations",
                "validated": true,
                "constraint": "site_settings_translations_settings_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (settings_id) REFERENCES site_settings(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "tag_translations",
                "validated": true,
                "constraint": "tag_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (tag_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "tag_translations",
                "validated": true,
                "constraint": "tag_translations_tag_id_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "tags",
                "validated": true,
                "constraint": "tags_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "tags",
                "validated": true,
                "constraint": "tags_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "varieties",
                "validated": true,
                "constraint": "varieties_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "varieties",
                "validated": true,
                "constraint": "varieties_slug_key",
                "deferrable": false,
                "definition": "UNIQUE (slug)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "warehouse_translations",
                "validated": true,
                "constraint": "warehouse_translations_name_check",
                "deferrable": false,
                "definition": "CHECK (char_length(TRIM(BOTH FROM name)) > 0)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "warehouse_translations",
                "validated": true,
                "constraint": "warehouse_translations_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (warehouse_id, locale)",
                "initially_deferred": false
            },
            {
                "type": "FOREIGN_KEY",
                "table": "warehouse_translations",
                "validated": true,
                "constraint": "warehouse_translations_warehouse_fkey",
                "deferrable": false,
                "definition": "FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "warehouses",
                "validated": true,
                "constraint": "warehouses_allowed_codes",
                "deferrable": false,
                "definition": "CHECK (code = ANY (ARRAY['EGYPT'::text, 'DUBAI'::text]))",
                "initially_deferred": false
            },
            {
                "type": "UNIQUE",
                "table": "warehouses",
                "validated": true,
                "constraint": "warehouses_code_key",
                "deferrable": false,
                "definition": "UNIQUE (code)",
                "initially_deferred": false
            },
            {
                "type": "CHECK",
                "table": "warehouses",
                "validated": true,
                "constraint": "warehouses_country_code_length",
                "deferrable": false,
                "definition": "CHECK (char_length(country_code::text) = 2)",
                "initially_deferred": false
            },
            {
                "type": "PRIMARY_KEY",
                "table": "warehouses",
                "validated": true,
                "constraint": "warehouses_pkey",
                "deferrable": false,
                "definition": "PRIMARY KEY (id)",
                "initially_deferred": false
            }
        ],
        "rls_policies": [
            {
                "roles": [
                    "authenticated"
                ],
                "table": "article_categories",
                "using": "is_admin()",
                "policy": "hills_article_categories_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "article_categories",
                "using": "(is_active = true)",
                "policy": "hills_article_categories_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "article_category_translations",
                "using": "is_admin()",
                "policy": "hills_article_category_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "article_category_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM article_categories c\n  WHERE ((c.id = article_category_translations.category_id) AND (c.is_active = true))))",
                "policy": "hills_article_category_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "article_translations",
                "using": "is_admin()",
                "policy": "hills_article_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "article_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM articles a\n  WHERE ((a.id = article_translations.article_id) AND (a.status = 'PUBLISHED'::article_status) AND (a.deleted_at IS NULL) AND (a.published_at <= now()))))",
                "policy": "hills_article_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "articles",
                "using": "is_admin()",
                "policy": "hills_articles_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "articles",
                "using": "((status = 'PUBLISHED'::article_status) AND (deleted_at IS NULL) AND (published_at <= now()))",
                "policy": "hills_articles_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "audit_logs",
                "using": "is_admin()",
                "policy": "hills_audit_admin_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "certification_translations",
                "using": "is_admin()",
                "policy": "hills_certification_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "certification_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM certifications c\n  WHERE ((c.id = certification_translations.certification_id) AND (c.is_active = true))))",
                "policy": "hills_certification_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "certifications",
                "using": "is_admin()",
                "policy": "hills_certifications_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "certifications",
                "using": "(is_active = true)",
                "policy": "hills_certifications_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffee_certifications",
                "using": "is_admin()",
                "policy": "hills_coffee_certifications_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffee_certifications",
                "using": "(EXISTS ( SELECT 1\n   FROM coffees c\n  WHERE ((c.id = coffee_certifications.coffee_id) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL))))",
                "policy": "hills_coffee_certifications_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffee_media",
                "using": "is_admin()",
                "policy": "hills_coffee_media_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffee_media",
                "using": "(EXISTS ( SELECT 1\n   FROM coffees c\n  WHERE ((c.id = coffee_media.coffee_id) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL))))",
                "policy": "hills_coffee_media_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffee_offers",
                "using": "is_admin()",
                "policy": "hills_offers_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffee_offers",
                "using": "((is_visible = true) AND (deleted_at IS NULL) AND (status <> 'INACTIVE'::offer_status) AND (EXISTS ( SELECT 1\n   FROM coffees c\n  WHERE ((c.id = coffee_offers.coffee_id) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL)))))",
                "policy": "hills_offers_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffee_tags",
                "using": "is_admin()",
                "policy": "hills_coffee_tags_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffee_tags",
                "using": "(EXISTS ( SELECT 1\n   FROM coffees c\n  WHERE ((c.id = coffee_tags.coffee_id) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL))))",
                "policy": "hills_coffee_tags_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffee_translations",
                "using": "is_admin()",
                "policy": "hills_coffee_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffee_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM coffees c\n  WHERE ((c.id = coffee_translations.coffee_id) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL))))",
                "policy": "hills_coffee_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffee_type_translations",
                "using": "is_admin()",
                "policy": "hills_coffee_type_translations_admin_all",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffee_type_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM coffee_types t\n  WHERE ((t.id = coffee_type_translations.coffee_type_id) AND (t.is_active = true))))",
                "policy": "hills_coffee_type_translations_public_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffee_types",
                "using": "is_admin()",
                "policy": "hills_coffee_types_admin_all",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffee_types",
                "using": "(is_active = true)",
                "policy": "hills_coffee_types_public_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffee_varieties",
                "using": "is_admin()",
                "policy": "hills_coffee_varieties_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffee_varieties",
                "using": "(EXISTS ( SELECT 1\n   FROM coffees c\n  WHERE ((c.id = coffee_varieties.coffee_id) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL))))",
                "policy": "hills_coffee_varieties_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "coffees",
                "using": "is_admin()",
                "policy": "hills_coffees_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "coffees",
                "using": "((status = 'PUBLISHED'::coffee_status) AND (deleted_at IS NULL))",
                "policy": "hills_coffees_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "favorites",
                "using": "is_admin()",
                "policy": "hills_favorites_admin_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "favorites",
                "using": "((user_id = auth.uid()) AND hills_is_verified_user())",
                "policy": "hills_favorites_delete_own",
                "command": "DELETE",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "favorites",
                "using": null,
                "policy": "hills_favorites_insert_own",
                "command": "INSERT",
                "permissive": "PERMISSIVE",
                "with_check": "((user_id = auth.uid()) AND hills_is_verified_user() AND (EXISTS ( SELECT 1\n   FROM coffees c\n  WHERE ((c.id = favorites.coffee_id) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL)))))"
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "favorites",
                "using": "((user_id = auth.uid()) AND hills_is_verified_user())",
                "policy": "hills_favorites_select_own",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "inquiries",
                "using": "is_admin()",
                "policy": "hills_inquiries_admin_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "inquiries",
                "using": "is_admin()",
                "policy": "hills_inquiries_admin_update",
                "command": "UPDATE",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "inquiries",
                "using": null,
                "policy": "hills_inquiries_insert_verified",
                "command": "INSERT",
                "permissive": "PERMISSIVE",
                "with_check": "((user_id = auth.uid()) AND hills_is_verified_user() AND (status = 'NEW'::inquiry_status) AND ((type = 'GENERAL'::inquiry_type) OR ((type = ANY (ARRAY['PRODUCT'::inquiry_type, 'SAMPLE_REQUEST'::inquiry_type])) AND (coffee_id IS NOT NULL))) AND ((offer_id IS NULL) OR (EXISTS ( SELECT 1\n   FROM coffee_offers o\n  WHERE ((o.id = inquiries.offer_id) AND (o.coffee_id = inquiries.coffee_id) AND (o.deleted_at IS NULL))))))"
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "inquiries",
                "using": "((user_id = auth.uid()) AND hills_is_verified_user())",
                "policy": "hills_inquiries_select_own",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "inquiry_status_history",
                "using": "is_admin()",
                "policy": "hills_inquiry_history_admin",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "inquiry_status_history",
                "using": "(hills_is_verified_user() AND (EXISTS ( SELECT 1\n   FROM inquiries i\n  WHERE ((i.id = inquiry_status_history.inquiry_id) AND (i.user_id = auth.uid())))))",
                "policy": "hills_inquiry_history_select_own",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "media",
                "using": "is_admin()",
                "policy": "hills_media_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "media",
                "using": "((is_public = true) AND (deleted_at IS NULL))",
                "policy": "hills_media_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "media_translations",
                "using": "is_admin()",
                "policy": "hills_media_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "media_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM media m\n  WHERE ((m.id = media_translations.media_id) AND (m.is_public = true) AND (m.deleted_at IS NULL))))",
                "policy": "hills_media_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "offer_price_tiers",
                "using": "is_admin()",
                "policy": "hills_price_tiers_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "offer_price_tiers",
                "using": "(hills_is_verified_user() AND (EXISTS ( SELECT 1\n   FROM (coffee_offers o\n     JOIN coffees c ON ((c.id = o.coffee_id)))\n  WHERE ((o.id = offer_price_tiers.offer_id) AND (o.is_visible = true) AND (o.deleted_at IS NULL) AND (o.status <> 'INACTIVE'::offer_status) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL)))))",
                "policy": "hills_price_tiers_verified_users",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "offer_sensory_notes",
                "using": "is_admin()",
                "policy": "hills_offer_sensory_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "offer_sensory_notes",
                "using": "(EXISTS ( SELECT 1\n   FROM (coffee_offers o\n     JOIN coffees c ON ((c.id = o.coffee_id)))\n  WHERE ((o.id = offer_sensory_notes.offer_id) AND (o.is_visible = true) AND (o.deleted_at IS NULL) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL))))",
                "policy": "hills_offer_sensory_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "offer_tags",
                "using": "is_admin()",
                "policy": "hills_offer_tags_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "offer_tags",
                "using": "(EXISTS ( SELECT 1\n   FROM (coffee_offers o\n     JOIN coffees c ON ((c.id = o.coffee_id)))\n  WHERE ((o.id = offer_tags.offer_id) AND (o.is_visible = true) AND (o.deleted_at IS NULL) AND (c.status = 'PUBLISHED'::coffee_status) AND (c.deleted_at IS NULL))))",
                "policy": "hills_offer_tags_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "origin_media",
                "using": "is_admin()",
                "policy": "hills_origin_media_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "origin_media",
                "using": "(EXISTS ( SELECT 1\n   FROM origins o\n  WHERE ((o.id = origin_media.origin_id) AND (o.is_active = true) AND (o.deleted_at IS NULL))))",
                "policy": "hills_origin_media_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "origin_translations",
                "using": "is_admin()",
                "policy": "hills_origin_translations_admin_all",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "origin_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM origins o\n  WHERE ((o.id = origin_translations.origin_id) AND (o.is_active = true) AND (o.deleted_at IS NULL))))",
                "policy": "hills_origin_translations_public_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "origins",
                "using": "is_admin()",
                "policy": "hills_origins_admin_all",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "origins",
                "using": "((is_active = true) AND (deleted_at IS NULL))",
                "policy": "hills_origins_public_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "packaging_type_translations",
                "using": "is_admin()",
                "policy": "hills_packaging_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "packaging_type_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM packaging_types p\n  WHERE ((p.id = packaging_type_translations.packaging_type_id) AND (p.is_active = true))))",
                "policy": "hills_packaging_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "packaging_types",
                "using": "is_admin()",
                "policy": "hills_packaging_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "packaging_types",
                "using": "(is_active = true)",
                "policy": "hills_packaging_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "processing_method_translations",
                "using": "is_admin()",
                "policy": "hills_processing_method_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "processing_method_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM processing_methods p\n  WHERE ((p.id = processing_method_translations.processing_method_id) AND (p.is_active = true))))",
                "policy": "hills_processing_method_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "processing_methods",
                "using": "is_admin()",
                "policy": "hills_processing_methods_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "processing_methods",
                "using": "(is_active = true)",
                "policy": "hills_processing_methods_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "profiles",
                "using": "is_admin()",
                "policy": "hills_profiles_admin_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "profiles",
                "using": "(id = auth.uid())",
                "policy": "hills_profiles_select_own",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "profiles",
                "using": "(id = auth.uid())",
                "policy": "hills_profiles_update_own",
                "command": "UPDATE",
                "permissive": "PERMISSIVE",
                "with_check": "(id = auth.uid())"
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "region_translations",
                "using": "is_admin()",
                "policy": "hills_region_translations_admin_all",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "region_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM regions r\n  WHERE ((r.id = region_translations.region_id) AND (r.is_active = true) AND (r.deleted_at IS NULL))))",
                "policy": "hills_region_translations_public_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "regions",
                "using": "is_admin()",
                "policy": "hills_regions_admin_all",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "regions",
                "using": "((is_active = true) AND (deleted_at IS NULL))",
                "policy": "hills_regions_public_select",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "sensory_note_translations",
                "using": "is_admin()",
                "policy": "hills_sensory_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "sensory_note_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM sensory_notes s\n  WHERE ((s.id = sensory_note_translations.sensory_note_id) AND (s.is_active = true))))",
                "policy": "hills_sensory_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "sensory_notes",
                "using": "is_admin()",
                "policy": "hills_sensory_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "sensory_notes",
                "using": "(is_active = true)",
                "policy": "hills_sensory_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "site_page_section_translations",
                "using": "is_admin()",
                "policy": "hills_site_page_section_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "site_page_section_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM (site_page_sections s\n     JOIN site_pages p ON ((p.id = s.page_id)))\n  WHERE ((s.id = site_page_section_translations.section_id) AND (s.is_visible = true) AND (p.status = 'PUBLISHED'::article_status) AND (p.published_at IS NOT NULL) AND (p.published_at <= now()) AND (p.is_active = true) AND (p.deleted_at IS NULL))))",
                "policy": "hills_site_page_section_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "site_page_sections",
                "using": "is_admin()",
                "policy": "hills_site_page_sections_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "site_page_sections",
                "using": "((is_visible = true) AND (EXISTS ( SELECT 1\n   FROM site_pages p\n  WHERE ((p.id = site_page_sections.page_id) AND (p.status = 'PUBLISHED'::article_status) AND (p.published_at IS NOT NULL) AND (p.published_at <= now()) AND (p.is_active = true) AND (p.deleted_at IS NULL)))))",
                "policy": "hills_site_page_sections_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "site_page_translations",
                "using": "is_admin()",
                "policy": "hills_site_page_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "site_page_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM site_pages p\n  WHERE ((p.id = site_page_translations.page_id) AND (p.status = 'PUBLISHED'::article_status) AND (p.published_at IS NOT NULL) AND (p.published_at <= now()) AND (p.is_active = true) AND (p.deleted_at IS NULL))))",
                "policy": "hills_site_page_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "site_pages",
                "using": "is_admin()",
                "policy": "hills_site_pages_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "site_pages",
                "using": "((status = 'PUBLISHED'::article_status) AND (published_at IS NOT NULL) AND (published_at <= now()) AND (is_active = true) AND (deleted_at IS NULL))",
                "policy": "hills_site_pages_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "site_settings",
                "using": "is_admin()",
                "policy": "hills_site_settings_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "site_settings",
                "using": "true",
                "policy": "hills_site_settings_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "site_settings_translations",
                "using": "is_admin()",
                "policy": "hills_site_settings_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "site_settings_translations",
                "using": "true",
                "policy": "hills_site_settings_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "tag_translations",
                "using": "is_admin()",
                "policy": "hills_tag_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "tag_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM tags t\n  WHERE ((t.id = tag_translations.tag_id) AND (t.is_active = true))))",
                "policy": "hills_tag_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "tags",
                "using": "is_admin()",
                "policy": "hills_tags_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "tags",
                "using": "(is_active = true)",
                "policy": "hills_tags_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "varieties",
                "using": "is_admin()",
                "policy": "hills_varieties_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "varieties",
                "using": "(is_active = true)",
                "policy": "hills_varieties_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "warehouse_translations",
                "using": "is_admin()",
                "policy": "hills_warehouse_translations_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "warehouse_translations",
                "using": "(EXISTS ( SELECT 1\n   FROM warehouses w\n  WHERE ((w.id = warehouse_translations.warehouse_id) AND (w.is_active = true))))",
                "policy": "hills_warehouse_translations_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            },
            {
                "roles": [
                    "authenticated"
                ],
                "table": "warehouses",
                "using": "is_admin()",
                "policy": "hills_warehouses_admin",
                "command": "ALL",
                "permissive": "PERMISSIVE",
                "with_check": "is_admin()"
            },
            {
                "roles": [
                    "anon",
                    "authenticated"
                ],
                "table": "warehouses",
                "using": "(is_active = true)",
                "policy": "hills_warehouses_public",
                "command": "SELECT",
                "permissive": "PERMISSIVE",
                "with_check": null
            }
        ],
        "table_grants": [
            {
                "table": "article_categories",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "article_categories",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "article_categories",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "article_categories",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "article_category_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "article_category_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "article_category_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "article_category_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "article_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "article_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "article_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "article_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "articles",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "articles",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "articles",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "articles",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "audit_logs",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "audit_logs",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "audit_logs",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "audit_logs",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "certification_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "certification_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "certification_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "certification_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "certifications",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "certifications",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "certifications",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "certifications",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_certifications",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_certifications",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_certifications",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_certifications",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_media",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_media",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_media",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_media",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_offers",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_offers",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_offers",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_offers",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_tags",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_tags",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_tags",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_tags",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_type_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_type_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_type_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_type_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_types",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_types",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_types",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_types",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_varieties",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_varieties",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_varieties",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffee_varieties",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffees",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffees",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "coffees",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "coffees",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "favorites",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "favorites",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "favorites",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "favorites",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "inquiries",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "inquiries",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "inquiries",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "inquiries",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "inquiry_status_history",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "inquiry_status_history",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "inquiry_status_history",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "inquiry_status_history",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "media",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "media",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "media",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "media",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "media_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "media_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "media_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "media_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_price_tiers",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_price_tiers",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_price_tiers",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_sensory_notes",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_sensory_notes",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_sensory_notes",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_sensory_notes",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_tags",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_tags",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_tags",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "offer_tags",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "origin_media",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "origin_media",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "origin_media",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "origin_media",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "origin_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "origin_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "origin_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "origin_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "origins",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "origins",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "origins",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "origins",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "packaging_type_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "packaging_type_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "packaging_type_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "packaging_type_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "packaging_types",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "packaging_types",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "packaging_types",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "packaging_types",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "processing_method_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "processing_method_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "processing_method_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "processing_method_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "processing_methods",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "processing_methods",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "processing_methods",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "processing_methods",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "profiles",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "profiles",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "profiles",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "profiles",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "region_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "region_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "region_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "region_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "regions",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "regions",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "regions",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "regions",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "sensory_note_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "sensory_note_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "sensory_note_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "sensory_note_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "sensory_notes",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "sensory_notes",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "sensory_notes",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "sensory_notes",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_section_translations",
                "grantee": "anon",
                "privileges": [
                    "SELECT"
                ]
            },
            {
                "table": "site_page_section_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_section_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_section_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_sections",
                "grantee": "anon",
                "privileges": [
                    "SELECT"
                ]
            },
            {
                "table": "site_page_sections",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_sections",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_sections",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_translations",
                "grantee": "anon",
                "privileges": [
                    "SELECT"
                ]
            },
            {
                "table": "site_page_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_page_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_pages",
                "grantee": "anon",
                "privileges": [
                    "SELECT"
                ]
            },
            {
                "table": "site_pages",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "site_pages",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_pages",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_settings",
                "grantee": "anon",
                "privileges": [
                    "SELECT"
                ]
            },
            {
                "table": "site_settings",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "site_settings",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_settings",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_settings_translations",
                "grantee": "anon",
                "privileges": [
                    "SELECT"
                ]
            },
            {
                "table": "site_settings_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "site_settings_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "site_settings_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "tag_translations",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "tag_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "tag_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "tag_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "tags",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "tags",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "tags",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "tags",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "varieties",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "varieties",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "varieties",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "varieties",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "warehouse_translations",
                "grantee": "anon",
                "privileges": [
                    "SELECT"
                ]
            },
            {
                "table": "warehouse_translations",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "warehouse_translations",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "warehouse_translations",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "warehouses",
                "grantee": "anon",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "warehouses",
                "grantee": "authenticated",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "SELECT",
                    "UPDATE"
                ]
            },
            {
                "table": "warehouses",
                "grantee": "postgres",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            },
            {
                "table": "warehouses",
                "grantee": "service_role",
                "privileges": [
                    "DELETE",
                    "INSERT",
                    "REFERENCES",
                    "SELECT",
                    "TRIGGER",
                    "TRUNCATE",
                    "UPDATE"
                ]
            }
        ],
        "materialized_views": [
        ],
        "foreign_key_relations": [
            {
                "to_table": "article_categories",
                "to_schema": "public",
                "constraint": "article_category_translations_category_id_fkey",
                "definition": "FOREIGN KEY (category_id) REFERENCES article_categories(id) ON DELETE CASCADE",
                "from_table": "article_category_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "category_id"
                ]
            },
            {
                "to_table": "articles",
                "to_schema": "public",
                "constraint": "article_translations_article_id_fkey",
                "definition": "FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE",
                "from_table": "article_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "article_id"
                ]
            },
            {
                "to_table": "article_categories",
                "to_schema": "public",
                "constraint": "articles_category_id_fkey",
                "definition": "FOREIGN KEY (category_id) REFERENCES article_categories(id) ON DELETE SET NULL",
                "from_table": "articles",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "category_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "articles_created_by_fkey",
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "articles",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "created_by"
                ]
            },
            {
                "to_table": "media",
                "to_schema": "public",
                "constraint": "articles_featured_media_id_fkey",
                "definition": "FOREIGN KEY (featured_media_id) REFERENCES media(id) ON DELETE SET NULL",
                "from_table": "articles",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "featured_media_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "articles_updated_by_fkey",
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "articles",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "updated_by"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "audit_logs_actor_user_id_fkey",
                "definition": "FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "audit_logs",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "actor_user_id"
                ]
            },
            {
                "to_table": "certifications",
                "to_schema": "public",
                "constraint": "certification_translations_certification_id_fkey",
                "definition": "FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE",
                "from_table": "certification_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "certification_id"
                ]
            },
            {
                "to_table": "certifications",
                "to_schema": "public",
                "constraint": "coffee_certifications_certification_id_fkey",
                "definition": "FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE RESTRICT",
                "from_table": "coffee_certifications",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "certification_id"
                ]
            },
            {
                "to_table": "coffees",
                "to_schema": "public",
                "constraint": "coffee_certifications_coffee_id_fkey",
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "from_table": "coffee_certifications",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_id"
                ]
            },
            {
                "to_table": "coffees",
                "to_schema": "public",
                "constraint": "coffee_media_coffee_id_fkey",
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "from_table": "coffee_media",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_id"
                ]
            },
            {
                "to_table": "media",
                "to_schema": "public",
                "constraint": "coffee_media_media_id_fkey",
                "definition": "FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE RESTRICT",
                "from_table": "coffee_media",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "media_id"
                ]
            },
            {
                "to_table": "coffees",
                "to_schema": "public",
                "constraint": "coffee_offers_coffee_id_fkey",
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE RESTRICT",
                "from_table": "coffee_offers",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "coffee_offers_created_by_fkey",
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "coffee_offers",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "created_by"
                ]
            },
            {
                "to_table": "packaging_types",
                "to_schema": "public",
                "constraint": "coffee_offers_packaging_type_id_fkey",
                "definition": "FOREIGN KEY (packaging_type_id) REFERENCES packaging_types(id) ON DELETE SET NULL",
                "from_table": "coffee_offers",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "packaging_type_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "coffee_offers_updated_by_fkey",
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "coffee_offers",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "updated_by"
                ]
            },
            {
                "to_table": "warehouses",
                "to_schema": "public",
                "constraint": "coffee_offers_warehouse_id_fkey",
                "definition": "FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT",
                "from_table": "coffee_offers",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "warehouse_id"
                ]
            },
            {
                "to_table": "coffees",
                "to_schema": "public",
                "constraint": "coffee_tags_coffee_id_fkey",
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "from_table": "coffee_tags",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_id"
                ]
            },
            {
                "to_table": "tags",
                "to_schema": "public",
                "constraint": "coffee_tags_tag_id_fkey",
                "definition": "FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT",
                "from_table": "coffee_tags",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "tag_id"
                ]
            },
            {
                "to_table": "coffees",
                "to_schema": "public",
                "constraint": "coffee_translations_coffee_id_fkey",
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "from_table": "coffee_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_id"
                ]
            },
            {
                "to_table": "coffee_types",
                "to_schema": "public",
                "constraint": "coffee_type_translations_coffee_type_id_fkey",
                "definition": "FOREIGN KEY (coffee_type_id) REFERENCES coffee_types(id) ON DELETE CASCADE",
                "from_table": "coffee_type_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_type_id"
                ]
            },
            {
                "to_table": "coffees",
                "to_schema": "public",
                "constraint": "coffee_varieties_coffee_id_fkey",
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "from_table": "coffee_varieties",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_id"
                ]
            },
            {
                "to_table": "varieties",
                "to_schema": "public",
                "constraint": "coffee_varieties_variety_id_fkey",
                "definition": "FOREIGN KEY (variety_id) REFERENCES varieties(id) ON DELETE RESTRICT",
                "from_table": "coffee_varieties",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "variety_id"
                ]
            },
            {
                "to_table": "coffee_types",
                "to_schema": "public",
                "constraint": "coffees_coffee_type_id_fkey",
                "definition": "FOREIGN KEY (coffee_type_id) REFERENCES coffee_types(id) ON DELETE RESTRICT",
                "from_table": "coffees",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_type_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "coffees_created_by_fkey",
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "coffees",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "created_by"
                ]
            },
            {
                "to_table": "origins",
                "to_schema": "public",
                "constraint": "coffees_origin_id_fkey",
                "definition": "FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE RESTRICT",
                "from_table": "coffees",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "origin_id"
                ]
            },
            {
                "to_table": "processing_methods",
                "to_schema": "public",
                "constraint": "coffees_processing_method_id_fkey",
                "definition": "FOREIGN KEY (processing_method_id) REFERENCES processing_methods(id) ON DELETE SET NULL",
                "from_table": "coffees",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "processing_method_id"
                ]
            },
            {
                "to_table": "regions",
                "to_schema": "public",
                "constraint": "coffees_region_id_fkey",
                "definition": "FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL",
                "from_table": "coffees",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "region_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "coffees_updated_by_fkey",
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "coffees",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "updated_by"
                ]
            },
            {
                "to_table": "coffees",
                "to_schema": "public",
                "constraint": "favorites_coffee_id_fkey",
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE CASCADE",
                "from_table": "favorites",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "favorites_user_id_fkey",
                "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE",
                "from_table": "favorites",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "user_id"
                ]
            },
            {
                "to_table": "coffees",
                "to_schema": "public",
                "constraint": "inquiries_coffee_id_fkey",
                "definition": "FOREIGN KEY (coffee_id) REFERENCES coffees(id) ON DELETE SET NULL",
                "from_table": "inquiries",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "coffee_id"
                ]
            },
            {
                "to_table": "coffee_offers",
                "to_schema": "public",
                "constraint": "inquiries_offer_id_fkey",
                "definition": "FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE SET NULL",
                "from_table": "inquiries",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "offer_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "inquiries_user_id_fkey",
                "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "inquiries",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "user_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "inquiry_status_history_changed_by_fkey",
                "definition": "FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "inquiry_status_history",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "changed_by"
                ]
            },
            {
                "to_table": "inquiries",
                "to_schema": "public",
                "constraint": "inquiry_status_history_inquiry_id_fkey",
                "definition": "FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE",
                "from_table": "inquiry_status_history",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "inquiry_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "media_uploaded_by_fkey",
                "definition": "FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "media",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "uploaded_by"
                ]
            },
            {
                "to_table": "media",
                "to_schema": "public",
                "constraint": "media_translations_media_id_fkey",
                "definition": "FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE",
                "from_table": "media_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "media_id"
                ]
            },
            {
                "to_table": "coffee_offers",
                "to_schema": "public",
                "constraint": "offer_price_tiers_offer_id_fkey",
                "definition": "FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE CASCADE",
                "from_table": "offer_price_tiers",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "offer_id"
                ]
            },
            {
                "to_table": "coffee_offers",
                "to_schema": "public",
                "constraint": "offer_sensory_notes_offer_id_fkey",
                "definition": "FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE CASCADE",
                "from_table": "offer_sensory_notes",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "offer_id"
                ]
            },
            {
                "to_table": "sensory_notes",
                "to_schema": "public",
                "constraint": "offer_sensory_notes_sensory_note_id_fkey",
                "definition": "FOREIGN KEY (sensory_note_id) REFERENCES sensory_notes(id) ON DELETE RESTRICT",
                "from_table": "offer_sensory_notes",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "sensory_note_id"
                ]
            },
            {
                "to_table": "coffee_offers",
                "to_schema": "public",
                "constraint": "offer_tags_offer_id_fkey",
                "definition": "FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE CASCADE",
                "from_table": "offer_tags",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "offer_id"
                ]
            },
            {
                "to_table": "tags",
                "to_schema": "public",
                "constraint": "offer_tags_tag_id_fkey",
                "definition": "FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT",
                "from_table": "offer_tags",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "tag_id"
                ]
            },
            {
                "to_table": "media",
                "to_schema": "public",
                "constraint": "origin_media_media_id_fkey",
                "definition": "FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE RESTRICT",
                "from_table": "origin_media",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "media_id"
                ]
            },
            {
                "to_table": "origins",
                "to_schema": "public",
                "constraint": "origin_media_origin_id_fkey",
                "definition": "FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE CASCADE",
                "from_table": "origin_media",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "origin_id"
                ]
            },
            {
                "to_table": "origins",
                "to_schema": "public",
                "constraint": "origin_translations_origin_id_fkey",
                "definition": "FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE CASCADE",
                "from_table": "origin_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "origin_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "origins_created_by_fkey",
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "origins",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "created_by"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "origins_updated_by_fkey",
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "origins",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "updated_by"
                ]
            },
            {
                "to_table": "packaging_types",
                "to_schema": "public",
                "constraint": "packaging_type_translations_packaging_type_id_fkey",
                "definition": "FOREIGN KEY (packaging_type_id) REFERENCES packaging_types(id) ON DELETE CASCADE",
                "from_table": "packaging_type_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "packaging_type_id"
                ]
            },
            {
                "to_table": "processing_methods",
                "to_schema": "public",
                "constraint": "processing_method_translations_processing_method_id_fkey",
                "definition": "FOREIGN KEY (processing_method_id) REFERENCES processing_methods(id) ON DELETE CASCADE",
                "from_table": "processing_method_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "processing_method_id"
                ]
            },
            {
                "to_table": "profiles",
                "to_schema": "public",
                "constraint": "profiles_blocked_by_fkey",
                "definition": "FOREIGN KEY (blocked_by) REFERENCES profiles(id) ON DELETE SET NULL",
                "from_table": "profiles",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "blocked_by"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "profiles_id_fkey",
                "definition": "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE",
                "from_table": "profiles",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "id"
                ]
            },
            {
                "to_table": "regions",
                "to_schema": "public",
                "constraint": "region_translations_region_id_fkey",
                "definition": "FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE",
                "from_table": "region_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "region_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "regions_created_by_fkey",
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "regions",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "created_by"
                ]
            },
            {
                "to_table": "origins",
                "to_schema": "public",
                "constraint": "regions_origin_id_fkey",
                "definition": "FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE RESTRICT",
                "from_table": "regions",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "origin_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "regions_updated_by_fkey",
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "regions",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "updated_by"
                ]
            },
            {
                "to_table": "sensory_notes",
                "to_schema": "public",
                "constraint": "sensory_note_translations_sensory_note_id_fkey",
                "definition": "FOREIGN KEY (sensory_note_id) REFERENCES sensory_notes(id) ON DELETE CASCADE",
                "from_table": "sensory_note_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "sensory_note_id"
                ]
            },
            {
                "to_table": "site_page_sections",
                "to_schema": "public",
                "constraint": "site_page_section_translations_section_fkey",
                "definition": "FOREIGN KEY (section_id) REFERENCES site_page_sections(id) ON DELETE CASCADE",
                "from_table": "site_page_section_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "section_id"
                ]
            },
            {
                "to_table": "media",
                "to_schema": "public",
                "constraint": "site_page_sections_media_fkey",
                "definition": "FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE SET NULL",
                "from_table": "site_page_sections",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "media_id"
                ]
            },
            {
                "to_table": "site_pages",
                "to_schema": "public",
                "constraint": "site_page_sections_page_fkey",
                "definition": "FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE CASCADE",
                "from_table": "site_page_sections",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "page_id"
                ]
            },
            {
                "to_table": "site_pages",
                "to_schema": "public",
                "constraint": "site_page_translations_page_fkey",
                "definition": "FOREIGN KEY (page_id) REFERENCES site_pages(id) ON DELETE CASCADE",
                "from_table": "site_page_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "page_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "site_pages_created_by_fkey",
                "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "site_pages",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "created_by"
                ]
            },
            {
                "to_table": "media",
                "to_schema": "public",
                "constraint": "site_pages_og_media_fkey",
                "definition": "FOREIGN KEY (og_media_id) REFERENCES media(id) ON DELETE SET NULL",
                "from_table": "site_pages",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "og_media_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "site_pages_updated_by_fkey",
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "site_pages",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "updated_by"
                ]
            },
            {
                "to_table": "media",
                "to_schema": "public",
                "constraint": "site_settings_logo_media_fkey",
                "definition": "FOREIGN KEY (org_logo_media_id) REFERENCES media(id) ON DELETE SET NULL",
                "from_table": "site_settings",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "org_logo_media_id"
                ]
            },
            {
                "to_table": "media",
                "to_schema": "public",
                "constraint": "site_settings_og_media_fkey",
                "definition": "FOREIGN KEY (org_default_og_media_id) REFERENCES media(id) ON DELETE SET NULL",
                "from_table": "site_settings",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "org_default_og_media_id"
                ]
            },
            {
                "to_table": "users",
                "to_schema": "auth",
                "constraint": "site_settings_updated_by_fkey",
                "definition": "FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL",
                "from_table": "site_settings",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "updated_by"
                ]
            },
            {
                "to_table": "site_settings",
                "to_schema": "public",
                "constraint": "site_settings_translations_settings_fkey",
                "definition": "FOREIGN KEY (settings_id) REFERENCES site_settings(id) ON DELETE CASCADE",
                "from_table": "site_settings_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "settings_id"
                ]
            },
            {
                "to_table": "tags",
                "to_schema": "public",
                "constraint": "tag_translations_tag_id_fkey",
                "definition": "FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE",
                "from_table": "tag_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "tag_id"
                ]
            },
            {
                "to_table": "warehouses",
                "to_schema": "public",
                "constraint": "warehouse_translations_warehouse_fkey",
                "definition": "FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE",
                "from_table": "warehouse_translations",
                "to_columns": [
                    "id"
                ],
                "from_schema": "public",
                "from_columns": [
                    "warehouse_id"
                ]
            }
        ]
    },
    "business_counts": {
        "media": 0,
        "coffees": 0,
        "origins": 0,
        "regions": 0,
        "articles": 0,
        "profiles": 1,
        "favorites": 0,
        "inquiries": 0,
        "audit_logs": 0,
        "site_pages": 18,
        "warehouses": 2,
        "coffee_offers": 0,
        "site_settings": 1,
        "sample_requests": 0,
        "blocked_profiles": 0,
        "offer_price_tiers": 0,
        "profiles_with_avatar": 0,
        "active_sample_requests": 0
    },
    "hills_security_objects": {
        "avatars_bucket_exists": true,
        "hills_is_admin_exists": true,
        "avatars_bucket_private": true,
        "hills_is_blocked_exists": true,
        "audit_logs_realtime_enabled": false,
        "admin_set_user_blocked_exists": true,
        "hills_is_verified_user_exists": true,
        "protected_price_realtime_enabled": false,
        "active_sample_unique_index_exists": true,
        "sample_transition_function_exists": true
    },
    "sample_request_integrity": {
        "active_duplicates": [
        ],
        "expected_unique_identity": "user_id + coffee_id for active SAMPLE_REQUEST statuses",
        "offer_id_part_of_duplicate_identity": false
    },
    "external_dashboard_configuration_required": [
        "Supabase Project URL / NEXT_PUBLIC_SUPABASE_URL",
        "Publishable key configuration",
        "Service-role key custody and rotation",
        "Authentication email-confirmation setting",
        "Site URL",
        "Allowed redirect URLs",
        "Password policy",
        "SMTP/email provider configuration",
        "Email templates",
        "Auth rate limits / CAPTCHA configuration where applicable",
        "Production canonical hostname",
        "Realtime service/project-level settings outside PostgreSQL publication metadata"
    ]
}