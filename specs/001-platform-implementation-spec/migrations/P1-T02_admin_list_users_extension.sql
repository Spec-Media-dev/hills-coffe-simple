-- =====================================================================
-- P1-T02 — Admin users read-path extension
-- ATOMIC + SECURITY-DEFINER HARDENED
-- =====================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.admin_list_users();


CREATE FUNCTION public.admin_list_users(
  email_query    text    DEFAULT NULL,
  name_query     text    DEFAULT NULL,
  blocked_filter boolean DEFAULT NULL,
  page           integer DEFAULT 1,
  page_size      integer DEFAULT 25
)
RETURNS TABLE(
  id              uuid,
  full_name       text,
  phone           text,
  company_name    text,
  email           text,
  email_verified  boolean,
  registered_at   timestamptz,
  favorites_count bigint,
  inquiries_count bigint,
  is_blocked      boolean,
  blocked_at      timestamptz,
  block_reason    text,
  avatar_path     text,
  total_count     bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_page integer := GREATEST(COALESCE(page, 1), 1);
  v_size integer := LEAST(
    GREATEST(COALESCE(page_size, 25), 1),
    100
  );
BEGIN

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;


  RETURN QUERY

  WITH filtered AS (
    SELECT
      p.id                               AS id,
      p.full_name                        AS full_name,
      p.phone                            AS phone,
      p.company_name                     AS company_name,
      u.email::text                      AS email,
      (u.email_confirmed_at IS NOT NULL) AS email_verified,
      u.created_at                       AS registered_at,
      COALESCE(p.is_blocked, false)      AS is_blocked,
      p.blocked_at                       AS blocked_at,
      p.block_reason                     AS block_reason,
      p.avatar_path                      AS avatar_path

    FROM public.profiles p

    JOIN auth.users u
      ON u.id = p.id

    WHERE p.role = 'USER'::public.app_role

      AND (
        email_query IS NULL
        OR u.email ILIKE '%' || email_query || '%'
      )

      AND (
        name_query IS NULL
        OR COALESCE(p.full_name, '')
           ILIKE '%' || name_query || '%'
      )

      AND (
        blocked_filter IS NULL
        OR COALESCE(p.is_blocked, false) = blocked_filter
      )
  )

  SELECT
    f.id,
    f.full_name,
    f.phone,
    f.company_name,
    f.email,
    f.email_verified,
    f.registered_at,

    (
      SELECT COUNT(*)
      FROM public.favorites fv
      WHERE fv.user_id = f.id
    )::bigint,

    (
      SELECT COUNT(*)
      FROM public.inquiries iq
      WHERE iq.user_id = f.id
    )::bigint,

    f.is_blocked,
    f.blocked_at,
    f.block_reason,
    f.avatar_path,

    (
      SELECT COUNT(*)
      FROM filtered
    )::bigint AS total_count

  FROM filtered f

  ORDER BY f.registered_at DESC

  OFFSET (v_page - 1) * v_size

  LIMIT v_size;

END;
$function$;


REVOKE ALL
ON FUNCTION public.admin_list_users(
  text,
  text,
  boolean,
  integer,
  integer
)
FROM PUBLIC;


REVOKE ALL
ON FUNCTION public.admin_list_users(
  text,
  text,
  boolean,
  integer,
  integer
)
FROM anon;


GRANT EXECUTE
ON FUNCTION public.admin_list_users(
  text,
  text,
  boolean,
  integer,
  integer
)
TO authenticated;


COMMIT;