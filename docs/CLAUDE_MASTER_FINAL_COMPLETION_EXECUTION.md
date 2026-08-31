# HILLS COFFEE — MASTER FINAL PRODUCT COMPLETION, FLOW AUDIT & IMPLEMENTATION

You are now the PRIMARY SENIOR IMPLEMENTATION + QA AGENT for the final major
Hills Coffee completion pass.

This is NOT a read-only review.

This is NOT a planning-only task.

This is NOT a superficial "routes exist therefore complete" audit.

Your job is to:

1. understand the real product
2. inspect the entire current repository
3. inspect the authoritative database contract
4. inspect all previous implementation/review reports
5. run the real application
6. test EVERY important route and user flow
7. identify broken/missing/static/placeholder behavior
8. IMPLEMENT the missing functionality
9. fix runtime errors and broken routing
10. complete Admin/CMS functionality
11. polish UX, motion, localization and themes
12. run comprehensive automated + runtime QA
13. reach the highest defensible product-completion level possible

Target:
AT LEAST 85–90% genuine product completion.

Do NOT claim 90% because files/routes exist.

A capability counts as complete only when it:

- exists
- works at runtime
- uses real Supabase/database behavior
- has correct authorization
- has error handling
- has usable UX
- works in EN and AR
- works in light and dark modes
- works responsively
- has meaningful automated/runtime QA or is clearly marked as credential-blocked

================================================== 0. CURRENT WORKTREE — VERY IMPORTANT
==================================================

The current working tree already contains extensive implementation and an
interrupted targeted-remediation pass from another coding agent.

That agent stopped because its usage limit was reached.

DO NOT discard that work.

DO NOT reset the repository.

DO NOT run destructive commands such as:

- git reset --hard
- git clean
- force checkout
- force push
- destructive branch replacement

Start by running and understanding:

- git status
- git diff
- recent git log
- package.json
- package-lock.json

Inspect which interrupted edits are valid, partial, broken or unfinished.

Finish them correctly.

The project is now npm-only.

Do NOT restore pnpm.

==================================================

1. READ ALL AUTHORITATIVE SOURCES BEFORE CODING
   \==================================================

Read completely:

1. ./artifacts/HILLS_FULL_IMPLEMENTATION_PLAN.md
2. ./docs/HILLS_IMPLEMENTATION_EXECUTION_REPORT.md
3. ./docs/CLAUDE_INDEPENDENT_REVIEW.md
4. ./docs/CLAUDE_POST_REMEDIATION_REVIEW.md
5. all current ./docs/* Hills-related completion/review instructions/reports
6. all files currently under ./src/support/
7. the latest Post-DB0 Supabase database snapshot
8. the Hills Coffee SEO specification
9. the Hills Coffee Brand Guidelines
10. AGENTS.md
11. CLAUDE.md
12. package.json
13. package-lock.json
14. the COMPLETE current source tree
15. current git diff

Do not rely on old reports as proof.

Reports are historical claims.

The CURRENT SOURCE CODE + CURRENT POST-DB0 DATABASE CONTRACT + REAL RUNTIME
behavior are the truth.

================================================== 2. REAL PRODUCT DEFINITION — CRITICAL
==================================================

Do NOT misunderstand the product because some older documents mention B2B,
marketplace, trading, custody or authorized trading concepts.

For THIS CURRENT WEBSITE:

Hills Coffee is a premium green-coffee sourcing website/platform.

The website exists so prospective customers can:

- discover Hills Coffee
- browse green coffee products
- browse origins
- inspect coffee details
- inspect current offers/warehouse availability
- read knowledge/articles
- sign up
- verify email
- sign in
- view protected B2B pricing when eligible
- save favourite coffees
- Get in Touch
- request samples for specific coffees
- submit contact/delivery details
- track their requests
- allow Hills Coffee Admin staff to review those requests and contact them

The Admin uses the system to:

- manage coffees
- manage offers
- manage protected price tiers
- manage coffee taxonomies
- manage origins/regions/warehouses
- manage content
- manage media
- view users
- manage inquiry statuses
- inspect sample-request history
- manage Homepage/About/commercial SEO pages
- manage articles
- inspect audit logs
- manage site/organization content

THIS WEBSITE IS NOT:

- an e-commerce checkout
- a shopping cart
- a payment platform
- a public marketplace
- a seller marketplace
- a multi-vendor platform
- an inventory trading exchange
- a custody platform
- a securities or commodities exchange
- a payment/settlement system

Do NOT build:

- cart
- checkout
- payment
- sellers
- vendors
- commissions
- payouts
- custody
- trading
- purchase orders
- marketplace settlement

unless explicitly approved later.

================================================== 3. WHAT "B2B" MEANS HERE
==================================================

"B2B" is relevant primarily to:

- SEO positioning
- commercial wording
- target audience
- protected wholesale pricing
- green-coffee sourcing context

Examples of acceptable positioning:

- B2B green coffee supplier
- wholesale green coffee supplier
- green coffee sourcing
- specialty green coffee supplier
- Arabica / Robusta wholesale sourcing

It does NOT mean the application must implement B2B marketplace/trading logic.

The real functional model remains:

DISCOVER
↓
REGISTER
↓
VERIFY EMAIL
↓
SIGN IN
↓
VIEW PROTECTED PRICING
↓
FAVOURITE / GET IN TOUCH / REQUEST SAMPLE
↓
ADMIN MANUAL REVIEW
↓
CUSTOMER REQUEST TRACKING

Sucafina is a UX/content-architecture inspiration ONLY.

Do not copy Sucafina content, identity or design pixel-for-pixel.

================================================== 4. SOURCE PRECEDENCE
==================================================

If sources conflict, use this precedence:

1. THIS MASTER EXECUTION INSTRUCTION
2. approved current Hills implementation plan
3. current Post-DB0 Supabase database snapshot
4. SEO specification for SEO/routes/content architecture
5. Brand Guidelines
6. current repository
7. Sucafina as UX inspiration only
8. older broader SRS/trading concepts

Never resurrect a superseded marketplace/trading feature because an older file
mentions it.

================================================== 5. CURRENT VERIFIED RUNTIME PROBLEMS
==================================================

The owner has personally observed REAL browser failures.

These must be treated as real defects until reproduced and fixed.

Observed:

- `/account` returned the default Next.js 404.
- `/verify-email?email=...` returned the default Next.js 404.
- the Supabase confirmation email is received, but the verification flow does
  not reliably complete end-to-end.
- Admin/customer post-login routing is not trusted end-to-end.
- `/admin` has previously returned unexpected 404 behavior.
- some application routes/components have produced console/runtime warnings.
- the Admin sidebar/background visually ended incorrectly around Audit Log.
- Admin currently feels functional but visually/staticly incomplete.
- public site feels too static and insufficiently polished.
- logo/favicon handling has been inconsistent.
- some user/account settings functionality is missing.

Reproduce these issues yourself.

Do NOT mark them fixed because corresponding source folders exist.

================================================== 6. ROUTE-BY-ROUTE AUDIT — MUST DO
==================================================

Build a complete runtime route matrix.

PUBLIC ENGLISH:

/
/green-coffee-offer-list
/green-coffee-offer-list/[real-slug]
/coffee-origins
/coffee-origins/[real-slug]
/knowledge
/knowledge/[real-slug]
/about
/contact

AUTH:

/sign-up
/sign-in
/verify-email
/forgot-password
/reset-password
/auth/callback

ACCOUNT:

/account
/account/profile
/account/favorites
/account/requests
/account/requests/[real-code]
/account/security

ADMIN ENTRY:

/dashboard-admin

ADMIN:

/admin
/admin/products
/admin/offers
/admin/pricing
/admin/inquiries
/admin/origins
/admin/taxonomy
/admin/regions
/admin/warehouses
/admin/varieties
/admin/media
/admin/articles
/admin/article-categories
/admin/users
/admin/content
/admin/settings
/admin/audit
/admin/account

plus any implemented nested create/edit routes.

ARABIC:

Equivalent `/ar/...` versions for every locale-aware route.

For every route verify:

- HTTP behavior
- final browser URL
- redirects
- authentication requirement
- role requirement
- no unexpected 404
- loading
- error
- empty state
- dark mode
- light mode
- responsive behavior
- Arabic/RTL

================================================== 7. FINAL ADMIN ENTRY DECISION
==================================================

Canonical Admin authentication entry:

/dashboard-admin

Arabic:

/ar/dashboard-admin

Anonymous:

GET /dashboard-admin
-> Admin login page, 200.

GET /ar/dashboard-admin
-> Arabic Admin login page, 200.

Do NOT expose Admin signup.

Do NOT expose a role picker.

Legacy routes:

/admin/login
/ar/admin/login

should cleanly redirect to:

/dashboard-admin
/ar/dashboard-admin

Do not maintain two separate Admin login implementations.

================================================== 8. ADMIN LOGIN FLOW
==================================================

Admin credentials submitted to:

/dashboard-admin

must:

1. authenticate using Supabase
2. resolve real profile
3. read role from `public.profiles.role`
4. require role = ADMIN
5. redirect to /admin
6. render real Admin dashboard

Arabic:
-> /ar/admin

If USER credentials are entered:

- authentication must NOT grant Admin access
- show localized "This account does not have administrator access"
- clean the unauthorized session if necessary
- stay/return safely to Admin login

Authorization source MUST remain:

public.profiles.role

Never:
user.app_metadata.role

================================================== 9. NORMAL CUSTOMER SIGN-IN ROLE ROUTING
==================================================

Normal customer login:

/sign-in

Arabic:

/ar/sign-in

Successful USER:
-> intended safe customer destination
-> default `/account`

Successful ADMIN entered accidentally through normal `/sign-in`:
-> detect ADMIN server-side
-> redirect `/admin`

Do NOT send ADMIN to a broken `/account`.

Do NOT make Admin sign in twice.

================================================== 10. CUSTOMER AUTH — COMPLETE A TO Z
==================================================

Fully implement and runtime-test:

- sign up
- sign in
- sign out
- email verification
- resend verification
- forgot password
- password-recovery callback
- reset password
- invalid/expired links
- session persistence
- safe redirects
- duplicate email neutral behavior
- wrong password generic behavior

PUBLIC SIGNUP FIELDS:

- Full Name
- Email
- Phone
- Password
- Confirm Password

NO Company field in signup.

NO role selector.

Public signup always creates USER.

================================================== 11. EMAIL VERIFICATION FLOW — BLOCKER LEVEL
==================================================

The current behavior where an email is delivered but `/verify-email` 404s is
not acceptable.

Required route:

/verify-email

Arabic:

/ar/verify-email

Must render correctly with:

?email=user@example.com

Support:

- Check your email state
- resend
- pending
- success
- failure
- already verified
- expired/invalid confirmation
- sign-in CTA
- localization
- safe email display

Do not leak account existence unnecessarily.

==================================================
EMAIL CONFIRMATION UX — REQUIRED PRODUCT BEHAVIOR
==================================================

The current Supabase behavior may create the auth user row before email
confirmation. That is acceptable internally, but the PRODUCT UX must make the
account state crystal clear.

The user must NOT feel that registration is fully complete before email
verification.

After successful signup:

1. Create the Supabase Auth user using the normal secure signup flow.
2. If email confirmation is required, immediately redirect to:

   /verify-email?email=<encoded-email>

3. The UI must clearly communicate:

   "Your account was created. Please verify your email before continuing."

4. The user must NOT be treated as fully active/eligible for protected features
   until Supabase confirms the email.

5. The user must NOT gain access to:
   - protected pricing
   - favourites
   - PRODUCT inquiry
   - SAMPLE_REQUEST

   before email verification.

6. Receiving the email alone is NOT enough.

7. Clicking the verification link must complete the real Supabase confirmation
   flow and update the verified state.

8. Only after successful verification should the system consider:

   email_confirmed_at != null

   or the equivalent Supabase verified-email state.

==================================================
VERIFICATION EMAIL MUST BE A REAL STEP
==================================================

The intended flow is:

SIGN UP
↓
AUTH USER CREATED
↓
VERIFY-EMAIL PAGE
↓
USER RECEIVES GMAIL CONFIRMATION EMAIL
↓
USER CLICKS CONFIRM / VERIFY LINK
↓
/auth/callback
↓
SUPABASE EMAIL CONFIRMATION COMPLETES
↓
VERIFIED SESSION / VERIFIED USER STATE
↓
/account OR /sign-in?verified=1

Do NOT bypass this verification step merely because the auth.users row already
exists.

Do NOT auto-treat an unverified account as verified.

==================================================
UNVERIFIED USER EXPERIENCE
==================================================

If a user signs in before confirming their email:

- do not silently fail
- do not send them to a broken account route
- do not show protected features
- redirect/show:

  /verify-email

with a clear message such as:

"Your email is not verified yet. Check your inbox and confirm your account."

Provide:

- Resend verification email
- Change email / go back if appropriate
- Sign out
- Sign in after verification

Do NOT repeatedly recreate accounts.

==================================================
RESEND CONFIRMATION
==================================================

The verification page must provide a real resend action using the correct
Supabase API.

Requirements:

- disabled/pending state
- cooldown/debounce to avoid spam
- safe success message
- safe generic failure message
- no raw Supabase error
- no account enumeration

Example success:

"We sent a new verification email. Check your inbox."

==================================================
ALREADY VERIFIED
==================================================

If the user opens /verify-email but the current authenticated account is already
verified:

do not show a fake waiting state.

Redirect to the correct destination:

USER:
-> /account

ADMIN:
-> /admin

or show a clear "Email already verified" state with the appropriate CTA.

==================================================
CALLBACK MUST VERIFY REAL STATE
==================================================

After /auth/callback:

Do not merely assume verification succeeded because a callback route was hit.

Verify the actual resulting auth/session/user state.

Confirm that the user's verified-email state is now true before granting
verified-only functionality.

If confirmation fails:

- show safe invalid/expired-link UX
- allow resend
- do not create a false verified session

==================================================
TEST THE EXACT REAL FLOW
==================================================

When a safe disposable test account is available, perform this full test:

1. Use a brand-new email address.
2. Submit /sign-up.
3. Confirm the user appears in Supabase Auth as UNVERIFIED.
4. Confirm application redirects to /verify-email.
5. Confirm protected features are unavailable.
6. Confirm the Gmail verification email is generated/received.
7. Click the actual confirmation link manually if inbox automation is unavailable.
8. Confirm /auth/callback succeeds.
9. Confirm Supabase now reports the user's email as verified.
10. Confirm login succeeds.
11. Confirm /account loads.
12. Confirm protected pricing/favourites/inquiries become available only now.

If step 7 requires manual Gmail interaction:

mark ONLY that click as MANUAL QA.

Do not call the complete verification flow PASS until the post-click verified
state is confirmed.

==================================================
IMPORTANT PRODUCT RULE
==================================================

It is acceptable that Supabase creates the Auth row before verification.

What is NOT acceptable is for the application to present that account as fully
activated before the user confirms the email.

The UX distinction must be explicit:

REGISTERED
≠
VERIFIED

Only VERIFIED users receive verified-user capabilities.

================================================== 12. SUPABASE CONFIRMATION CALLBACK
==================================================

Audit the actual current Supabase setup and auth implementation.

Callback remains outside locale tree:

/auth/callback

Verify actual supported flow:

- emailRedirectTo
- code exchange / PKCE
- token_hash if applicable
- safe `next`
- locale preservation
- invalid callback
- expired callback
- verified-session state

Expected sign-up journey:

/sign-up
→ Supabase signUp
→ /verify-email?email=...
→ customer receives email
→ confirmation link
→ /auth/callback
→ verification/session established
→ safe destination such as /account or /sign-in?verified=1

At no stage should there be a default Next.js 404.

================================================== 13. FORGOT / RESET PASSWORD
==================================================

Runtime verify:

/forgot-password
/reset-password

Arabic equivalents.

Forgot password:

- neutral response
- real recovery email request
- no enumeration

Recovery callback:

- valid recovery state
- proper Supabase exchange

/reset-password without valid recovery context:

- MUST NOT allow password update

Successful reset:

- feedback
- redirect safely

================================================== 14. CUSTOMER ACCOUNT AREA
==================================================

Must exist and be usable:

/account
/account/profile
/account/favorites
/account/requests
/account/requests/[code]
/account/security

Anonymous:
-> localized /sign-in?next=...

Authenticated USER:
-> account renders.

Do NOT use notFound() as authentication control.

Account overview should feel like an application, not an empty static page.

================================================== 15. CUSTOMER PROFILE
==================================================

Allow USER to edit existing supported profile fields:

- full name
- phone
- company name where appropriate AFTER signup
- address
- country

Use actual `profiles` schema.

Validate.

Show:

- loading
- saving
- success
- inline errors
- Sonner where appropriate

================================================== 16. ACCOUNT SECURITY
==================================================

Account security should support real functionality:

- change email
- change password

using correct Supabase Auth APIs.

Do not write passwords to DB.

Do not fake password-change fields that do nothing.

Handle:

- reauthentication/recovery semantics where needed
- success
- failure
- confirmation requirements

================================================== 17. ADMIN OWN ACCOUNT SETTINGS
==================================================

Admin should have a usable personal-account settings area:

/admin/account

Admin should be able to manage THEIR OWN:

- display/full name
- email
- password
- phone where applicable
- profile/avatar image if safely supported

Email/password must use Supabase Auth.

For avatar/profile image:

inspect current schema first.

Preferred order:

1. existing profile/media/avatar DB relation if available
2. safe Supabase `user_metadata` avatar URL if appropriate

NEVER:

- app_metadata for user-editable profile data
- app_metadata for authorization

If a proper avatar implementation truly requires new DB structure:

do not silently migrate.

Report:
DATABASE GAP — ADMIN AVATAR

with minimum required conceptual change.

================================================== 18. REAL HILLS LOGO — IMPORTANT
==================================================

The supplied Hills Coffee logo asset is:

/public/images/logo-hero.png

Inspect and use this real asset.

Use it appropriately in:

- public header
- footer
- Admin sidebar/header
- Admin login
- customer Auth pages

Do NOT keep a fake text logo when the real official asset is available.

Do NOT redraw the logo.

Do NOT distort aspect ratio.

Handle transparent padding correctly.

Dark/light visibility must be correct.

================================================== 19. FAVICON / APP ICON
==================================================

Inspect assets under:

/public/images/

Use an appropriate official square mark, such as the actual logo mark if valid.

Do not leave:

- Next.js favicon
- Vercel favicon
- broken path
- incorrect `/public/...` URL

Verify actual browser tab icon in runtime.

================================================== 20. PUBLIC SITE VISUAL QUALITY
==================================================

Current perception:
too static / insufficiently polished.

Improve the site into a premium green-coffee sourcing experience.

Sucafina may be inspected as an interaction-quality reference:

https://sucafina.com/emea

Do not copy proprietary content/design.

Study:

- navigation
- spacing rhythm
- editorial sections
- image treatment
- card interactions
- hover states
- section reveals
- filters
- typography
- micro-interactions

================================================== 21. MOTION SYSTEM
==================================================

Use a consistent reusable motion system.

Apply thoughtful motion to:

- hero
- headings
- sections
- cards
- images
- navigation
- menus
- CTAs
- filters
- offer expansion
- favourite state
- dialogs
- form success
- Admin drawers
- loading/empty transitions

Potential primitives:

- Reveal
- FadeIn
- Stagger
- ImageReveal
- HoverLift
- MenuTransition
- DrawerTransition
- ExpandCollapse

Mandatory:

- prefers-reduced-motion
- no scroll hijacking
- transform/opacity preferred
- no CLS
- no huge client bundle just for animation
- SSR content remains available

================================================== 22. HOMEPAGE
==================================================

Homepage should use real CMS + DB content.

Include where real data exists:

- Hero
- commercial pathways
- featured coffees
- featured origins
- who-we-serve content
- quality/logistics
- warehouses
- knowledge/articles
- trust/content sections
- CTA

No fabricated:

- statistics
- establishment dates
- warehouse counts
- business claims

Elegant empty states instead.

================================================== 23. COFFEE CATALOG
==================================================

Public catalogue must use real DB.

Canonical route:

/green-coffee-offer-list

Requirements:

- SSR
- database filtering
- database sorting
- pagination
- shareable URL filters
- no full-catalogue client load
- useful filters
- responsive layout
- expandable details where intended
- real empty/loading/error states

Public data:
NO protected price leakage.

Verified users:
protected price.

================================================== 24. COFFEE DETAIL
==================================================

`/green-coffee-offer-list/[slug]`

Complete:

- coffee identity
- origin
- region
- processing
- grade
- agricultural facts
- varieties
- certifications
- tags
- media gallery
- MAIN image
- offer availability
- warehouse
- sensory data from OFFER relationship
- related content
- related origins/coffees
- visible breadcrumbs
- Get in Touch
- Sample Request
- protected tier pricing for verified users only

================================================== 25. ORIGINS
==================================================

Complete:

/coffee-origins
/coffee-origins/[slug]

Use:

- origins
- translations
- origin media
- related coffees
- editorial fields
- breadcrumbs
- SEO

Arabic must use localized DB content.

================================================== 26. KNOWLEDGE / ARTICLES
==================================================

Complete:

/knowledge
/knowledge/[slug]

Use:

- articles
- article translations
- categories
- featured media
- publish state
- scheduled publishing
- safe Markdown
- localized slugs
- locale switching
- Article structured data

Do not invent author Person entities.

================================================== 27. CONTACT / GET IN TOUCH
==================================================

Contact page is public informational content.

Tracked requests require verified login.

Anonymous:

- contact info
- sign-in/create-account CTA

Unverified:

- verification-required CTA

Verified:

- PRODUCT / SAMPLE_REQUEST forms

No anonymous PRODUCT/SAMPLE_REQUEST writes.

================================================== 28. FAVOURITES
==================================================

Verified USER can:

- add favourite
- remove favourite
- view own favourites

Anonymous:
-> sign in

Unverified:
-> verification message

Never cross-user leakage.

================================================== 29. SAMPLE_REQUEST FINAL RULE
==================================================

A customer may request samples for multiple DIFFERENT coffees.

For the SAME coffee:
same user may have only ONE ACTIVE SAMPLE_REQUEST.

Identity:

user_id +
coffee_id +
type = SAMPLE_REQUEST

NOT offer_id.

Therefore:

Coffee A / Egypt
and
Coffee A / Dubai

count as the SAME coffee.

Block if an existing request is:

- NEW
- RECEIVED
- CONTACTED

Return existing request code.

If CLOSED:
new request may be submitted for manual review.

SAMPLE REQUEST REQUIREMENTS:

- authenticated
- verified email
- phone
- address
- country
- valid trusted offer
- server-derived coffee relationship

NO quantity field.

NO quantity hidden in message.

Creating SAMPLE_REQUEST must NOT:

- ship sample
- reserve inventory
- create fulfillment
- approve delivery

It is only manual review.

================================================== 30. SAMPLE REQUEST ADMIN HISTORY
==================================================

Admin must see previous same-user/same-coffee sample requests as ACTUAL ROWS:

- request code
- status
- created_at

not just:

"Previous samples: 2"

Show current + previous context clearly.

================================================== 31. SAMPLE CONCURRENCY
==================================================

Known issue:

application does:
check duplicate
then insert

without atomic DB constraint.

Do not pretend this is fully race-safe.

Keep documented:

DATABASE HARDENING DECISION REQUIRED.

Do not modify database in this pass unless owner explicitly approves it.

================================================== 32. ADMIN WORKSPACE — FULL AUDIT
==================================================

Admin must feel like a real operations/CMS application.

Audit every module against the current Post-DB0 schema.

Navigation groups should be clear:

OVERVIEW

CATALOG

- Products/Coffees
- Offers
- Pricing

COFFEE DATA

- Coffee Types
- Origins
- Regions
- Processing Methods
- Varieties
- Certifications
- Tags
- Sensory Notes
- Packaging Types
- Warehouses

CONTENT

- Homepage
- About
- Commercial Pages
- Articles/Knowledge
- Article Categories
- Media
- Site/Organization Content

CUSTOMERS

- Users
- Inquiries

SYSTEM

- Audit Logs
- Admin Account

================================================== 33. ADMIN SIDEBAR VISUAL BUG
==================================================

The owner observed that the sidebar/background visually stops or changes near
the bottom around Audit Log instead of filling the full application height.

Fix the layout structurally.

Desktop sidebar should:

- fill viewport height
- remain continuous
- not visually terminate early
- support internal scroll if navigation exceeds viewport
- keep footer/account section positioned correctly
- retain active item styling
- not overlap Windows/browser viewport

Use appropriate:
min-h-dvh
h-dvh
sticky/fixed/grid
overflow-y-auto

based on architecture.

Test at:

- laptop
- 1440 desktop
- smaller height viewport

================================================== 34. ADMIN OVERVIEW
==================================================

Real metrics only.

No fake analytics.

Use real database counts such as:

- published/draft coffees
- offers
- warehouse/status counts
- users
- inquiry statuses
- articles
- recent audit activity

No fabricated charts/data.

================================================== 35. PRODUCTS / COFFEES ADMIN
==================================================

Full operational CRUD.

Admin should manage:

- slug
- status
- coffee type
- origin
- region
- processing method
- grade
- altitude
- harvest data where schema supports
- featured state/order
- translations EN/AR
- varieties
- certifications
- tags
- MAIN image
- gallery
- publish/archive

Origin/region relationship must be valid.

================================================== 36. OFFERS ADMIN
==================================================

Full operational CRUD.

Manage real DB-supported fields:

- coffee
- warehouse
- reference number
- status
- packaging
- sensory notes
- tags
- lifecycle

Handle unique constraints with friendly messages.

================================================== 37. PRICING ADMIN
==================================================

Protected pricing module should support:

- searchable offer selector
- min bags
- USD/kg
- create
- edit
- delete
- ladder ordering/invariants
- error states

No raw UUID-only UX.

================================================== 38. TAXONOMIES
==================================================

Full CRUD where DB supports:

- Coffee Types
- Processing Methods
- Varieties
- Certifications
- Tags
- Sensory Notes
- Packaging Types

EN/AR translations where translation tables exist.

================================================== 39. ORIGINS / REGIONS ADMIN
==================================================

Origins:

- CRUD
- EN/AR
- media
- featured state/order
- archive

Regions:

- CRUD
- EN/AR
- parent origin
- archive

================================================== 40. WAREHOUSES ADMIN
==================================================

Full CRUD and translation support.

Warehouses:

- structural data
- EN
- AR
- active/archive
- correct allowed warehouse codes

Do not lose warehouse translations.

================================================== 41. MEDIA ADMIN
==================================================

Real media library.

Support:

- upload
- preview
- valid MIME
- max size
- dimensions
- storage path
- EN alt
- AR alt
- captions
- archive
- reusable media picker

Image previews must actually render.

No broken `/public/...` paths.

================================================== 42. ARTICLES ADMIN
==================================================

Full:

- create
- update
- category
- featured media
- feature state
- draft
- publish
- schedule
- archive
- EN/AR
- localized slug
- SEO title/description
- Markdown

================================================== 43. ARTICLE CATEGORIES ADMIN
==================================================

CRUD + EN/AR.

================================================== 44. USERS ADMIN
==================================================

Users are READ-ONLY unless DB contract safely supports otherwise.

Admin can:

- list
- search
- inspect full name
- email
- phone
- role
- verification/account state where safely retrievable
- request history context

Do NOT expose:

- password
- unsafe role editing
- arbitrary Auth-user deletion

================================================== 45. INQUIRIES ADMIN
==================================================

Operational request management.

Show:

- request code
- type
- status
- customer
- name
- email
- phone
- company
- country
- address
- coffee
- offer
- warehouse context
- timestamp
- status history
- sample history

Filters:

- status
- type
- search
- coffee
- customer
- date where practical

Admin can change approved status only.

Do not edit customer-submitted historical facts arbitrarily.

================================================== 46. AUDIT LOGS
==================================================

Dedicated useful viewer:

- pagination
- search
- entity
- actor where available
- action
- date
- record context

Protected Admin only.

Remember price-tier audit JSON can contain sensitive price data.

Never expose Audit data publicly.

================================================== 47. CMS
==================================================

Structured CMS, not generic arbitrary page builder.

Admin manages:

- Homepage
- About
- commercial SEO pages
- support/legal/contact content where existing DB supports
- section visibility
- ordering
- CTA
- media
- SEO title/description
- EN/AR
- draft
- publish
- archive
- preview

Missing Arabic indicators.

No arbitrary:

- HTML
- JS
- CSS
- canonical URL
- JSON-LD editor

================================================== 48. SITE / ORGANIZATION SETTINGS
==================================================

Admin settings should manage actual supported values:

- brand name
- legal name
- contact email
- phone
- address
- tagline
- low-stock threshold
- localized organization data

Public frontend should reflect the values.

Organization/WebSite JSON-LD should reflect actual `site_settings` where factual.

================================================== 49. ADMIN FEEDBACK
==================================================

Every Admin mutation needs:

- validation
- pending state
- duplicate-submit prevention
- inline error
- safe error mapping
- Sonner success
- Sonner failure

No silent refresh where Admin cannot tell whether save succeeded.

================================================== 50. DELETE / ARCHIVE RULES
==================================================

Follow actual DB lifecycle.

Do not hard-delete:

- customer inquiries
- audited business entities
- content where soft archive exists

Price tiers may use appropriate hard delete if DB model allows.

Confirm destructive actions.

================================================== 51. ADMIN UI QUALITY
==================================================

Current Admin feels too static/generated.

Improve professionalism:

- hierarchy
- page titles
- descriptive subtitles
- cards
- tables
- compact filters
- badges
- action menus
- sticky form actions where useful
- relation pickers
- empty states
- responsive tables
- confirmation dialogs
- meaningful skeleton/loading states

Functionality first.

Do not over-design.

================================================== 52. LIGHT MODE
==================================================

Test entire public/auth/account/admin interface in Light.

Verify:

- logo
- contrast
- buttons
- fields
- tables
- cards
- sidebar
- borders
- dialogs
- badges
- links
- hover
- disabled
- focus

================================================== 53. DARK MODE
==================================================

Repeat for Dark.

Do not simply invert official brand artwork.

Logo must remain visible.

Fix all low-contrast elements.

================================================== 54. ARABIC / RTL FIRST-CLASS
==================================================

Arabic must match English functionality.

Audit all routes and components.

Requirements:

- `lang="ar"`
- `dir="rtl"`
- logical spacing
- correct icon direction
- correct sidebar placement/behavior
- correct mobile menu
- correct tables
- correct breadcrumbs
- correct forms
- correct dialog direction
- correct toast direction
- correct motion direction where meaningful

================================================== 55. TRANSLATION SYSTEM
==================================================

User-visible UI text belongs in `messages/en.json` and `messages/ar.json`.

Reduce/remove:

locale === "ar" ? "..." : "..."

Maintain exact key parity.

Add automated parity test:

- same keys
- no empty values

Database-translated business content should use:

requested locale
→ English fallback
→ null

Fallback English content inside Arabic page should be marked with `lang="en"`
where practical.

================================================== 56. MOBILE NAV ACCESSIBILITY
==================================================

Complete/fix:

- real dialog/sheet semantics
- Escape closes
- focus trap
- focus restoration
- scroll lock
- 44px minimum touch target
- localized aria labels

Run Axe with menu OPEN.

================================================== 57. GENERAL ACCESSIBILITY
==================================================

Target WCAG 2.2 AA core flows.

Verify:

- skip link
- keyboard
- focus-visible
- labels
- aria-invalid
- aria-describedby
- live errors
- status announcements
- heading hierarchy
- image alt
- contrast
- touch targets
- reduced motion

================================================== 58. BREADCRUMBS
==================================================

Visible localized breadcrumbs + BreadcrumbList JSON-LD on:

- offer list where meaningful
- coffee detail
- origin detail
- knowledge detail
- commercial CMS pages

RTL compatible.

================================================== 59. SEO
==================================================

Strong B2B green-coffee SEO.

Do not keyword-stuff.

Use clear site structure to maximize branded sitelink eligibility.

Google decides actual sitelinks.

Implement:

- localized titles
- descriptions
- metadataBase
- canonical
- hreflang
- x-default
- Open Graph
- Twitter
- robots
- sitemap
- real status codes
- noindex private routes
- draft exclusion
- Article schema
- Product schema without protected price
- Organization
- WebSite
- BreadcrumbList
- ItemList where justified

================================================== 60. CANONICAL HOST
==================================================

Use:

NEXT_PUBLIC_SITE_URL

as authoritative source.

Do not silently ship an incorrect hardcoded production hostname.

Development:
localhost allowed.

Production:
missing/invalid URL should fail clearly.

Production domain remains a business-config input until confirmed.

================================================== 61. PRIVATE ROUTES SEO
==================================================

Must be noindex / excluded from sitemap:

- /account/*
- /admin/*
- /dashboard-admin
- sign-in related private utility routes where appropriate

No private data in sitemap.

================================================== 62. PRICE SECURITY
==================================================

CRITICAL.

Anonymous:
NO protected price.

Unverified:
NO protected price.

Verified USER:
price available.

Admin:
price management.

Protected price must NEVER appear in:

- anonymous HTML
- unverified HTML
- RSC payload for unauthorized user
- metadata
- OG
- Twitter
- JSON-LD
- sitemap

Never cache viewer-dependent price publicly.

================================================== 63. SERVER/CLIENT ARCHITECTURE
==================================================

Do not turn large public pages into Client Components just for animation or auth UI.

Prefer:
Server Components +
small Client islands.

Keep public SEO content SSR.

Keep viewer-sensitive data properly dynamic/private.

================================================== 64. PUBLIC PERFORMANCE
==================================================

Audit:

- large JS
- unnecessary client components
- duplicate requests
- huge image payloads
- missing image dimensions
- full-table fetches
- catalog filtering in memory
- fonts
- caching

Do not damage Core Web Vitals for motion.

================================================== 65. IMAGE QUALITY
==================================================

Use real existing images under `/public/images`.

Do not invent fake business/product photography.

Use `next/image` correctly.

No path:

/public/images/...

Correct URL:

/images/...

Set meaningful dimensions.

================================================== 66. ERROR / CONSOLE CLEANUP
==================================================

Run the app and inspect browser/server consoles.

Fix real:

- runtime exception
- hydration mismatch
- invalid DOM
- React warnings
- broken import
- missing assets
- routing warnings
- unhandled rejection
- raw Supabase error
- invalid form state

If a framework warning is harmless and officially expected:
document why.

Do not damage SEO/functionality merely to silence a harmless warning.

================================================== 67. NOT FOUND / ERROR UX
==================================================

Do not leave supported flows falling into generic Next.js 404.

Use:

not-found.tsx
error.tsx

appropriately.

Authentication is not a 404.

Unauthorized:
redirect/deny.

Missing public entity:
real 404.

Provide branded, localized not-found UI.

================================================== 68. LOADING / EMPTY STATES
==================================================

No giant blank areas.

Major screens need:

- loading
- empty
- error
- unauthorized
- success

Examples:

"No offers available"
"No requests yet"
"No articles yet"

should be useful and polished.

================================================== 69. RESPONSIVE QA
==================================================

Test:

375 mobile
768 tablet
1024 laptop
1440 desktop

Check:

- no horizontal overflow
- nav
- sidebar
- grids
- forms
- tables
- modals
- CMS
- long Arabic content

================================================== 70. NPM
==================================================

Project is npm-only.

Required workflow:

npm install
npm run dev

No:
pnpm-lock.yaml
pnpm-workspace.yaml
active pnpm docs

================================================== 71. DATABASE CONTRACT
==================================================

Post-DB0 Supabase snapshot is authoritative.

Do not silently modify schema.

Use actual:

- profiles
- coffees
- coffee_translations
- coffee_types
- origins
- origin_translations
- regions
- region_translations
- warehouses
- warehouse_translations
- processing methods
- varieties
- certifications
- tags
- sensory notes
- packaging
- coffee_offers
- offer_price_tiers
- offer relations
- favorites
- inquiries
- inquiry_status_history
- articles
- article_categories
- media
- site_pages
- site sections/translations
- site_settings
- audit_logs

and real constraints/RLS/triggers.

================================================== 72. DO NOT SILENTLY MODIFY DATABASE
==================================================

If implementation genuinely requires DB work:

STOP only that dependency.

Report:

DATABASE GAP
or
DATABASE HARDENING DECISION REQUIRED

Explain minimum conceptual change.

Do not run migration without owner approval.

================================================== 73. ADMIN AUTHORIZATION
==================================================

Every Admin mutation:

- requireAdmin() server-side
- rely on DB RLS too
- explicit fields
- Zod
- no mass assignment
- handle Supabase error
- no raw DB message exposed

================================================== 74. REAL AUTHENTICATED PERSONAS
==================================================

Required testing personas:

A. Anonymous
B. Unverified USER
C. Verified USER
D. ADMIN

If safe credentials exist:
use them.

Never print secrets/passwords.

If credentials unavailable:
mark relevant tests:

BLOCKED — STAGING CREDENTIALS REQUIRED

Do not fake sessions.

================================================== 75. AUTHENTICATED QA MATRIX
==================================================

A:

- public routes
- no price
- account redirect
- admin redirect
- inquiry sign-in CTA

B:

- no price
- verify-email UX
- resend
- cannot favourite
- cannot PRODUCT
- cannot SAMPLE

C:

- account
- profile
- price
- favourite
- PRODUCT inquiry
- SAMPLE inquiry
- duplicate sample rule
- own request history
- no admin

D:

- admin login
- dashboard
- all admin modules
- CRUD
- CMS
- pricing
- sample history
- audit
- personal admin account settings

================================================== 76. REAL EMAIL QA
==================================================

If a disposable test USER can safely be created:

test real:

sign-up
→ verify page
→ email generated
→ confirmation callback
→ verified state
→ sign in
→ account

If inbox interaction cannot be automated:
mark link click as MANUAL.

Do not falsely PASS it.

================================================== 77. UNIT / INTEGRATION TESTS
==================================================

Add meaningful tests for:

- auth redirects
- role routing
- verification route
- safe next
- sample rules
- translations
- SEO helpers
- pricing boundary
- admin authorization

Behavior tests, not source-text grep alone.

================================================== 78. PLAYWRIGHT E2E
==================================================

Expand E2E.

At minimum public:

- homepage desktop/mobile
- dark/light
- AR
- catalog
- responsive
- navigation
- open mobile menu
- anonymous price leakage
- account redirect
- dashboard-admin login page
- admin protected redirect
- verify-email route

Authenticated tests only when safe credentials exist.

================================================== 79. AXE
==================================================

Do NOT report "2/2" because one homepage test runs in two projects.

Scan meaningful screens/states:

- homepage
- open mobile menu
- sign-in
- sign-up
- verify email
- catalog
- coffee detail
- account shell
- admin login
- admin shell
- Arabic

================================================== 80. FINAL COMMANDS
==================================================

At final completion run:

npm install
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e

Record exact results.

================================================== 81. REAL DEV RUNTIME
==================================================

Actually start:

npm run dev

Test routes in a real browser/server.

Do not conclude "route works" only from build output.

================================================== 82. PRODUCTION BUILD RUNTIME
==================================================

Also verify production build/start where practical.

Some issues appear only between development and production.

================================================== 83. NO FAKE BUSINESS DATA
==================================================

Do not invent:

- prices
- stock
- statistics
- years
- customers
- warehouses
- certifications
- claims
- authors
- contact details

Real DB/CMS only.

================================================== 84. DOCUMENTATION
==================================================

Update:

./docs/HILLS_IMPLEMENTATION_EXECUTION_REPORT.md

Create:

./docs/CLAUDE_MASTER_FINAL_COMPLETION_REPORT.md

Report REAL state.

================================================== 85. EVIDENCE-BASED COMPLETION SCORE
==================================================

Score:

Auth / Customer Account 15%
Public Catalogue / Content 15%
Sample / Inquiry Workflow 10%
Admin Operational CRUD 20%
Admin CMS / Settings 15%
EN/AR + RTL + Light/Dark 10%
UX / Motion / Accessibility 5%
SEO 5%
Testing / Runtime QA 5%

TOTAL = 100%.

Target >= 85%.

Do not fabricate the score.

If below 85 due FIXABLE code:
continue implementation.

If below 85 due only external inputs:
state clearly.

================================================== 86. BLOCKER COMPLETION GATE
==================================================

Zero FIXABLE BLOCKER/HIGH application defects before finishing.
Do NOT mark Auth complete unless a newly registered account is visibly
UNVERIFIED until the real confirmation email link is clicked and Supabase
reports the email as verified.

Auth is BLOCKER-level.

Do NOT declare completion while:

- /account 404s
- /verify-email 404s
- Admin login flow is broken
- verification callback is broken
- required Admin modules don't work
- price leaks
- SAMPLE_REQUEST doesn't work
- EN/AR important flows differ
- production build fails

================================================== 87. FINAL ACCEPTANCE
==================================================

Before completion prove:

- npm install succeeds
- npm dev boots
- format passes
- typecheck passes
- lint passes
- tests pass
- build passes
- E2E passes
- logo/favicons work
- public site works
- Auth flow works
- account routes work
- Admin routing works
- Admin CRUD is real
- CMS works
- SAMPLE_REQUEST works
- no known unauthorized price leak
- Arabic works
- Dark/Light works
- responsive works
- supported routes do not unexpectedly 404

================================================== 88. FINAL RESPONSE FORMAT
==================================================

Return exactly:

# Final Verdict

# Evidence-Based Completion Score

XX / 100

# Product Scope Confirmed

# Runtime Route Audit

table:
Route | Persona | Expected | Actual | PASS/FAIL

# Customer Auth

Signup
Sign-in
Verification
Forgot/reset
Role routing
Account

# Admin

Dashboard
Modules
CRUD
Account settings

# CMS

# SAMPLE_REQUEST

# Public UX / Motion

# EN / AR / RTL

# Light / Dark

# SEO

# Accessibility

# Automated Tests

exact commands + exact pass/fail counts

# Authenticated QA

PASS / PARTIAL / BLOCKED

# Remaining BLOCKER

# Remaining HIGH

# Remaining MEDIUM

# Remaining LOW

# Database Gaps / Decisions

# External Business Inputs

# Staging Readiness

YES / NO

# Production Readiness

YES / NO

# Exact Remaining Work

==================================================
FINAL INSTRUCTION
==================================================

START NOW.

First:

- inspect current interrupted worktree
- read authoritative sources
- run baseline checks
- run the application
- reproduce current runtime issues

Then IMPLEMENT and FIX.

Do NOT stop after writing an audit.

Do NOT return another theoretical plan.

Continue through the codebase systematically until the completion gates are
satisfied or the only remaining blockers require external credentials/business
inputs/database-owner approval.
