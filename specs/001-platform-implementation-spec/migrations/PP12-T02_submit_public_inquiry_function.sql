-- =====================================================================
-- PP12-T02 — public.submit_public_inquiry(): the anonymous write boundary
-- Pre-Phase 12 Owner Alignment Addendum (OA-T02).
-- Implements spec.md FR-081. Supports FR-069 through FR-075 and FR-078.
--
-- STATUS: APPLIED LIVE by the owner (Supabase SQL editor, 2026-09-03 —
-- "Success. No rows returned."). The execution agent has no DDL-capable
-- credential (only the PostgREST service-role key, which cannot run DDL),
-- so the owner ran this as a role owning public.inquiries (postgres).
--
-- The verification block at the foot of this file passed at apply time —
-- it raises and aborts the transaction otherwise, so a clean apply is
-- itself the proof that the signature, SECURITY DEFINER flag, pinned
-- search_path and EXECUTE grants are exactly as specified. Independently
-- re-confirmed afterwards from the application side: `anon` can call it,
-- a real `authenticated` session is denied, and a direct `anon` INSERT
-- into public.inquiries is still refused with 42501.
--
-- This is genuinely NEW schema and therefore carries a real approval gate,
-- unlike PP12-T01, which only reconciles a delta the owner had already
-- approved and applied. The two are deliberately separate files so those
-- two very different statuses are never conflated.
--
-- WHY A FUNCTION AND NOT AN RLS POLICY
-- Row Level Security correctly denies anonymous INSERT on public.inquiries
-- today, and this migration deliberately does NOT change that. A policy
-- broad enough to let `anon` insert directly would have to re-encode every
-- guarantee below as a WITH CHECK expression and would widen the table's
-- surface permanently. A SECURITY DEFINER function keeps the whole
-- boundary in one reviewable, revocable object: the parameter list IS the
-- allow-list, and anything not named there simply cannot be supplied.
-- =====================================================================


-- ---------------------------------------------------------------------
-- What the caller can and cannot control
-- ---------------------------------------------------------------------
-- CAN supply (the complete allow-list, enforced by the signature itself):
--   p_full_name, p_email, p_phone, p_message,
--   p_offer_id      (presence selects SAMPLE_REQUEST over GENERAL),
--   p_address, p_country_code   (required only for SAMPLE_REQUEST),
--   p_company_name, p_subject   (optional)
--
-- CANNOT supply, at all — there is no parameter to abuse:
--   user_id ......... never set; hydrate_inquiry_context() leaves it NULL
--                     because auth.uid() is NULL for an anon caller.
--   type ............ decided here, and only ever GENERAL or
--                     SAMPLE_REQUEST. PRODUCT is unreachable through this
--                     function, so a public caller can never manufacture
--                     the account-only inquiry type.
--   status .......... hardcoded to NEW.
--   coffee_id ....... derived server-side from the offer, never accepted.
--   coffee_name_snapshot / offer_reference_snapshot /
--   warehouse_code_snapshot ... derived by the existing
--                     hydrate_inquiry_context() trigger, never accepted.
--   any other column ... not addressable.
--
-- Nothing in this function reads offer_price_tiers or any protected price,
-- and it returns only the new row's request_code and id, so there is no
-- path by which pricing or another customer's data could leave it.


-- ---------------------------------------------------------------------
-- Offer visibility: validated HERE, not delegated
-- ---------------------------------------------------------------------
-- hydrate_inquiry_context() resolves coffee_id from offer_id but only
-- checks `deleted_at IS NULL`. That is sufficient for the authenticated
-- path because src/actions/inquiries.ts already filters for a *visible*
-- offer before inserting. An anonymous caller supplies the offer id
-- directly, so this function must not inherit that assumption: it repeats
-- the full public-visibility test itself —
--   offer:     is_visible = true, status <> 'INACTIVE', deleted_at IS NULL
--   coffee:    status = 'PUBLISHED', deleted_at IS NULL
--   warehouse: is_active = true
-- exactly mirroring resolveVisibleOffer() in the application layer. A
-- hidden, archived, inactive, or unpublished target is rejected as
-- 'public_inquiry_invalid_offer', which is indistinguishable from a
-- nonexistent one, so this cannot be used to probe unpublished catalogue.


