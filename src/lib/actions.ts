/**
 * The single result shape every server action returns, per
 * `specs/001-platform-implementation-spec/contracts/action-result.md`.
 *
 * The critical rule (Constitution Principle XII): the server returns a
 * `messageKey`, never a pre-localized or raw provider string. The client
 * resolves it through the active locale's catalog, which is what keeps an
 * English page English and an Arabic page Arabic without any
 * `locale === "ar" ? …` branching in action code, and what makes it
 * structurally impossible for a Postgres/Supabase error text to reach the UI.
 */
export type FieldErrors = Record<string, string[] | undefined>;

/** Closed set. Do not add ad hoc codes — see the contract's table. */
export type DomainErrorCode =
  | "VALIDATION"
  | "AUTH_REQUIRED"
  | "VERIFICATION_REQUIRED"
  | "ADMIN_PORTAL_REQUIRED"
  | "FORBIDDEN"
  | "BLOCKED"
  | "NOT_FOUND"
  | "DUPLICATE_SAMPLE"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "STORAGE_INVALID"
  | "STORAGE_FAILED"
  | "CONFIGURATION"
  | "UNEXPECTED";

export type ActionResult<T = undefined> =
  | { ok: true; code: "OK"; data?: T; messageKey?: string }
  | {
      ok: false;
      code: DomainErrorCode;
      messageKey: string;
      fieldErrors?: FieldErrors;
      conflict?: { requestCode?: string };
    };

/**
 * `useActionState` needs an initial value, but "not submitted yet" is not a
 * domain outcome and must not borrow a `DomainErrorCode`. It is modelled as a
 * separate union member so the closed set above stays honest.
 */
export type ActionFormState<T = undefined> =
  ActionResult<T> | { ok: false; code: "IDLE" };

export const idleActionState: ActionFormState = { ok: false, code: "IDLE" };

export const isIdle = <T>(state: ActionFormState<T>): boolean =>
  !state.ok && state.code === "IDLE";

/** Narrows to a settled result so callers can read `messageKey` safely. */
export function settled<T>(state: ActionFormState<T>): ActionResult<T> | null {
  return isIdle(state) ? null : (state as ActionResult<T>);
}

export function fieldErrorsOf<T>(
  state: ActionFormState<T>,
): FieldErrors | undefined {
  return !state.ok && state.code !== "IDLE"
    ? (state as Extract<ActionResult<T>, { ok: false }>).fieldErrors
    : undefined;
}

export const ok = <T>(messageKey?: string, data?: T): ActionResult<T> => ({
  ok: true,
  code: "OK",
  ...(data === undefined ? {} : { data }),
  ...(messageKey ? { messageKey } : {}),
});

export const fail = (
  code: DomainErrorCode,
  messageKey: string,
  extra?: { fieldErrors?: FieldErrors; conflict?: { requestCode?: string } },
): ActionResult => ({ ok: false, code, messageKey, ...extra });

/**
 * Temporary compatibility shape for non-Auth actions that are scheduled for
 * the Phase 11 domain-result migration. Phase 3 must not silently expand into
 * account/admin/inquiry result refactors, but those existing actions still
 * need to typecheck while Auth moves to the approved contract.
 */
export type LegacyActionResult<T = undefined> =
  | { ok: true; data?: T; message: string }
  | {
      ok: false;
      code: string;
      message: string;
      fieldErrors?: FieldErrors;
    };

export const idleLegacyActionResult: LegacyActionResult = {
  ok: false,
  code: "idle",
  message: "",
};
