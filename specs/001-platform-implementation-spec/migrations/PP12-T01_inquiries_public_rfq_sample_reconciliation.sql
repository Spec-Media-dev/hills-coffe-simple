-- =====================================================================
-- PP12-T01 — Public RFQ / anonymous SAMPLE_REQUEST: schema reconciliation
-- Pre-Phase 12 Owner Alignment Addendum (OA-T01).
-- Implements spec.md FR-083. Supports FR-069, FR-073, FR-074.
--
-- STATUS: ALREADY APPLIED LIVE — this file RECONCILES, it does not change.
-- The owner applied this delta directly to the live database and verified
-- it before this addendum was planned. This file exists so the repository's
-- versioned migration history matches that reality, and so a clean database
-- replaying the full sequence reproduces the identical end state.
-- Running it against the already-patched database is a safe no-op-equivalent
-- (the constraint is re-created with the same semantics; the index creation
-- is skipped by IF NOT EXISTS).
--
-- Contrast with PP12-T02 (the submit_public_inquiry function), which is a
-- genuinely NEW object and carries its own PENDING OWNER APPLICATION status.
-- The two are deliberately separate files: different content, different
-- approval status. Neither edits, renames, moves, or replaces any existing
-- migration file.
--
-- Live behaviour verified empirically on 2026-09-03 (service-role probes,
-- disposable rows, removed immediately afterwards):
--   SAMPLE_REQUEST + user_id NULL ......................... ACCEPTED
--   same normalized email + same coffee, still active ..... REJECTED 23505
--     on uq_inquiries_active_sample_anon_email_coffee
--   "  QA-OA-VERIFY@Example.INVALID  " vs the lower-cased,
--     trimmed form, same coffee ........................... REJECTED 23505
--     (proves the index really keys on lower(btrim(email)))
--   PRODUCT + user_id NULL ................................ REJECTED 23514
--     on inquiries_product_needs_user
--   GENERAL + user_id NULL + coffee_id NULL ............... ACCEPTED
-- =====================================================================


-- ---------------------------------------------------------------------
-- What this migration represents
-- ---------------------------------------------------------------------
-- 1. inquiries_product_needs_user — relaxed so that only PRODUCT requires
--    an owning account. GENERAL and SAMPLE_REQUEST may now carry a NULL
--    user_id, which is what makes an anonymous submission possible at all.
--    Its previous definition required user_id for everything except
--    GENERAL: CHECK (type = 'GENERAL'::inquiry_type OR user_id IS NOT NULL).
--
-- 2. uq_inquiries_active_sample_anon_email_coffee — the anonymous twin of
--    the existing per-account index. Anonymous callers have no user_id, so
--    their duplicate identity is the normalized email plus the coffee.
--
-- 3. uq_inquiries_active_sample_user_coffee — PRESERVED, untouched. It
--    keys on (user_id, coffee_id) and its predicate requires
--    user_id IS NOT NULL, so it and the new anonymous index can never
--    match the same row. The two rules never interact (FR-073).
--
-- No new table, column, enum, trigger, or status-transition function.


BEGIN;

-- ---------------------------------------------------------------------
-- 1/2  inquiries_product_needs_user
-- ---------------------------------------------------------------------
-- DROP + ADD rather than a guarded conditional: it is idempotent in the
-- sense that matters here (same end state from either starting point), it
-- makes the final definition explicit in one place rather than implied by
-- a branch, and it matches the DROP-IF-EXISTS-then-CREATE idiom PP12-T02
-- and P1-T02 already use.
ALTER TABLE public.inquiries
  DROP CONSTRAINT IF EXISTS inquiries_product_needs_user;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_product_needs_user
  CHECK (
    type <> 'PRODUCT'::public.inquiry_type
    OR user_id IS NOT NULL
  );


-- ---------------------------------------------------------------------
-- 2/2  uq_inquiries_active_sample_anon_email_coffee
-- ---------------------------------------------------------------------
-- Partial unique index. The predicate is the whole point:
--   * type = 'SAMPLE_REQUEST'  — GENERAL RFQs have no duplicate rule at
--     all (FR-075); they are not tied to a coffee.
--   * user_id IS NULL          — anonymous rows only. A signed-in
--     customer's row is governed by uq_inquiries_active_sample_user_coffee
--     instead, and this predicate guarantees the two never overlap.
--   * status IN (the five active states) — CLOSED is deliberately absent,
--     which is what lets a closed request be followed by a new one
--     (FR-074).
-- lower(btrim(email)) is the normalization: "  A@B.COM " and "a@b.com"
-- are the same person for duplicate purposes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inquiries_active_sample_anon_email_coffee
  ON public.inquiries (lower(btrim(email)), coffee_id)
  WHERE type = 'SAMPLE_REQUEST'::public.inquiry_type
    AND user_id IS NULL
    AND status IN (
      'NEW'::public.inquiry_status,
      'RECEIVED'::public.inquiry_status,
      'CONTACTED'::public.inquiry_status,
      'SAMPLE_SENT'::public.inquiry_status,
      'DELIVERED'::public.inquiry_status
    );