-- ---------------------------------------------------------------------
-- Error vocabulary
-- ---------------------------------------------------------------------
-- Failures are raised as stable, machine-readable tokens, never prose, so
-- the application maps them through a closed switch (the pattern
-- admin_set_user_blocked / mapRpcError already establishes). Constitution
-- Principle XII: no raw backend text ever reaches a user.
--
-- These use the default P0001 that a bare RAISE EXCEPTION produces, exactly
-- like admin_list_users' own 'Forbidden'. A custom ERRCODE would buy nothing
-- — the application matches the token, not the code — while risking
-- PostgREST mapping an unusual class to a surprising HTTP status.
--   public_inquiry_missing_field   -> VALIDATION
--   public_inquiry_invalid_field   -> VALIDATION  (supplied but out of bounds)
--   public_inquiry_invalid_offer   -> NOT_FOUND
--   public_inquiry_rate_limited    -> RATE_LIMITED
-- A duplicate is NOT raised here: the unique-violation (23505) from
-- PP12-T01's index is allowed to propagate untouched so the application
-- can look up the existing request code and return DUPLICATE_SAMPLE with
-- it, exactly as createSampleRequestInquiry already does for signed-in
-- customers.


BEGIN;

DROP FUNCTION IF EXISTS public.submit_public_inquiry(
  text, text, text, text, uuid, text, text, text, text
);


CREATE FUNCTION public.submit_public_inquiry(
  p_full_name    text,
  p_email        text,
  p_phone        text,
  p_message      text,
  p_offer_id     uuid DEFAULT NULL,
  p_address      text DEFAULT NULL,
  p_country_code text DEFAULT NULL,
  p_company_name text DEFAULT NULL,
  p_subject      text DEFAULT NULL
)
-- jsonb rather than RETURNS TABLE on purpose: `request_code` is also a
-- column of public.inquiries, and an OUT parameter of that name would make
-- the RETURNING clause below ambiguous to plpgsql. Returning a built object
-- keeps the API shape ({ request_code, inquiry_id }) without that hazard.
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  -- Per-email throttle. Deliberately generous: this is the durable
  -- backstop behind the application's own per-IP limiter, not the primary
  -- friction. Both map to the same RATE_LIMITED domain error.
  c_email_window   constant interval := interval '1 hour';
  c_email_max      constant integer  := 5;

  -- Bounds. `anon` holds EXECUTE on this function, so it is reachable
  -- directly through PostgREST with the publishable key — the Next.js Zod
  -- schema is a convenience for people using the form, not a boundary.
  -- These limits are the boundary, and they mirror the application's rules
  -- so a direct caller cannot do anything the form would have refused.
  c_name_max       constant integer := 200;
  c_email_max_len  constant integer := 320;   -- RFC 5321 practical ceiling
  c_message_min    constant integer := 10;
  c_message_max    constant integer := 2000;
  c_address_max    constant integer := 400;
  c_company_max    constant integer := 160;
  c_subject_max    constant integer := 160;
  -- The project's one accepted phone shape, identical to PHONE_PATTERN in
  -- src/lib/validation/auth.ts.
  c_phone_pattern  constant text := '^\+?[0-9\s\-()]{7,20}$';

  v_full_name    text := btrim(coalesce(p_full_name, ''));
  v_email        text := lower(btrim(coalesce(p_email, '')));
  v_phone        text := btrim(coalesce(p_phone, ''));
  v_message      text := btrim(coalesce(p_message, ''));
  v_address      text := nullif(btrim(coalesce(p_address, '')), '');
  v_country      text := nullif(upper(btrim(coalesce(p_country_code, ''))), '');
  v_company      text := nullif(btrim(coalesce(p_company_name, '')), '');
  v_subject      text := nullif(btrim(coalesce(p_subject, '')), '');
  v_type         public.inquiry_type;
  v_recent_count integer;
  v_new_id       uuid;
  v_new_code     text;
