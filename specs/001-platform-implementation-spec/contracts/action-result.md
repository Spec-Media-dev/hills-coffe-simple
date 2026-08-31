# Contract: Domain Result Shape

Applies to every server action and every server-side query result that
crosses into a client component, across all other contracts in this
directory. This is not a network API — it is the internal contract every
mutation and protected read must honor before returning to the UI layer.

## Shape

```text
ActionResult<T = undefined> =
  | { ok: true;  code: "OK"; data?: T; messageKey?: MessageKey }
  | { ok: false; code: DomainErrorCode; messageKey: MessageKey;
      fieldErrors?: Record<string, string[]>;
      conflict?: { requestCode?: string } }
```

## Domain error codes (closed set — do not add ad hoc codes)

| Code | Meaning | Typical trigger |
|---|---|---|
| `VALIDATION` | input failed schema validation | malformed form data |
| `AUTH_REQUIRED` | no session | anonymous hitting a protected action |
| `VERIFICATION_REQUIRED` | session exists, email unconfirmed | FR-004 |
| `ADMIN_PORTAL_REQUIRED` | admin credential used at customer sign-in | FR-008 |
| `FORBIDDEN` | authenticated but not authorized for this action | cross-user access attempt |
| `BLOCKED` | `is_blocked = true` | FR-014 |
| `NOT_FOUND` | target row does not exist / not visible to caller | deleted or foreign-owned record |
| `DUPLICATE_SAMPLE` | active sample already exists | unique-index violation on insert (FR-039) |
| `CONFLICT` | invalid state transition or concurrent write lost | rejected status transition (FR-041) |
| `RATE_LIMITED` | resend/signup throttled | FR-007 |
| `STORAGE_INVALID` | avatar/media upload failed client-side-checkable validation | wrong MIME/size before upload attempt |
| `STORAGE_FAILED` | avatar/media upload failed server-side | signature/decoding/storage write failure |
| `CONFIGURATION` | Supabase not configured | missing env in a given environment |
| `UNEXPECTED` | anything else | last-resort; must still carry a safe `messageKey`, never a raw error string |

## Rules

1. `messageKey` is always a key the UI resolves through the current locale's
   message catalog — never a pre-localized or raw string returned from the
   server (Constitution Principle XII).
2. A `DUPLICATE_SAMPLE` result MUST populate `conflict.requestCode` with the
   existing active request's code (FR-039).
3. `fieldErrors` keys MUST match the form field names exactly so the UI can
   attach the message to the correct input without additional mapping.
4. No action may throw an unhandled exception to the client boundary; every
   code path must resolve to one of the above shapes.
5. A raw Postgres/Supabase error (constraint name, policy name, stack trace)
   MUST NEVER appear in `messageKey`, `fieldErrors`, or anywhere else in the
   response — log it server-side with a correlation ID instead.
