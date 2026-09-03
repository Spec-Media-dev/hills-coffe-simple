# Feature Specification: Hills Coffee Platform Implementation Specification

**Feature Branch**: `main` (no dedicated branch created — no `before_specify` hook is configured for this project)

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Convert the approved Hills Coffee master rebuild plan and current Supabase database state into the formal Hills Coffee implementation specification, preserving all already-approved architecture, authentication, blocking, avatar, sample-lifecycle, Realtime, pricing, catalog, CMS/media, i18n, UX, SEO, security and QA decisions, without inventing new functionality or performing new discovery."

**Authoritative sources**: `docs/CODEX_HILLS_MASTER_REBUILD_PLAN.md`, `docs/HILLS_SUPABASE_CURRENT_STATE.md`, `.specify/memory/constitution.md`, and the existing approved Hills implementation/SEO/brand documents under `docs/` and `src/support/`. Where the current Supabase snapshot differs from older snapshots, the current snapshot governs. This specification documents already-approved product decisions; it does not perform new product discovery, does not redesign scope, and does not modify code or the database.

## Clarifications

### Session 2026-09-02

Scope: the Pre-Phase 12 Owner Alignment Addendum (see the dedicated section
near the end of this document) for public/anonymous RFQ and sample-request
submission. These answers resolve genuine ambiguity in the owner's brief; the
owner's explicit decisions themselves are recorded verbatim in that section
and were not treated as open questions.