BEGIN
  -- ---------------------------------------------------------------
  -- 1. Fields required of every public submission
  -- ---------------------------------------------------------------
  IF v_full_name = '' OR v_email = '' OR v_phone = '' OR v_message = '' THEN
    RAISE EXCEPTION 'public_inquiry_missing_field';
  END IF;

  -- ---------------------------------------------------------------
  -- 1b. Bounds and shape, enforced here rather than trusted from the caller
  -- ---------------------------------------------------------------
  -- Anything supplied but malformed is `invalid_field`; anything required
  -- but absent was already `missing_field` above. Neither token carries
  -- database text, and neither says which specific rule tripped, so this
  -- cannot be used to probe the schema.
  IF length(v_full_name) > c_name_max
     OR length(v_email) > c_email_max_len
     -- Deliberately loose: a shape check, not an address validator. It
     -- rejects the obviously-not-an-email without pretending to decide
     -- deliverability.
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     OR v_phone !~ c_phone_pattern
     OR length(v_message) < c_message_min
     OR length(v_message) > c_message_max
     OR (v_address IS NOT NULL AND length(v_address) > c_address_max)
     OR (v_company IS NOT NULL AND length(v_company) > c_company_max)
     OR (v_subject IS NOT NULL AND length(v_subject) > c_subject_max)
     -- Two letters exactly, when supplied at all.
     OR (v_country IS NOT NULL AND v_country !~ '^[A-Z]{2}$')
  THEN
    RAISE EXCEPTION 'public_inquiry_invalid_field';
  END IF;

  -- ---------------------------------------------------------------
  -- 2. Which of the two public types this is, and its extra requirements
  -- ---------------------------------------------------------------
  IF p_offer_id IS NULL THEN
    -- GENERAL: coffee-agnostic. No offer, no coffee, no shipping detail.
    -- It can never become an offer-specific inquiry because offer_id and
    -- coffee_id are both left NULL below.
    v_type := 'GENERAL'::public.inquiry_type;
  ELSE
    -- SAMPLE_REQUEST: a physical sample has to ship somewhere.
    v_type := 'SAMPLE_REQUEST'::public.inquiry_type;

    IF v_address IS NULL OR v_country IS NULL THEN
      RAISE EXCEPTION 'public_inquiry_missing_field';
    END IF;

    -- Full public-visibility test. A target failing any leg is reported
    -- identically to a nonexistent one.
    IF NOT EXISTS (
      SELECT 1
      FROM public.coffee_offers o
      JOIN public.coffees c    ON c.id = o.coffee_id
      JOIN public.warehouses w ON w.id = o.warehouse_id
      WHERE o.id = p_offer_id
        AND o.is_visible = true
        AND o.status <> 'INACTIVE'::public.offer_status
        AND o.deleted_at IS NULL
        AND c.status = 'PUBLISHED'::public.coffee_status
        AND c.deleted_at IS NULL
        AND w.is_active = true
    ) THEN
      RAISE EXCEPTION 'public_inquiry_invalid_offer';
    END IF;
  END IF;

  -- ---------------------------------------------------------------
  -- 3. Per-email rate limit (durable; the per-IP limit lives in the app)
  -- ---------------------------------------------------------------
  -- Serialize same-email callers first. A plain count-then-insert is a
  -- read-then-write race: N concurrent requests for one address can all
  -- read a count below the ceiling and all proceed, which is exactly the
  -- pattern an abuser would exploit. The advisory lock is transaction
  -- scoped, so PostgreSQL releases it on commit or rollback with no
  -- unlock path to forget — and it is keyed on the normalized email, so
  -- two different addresses never contend with each other.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_email, 0));

  SELECT count(*) INTO v_recent_count
  FROM public.inquiries i
  WHERE i.user_id IS NULL
    AND lower(btrim(i.email)) = v_email
    AND i.created_at > (now() - c_email_window);

  IF v_recent_count >= c_email_max THEN
    RAISE EXCEPTION 'public_inquiry_rate_limited';
  END IF;

  -- ---------------------------------------------------------------
  -- 4. The write
  -- ---------------------------------------------------------------
  -- user_id, coffee_id and every snapshot column are absent on purpose:
  -- hydrate_inquiry_context() derives them, and leaves user_id NULL
  -- because auth.uid() is NULL for an anon caller. status is pinned to
  -- NEW. A 23505 from uq_inquiries_active_sample_anon_email_coffee is
  -- allowed to propagate for the application to translate.
  INSERT INTO public.inquiries (
    type, status, offer_id,
    full_name, email, phone, company_name,
    address, country_code, subject, message
  )
  VALUES (
    v_type, 'NEW'::public.inquiry_status, p_offer_id,
    v_full_name, v_email, v_phone, v_company,
    v_address, v_country, v_subject, v_message
  )
  RETURNING id, request_code INTO v_new_id, v_new_code;

  RETURN jsonb_build_object(
    'request_code', v_new_code,
    'inquiry_id',   v_new_id
  );
