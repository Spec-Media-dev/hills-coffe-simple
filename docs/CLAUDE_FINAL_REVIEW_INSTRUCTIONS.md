Continue the Hills Coffee independent review from the current session.

IMPORTANT UPDATE:

I verified the support folder manually and confirmed that the previous review was correct:
the Post-DB0 Supabase snapshot and SEO specification were actually missing from ./src/support/.

I have now restored the required support artifacts.

Before continuing, verify that ./src/support/ now contains:

1. Supabase Database Snapshot - Post DB0.csv
2. HillsCoffee_SEO_Development_Specification.pdf
3. HILLS Brand GuidLines copy.pdf

Then re-read the restored Post-DB0 database snapshot and SEO specification completely.

Also re-read:

- ./artifacts/HILLS_FULL_IMPLEMENTATION_PLAN.md
- ./docs/HILLS_IMPLEMENTATION_EXECUTION_REPORT.md
- the current repository
- current git diff
- git status

IMPORTANT:
Another coding agent has finished the current implementation pass.

This is still an INDEPENDENT READ-ONLY REVIEW.

DO NOT modify application code.
DO NOT fix bugs.
DO NOT modify the database.
DO NOT install packages.
DO NOT commit anything.

You MAY create or update ONLY this review file:

./docs/CLAUDE_INDEPENDENT_REVIEW.md

==================================================
RE-EVALUATE THE PREVIOUS REVIEW
==================================================

Use the restored authoritative files to re-evaluate every previous finding.

Do NOT automatically preserve a finding just because you reported it earlier.

For every previous BLOCKER / HIGH / MEDIUM / LOW finding:

- verify whether it still exists
- verify it against the actual Post-DB0 schema
- verify it against the SEO specification
- verify it against the current implementation
- mark it as:
  CONFIRMED
  RESOLVED
  PARTIALLY RESOLVED
  NOT A VALID FINDING

Pay special attention to:

- inquiry trigger-owned fields
- actual inquiries table contract
- RLS and trigger behavior
- generated Supabase types
- Admin/CMS completeness
- catalog filtering/pagination
- authentication success/error handling
- password recovery semantics
- canonical host consistency
- robots
- soft 404s
- filtered catalog noindex behavior
- sitemap
- Organization JSON-LD
- account/admin noindex
- public caching
- localization
- accessibility
- motion
- error handling
- Sonner
- Admin CRUD
- CMS section types
- Media
- Articles
- Warehouses
- Taxonomy
- Audit Logs

==================================================
DATABASE VERIFICATION
==================================================

The restored CSV is the authoritative POST-DB0 contract.

Verify that it contains the expected DB-0 state including:

- 47 public tables
- approximately 98 public RLS policies
- site_pages
- site_page_translations
- site_page_sections
- site_page_section_translations
- site_settings
- site_settings_translations
- warehouse_translations
- coffees.is_featured
- coffees.featured_sort_order
- origins.is_featured
- origins.featured_sort_order
- corrected inquiry RLS policy
- Storage MIME/size hardening

Do NOT compare implementation against the old pre-DB0 schema.

==================================================
IMPORTANT INQUIRY REVIEW
==================================================

Inspect the actual database trigger/function and RLS definitions from the restored CSV.

Determine exactly which inquiry fields are application-owned versus database-owned.

Then compare them to:

src/actions/inquiries.ts

Do not assume the previous H1 finding is correct until you verify the real Post-DB0 trigger behavior.

If fields such as user_id, snapshots, status, request code or timestamps are populated/overridden by database logic, clearly state what the application should and should not send.

==================================================
SEO REVIEW
==================================================

Now that the SEO PDF is available again, re-check:

- route architecture
- English unprefixed URLs
- Arabic /ar URLs
- canonical
- hreflang
- x-default
- robots
- sitemap
- filter URLs
- pagination
- 404/410/503 behavior
- legacy redirects
- Product schema
- Organization/WebSite schema
- breadcrumbs
- commercial CMS routes

The current implementation removed trailingSlash because it created a locale redirect loop.

Judge the final architecture based on SEO consistency and correctness.

Do not demand trailingSlash purely because the original document preferred it if the no-trailing-slash implementation is canonicalized consistently.

==================================================
ADMIN / CMS REVIEW
==================================================

Do a real capability matrix.

For each module classify:

FULLY IMPLEMENTED
PARTIALLY IMPLEMENTED
DISPLAY ONLY
MISSING

Modules:

- Coffees
- Offers
- Price Tiers
- Origins
- Regions
- Coffee Types
- Processing Methods
- Varieties
- Certifications
- Tags
- Sensory Notes
- Packaging
- Warehouses
- Media
- Users
- Inquiries
- Articles
- Article Categories
- Homepage CMS
- About CMS
- Commercial CMS Pages
- Site / Organization Content
- Audit Logs

For each one check:

- list/read
- create
- update
- delete/archive where allowed
- EN/AR
- validation
- server-side admin authorization
- error handling
- Sonner / user feedback
- responsive behavior

Do not call a module complete just because a route exists.

==================================================
TEST VERIFICATION
==================================================

Inspect actual tests.

Classify:

VERIFIED
PARTIALLY VERIFIED
NOT VERIFIED
BLOCKED BY CREDENTIALS

Do not call authenticated behavior PASS unless actual authenticated E2E evidence exists.

Pay special attention to:

- Anonymous
- Unverified USER
- Verified USER
- ADMIN

and:

- price access
- price leakage
- favorites
- inquiries
- admin CRUD
- CMS
- email verification
- password recovery

==================================================
OUTPUT FILE
==================================================

Write the updated final independent review to:

./docs/CLAUDE_INDEPENDENT_REVIEW.md

Use:

# 1. Final Verdict

PASS
PASS WITH REMAINING QA
FAIL

# 2. Support Artifact Verification

# 3. Verified Implementation

# 4. Capability Matrix

# 5. Findings

BLOCKER
HIGH
MEDIUM
LOW

For each finding:

- status
- requirement
- actual implementation
- exact files
- DB evidence where relevant
- impact
- exact recommended fix

# 6. Security Review

# 7. SEO Review

# 8. Database / Supabase Review

# 9. UX / Motion / Accessibility / Responsive Review

# 10. Test Coverage Review

# 11. Remaining Operational Work

# 12. Exact Codex Remediation List

# 13. Final Recommendation

Explicitly answer:

READY FOR CODE REMEDIATION?
YES / NO

READY FOR AUTHENTICATED STAGING QA?
YES / NO

==================================================
FINAL RULE
==================================================

Do NOT modify any application file.

The ONLY file you are allowed to create/update is:

./docs/CLAUDE_INDEPENDENT_REVIEW.md

When finished, return a concise terminal summary containing:

- final verdict
- blocker count
- high count
- medium count
- low count
- findings changed after restoring the support files
- path to the review MD
- whether Codex remediation is required
- whether authenticated staging QA can start
