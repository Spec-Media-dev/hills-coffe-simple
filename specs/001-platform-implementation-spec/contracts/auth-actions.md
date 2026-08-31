# Contract: Authentication & Authorization Actions

All results use the `ActionResult` shape from `action-result.md`. All
actions are server-only. None accept a client-supplied role or block state.

## `signUp(fullName, email, phone, password, confirmPassword)`

- **Requires**: no session, or an existing anonymous request.
- **Effect**: creates a Supabase Auth user (unconfirmed) and a `profiles`
  row with `role = 'USER'`. Never accepts a role or company field (FR-002).
- **Returns**: `OK` with a neutral "check your email" outcome regardless of
  whether the address was already registered (FR-003). Never `VALIDATION`
  distinguishing "email taken" from "invalid email" in a way that leaks
  existence.

## `signIn(email, password, next?)`

- **Effect**: authenticates via Supabase; then resolves `profiles.role` and
  `is_blocked` server-side.
- **Returns**:
  - `VERIFICATION_REQUIRED` if `email_confirmed_at` is null (FR-004).
  - `BLOCKED` if `is_blocked = true`, with the customer's session cleared
    (FR-014).
  - `ADMIN_PORTAL_REQUIRED` if `role = 'ADMIN'` (customer sign-in never
    grants Admin capability) (FR-008).
  - `OK` with a safe internal redirect target otherwise (FR-001, next-URL
    allow-listed against known routes only — no open redirect).

## `adminSignIn(email, password)`

- **Effect**: authenticates via Supabase; resolves `profiles.role` and
  `is_blocked` server-side.
- **Returns**:
  - `FORBIDDEN` if `role != 'ADMIN'` or `is_blocked = true`, with the
    session cleared and no capability granted (FR-009).
  - `OK` with the Admin destination otherwise.

## `resendVerification(email)`

- **Effect**: server-enforced rate limit (not client-timer-only) (FR-007).
- **Returns**: `OK` or `RATE_LIMITED`, always with a neutral message that
  does not reveal account existence (FR-003).

## `requestPasswordReset(email)`

- **Returns**: always `OK` with an identical neutral message (FR-003).

## `resetPassword(newPassword, confirmPassword)`

- **Requires**: a genuine, server-verified recovery session (FR-012) — an
  ordinary authenticated session is not sufficient.
- **Effect**: updates the credential, then invalidates the recovery-specific
  session context (FR-013).
- **Returns**: `AUTH_REQUIRED`/`FORBIDDEN` if no valid recovery session,
  `VALIDATION` on weak/mismatched password, `OK` otherwise.

## `authCallback(code | token_hash, type)` (route handler, not a server action)

- **Effect**: exchanges the code/verifies the token, then **re-reads** the
  resulting user/session state (FR-005) before deciding the destination:
  - signup confirmation confirmed → route to customer or Admin destination
    per resolved role.
  - recovery → route into the password-reset flow with a verified recovery
    session.
  - confirmation failed / expired / reused → safe "link no longer valid"
    destination with an offer to resend/retry, no protected session granted.

## Cross-cutting authorization checks (used by every other contract)

- `requireVerifiedUser()`: `AUTH_REQUIRED` → `VERIFICATION_REQUIRED` →
  `BLOCKED` → success, evaluated in that order, backed by
  `hills_is_verified_user()`.
- `requireAdmin()`: `AUTH_REQUIRED` → `FORBIDDEN` (wrong role or blocked) →
  success, backed by `is_admin()`.
- Both checks MUST be re-evaluated inside every protected action/query, not
  only at the page/layout boundary (FR-024, Constitution Principle VII).