END
$function$;


-- ---------------------------------------------------------------------
-- Privileges: the minimum, and nothing inherited
-- ---------------------------------------------------------------------
-- PostgreSQL grants EXECUTE to PUBLIC by default on a new function, which
-- for a SECURITY DEFINER function is exactly what must not happen. Revoke
-- first, then grant only to `anon` — the single role that needs it.
-- `authenticated` is deliberately excluded: a signed-in customer keeps
-- using the existing authenticated actions (FR-076), so there is no reason
-- for a session-bearing role to be able to reach this path at all.
REVOKE ALL ON FUNCTION public.submit_public_inquiry(
  text, text, text, text, uuid, text, text, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.submit_public_inquiry(
  text, text, text, text, uuid, text, text, text, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.submit_public_inquiry(
  text, text, text, text, uuid, text, text, text, text
) TO anon;


-- ---------------------------------------------------------------------
-- Self-verification
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  -- The exact overload, resolved once. Checking by proname alone would pass
  -- even if this migration had created a *different* signature alongside an
  -- older one, or if some other overload existed — the whole point of the
  -- verification is to prove that THIS function, with THIS argument list,
  -- is the one that ended up installed and granted.
  c_signature constant text :=
    'public.submit_public_inquiry(text,text,text,text,uuid,text,text,text,text)';
  v_oid    oid;
  v_secdef boolean;
  v_config text[];
  v_acl    aclitem[];
  v_anon   boolean;
  v_pub    boolean;
  v_auth   boolean;
BEGIN
  -- to_regprocedure returns NULL rather than raising when nothing matches,
  -- so a missing function is reported as our own message, not a parse error.
  v_oid := to_regprocedure(c_signature);

  IF v_oid IS NULL THEN
    RAISE EXCEPTION
      'PP12-T02 verification failed: % was not created', c_signature;
  END IF;

  SELECT p.prosecdef, p.proconfig, p.proacl
    INTO v_secdef, v_config, v_acl
  FROM pg_proc p
  WHERE p.oid = v_oid;

  IF NOT v_secdef THEN
    RAISE EXCEPTION 'PP12-T02 verification failed: % is not SECURITY DEFINER', c_signature;
  END IF;
  IF v_config IS NULL
     OR NOT EXISTS (SELECT 1 FROM unnest(v_config) AS c WHERE c LIKE 'search_path=%') THEN
    RAISE EXCEPTION 'PP12-T02 verification failed: % has no pinned search_path', c_signature;
  END IF;

  -- Privilege checks against the same resolved OID, so they cannot drift
  -- onto a different overload than the one inspected above.
  --
  -- PUBLIC is checked through the ACL rather than has_function_privilege():
  -- PUBLIC is a pseudo-role, not a row in pg_authid, so passing it there
  -- would raise a 'role "public" does not exist' error and fail this
  -- migration for the wrong reason. In an ACL, grantee 0 *is* PUBLIC. A NULL
-- proacl is the
  -- separate hazard — it means no grant was ever recorded, which leaves
  -- PostgreSQL's default EXECUTE-to-PUBLIC in force.
  IF v_acl IS NULL THEN
    RAISE EXCEPTION
      'PP12-T02 verification failed: % has default privileges, so PUBLIC still holds EXECUTE',
      c_signature;
  END IF;

  v_anon := has_function_privilege('anon', v_oid, 'EXECUTE');
  v_auth := has_function_privilege('authenticated', v_oid, 'EXECUTE');
  SELECT EXISTS (
    SELECT 1
    FROM aclexplode(v_acl) AS a
    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
  ) INTO v_pub;

  IF NOT v_anon THEN
    RAISE EXCEPTION 'PP12-T02 verification failed: anon cannot execute %', c_signature;
  END IF;
  IF v_pub THEN
    RAISE EXCEPTION 'PP12-T02 verification failed: EXECUTE is still granted to PUBLIC on %', c_signature;
  END IF;
  IF v_auth THEN
    RAISE EXCEPTION 'PP12-T02 verification failed: EXECUTE is still granted to authenticated on %', c_signature;
  END IF;

  RAISE NOTICE 'PP12-T02 verification passed for % (oid %).', c_signature, v_oid;
  RAISE NOTICE '  SECURITY DEFINER, pinned search_path, anon-only EXECUTE.';
END
$verify$;

COMMIT;


-- =====================================================================
-- Explicitly NOT changed by this migration
-- =====================================================================
--   * No RLS policy is added, altered, or dropped. Direct anonymous
--     INSERT into public.inquiries remains denied — that denial is a
--     tested part of this addendum's acceptance, not an oversight.
--   * hydrate_inquiry_context(), validate_inquiry_status_transition(),
--     track_inquiry_status() — all unchanged.
--   * uq_inquiries_active_sample_user_coffee and the authenticated
--     duplicate rule — unchanged.
--   * PP12-T01's constraint and anonymous index — this file assumes them
--     and does not restate them.
--   * No table, column, enum, trigger, or storage object.
--   * The service-role key is not involved anywhere in this path.


-- =====================================================================
-- Post-application verification (run the tests, do not just re-read SQL)
-- =====================================================================
-- The DO block above runs automatically and aborts on any mismatch.
-- Then, against the real database:
--
--   npm run test:integration
-- which includes tests/integration/public-inquiry.test.ts and covers, as
-- the anon role through PostgREST:
--   * a GENERAL submission succeeds and returns a request_code
--   * a SAMPLE_REQUEST against a visible offer succeeds
--   * a SAMPLE_REQUEST against a hidden/archived/unpublished offer is
--     rejected as public_inquiry_invalid_offer
--   * a second active request for the same normalized email and coffee
--     raises 23505 on the anonymous index
--   * missing address/country on a sample raises
--     public_inquiry_missing_field
--   * an over-long name/message/address, a malformed email, a phone that
--     fails the project's pattern, or a country code that is not exactly two
--     letters each raise public_inquiry_invalid_field — proving the bounds
--     hold for a caller who skips the application entirely
--   * concurrent submissions for one normalized email cannot exceed the
--     hourly ceiling (the advisory lock serializes them)
--   * a direct anon INSERT into public.inquiries is STILL denied by RLS
--   * every created row has user_id IS NULL, status = 'NEW', and a type
--     of GENERAL or SAMPLE_REQUEST — never PRODUCT
--
-- Manual spot check:
--
--   SELECT p.proname, p.prosecdef, p.proconfig,
--          pg_get_function_identity_arguments(p.oid) AS args
--     FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'submit_public_inquiry';
--
--   SELECT grantee, privilege_type
--     FROM information_schema.role_routine_grants
--    WHERE routine_schema = 'public'
--      AND routine_name = 'submit_public_inquiry';
--
-- Expect prosecdef = true, proconfig containing search_path, and exactly
-- one grantee: anon.


-- =====================================================================
-- Rollback (restores the exact pre-migration state)
-- =====================================================================
-- Dropping the function is the whole rollback: no policy, trigger, table,
-- or grant outside this function was touched. Anonymous submission simply
-- stops working and the application's calls begin failing closed, which is
-- the correct pre-addendum behaviour.
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.submit_public_inquiry(
--   text, text, text, text, uuid, text, text, text, text
-- );
-- COMMIT;
