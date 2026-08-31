-- =====================================================================
-- P1-T04 — Blocked-user enforcement at the database/storage boundary
-- Implements spec.md FR-067 and FR-068. Closes analysis finding C1.
-- Constitution Principle VII: "A block that only holds at one layer is
-- not compliant."
--
-- STATUS: PENDING OWNER APPLICATION.
-- This file is authored and reviewed but NOT yet applied. The execution
-- agent has no DDL-capable credential (only the PostgREST service-role
-- key, which cannot run DDL), so the owner must run this in the Supabase
-- SQL editor as a role that owns both public.profiles and
-- storage.objects (postgres / supabase_storage_admin).
--
-- Verified vulnerable baseline (2026-08-31, real blocked fixture session):
--   blocked USER: UPDATE own profiles.full_name ....... ALLOWED  (persisted)
--   blocked USER: avatar UPLOAD  (insert) ............. ALLOWED
--   blocked USER: avatar REPLACE (update) ............. ALLOWED
--   blocked USER: avatar READ    (select) ............. ALLOWED  (70 bytes)
--   blocked USER: avatar DELETE  (delete) ............. ALLOWED
-- All five MUST be denied after this migration.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Predicate choice: NOT public.hills_is_blocked()  (NOT hills_is_verified_user())
-- ---------------------------------------------------------------------
-- hills_is_verified_user() additionally requires p.role = 'USER', so using
-- it here would lock ADMIN accounts out of their own profile row and their
-- own avatar. That would violate FR-068 ("hardening MUST NOT reduce
-- Admin/service-role access") and break the Admin profile/account screen.
--
-- hills_is_blocked() is exactly the needed predicate. Its live definition:
--
--   CREATE OR REPLACE FUNCTION public.hills_is_blocked()
--     RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
--     SET search_path TO 'pg_catalog','public'
--   AS $$ SELECT COALESCE((SELECT p.is_blocked FROM public.profiles p
--                          WHERE p.id = auth.uid()), false); $$;
--
-- Empirically confirmed on 2026-08-31 against live staging fixtures:
--   blocked USER -> true    active USER -> false
--   ADMIN        -> false   anon        -> false
-- so ADMIN and service-role paths are provably unaffected by this change.
--
-- These policies remain PERMISSIVE and scoped to the `authenticated` role.
-- The service-role key bypasses RLS entirely and is untouched.


BEGIN;

-- ---------------------------------------------------------------------
-- 1/5  public.profiles — own-row UPDATE
--      before: USING (id = auth.uid())  WITH CHECK (id = auth.uid())
-- ---------------------------------------------------------------------
ALTER POLICY hills_profiles_update_own
  ON public.profiles
  USING (
    id = auth.uid()
    AND NOT public.hills_is_blocked()
  )
  WITH CHECK (
    id = auth.uid()
    AND NOT public.hills_is_blocked()
  );

-- NOTE: this deliberately does NOT replace protect_profile_block_fields().
-- That trigger independently rejects any attempt to change
-- is_blocked / blocked_at / blocked_by / block_reason by a non-admin
-- (error 42501 'profile_security_fields_not_editable') and remains the
-- authoritative anti-self-unblock guarantee required by FR-068. The two
-- controls are complementary; neither is a path around the other.


-- ---------------------------------------------------------------------
-- 2/5  storage.objects — avatars INSERT (upload)
--      before: WITH CHECK (bucket_id = 'avatars'
--                          AND (storage.foldername(name))[1] = auth.uid()::text)
-- ---------------------------------------------------------------------
ALTER POLICY avatars_owner_insert
  ON storage.objects
  WITH CHECK (
    bucket_id = 'avatars'::text
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND NOT public.hills_is_blocked()
  );


-- ---------------------------------------------------------------------
-- 3/5  storage.objects — avatars SELECT (read own private avatar)
-- ---------------------------------------------------------------------
ALTER POLICY avatars_owner_select
  ON storage.objects
  USING (
    bucket_id = 'avatars'::text
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND NOT public.hills_is_blocked()
  );


-- ---------------------------------------------------------------------
-- 4/5  storage.objects — avatars UPDATE (replace)
-- ---------------------------------------------------------------------
ALTER POLICY avatars_owner_update
  ON storage.objects
  USING (
    bucket_id = 'avatars'::text
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND NOT public.hills_is_blocked()
  )
  WITH CHECK (
    bucket_id = 'avatars'::text
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND NOT public.hills_is_blocked()
  );


-- ---------------------------------------------------------------------
-- 5/5  storage.objects — avatars DELETE
-- ---------------------------------------------------------------------
ALTER POLICY avatars_owner_delete
  ON storage.objects
  USING (
    bucket_id = 'avatars'::text
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND NOT public.hills_is_blocked()
  );

COMMIT;


-- =====================================================================
-- Explicitly NOT changed by this migration
-- =====================================================================
--   * hills_is_blocked(), hills_is_verified_user(), is_admin(),
--     hills_is_admin(), protect_profile_block_fields()  — unchanged.
--   * hills_storage_admin_insert/update/delete and
--     hills_storage_public_read (the 'hills-public' bucket) — unchanged.
--   * Every other RLS policy in the snapshot — unchanged.
--   * The avatars bucket stays private (public = false).
--   * No table, column, index, trigger, or grant is altered.


-- =====================================================================
-- Post-application verification (run tests, do not just re-read the SQL)
-- =====================================================================
-- Automated:
--   npm run test:integration
-- which runs tests/integration/blocked-user-rls.test.ts. Before this
-- migration its five "must be denied" cases FAIL (documenting the live
-- vulnerability); after it they must all PASS, while the unblocked-USER,
-- ADMIN, and service-role control cases must keep passing unchanged.
--
-- Manual spot check of the resulting policy text:
--
--   SELECT policyname, qual, with_check
--     FROM pg_policies
--    WHERE (schemaname = 'public'  AND tablename = 'profiles'
--           AND policyname = 'hills_profiles_update_own')
--       OR (schemaname = 'storage' AND tablename = 'objects'
--           AND policyname LIKE 'avatars_owner_%')
--    ORDER BY policyname;
--
-- Every returned row must contain `NOT hills_is_blocked()`.


-- =====================================================================
-- Rollback (restores the exact pre-migration definitions)
-- =====================================================================
-- BEGIN;
-- ALTER POLICY hills_profiles_update_own ON public.profiles
--   USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- ALTER POLICY avatars_owner_insert ON storage.objects
--   WITH CHECK (bucket_id = 'avatars'::text
--               AND (storage.foldername(name))[1] = (auth.uid())::text);
-- ALTER POLICY avatars_owner_select ON storage.objects
--   USING (bucket_id = 'avatars'::text
--          AND (storage.foldername(name))[1] = (auth.uid())::text);
-- ALTER POLICY avatars_owner_update ON storage.objects
--   USING (bucket_id = 'avatars'::text
--          AND (storage.foldername(name))[1] = (auth.uid())::text)
--   WITH CHECK (bucket_id = 'avatars'::text
--               AND (storage.foldername(name))[1] = (auth.uid())::text);
-- ALTER POLICY avatars_owner_delete ON storage.objects
--   USING (bucket_id = 'avatars'::text
--          AND (storage.foldername(name))[1] = (auth.uid())::text);
-- COMMIT;