-- ---------------------------------------------------------------------
-- Self-verification — fail loudly rather than accept a same-named object
-- ---------------------------------------------------------------------
-- OA-T01 requires this migration to verify the definitions it expects, not
-- merely observe that objects with the right names exist. A same-named
-- constraint or index with a different predicate would silently break the
-- anonymous duplicate rule, so each is inspected and the transaction is
-- aborted if anything does not match.
DO $verify$
DECLARE
  v_check_def text;
  v_anon_def  text;
  v_user_def  text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_check_def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'inquiries'
    AND c.conname = 'inquiries_product_needs_user';

  IF v_check_def IS NULL THEN
    RAISE EXCEPTION 'PP12-T01 verification failed: inquiries_product_needs_user is missing';
  END IF;
  IF position('PRODUCT' in v_check_def) = 0
     OR position('user_id IS NOT NULL' in v_check_def) = 0 THEN
    RAISE EXCEPTION
      'PP12-T01 verification failed: inquiries_product_needs_user has an unexpected definition: %',
      v_check_def;
  END IF;

  SELECT pg_get_indexdef(i.indexrelid) INTO v_anon_def
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'uq_inquiries_active_sample_anon_email_coffee';

  IF v_anon_def IS NULL THEN
    RAISE EXCEPTION 'PP12-T01 verification failed: uq_inquiries_active_sample_anon_email_coffee is missing';
  END IF;
  -- Must be UNIQUE, must normalize the email, must be scoped to anonymous
  -- active SAMPLE_REQUEST rows, and must NOT include CLOSED.
  IF position('UNIQUE' in v_anon_def) = 0
     OR position('btrim' in v_anon_def) = 0
     OR position('user_id IS NULL' in v_anon_def) = 0
     OR position('SAMPLE_REQUEST' in v_anon_def) = 0
     OR position('CLOSED' in v_anon_def) > 0 THEN
    RAISE EXCEPTION
      'PP12-T01 verification failed: anonymous sample index has an unexpected definition: %',
      v_anon_def;
  END IF;

  SELECT pg_get_indexdef(i.indexrelid) INTO v_user_def
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'uq_inquiries_active_sample_user_coffee';

  IF v_user_def IS NULL THEN
    RAISE EXCEPTION
      'PP12-T01 verification failed: uq_inquiries_active_sample_user_coffee was expected to be preserved but is missing';
  END IF;

  RAISE NOTICE 'PP12-T01 verification passed.';
  RAISE NOTICE '  check : %', v_check_def;
  RAISE NOTICE '  anon  : %', v_anon_def;
  RAISE NOTICE '  user  : %', v_user_def;
END
$verify$;

COMMIT;


-- =====================================================================
-- Explicitly NOT changed by this migration
-- =====================================================================
--   * uq_inquiries_active_sample_user_coffee — preserved exactly; the
--     authenticated duplicate rule (user_id + coffee_id) is unchanged.
--   * hydrate_inquiry_context()          — unchanged. It already leaves
--     user_id alone when auth.uid() is NULL, which is precisely what makes
--     an anonymous row possible without touching it.
--   * validate_inquiry_status_transition() — unchanged. The status graph,
--     including SAMPLE_SENT/DELIVERED and CLOSED being terminal, is
--     untouched by this addendum.
--   * track_inquiry_status(), set_updated_at(), and every other trigger.
--   * inquiries_coffee_or_offer_required and every other constraint.
--   * Every RLS policy on public.inquiries. In particular, no anonymous
--     INSERT policy is added here or anywhere else in this addendum — the
--     anonymous write path is the SECURITY DEFINER function in PP12-T02,
--     not a widened policy.
--   * No table, column, enum, sequence, grant, or storage object.


-- =====================================================================
-- Post-application verification (run the tests, do not just re-read SQL)
-- =====================================================================
-- The DO block above runs automatically and aborts the transaction on any
-- mismatch. In addition, confirm the enforced behaviour end-to-end:
--
--   npm run test:integration
-- which includes tests/integration/public-inquiry.test.ts (added by OA-T10)
-- and covers, against the real database:
--   * SAMPLE_REQUEST with user_id NULL is accepted
--   * PRODUCT with user_id NULL is rejected (23514)
--   * a second active anonymous request for the same normalized email and
--     coffee is rejected (23505 on the anonymous index)
--   * the same pair is accepted again once the first reaches CLOSED
--   * a signed-in customer's duplicate rule still keys on user_id + coffee
--
-- Manual spot check of the resulting definitions:
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.inquiries'::regclass
--      AND conname = 'inquiries_product_needs_user';
--
--   SELECT indexname, indexdef
--     FROM pg_indexes
--    WHERE schemaname = 'public'
--      AND tablename = 'inquiries'
--      AND indexname LIKE 'uq_inquiries_active_sample%'
--    ORDER BY indexname;
--
-- Expect exactly two rows from the second query: the preserved
-- ..._user_coffee index and the ..._anon_email_coffee index.


-- =====================================================================
-- Rollback (restores the pre-addendum definitions)
-- =====================================================================
-- Only safe while no anonymous rows exist, since restoring the old CHECK
-- would be violated by any GENERAL/SAMPLE_REQUEST row with a NULL user_id.
-- Delete or reassign those rows first.
--
-- BEGIN;
-- DROP INDEX IF EXISTS public.uq_inquiries_active_sample_anon_email_coffee;
-- ALTER TABLE public.inquiries
--   DROP CONSTRAINT IF EXISTS inquiries_product_needs_user;
-- ALTER TABLE public.inquiries
--   ADD CONSTRAINT inquiries_product_needs_user
--   CHECK (type = 'GENERAL'::public.inquiry_type OR user_id IS NOT NULL);
-- COMMIT;