- Q: What contact information should the public RFQ and sample-request forms require from an anonymous visitor? → A: Name/email/phone always (the database's real minimum — those three columns are `NOT NULL`); delivery address and country are required only for a `SAMPLE_REQUEST` (something has to ship), not for a `GENERAL` RFQ.
- Q: After an anonymous visitor submits an RFQ or sample request, how should Hills Coffee confirm it was received? → A: An on-screen confirmation showing the request code only. No automated confirmation email is sent; building a new transactional-email path is explicitly out of scope for this addendum.
- Q: What should prevent automated/bot spam through the new public forms, since they no longer sit behind a sign-in wall? → A: A honeypot field (matching the existing authenticated inquiry action's pattern) plus a server-side rate limit per source IP address and per normalized email address. No third-party CAPTCHA/challenge vendor is introduced.
- Q: Should the new public RFQ/sample-request capability live on dedicated new pages, or as sections/CTAs on the existing catalog and coffee-detail pages? → A: Reuse existing pages. Add a public "Request a sample" action to each coffee/offer detail page, extend the existing `/request-a-quote` page with a new anonymous branch for the GENERAL RFQ — the canonical RFQ route is `/request-a-quote`, and no parallel route is created — and treat Dubai-first positioning, "Source a Coffee", "Buy Available Lots", and "Trade With Hills" as copy/positioning on the existing Home, About, and Contact pages rather than new dedicated routes.

### Correction — 2026-09-03

An earlier pass of this addendum incorrectly listed "writing the new
repository migration that reconciles the already-applied database change" as
out of scope/deferred. The owner corrected this: authoring that migration
(FR-083) is a **required** implementation item of this addendum, not
deferred — the database delta itself is already owner-approved and already
live; what was missing was only the repository's own record of it. The
"Database baseline" subsection and the "Explicit out of scope" list below
were both corrected accordingly, and FR-083 was added. The three items that
remain genuinely deferred are unchanged: the confirmation-email integration,
a third-party CAPTCHA/Turnstile vendor, and any dedicated marketing page
beyond the approved copy/positioning sections and `/request-a-quote` itself.

### Correction — 2026-09-03 (routing)

A separate, earlier pass of this addendum proposed a new `/request-an-offer`
route for the `GENERAL` RFQ, reasoning that the existing `/request-a-quote`
page was too different in shape (authenticated-only, per-offer `PRODUCT`
inquiry) to extend. **The owner corrected this**: the SEO architecture
already defines `/request-a-quote/` as the canonical RFQ route, and no
parallel route may exist. "Request an Offer" is CTA/copy wording only and
links to `/request-a-quote`. The fix is to extend that page with a third,
anonymous branch (alongside its existing signed-in branches) rather than
build a second page. Q4's answer above, FR-069, FR-079, the content/journey
audit table, and the "Explicit out of scope" list below were all corrected
to reflect this; nothing else about the addendum's scope changed.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Customer Authentication, Verification & Authorization State Machine (Priority: P1)

A prospective buyer registers an account, verifies their email, and reaches a session state where the system knows exactly what they are allowed to do (anonymous, unverified, verified customer, blocked, or administrator) at every subsequent request — with no dependence on anything the browser or a client can claim about itself.

**Why this priority**: Every other capability (pricing, favorites, inquiries, account, admin) depends on this state machine being correct. Getting it wrong either locks out legitimate buyers or leaks protected capability, so it must be the first slice delivered and independently proven.

**Independent Test**: Can be fully tested by creating a new account, confirming it is unverified, confirming protected actions are refused, following the real verification link, confirming the same actions now succeed, and confirming an administrator credential used at the customer sign-in never receives customer capability.

**Acceptance Scenarios**:

1. **Given** a visitor with no session, **When** they submit valid sign-up details with or without the optional company name, **Then** an account is created in an unverified state, no role or administrator-signup field was requested, and the visitor is shown a neutral "check your email" state without any protected capability granted.
2. **Given** an unverified account, **When** the person attempts to view protected pricing, add a favorite, or submit a product/sample inquiry, **Then** every attempt is refused with a localized "verify your email" message and none of those actions leave a data trace.
3. **Given** an unverified account, **When** the person opens the real confirmation link, **Then** the system re-checks the actual confirmed-email state (not merely that a callback was reached) before granting any protected capability.
4. **Given** a confirmed, unblocked account with role USER, **When** they sign in, **Then** they land on their customer destination and protected actions succeed.
5. **Given** an administrator's credentials, **When** they are entered at the ordinary customer sign-in form, **Then** no customer session capability is granted, the customer-entry session is not retained, and the person is shown a localized message directing them to the dedicated Admin entry.
6. **Given** a customer requesting password recovery, **When** they submit their email, **Then** the response is identical whether or not the address has an account, and the password can only be changed from a link that produces a genuine recovery session.
7. **Given** an account whose `profiles.is_blocked` flag is true, **When** that person makes any request with a still-valid prior session token, **Then** every protected action is refused immediately, not merely at next login.

---

### User Story 2 - Customer Account, Avatar & Profile Management (Priority: P2)

A verified, unblocked customer manages their own identity: profile details, a personal avatar image, their favorites, and the history of everything they have asked Hills Coffee about.

**Why this priority**: This is the customer's home base once authenticated, and it is the first place customers notice missing or broken functionality (avatars, stale counts, unreachable request history) — but it depends entirely on Story 1's authorization state being correct first.

**Independent Test**: Can be fully tested by signing in as a verified unblocked customer, uploading and then removing an avatar image, editing profile fields, and confirming another customer's account, avatar, and request history remain completely inaccessible.

**Acceptance Scenarios**:

1. **Given** a verified unblocked customer with no avatar, **When** they view their account, **Then** a stable default avatar icon is shown, never a broken image or empty box.
2. **Given** a verified unblocked customer, **When** they upload a valid image, **Then** it becomes their avatar everywhere it is shown (header, account, and — where an administrator is permitted to view it — the admin user detail), and the previous avatar object is no longer retrievable.
3. **Given** a verified unblocked customer, **When** they attempt to upload a file that is not an accepted image type or exceeds the size limit, **Then** the upload is rejected server-side (not only by the browser) with a clear localized error and no partial state is left behind.
4. **Given** two different verified customers, **When** either attempts to read or modify the other's avatar, profile, favorites, or request history by any means, **Then** the attempt is refused.
5. **Given** a verified unblocked customer with saved favorites and past inquiries, **When** they view their account overview, **Then** they see accurate real counts and their own inquiry timeline with current status, and no fabricated business metric (revenue, shipping, fulfillment) appears anywhere.
6. **Given** a customer editing their profile, **When** they submit a change, **Then** they cannot edit their own role, blocked state, or block reason through any account form, and the change is confirmed with clear success or error feedback.

---

### User Story 3 - Admin Authentication, User Directory & Account Blocking (Priority: P3)

An authorized Hills Coffee staff member signs in through the dedicated administrator entry, and can find, inspect, and — for ordinary customer accounts only — block or unblock a user, with the change taking effect immediately for that customer.

**Why this priority**: Blocking is the primary trust-and-safety control for the whole platform and depends on both the authorization state machine (Story 1) and the existence of a distinct, non-public admin entry; it must exist before wider admin operations are meaningful.

**Independent Test**: Can be fully tested by signing in as an administrator at the dedicated admin entry, searching for a customer, viewing their profile and avatar, blocking them, confirming their active session immediately loses protected capability, then unblocking them and confirming a fresh sign-in restores capability.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor, **When** they open the dedicated Admin authentication entry, **Then** they see a localized administrator sign-in form that shares no public site navigation shell.
2. **Given** a customer's credentials, **When** they are entered at the Admin authentication entry, **Then** no administrator session is granted and a localized denial message is shown.
3. **Given** an authenticated administrator, **When** they search the user directory, **Then** they can find a customer account and view its name, contact details, verification state, avatar, and current blocked state, but never a password or unsafe editable role control.
4. **Given** an authenticated administrator viewing a customer account, **When** they block it, **Then** the reason is optional and stored internally only, the action is attributed and timestamped, and the customer's next request anywhere in the product is denied protected capability even if their session token is still technically valid.
5. **Given** an authenticated administrator, **When** they attempt to block their own account or another administrator account through the standard Users tool, **Then** the action is refused.
6. **Given** a previously blocked customer, **When** an administrator unblocks them, **Then** the customer must sign in again to regain access — unblocking does not itself create a new customer session.

---

### User Story 4 - Protected Catalog Discovery & Wholesale Pricing (Priority: P4)

Any visitor can browse the green-coffee catalog, origins, and knowledge content in their language; only a verified, unblocked customer ever sees wholesale pricing, and browsing performs efficiently regardless of catalog size.

**Why this priority**: Discovery is the top of the funnel and the platform's core value proposition, and price confidentiality is a non-negotiable trust boundary — but both depend on the authorization state machine already being correct.

**Independent Test**: Can be fully tested by filtering and paginating the public catalog as an anonymous visitor and confirming no price appears anywhere in the page, then repeating as a verified unblocked customer and confirming price appears only in the authenticated view.

**Acceptance Scenarios**:

1. **Given** an anonymous or unverified visitor, **When** they view any catalog, coffee detail, or origin page, **Then** no wholesale price value appears in the visible page, page source, structured data, metadata, or any cached version of that page.
2. **Given** a verified unblocked customer, **When** they view an available coffee's offer, **Then** the applicable wholesale price tier is shown only to them, fetched through a path separate from the public page data.
3. **Given** an administrator session, **When** they browse the public catalog as a shopper would, **Then** they do not receive customer wholesale pricing through that public browsing path — administrator pricing management is a distinct, separate capability.
4. **Given** any visitor applying search, origin, region, type, process, certification, or warehouse filters, **Then** results are returned from the database with pagination and an accurate total count, without loading the entire catalog into the page to filter it there.
5. **Given** a visitor selecting a region filter, **When** no origin is selected or the region does not belong to the selected origin, **Then** the region option set updates to remain consistent with the origin dependency.
6. **Given** an empty or partially populated catalog, **When** a visitor browses it, **Then** they see an honest, well-designed empty state — never a fabricated coffee, origin, or price.

---

### User Story 5 - Product & Sample Inquiry Lifecycle (Priority: P5)

A verified, unblocked customer contacts Hills Coffee about a specific coffee or requests a physical sample; Hills Coffee staff manually track and progress that request to completion, and the customer can see its status at every step.

**Why this priority**: This is the primary conversion action once a customer finds a coffee they want, and its correctness (especially the one-active-sample-per-coffee rule) protects both the customer experience and Admin's manual workload — but it depends on authentication (Story 1), catalog data (Story 4), and is best proven once an Admin workspace (Story 3) exists to act on it.

**Independent Test**: Can be fully tested by submitting a sample request for one coffee as a verified customer, confirming a second sample request for the same coffee through a different warehouse offer is blocked and returns the existing request code, closing the request as Admin, confirming a new request for that same coffee is then allowed, and confirming the customer's timeline reflects every status change.

**Acceptance Scenarios**:

1. **Given** a verified unblocked customer with complete phone, delivery address, and country on file, **When** they request a sample for a specific coffee through a valid, visible offer, **Then** a `SAMPLE_REQUEST` record is created with no quantity field and no shipment, reservation, or fulfillment side effect.
2. **Given** that same customer, **When** they request a sample for the same coffee again while any active-state request exists (including after switching to a different warehouse's offer for that coffee), **Then** the new request is rejected and the customer is shown their existing request code and a clear "already active" message.
3. **Given** that same customer, **When** they request a sample for a genuinely different coffee, **Then** the request succeeds independently of the first.
4. **Given** a verified unblocked customer missing phone, address, or country, **When** they attempt a sample or product inquiry, **Then** they are told precisely which profile field is missing before any inquiry is created.
5. **Given** an administrator reviewing a lead, **When** they advance its status, **Then** only the approved next statuses for that inquiry's type are offered, an attempted invalid or backward transition is rejected without changing any data, and every successful change is recorded in that request's visible history.
6. **Given** a `SAMPLE_REQUEST` that reaches `CLOSED`, **When** the same customer requests a sample for that same coffee again, **Then** a new request is accepted for manual review, and Admin can see the customer's prior request(s) for that same coffee alongside the new one.
7. **Given** an inquiry of type other than `SAMPLE_REQUEST`, **When** any attempt is made to move it into a sample-delivery-specific status, **Then** the attempt is rejected.

---

### User Story 6 - Admin Operations Workspace (Priority: P6)

Authorized staff manage the catalog, origins/regions/warehouses, taxonomy, articles, CMS pages, media, the project logo, and site settings from one coherent, localized workspace, with every change validated, authorized, and confirmed.

**Why this priority**: This is the operational backbone that keeps the public catalog and content accurate over time, but it is meaningful only once admin authentication/blocking (Story 3) exists and is lower urgency than the customer-facing trust boundaries above.

**Independent Test**: Can be fully tested by signing in as an administrator, creating or editing a coffee/offer/price tier, publishing a CMS section, changing the project logo through the existing site-settings relation, and confirming every action produces clear success/failure feedback and an audit trail where applicable.

**Acceptance Scenarios**:

1. **Given** an authenticated administrator, **When** they view the workspace navigation, **Then** it is grouped logically (overview, leads, catalog, origins/logistics, taxonomy, editorial, people, system) and fully localized in both languages.
2. **Given** an administrator creating or editing a coffee, offer, or price tier, **When** they submit invalid or conflicting data, **Then** they see a specific, localized, actionable error and no partial write occurs.
3. **Given** an administrator selecting the project logo, **When** they choose an active, valid image from the media library, **Then** the header, footer, auth pages, and admin shell all reflect the new logo, and if the reference is later removed the platform falls back to the existing official static logo rather than showing nothing.
4. **Given** an administrator managing origins and regions, **When** they attempt to assign a region to a coffee under an origin that region does not belong to, **Then** the assignment is rejected.
5. **Given** an administrator archiving a media item, **When** that item is still referenced by an active coffee, origin, article, or the site logo, **Then** they are warned about the reference before the archive proceeds.
6. **Given** an administrator viewing the audit log, **When** they inspect an entry, **Then** they can see what changed, who made the change, and when — and this log is never reachable by a non-administrator.

---

### User Story 7 - Bilingual, Accessible, Themed, SEO-Correct Public Experience (Priority: P7)

Every public, account, and admin surface behaves identically in substance across English (unprefixed URLs) and Arabic (`/ar`-prefixed URLs), in both light and dark themes, at all supported screen sizes, meets accessibility expectations, and is correctly indexable without ever exposing private routes or protected data to search engines.

**Why this priority**: This is a cross-cutting quality bar that applies to everything above rather than a standalone feature; it is prioritized last only because it is validated most efficiently once the underlying flows exist, not because it is optional.

**Independent Test**: Can be fully tested by exercising the same journey (e.g., browse catalog, sign in, view account) in English, then in Arabic, confirming identical functionality, correct `lang`/direction, correct canonical/hreflang tags, and no console or hydration error during repeated locale switching.

**Acceptance Scenarios**:

1. **Given** any public, auth, or account page, **When** it is viewed in Arabic, **Then** every capability, field, and message available in English is present and correctly translated, with logical (start/end, not left/right) layout direction.
2. **Given** a visitor switching language on any page, **When** the switch completes, **Then** the equivalent path, query parameters, and record identifiers are preserved, and no framework console warning, hydration error, or broken structured-data script appears.
3. **Given** any page in the private route set (account, admin, admin authentication entry, auth utility pages), **When** a search engine or automated crawler requests it, **Then** it is marked non-indexable and does not appear in the sitemap.
4. **Given** any indexable public page, **When** it is crawled, **Then** it emits a valid self-canonical URL, reciprocal English/Arabic alternates, and structured data that never includes a protected price.
5. **Given** a keyboard-only or screen-reader user, **When** they operate the primary navigation menu, a modal dialog (such as sign-out confirmation or a sample-request form), or the mobile drawer, **Then** focus is trapped and restored correctly, all essential controls meet the 44×44px minimum target, and no status is communicated by color alone.
6. **Given** a user with reduced-motion preference enabled, **When** they navigate the site, **Then** all content remains fully visible and reachable with translation/scale/parallax motion removed, without any functional loss.

---

### Edge Cases

- What happens when a customer's confirmation link is expired, already used, or the wrong purpose (recovery link used as a signup confirmation, or vice versa)? The system must show a safe, localized "link no longer valid" state and offer a way to request a new one, without granting any protected capability.
- What happens if a customer never confirms their email within the three-minute guided waiting window? The waiting UI must return to a safe entry state without automatically deleting the underlying account and without implying the token itself expired.
- What happens if two sample requests for the same customer and coffee are submitted at nearly the same instant from two different sessions? The system must guarantee only one active request survives and the other receives the duplicate outcome with the surviving request's code.
- What happens when an administrator tries to block another administrator, or themselves, from the standard Users tool? The action must be refused with a clear reason.
- What happens when a blocked customer's browser still holds a valid prior session token and they navigate to a protected page or call a protected action directly, or bypass the application entirely with a direct database or storage call? Access must be denied at that moment — at the database/storage layer itself, not only by the application UI — and not only after a fresh sign-in.
- What happens when a customer attempts to view or act on another customer's avatar, favorites, or request history by guessing or reusing an identifier? Access must be denied regardless of how the identifier was obtained.
- What happens when catalog, origin, or knowledge data is empty or partially populated? The public pages must show an honest empty or partial state rather than any fabricated content, price, or statistic.
- What happens when a customer requests a product/sample inquiry but their profile is missing required contact information? The system must identify exactly which field is missing before creating any inquiry record.
- What happens when an inquiry status transition is attempted out of the approved sequence (e.g., skipping ahead, or moving backward, or moving a non-sample inquiry into a sample-delivery status)? The transition must be rejected, no data changed, and no duplicate history entry written.
- What happens when the referenced project logo media item is archived or deleted while still set as the active site logo? The public and admin surfaces must fall back to the existing official static logo, never a broken image.
- What happens when a filter combination in the catalog does not correspond to an approved landing page? The page must remain reachable but marked non-indexable and canonicalized to the unfiltered collection, never treated as a security boundary substitute.
- What happens when the production canonical hostname is not yet configured? The system must fail clearly during production startup rather than silently publishing an incorrect host.
- What happens when an anonymous visitor submits a `GENERAL` RFQ or `SAMPLE_REQUEST` using an email address that also belongs to a registered, verified customer account? The submission must still be accepted anonymously — no login is required or inferred — and must not be merged into that customer's account or request history, and must not be usable to bypass the authenticated (`user_id` + coffee) duplicate rule that account is separately subject to if that same person later signs in and submits again.
- What happens when the same anonymous visitor attempts a second `SAMPLE_REQUEST` for the same coffee within the rate-limit window? The attempt must be rejected by the rate limit before the duplicate-identity check is reached, with a generic "try again shortly" message that does not reveal whether a prior request exists.
- What happens when a public `SAMPLE_REQUEST`'s coffee or offer becomes unavailable (unpublished, archived, or its offer no longer visible) between page load and submission? The server must re-validate the offer at submission time, exactly as the authenticated path already does, and reject the request rather than create one against a stale coffee or offer.
- What happens when the honeypot field on either public form is filled in? The submission must be silently rejected without revealing that a honeypot check exists, and must not create any inquiry record.

## Requirements _(mandatory)_

### Functional Requirements — Authentication & Authorization

- **FR-001**: The system MUST recognize exactly these viewer states and evaluate every protected page, action, and data query against the current state on every request: anonymous, signup-pending, unverified, verification-waiting, verified-transitional, authenticated customer (role USER, confirmed, unblocked), authenticated administrator (role ADMIN, confirmed, unblocked), password-recovery, blocked, and signed-out.
- **FR-002**: Public sign-up MUST require full name, email, phone, password, and password confirmation; MAY collect an optional company name; MUST NOT expose a role selector or administrator-signup path; and MUST always create a customer (role USER) account. When supplied, the optional company name MUST be persisted to the customer's profile without affecting authorization.
- **FR-003**: The system MUST return an identical, neutral response to sign-up and password-recovery requests regardless of whether the email address already has an account, so account existence is never revealed.
- **FR-004**: The system MUST NOT grant any protected capability (pricing, favorites, inquiry submission, account access) to a session whose email is not confirmed, regardless of how the request was made.
- **FR-005**: After any authentication callback (email confirmation or password recovery), the system MUST re-check the actual resulting account state (confirmed-email status, and for recovery, a genuine recovery session) before proceeding — reaching the callback URL is never sufficient by itself.
- **FR-006**: The system MUST present a guided, non-authoritative waiting period (approximately three minutes) after signup during which the customer is told their account is registered but not yet verified; this waiting period MUST NOT be treated as, or substituted for, the actual verification-link expiry, and the underlying account MUST NOT be automatically deleted when the waiting period ends.
- **FR-007**: Resending a verification email MUST be rate-limited by the server (not only by client-side countdown display) and MUST return a generic success/failure result that does not reveal account existence.
- **FR-008**: Administrator credentials submitted at the ordinary customer sign-in MUST NOT result in any customer-side session capability; the person MUST be shown a localized message directing them to the dedicated administrator entry.
- **FR-009**: Customer credentials submitted at the dedicated administrator entry MUST NOT result in any administrator capability and MUST produce a localized denial.
- **FR-010**: The dedicated administrator authentication entry MUST NOT expose any self-service administrator registration path.
- **FR-011**: Application and page-level authorization decisions MUST be based solely on the authoritative server-verified role and profile state; client-supplied claims or editable user metadata MUST NEVER be treated as authoritative for role or authorization.
- **FR-012**: A password-reset form MUST refuse to operate outside a genuine, server-verified recovery session, regardless of whether an ordinary logged-in session exists.
- **FR-013**: On successful password update, the system MUST invalidate the recovery-specific session context and return the person to sign-in with a localized success message.
- **FR-014**: A blocked customer account (`is_blocked = true`) MUST be denied every protected capability at the moment of the next request, even when a previously issued session token remains technically valid, and MUST be shown a generic, localized "account access restricted" message without revealing the internal block reason.
- **FR-015**: The system MUST NOT allow a customer to change their own role or blocked state through any customer-facing form or action.

### Functional Requirements — Account & Avatar

- **FR-016**: A verified, unblocked customer MUST be able to view an account overview showing their real favorites count, real active-sample count, and recent request activity, with no fabricated business metric.
- **FR-017**: A verified, unblocked customer MUST be able to edit their own profile fields (full name, phone, company, delivery address, country) with field-level validation and clear success/failure feedback.
- **FR-018**: A verified, unblocked customer MUST be able to upload, replace, and remove a personal avatar image; an account with no avatar MUST display a stable default icon rather than a broken image.
- **FR-019**: Avatar uploads MUST be validated server-side for accepted image type and maximum size regardless of what the browser reports, and a rejected upload MUST leave no partial state.
- **FR-020**: A customer's avatar and profile data MUST be readable and writable only by that customer, with the sole exception that an authenticated administrator MAY view (never edit) a customer's avatar as part of the administrator's user-directory tooling.
- **FR-021**: A verified, unblocked customer MUST be able to view a list and detail of their own past product/sample inquiries, including an immutable chronological status history, and MUST NOT be able to view another customer's inquiries by any means.
- **FR-022**: Customer avatars MUST be modeled, stored, and administered independently of business/catalog media and of the project logo — they MUST NOT share storage location, path convention, or mutation actions with those domains.

### Functional Requirements — Administrator Access & Blocking

- **FR-023**: The system MUST provide exactly one dedicated, canonical administrator authentication entry point (localized for both supported languages) that does not share the public marketing site's navigation shell.
- **FR-024**: Every administrator-only page, action, and data query MUST independently re-verify administrator role and unblocked state at the point of execution; a shared navigation guard alone is not sufficient.
- **FR-025**: An administrator MUST be able to search and view a directory of customer accounts, including name, contact details, verification state, avatar, and current blocked state, without exposing a password or an unrestricted role-editing control.
- **FR-026**: An administrator MUST be able to block and unblock a customer (role USER) account, optionally recording an internal-only reason, with the action attributed to the acting administrator and time-stamped.
- **FR-027**: The system MUST refuse an attempt, through the standard Users tool, for an administrator to block their own account or another administrator account.
- **FR-028**: Unblocking a customer MUST NOT itself create a new session for that customer; the customer MUST sign in again to regain access.
- **FR-029**: Blocking a customer MUST take effect for that customer's very next request across every protected surface (pages, actions, data reads/writes) without requiring a fresh deployment or cache clear.

### Functional Requirements — Catalog, Origins & Protected Pricing

- **FR-030**: Public catalog, coffee detail, and origin pages MUST be reachable and correctly rendered by anonymous visitors, and MUST NEVER include a protected wholesale price value in the visible page, page source, metadata, structured data, or any cached representation.
- **FR-031**: Wholesale price data MUST be retrievable only through a path that independently verifies the requester is an authenticated, confirmed, unblocked customer (role USER) — an authenticated administrator session MUST NOT receive customer wholesale pricing through the public catalog browsing path.
- **FR-032**: Catalog search and filtering (by text, origin, region, coffee type, process, certification, sensory attribute, warehouse, and availability) MUST be evaluated by the data layer with server-side pagination and an accurate total result count; the system MUST NOT load the full catalog into the page for in-memory filtering.
- **FR-033**: The available region filter options MUST depend on the selected origin, and an invalid origin/region combination MUST NOT be assignable.
- **FR-034**: When catalog, origin, or article data is empty or incomplete, the public pages MUST present a deliberate, honest empty or partial state and MUST NOT substitute fabricated coffees, prices, statistics, or business claims.
- **FR-035**: Origin and region administration MUST prevent assigning a region to a coffee under an origin the region does not belong to.

### Functional Requirements — Inquiries & Sample Lifecycle

- **FR-036**: Creating a product or sample inquiry MUST require an authenticated, confirmed, unblocked customer (role USER) with complete phone, delivery address, and country on file; a missing field MUST be identified to the customer before any inquiry record is created.
- **FR-037**: A sample inquiry MUST resolve its associated coffee from a valid, visible, trusted offer on the server side; it MUST NOT accept a quantity value and MUST NOT create any shipment, inventory reservation, or automatic fulfillment side effect.
- **FR-038**: The system MUST treat a customer's active sample-request eligibility as unique per (customer, coffee) pair regardless of which warehouse offer for that coffee is used — switching offers for the same coffee MUST NOT bypass the one-active-request rule.
- **FR-039**: The active sample-request states are exactly: submitted, received, contacted, sample sent, and delivered; a request in any of these states MUST block a new sample request for the same customer and coffee and MUST return the existing request's code and a clear "already active" message.
- **FR-040**: Once a sample request reaches its closed state, the same customer MUST be able to submit a new sample request for that same coffee, and an administrator reviewing it MUST be able to see the customer's prior request(s) for that same coffee.
- **FR-041**: Inquiry status changes MUST follow an approved transition sequence per inquiry type; an attempted invalid, backward, or out-of-type transition (for example, moving a non-sample inquiry into a sample-delivery-specific status) MUST be rejected without altering any data.
- **FR-042**: Every successful inquiry status change MUST produce exactly one corresponding, immutable history entry visible to both the owning customer and administrators.
- **FR-043**: "Sample delivered" MUST represent an administrator's recorded confirmation of physical sample delivery, not an automated or customer-asserted state.

### Functional Requirements — Admin Operations, CMS & Media

- **FR-044**: The administrator workspace MUST present one coherent, logically grouped, fully localized navigation covering overview, leads, catalog, origins/logistics, taxonomy, editorial (articles/CMS/media), people, and system settings.
- **FR-045**: Every administrator create/update/archive action MUST validate input, re-verify administrator authorization, and return a clear, localized success or failure result; a failed action MUST NOT leave a partial write.
- **FR-046**: Dashboard metrics shown to administrators MUST be computed from real current data (published coffees, visible offers, active leads, content state, recent activity); the system MUST NOT display invented or placeholder business metrics.
- **FR-047**: The project logo MUST be selected from the existing site-settings-to-media relation; if the referenced media item becomes unavailable, every surface that displays the logo (public header/footer, auth pages, admin shell) MUST fall back to the existing official static logo rather than showing a missing image.
- **FR-048**: Archiving or deleting a media item that is still referenced by an active coffee, origin, article, CMS section, or the site logo MUST warn the administrator of that reference before the action proceeds.
- **FR-049**: CMS page sections MUST be rendered only through a defined, validated set of section types; an unknown or invalid section MUST fail safely in the administrator preview and MUST NOT crash a public page.
- **FR-050**: All privileged administrator mutations (block/unblock, catalog/content changes, settings changes) MUST be recorded in an audit trail that is readable only by administrators and MUST NOT expose sensitive values such as passwords or full block reasons where policy restricts them.
- **FR-051**: Administrator personal profile settings, site-wide settings, and administrator account credentials MUST be three independently submittable areas, such that a failure in one cannot discard changes in another.

### Functional Requirements — Localization, Theming, Accessibility & Responsiveness

- **FR-052**: Every public, authentication, account, and administrator-facing capability, field, and message MUST be available in both English and Arabic with equivalent functionality; there MUST be zero features present in one language and missing in the other.
- **FR-053**: English routes MUST remain unprefixed and Arabic routes MUST be served under an `/ar` prefix, with locale switching preserving the equivalent path, query parameters, and record identifiers.
- **FR-054**: There MUST be exactly one canonical administrator implementation; no second, parallel administrator source or entry point may exist for either language.
- **FR-055**: Document language and reading direction MUST be set correctly for the active locale on every page, and layout MUST use logical (start/end) direction rather than hardcoded left/right assumptions.
- **FR-056**: The system MUST support light and dark themes across every surface without inverting or otherwise distorting official brand imagery or the project logo.
- **FR-057**: Every core journey (discovery, authentication, account, inquiry submission, administrator operations) MUST remain fully usable at the supported range of screen widths from small mobile through large desktop, including short-height desktop viewports for the administrator workspace.
- **FR-058**: Primary navigation menus, modal dialogs (including sign-out confirmation and inquiry forms), and mobile drawers MUST implement correct focus management (trap, restore, escape-to-close) and every essential interactive control MUST meet a minimum 44×44px touch target.
- **FR-059**: The system MUST honor a reduced-motion preference by removing translation, scale, parallax, and auto-advancing motion while preserving full functional access to the same content.
- **FR-060**: The system MUST NOT expose any raw backend, database, or infrastructure error message to an end user under any circumstance; all user-facing errors MUST be safe, localized, and actionable.

### Functional Requirements — SEO & Discoverability

- **FR-061**: Every indexable public page MUST emit a correct self-referential canonical URL and reciprocal English/Arabic alternate links.
- **FR-062**: Account pages, the administrator workspace, the dedicated administrator authentication entry, and authentication utility pages MUST be marked non-indexable and MUST be excluded from the sitemap.
- **FR-063**: Arbitrary catalog filter combinations that are not approved landing pages MUST be marked non-indexable and canonicalized to the unfiltered collection; indexability controls MUST NOT be relied upon as a substitute for an actual access-control boundary.
- **FR-064**: Structured data (Organization, WebSite, breadcrumb, article, and product identity schema) MUST reflect only real, currently published data and MUST NEVER include a protected price value.
- **FR-065**: A request for a page or entity that does not exist or is not published MUST return a genuine not-found response; the system MUST NOT return a soft "success" response for missing content.
- **FR-066**: Locale switching between English and Arabic, repeated back and forth across public, authentication, account, and administrator surfaces, MUST produce no console error, hydration warning, or malformed/duplicated structured-data output.

### Functional Requirements — Blocked-User Database & Storage Enforcement

- **FR-067**: The database and storage layer MUST independently deny a blocked customer's routine self-service mutations even when the customer holds a technically valid session, with no dependence on the application layer catching the attempt first: a blocked customer's normal profile self-update path MUST be denied, and all of upload, replace, delete, and read of their own avatar through the normal owner-scoped storage policy MUST be denied.
- **FR-068**: Closing the gap in FR-067 MUST NOT reduce Administrator or service-role access to the same resources, and MUST NOT create any path — direct or indirect — by which a blocked customer can change their own blocked state or otherwise restore their own access.

### Functional Requirements — Pre-Phase 12 Owner Alignment Addendum (Public RFQ & Anonymous Sample Requests)

These requirements extend, and do not replace, FR-036 through FR-043. They
belong to the Pre-Phase 12 Owner Alignment Addendum described in full near the
end of this document.

- **FR-069**: Anonymous/public visitors MUST be able to submit exactly two new unauthenticated request types — a `GENERAL` sourcing RFQ ("Request an Offer") not tied to any specific coffee, and a `SAMPLE_REQUEST` tied to a specific coffee via a valid, visible offer — using the existing `inquiries` table and existing `inquiry_type`/`inquiry_status` enum values; no new table, column, or enum is introduced.
- **FR-070**: A public `GENERAL` RFQ submission MUST require full name, email, and phone; it MUST NOT require delivery address or country.
- **FR-071**: A public `SAMPLE_REQUEST` submission MUST require full name, email, phone, delivery address, and country, in addition to the coffee it is requested for, which MUST be resolved server-side from a valid, visible, trusted offer — the same server-side resolution guarantee FR-037 already requires for the authenticated sample-request path.
- **FR-072**: A public `GENERAL` or `SAMPLE_REQUEST` submission MUST NOT require or create a `user_id` or an account, and MUST NOT itself grant the submitter account access, favorites capability, or protected-pricing visibility.
- **FR-073**: A public `SAMPLE_REQUEST` MUST be evaluated for duplicate-identity using the normalized (lower-cased, trimmed) email address plus coffee, independent of any customer account. This anonymous identity key and the existing authenticated identity key (`user_id` plus coffee, FR-038) are evaluated independently and MUST NOT be merged or cross-checked against each other.
- **FR-074**: The active states that block a new anonymous `SAMPLE_REQUEST` for the same normalized-email-and-coffee identity are exactly `NEW`, `RECEIVED`, `CONTACTED`, `SAMPLE_SENT`, and `DELIVERED`; once that identity's request reaches `CLOSED`, a new `SAMPLE_REQUEST` for the same normalized email and coffee MUST be accepted — mirroring FR-040's guarantee for authenticated customers.
- **FR-075**: A public `GENERAL` RFQ MUST NOT be subject to any duplicate-identity rule, since it is not tied to a specific coffee; repeated `GENERAL` submissions from the same visitor MUST be accepted for manual review.
- **FR-076**: The existing authenticated sample-request duplicate rule (`user_id` plus coffee, FR-038) MUST remain unchanged. A signed-in verified customer MUST continue to submit sample requests through the existing authenticated path, not the new public one, so the two rules never need to interact for the same request.
- **FR-077**: After a public `GENERAL` or `SAMPLE_REQUEST` submission succeeds, the system MUST show the visitor an on-screen confirmation containing their request code. The system MUST NOT send an automated confirmation email as part of this addendum.
- **FR-078**: Both public forms MUST include a non-visible honeypot field, matching the existing authenticated inquiry action's pattern, and MUST be rate-limited server-side per source IP address and per normalized email address. A submission that fails either check MUST be rejected without revealing which check failed, using the same closed, localized error vocabulary FR-060 already requires.
- **FR-079**: The public coffee/offer detail pages MUST expose a "Request a sample" action reachable by anonymous visitors, in addition to the existing authenticated one already available to verified customers. The `GENERAL` RFQ ("Request an Offer") MUST be served from the existing `/request-a-quote` route — extended with a new anonymous branch alongside its existing signed-in branches — and MUST NOT be served from any additional, parallel route. Dubai-first positioning, "Source a Coffee," "Buy Available Lots," and "Trade With Hills" content MUST be delivered as copy/positioning sections on the existing Home, About, and Contact pages rather than as additional dedicated routes.
- **FR-080**: Administrator Lead Inbox tooling MUST display an anonymously submitted `GENERAL` or `SAMPLE_REQUEST` inquiry using the same fields, filters, and status-transition controls already used for authenticated inquiries — the existing `full_name`/`email`/`phone`/`company_name` snapshot columns on the `inquiries` row are already independent of `user_id`. No separate anonymous-lead view is introduced.
- **FR-081**: The write path for an anonymous submission MUST NOT rely on a direct anonymous-role table `INSERT`, which Row Level Security correctly continues to block; it MUST go through a trusted server-side path (matching the pattern the authenticated inquiry action already uses), so this addendum never requires loosening RLS to permit a direct anonymous client write.
- **FR-082**: This addendum MUST NOT introduce a shopping cart, checkout, payment step, seller-onboarding flow, custody workflow, or any other real marketplace/trading mechanic on the public site, consistent with Constitution Principle I. "Buy Available Lots" and "Trade With Hills" content MUST read as sourcing/positioning language, never as transactable commerce.
- **FR-083**: A single new repository migration file, added under `specs/001-platform-implementation-spec/migrations/` and never editing an existing migration file, MUST reconcile the versioned migration history with the database delta already applied and verified live: the `inquiries_product_needs_user` check constraint permitting a NULL `user_id` for `GENERAL` and `SAMPLE_REQUEST` (still required for `PRODUCT`), and the new `uq_inquiries_active_sample_anon_email_coffee` partial unique index on `lower(btrim(email))` plus `coffee_id` for anonymous active `SAMPLE_REQUEST` rows. The migration MUST preserve `uq_inquiries_active_sample_user_coffee` unchanged, MUST NOT add any table, column, enum, or status-transition function change, and MUST be written so it applies safely both to the current database (where the delta already exists) and to a clean database applying the full migration sequence from scratch. Any generated database/schema snapshot affected by this reconciliation MUST be regenerated, never hand-edited. Authoring and applying this migration is a required implementation item of this addendum, not a deferred one — the owner has already approved and applied the delta itself; what remains is the repository's own record of it.

### Key Entities _(include if feature involves data)_

- **Customer/Administrator Profile**: Represents a person's application-level identity — name, contact details, role (customer or administrator), verification-relevant state, blocked state and its audit trail (when/by whom/optional internal reason), and a reference to an optional personal avatar image. Distinct from the underlying authentication credential record.
- **Avatar Image**: A private, owner-scoped image associated with exactly one profile; independent of business/catalog media and of the project brand logo.
- **Coffee / Offer / Price Tier**: A coffee identity (with translations, taxonomy, media) offered from a specific warehouse with visibility/status; a price tier is the protected wholesale value attached to an offer, visible only under the protected-pricing policy.
- **Origin / Region**: A country-level sourcing origin and its dependent geographic regions; a region belongs to exactly one origin, and coffees/offers relate to these through the origin's structure.
- **Inquiry (General / Product / Sample Request)**: A request tied to a specific coffee where applicable (and, for context, the offer it was raised from), with a type, a current status drawn from an approved progression, a timestamped and attributed status-change history, and contact details captured at submission time. Never carries a quantity value and never itself represents a shipment or fulfillment record. A `PRODUCT` inquiry always belongs to an authenticated verified customer (`user_id` set); a `GENERAL` or `SAMPLE_REQUEST` inquiry MAY instead be submitted anonymously (`user_id` NULL), per the Pre-Phase 12 Owner Alignment Addendum below — in that case duplicate-identity for `SAMPLE_REQUEST` is the normalized email plus coffee rather than customer plus coffee.
- **Favorite**: A customer's saved association with a specific coffee, owned exclusively by that customer.
- **Media Item / Site Settings**: A managed image asset (business/editorial, CMS, or brand) with translation/alt text and reference tracking; site settings hold the organization's public-facing configuration including which media item is the active project logo.
- **Audit Log Entry**: An administrator-readable record of a privileged action — what changed, who performed it, and when — used for accountability and never exposed to non-administrators.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across a full test pass covering anonymous, unverified, verified customer, blocked customer, and administrator personas, 100% of protected-capability checks (pricing, favorites, inquiries, account, administrator functions) match the approved authorization state machine, with zero unauthorized access or unauthorized price exposure observed.
- **SC-002**: A newly registered customer can complete sign-up, understand from the interface that they are registered but not yet verified, and — after confirming email through the real verification link — reach protected pricing, with no step requiring more than what is described in the approved flow.
- **SC-003**: 100% of user-facing capabilities, fields, and messages exist in both English and Arabic; an automated parity check reports zero missing or empty translation keys.
- **SC-004**: A customer who is blocked while holding an active session loses every protected capability on their very next request, verified across pricing access, favorites, inquiry submission, profile self-update, and avatar upload/replace/delete/read — including when the database or storage layer is called directly rather than through the application UI.
- **SC-005**: Attempting to create a second active sample request for the same customer and coffee — including through a different warehouse offer — is rejected 100% of the time while any prior request remains active, and the customer is always shown the existing request's code.
- **SC-006**: Catalog browsing with any supported filter combination returns a bounded, paginated result set directly from the data layer, with response composition that does not scale with total catalog size the way a full in-memory scan would.
- **SC-007**: Core public, authentication, account, and administrator journeys pass an automated accessibility check with zero critical/serious violations, and manual keyboard-only completion is possible for menu, dialog, and form interactions, with no essential control below 44×44px.
- **SC-008**: A scan of all public page HTML, structured data, metadata, and sitemap output finds zero occurrences of a protected wholesale price value outside an authenticated customer session.
- **SC-009**: An administrator can locate a specific customer account and complete a block or unblock action, with the resulting access change observable on that customer's very next request, without any deployment or manual cache action.
- **SC-010**: Repeated English-to-Arabic-to-English navigation across every major surface (public, auth, account, admin) produces zero console errors, zero hydration warnings, and zero malformed structured-data output.
- **SC-011**: Every indexable public page carries a valid canonical URL and reciprocal English/Arabic alternate tags; private and administrator-only routes are absent from the sitemap and marked non-indexable in 100% of sampled pages.
- **SC-012**: An anonymous visitor can submit a `GENERAL` RFQ providing only name, email, and phone, and a `SAMPLE_REQUEST` for a specific coffee providing name, email, phone, delivery address, and country — in both cases without creating an account or session — and receives an on-screen confirmation containing a request code.
- **SC-013**: A second anonymous `SAMPLE_REQUEST` for the same normalized email and coffee is rejected 100% of the time while any prior anonymous request for that email/coffee pair is in an active state (`NEW`, `RECEIVED`, `CONTACTED`, `SAMPLE_SENT`, `DELIVERED`), and is accepted once that prior request reaches `CLOSED` — mirroring SC-005's guarantee for authenticated customers.
- **SC-014**: Zero protected wholesale price value, account-only capability (favorites, protected pricing, private inventory), or marketplace/checkout mechanic (cart, payment, seller onboarding) is reachable by an anonymous visitor through the new public RFQ or sample-request journeys, verified in both languages.
- **SC-015**: A scan of the new public forms confirms a honeypot field is present on each, a server-side rate limit rejects rapid repeated submissions from the same source, and zero raw backend/database error is exposed on any rejection path — extending FR-060's guarantee to these new anonymous surfaces.

## Assumptions

- The current Supabase database snapshot (`docs/HILLS_SUPABASE_CURRENT_STATE.md`) already reflects the approved rebuild decisions this specification documents: `profiles.avatar_path`, `profiles.is_blocked`/`blocked_at`/`blocked_by`/`block_reason`, the private `avatars` storage bucket, the `SAMPLE_SENT`/`DELIVERED` inquiry statuses with their transition guard, the partial unique active-sample index keyed on customer and coffee, and a Realtime publication that excludes `offer_price_tiers` and `audit_logs`. This specification describes the application behavior that must be built and verified against that already-migrated state; it does not itself request any further schema change.
- `is_blocked` on `public.profiles` is the durable, authoritative application-blocking signal; any additional authentication-provider-level ban is defense-in-depth applied by secure server-side administrator logic and is never the sole enforcement point.
- The administrator Users tool blocks and unblocks customer (role USER) accounts only; blocking an administrator account, or an administrator blocking themselves, is out of scope for that standard tool.
- `/sign-in` is the customer authentication entry and `/dashboard-admin` is the dedicated administrator authentication entry; these remain two distinct entry points with cross-role redirection to a localized explanation rather than silent failure or silent capability grant.
- The three-minute post-signup waiting period is a guided user-experience convention only; it has no bearing on the actual verification-link/token expiry, and an unverified account is never automatically deleted because that window elapsed.
- `site_settings.org_logo_media_id` is the existing, reused relation for the active project logo; no separate or duplicate logo relation is introduced by this specification.
- The production canonical hostname is an external business input not yet finalized; the system is expected to use an explicit environment-provided value and fail clearly at production startup if that value is absent or invalid, rather than silently defaulting to an unconfirmed host.
- A fully licensed "Benito" brand webfont has not yet been supplied; the currently approved fallback typography stack continues to apply until the owner provides a licensed asset.
- A dedicated staging environment, safe test personas for each of the five authorization states, and an approved email-testing strategy are provisioned separately from this specification and are a precondition for authenticated end-to-end verification, not something this specification creates.
- Real legal, contact, and organizational copy is supplied by the business owner; where such content does not yet exist, the corresponding public surface shows an honest absence rather than invented text.
- Sucafina's live site is referenced only as an interaction-quality and information-architecture study already completed in the authoritative sources; no further comparative research against it is part of this specification.
- FR-067/FR-068 record an owner-approved hardening decision reached during consistency analysis of this specification: the current database/storage policies governing a customer's own profile row and own avatar object do not yet independently enforce the blocked-state boundary (they enforce ownership only). The owner has approved tightening the specific policies to add the same unblocked-customer predicate already used elsewhere (favorites, inquiries, protected pricing); the exact SQL is authored and reviewed as its own migration unit outside this specification, per Principle XV.

## Pre-Phase 12 — Owner Alignment Addendum: Public RFQ, Public Sample Requests & Buyer Journey

**Status**: Owner-approved. This addendum does not create a new Spec Kit
feature and does not renumber the existing Phase 0–13 sequence. It is a
bounded extension of the existing specification above, to be delivered before
Phase 12 begins (Phase 12's staging fixtures and persona matrix should account
for an anonymous public RFQ/sample-request persona once this addendum is
implemented). FR-069 through FR-083, the edge cases and success criteria
above, and the Clarifications session above are this addendum's normative
content; this section explains the "why" and records the owner's decisions
and the verified database baseline they rest on.

### Owner decisions (verbatim intent)

1. Public/anonymous visitors may browse public coffees, origins, and
   available lots — this capability already exists (User Story 4) and is
   unchanged by this addendum.
2. Public/anonymous visitors may submit a `GENERAL` sourcing RFQ ("Request an
   Offer") and a `SAMPLE_REQUEST` for a specific coffee (FR-069).
3. Public visitors must never see protected Hills customer pricing — this
   boundary already exists (FR-030/FR-031) and is unchanged; nothing in this
   addendum grants pricing visibility to an anonymous submission.
4. Public visitors gain no account access, favorites, private inventory,
   marketplace/trading execution, checkout/payment, or protected customer
   data as a result of submitting either public form (FR-072, FR-082).
5. Verified `USER` behavior is unchanged: protected Hills pricing, favorites
   and account, sample requests through the existing authenticated path, and
   every other existing customer capability continue exactly as specified
   elsewhere in this document (FR-076).
6. Public `SAMPLE_REQUEST` requires `coffee_id`, does not require `user_id`,
   uses the existing inquiry workflow and status progression, always starts
   at `NEW`, treats `NEW`/`RECEIVED`/`CONTACTED`/`SAMPLE_SENT`/`DELIVERED` as
   active (blocking) states, and permits a new request once the prior one
   reaches `CLOSED` (FR-071, FR-073, FR-074).
7. The existing authenticated sample-request duplicate rule (`user_id` +
   coffee) is unchanged (FR-076).

### Database baseline (already verified and applied) and the required reconciling migration

The following is the current, owner-verified live database state this
addendum's application behavior is built against:

- No new table. No new column. No new enum.
- The `inquiries_product_needs_user` check constraint was changed so `GENERAL`
  and `SAMPLE_REQUEST` may have a NULL `user_id`, while `PRODUCT` still
  requires one.
- The existing `uq_inquiries_active_sample_user_coffee` unique index is
  unchanged.
- A new `uq_inquiries_active_sample_anon_email_coffee` partial unique index
  exists, keyed on `lower(btrim(email))` plus `coffee_id`, scoped to rows
  where `user_id IS NULL` and the `SAMPLE_REQUEST` is in an active state.
- Structural database tests for this change have passed.
- Direct anonymous-role `INSERT` remains blocked by Row Level Security (see
  FR-081): the application write path, not a loosened policy, is what makes
  the anonymous case possible.
- This database change was applied directly against the live database rather
  than through a repository migration file. **Authoring the new repository
  migration that reconciles the versioned migration history with this
  already-applied delta is a required implementation item of this addendum
  (FR-083), not a deferred one** — the delta itself is already owner-approved
  and already live; a new file under `specs/001-platform-implementation-spec/migrations/`
  records it so the repository's migration history matches reality. Existing
  migration files MUST NOT be edited to retroactively describe it.

### Content and journey audit (owner-supplied list, resolved by the page-structure decision above)

The owner asked that the following be audited for coverage: "Request an
Offer" / RFQ, public Sample Request, Dubai-first positioning, "Source a
Coffee," "Buy Available Lots," "Trade With Hills" (bounded by FR-082 to never
introduce real marketplace mechanics), traceability/quality/sourcing proof,
the RFQ steps, the sample-request steps, and a clear separation between the
public site and the protected customer portal. Per the clarified page-structure
decision, these resolve as:

- **Request an Offer / RFQ** → the existing `/request-a-quote` page, extended
  with a new anonymous branch — the canonical route, not a new page
  (FR-079).
- **Public Sample Request** → a "Request a sample" action added to existing
  coffee/offer detail pages (FR-079), not a new page.
- **Dubai-first, Source a Coffee, Buy Available Lots, Trade With Hills,
  traceability/quality/sourcing proof** → positioning and content sections on
  the existing Home, About, and Contact pages — real, owner-supplied copy
  only (per the existing "Assumptions" entry on real content), never invented
  business claims, and never phrased as transactable commerce (FR-082).
- **Public-site vs. protected-customer-portal separation** → already the
  existing boundary (protected pricing, favorites, account, and Admin remain
  behind the existing authorization state machine); this addendum adds a
  purely public, unauthenticated path alongside it and does not weaken it.

### Explicit out of scope

Deliberately deferred — exactly these three, and no others:

- Building a transactional-email confirmation system (FR-077; deferred, not
  silently dropped — see the Clarifications session above).
- Adding a third-party CAPTCHA/challenge vendor (FR-078; a honeypot plus
  server-side rate limiting was chosen instead).
- Any dedicated "Source a Coffee," "Buy Available Lots," or "Trade With
  Hills" page beyond the copy/positioning sections described above, and any
  RFQ route parallel to the existing, canonical `/request-a-quote`.

Also out of scope, but for the ordinary reason that it is unrelated rather
than deferred:

- Any cart, checkout, payment, seller-onboarding, or custody mechanic
  (Constitution Principle I; FR-082).
- Any database/RLS/storage change beyond the single reconciling migration
  required by FR-083 — that migration is in scope (see above); nothing
  further is.
- Starting Phase 12 itself. This addendum is a precondition Phase 12's
  five-persona matrix should account for once implemented, not part of
  Phase 12's own task list.
