# Phase 8 Evidence — CMS, media, articles, and project logo

**Recorded**: 2026-09-02
**Branch**: `main`; Phases 0–7 committed (`6899f98 finish phase 7`), Phase 8 uncommitted
**Phases 0–7**: not redone; re-run as regressions only.
**Database**: **unchanged**. No migration, function, trigger, RLS policy, index,
bucket or storage policy was created, altered or dropped. The pending N32
Variety translation migration was not touched.

---

## The starting picture

A runtime and live-schema audit ran before any code changed. The content
architecture was fully present in the database and almost entirely unreachable
from the application.

### What the live schema actually provides

| Object                              | State at audit                                                        |
| ----------------------------------- | --------------------------------------------------------------------- |
| `media`                             | 3 rows, all under `coffees/…`; `width`/`height` **NULL on every row** |
| `media_translations`                | 6 rows (EN + AR alt text for the three)                               |
| `coffee_media` / `origin_media`     | 3 / 0 rows; roles `MAIN`\|`GALLERY` and `HERO`\|`GALLERY`             |
| `site_pages`                        | 18 rows — **every one `DRAFT`**                                       |
| `site_page_translations`            | **0 rows**                                                            |
| `site_page_sections`                | 16 rows: HERO 1, ENTITY_LIST 5, RICH_TEXT 8, CTA 1, MEDIA_SPLIT 1     |
| `site_page_section_translations`    | **0 rows**                                                            |
| `articles` / `article_translations` | 0 / 0 rows; `articles.featured_media_id` exists                       |
| `site_settings.org_logo_media_id`   | **NULL**, and consumed by nothing                                     |
| `hills-public` storage              | only a `coffees/` prefix; `media/` empty                              |

Because `site_page_translations` is empty and every page is `DRAFT`,
`getSitePage()` returned `null` for all 18 pages: **the entire CMS was inert**,
and the public pages that appear to work are hardcoded React.

### The FK contract, read from the live schema

| Consumer                                | ON DELETE    |
| --------------------------------------- | ------------ |
| `coffee_media.media_id`                 | **RESTRICT** |
| `origin_media.media_id`                 | **RESTRICT** |
| `articles.featured_media_id`            | SET NULL     |
| `site_page_sections.media_id`           | SET NULL     |
| `site_pages.og_media_id`                | SET NULL     |
| `site_settings.org_logo_media_id`       | SET NULL     |
| `site_settings.org_default_og_media_id` | SET NULL     |
| `media_translations.media_id`           | CASCADE      |

And the check constraints that govern content:

- `site_page_sections_section_type_check` — **exactly the eight approved types**
- `site_page_sections_entity_ref_check` — the five approved feeds
- `site_page_sections_key_format` — `^[a-z0-9]+(_[a-z0-9]+)*$` (**underscores**)
- `site_pages_template_check` — HOME, ABOUT, COMMERCIAL, SEGMENT, PRICING,
  SUPPORT, LEGAL, CONTACT (**no `STANDARD`**)
- `site_pages_route_path_check` — starts **and ends** with `/`, no `//`
- `site_pages_publish_check` / `articles_published_requires_date` — PUBLISHED
  requires `published_at`

### Eleven defects the audit and the runtime found

**N50 (CRITICAL) — uploaded media could never be rendered.** No upload path
ever wrote `media.width`/`height`, and `getSitePage` drops media without both
(`next/image` needs them to reserve layout). Every image an Admin uploaded was
invisible to the CMS, silently.

**N51 (HIGH) — four of the eight section types had no renderer.** `CmsPageView`
branched on `HERO` and rendered everything else identically, so `CARD_GRID`,
`STAT_ROW`, `FAQ` and `MEDIA_SPLIT` were one column of prose.

**N52 (HIGH) — the section-type vocabulary disagreed with the database.** The
create action offered `WAREHOUSES` and `MEDIA_TEXT` (both rejected by the check
constraint) and **could not create `MEDIA_SPLIT`**, which the table already
contained.

**N53 (HIGH) — the project logo relation was consumed by nothing.**
`BrandMark` rendered a hardcoded path; choosing a logo changed nothing anywhere.

**N54 (HIGH) — creating a CMS page with the default template always failed.**
The template select's first and default option was `STANDARD`, which
`site_pages_template_check` has always rejected.

**N55 (HIGH) — section keys were validated as hyphenated slugs.** The database
requires snake_case, so any multi-word key was refused.

**N56 (HIGH) — articles could not have an image.** `saveArticleAction` never
wrote `featured_media_id`, and the public query never read it.

**N57 (HIGH) — a second, weaker upload system existed.**
`admin-operations.ts`'s `uploadMediaAction` trusted the browser-declared MIME
type instead of the file's signature, recorded no dimensions, and
`updateMediaTranslationAction` returned the provider's error text verbatim.

**N58 (MEDIUM) — route paths were validated against the wrong rule.** Only the
leading `/` was checked; the constraint also requires a trailing one, so a
natural `/help` was refused by the database with no explanation.

**N59 (MEDIUM) — a rejected Admin submit silently emptied every `<select>`.**
React resets the form element once an action settles; for a `<select>` whose
value did not change it skips the DOM write, so the browser showed the reset
option while React believed otherwise. The next submit sent an empty value and
was rejected for a reason invisible on screen.

**N60 (HIGH) — a page created in the Admin returned 404.** The dynamic CMS
route served a hardcoded allow-list of eleven page keys, so publishing a new
page still required editing code — which is exactly what Phase 8 exists to end.

Plus **N48-class** repeats found at runtime: a success message nested inside a
control group that disappears on success (media restore), and inline errors
rendered inside a `<label>`, which makes them part of the field's accessible
_name_ rather than its description.

---

## P8-T01 — Typed CMS section registry — **PASS**

`src/lib/cms/sections.ts` maps each of the eight approved types to its editor
expectations, its validation rule and its renderer. The list is asserted equal
to the live check constraint's, and the live database is asserted to accept
exactly those eight and reject `WAREHOUSES`, `MEDIA_TEXT` and `BANNER`.

**Storage note, recorded as a deliberate decision.** The schema gives a section
`media_id`, `cta_href`, `entity_ref`, `entity_limit` and — per locale —
`heading`, `subheading`, `body_markdown`, `cta_label`. There is no JSON props
column and Phase 8 may not add one. The three list-shaped types therefore
express their items through `body_markdown` in a documented convention the
registry both validates and parses:

| Type        | Convention                          | Rule                  |
| ----------- | ----------------------------------- | --------------------- |
| `CARD_GRID` | `### Title` then its text, repeated | at least two cards    |
| `STAT_ROW`  | `- value — label`, one per line     | at least two figures  |
| `FAQ`       | `### Question` then its answer      | at least one question |

The convention is plain Markdown, shown as hint text beside the field, so the
body stays readable and safe if ever rendered as ordinary prose. **Nothing is
computed** in `STAT_ROW`: a figure on the page is one an Administrator typed.

Validation happens in two places, both before anything reaches a visitor:

- **Before the write** — `saveSectionAction` refuses to make a section visible
  until its content satisfies its type. Issues are split by which form can fix
  them: `mediaId`/`entityRef`/`entityLimit`/`ctaHref` become field errors on the
  settings form, while heading/body issues become a form-level message pointing
  at the content editor beside it. (Reporting the latter as field errors
  produced a _silent_ rejection, since those inputs are on the other form.)
- **Before the render** — `getSitePage` validates every section and drops the
  ones that fail, logging the reason server-side. A visitor sees a page missing
  one block; never a crash, a hydration error or a stack trace. An unknown type
  is impossible to render, because the renderer switches on a narrowed union.

**Runtime proof**: a `CARD_GRID` with one card is refused with "Add at least
two cards…"; a `FAQ` made visible with no content is refused with "Add this
section's English content before showing it publicly"; the invalid card grid is
simply absent from the published page while the rest of it renders.

---

## P8-T02 — `BrandMark` → `site_settings.org_logo_media_id` — **PASS**

`getSiteLogo()` resolves the relation and returns `null` on **every** way it can
be unusable: no settings row, NULL relation, archived media, non-public media,
missing dimensions, or a thrown error. `BrandMark` then draws the official
static artwork. It is `cache()`d, so a page drawing the mark in its header,
footer and mobile menu costs one round trip.

One failure the database cannot see is a **storage object that is gone**. That
is caught in the browser: `BrandImage` swaps to the static asset on a load
error. Without it, "the logo must never disappear" would hold everywhere except
the one case the database has no view of.

No new column. No second logo table. No light/dark pair. The static asset stays
the fallback, never a stored row.

The Admin sign-in shell had **no logo at all** — moving those routes out of the
public chrome in an earlier phase had taken it away. It now carries the mark.

**Runtime proof**: with a logo configured, `/`, `/ar`, `/sign-in`,
`/dashboard-admin` and `/admin` all serve an `<img>` whose `src` is the Supabase
storage URL, at the image's own aspect ratio (asserted within 0.2 of 24÷16, not
the artwork's 529÷231), in both themes. On `/ar` the alt text is the Arabic one.
Clearing the selection restores `/images/logo-mark.png` immediately —
`revalidatePath("/", "layout")` means a successful save never leaves stale
chrome.

---

## P8-T03 — Media Library, reusable picker, reference-aware archiving — **PASS**

### One pipeline

`src/lib/media/upload.ts` is now the single ingest path, shared by the Media
Library and the Phase 6 coffee uploader. Size before bytes; the real signature
must agree with the declared type; **intrinsic dimensions are read and stored**
(`src/lib/media/dimensions.ts`, a bounds-checked PNG/JPEG/WebP header parser
with 6 unit tests against real encoded fixtures); the server chooses the path
and never uses the client's filename; and orphans are impossible in either
direction. The legacy uploader was deleted, and a structural test now asserts
that `.upload(` appears in exactly two files — this pipeline and the customer
avatar, which is a different bucket with its own owner-scoped policies.

### One picker

`src/components/admin/media-picker.tsx` serves coffee, origin, article, CMS
section and site logo. It contributes a plain hidden input, so the surrounding
form submits a media id like any other field and the server keeps validating it.
Uploading happens by calling the action directly rather than nesting a second
`<form>` — a nested form is dropped by the browser, which would have made the
button do nothing. A structural test asserts exactly one `MediaPicker` exists
and at least three consumers import it.

### The reference check

`findMediaReferences()` covers all seven consumers. Archiving is a **soft
delete**, which no foreign key defends against — the live suite proves the
database will happily retire an image a section still points at and say
nothing. So the refusal is the application's job: the first archive attempt on a
referenced item is refused by the server and the Admin is shown exactly what
depends on it, by name; only an explicit, differently-labelled second button
proceeds.

Hard deletion is a separate second step, only available once archived, and the
`RESTRICT` refusal from `coffee_media`/`origin_media` is translated to a domain
message — the constraint name never reaches the Admin.

| Scenario               | Result                                           |
| ---------------------- | ------------------------------------------------ |
| unreferenced media     | archives (and hard-deletes) normally             |
| coffee-referenced      | warning; hard delete refused by RESTRICT (23503) |
| origin-referenced      | warning; hard delete refused by RESTRICT         |
| article-referenced     | warning; hard delete SET NULLs the reference     |
| CMS-section-referenced | warning; hard delete SET NULLs the reference     |
| site-logo-referenced   | warning; hard delete SET NULLs the relation      |
| media row deleted      | `media_translations` cascade away                |

### Missing media

A row whose storage object is gone shows a stated message on the detail page —
not a broken-image icon. Archived media is treated as absent by the CMS
renderer, the article query and the logo resolver alike, so retiring an image
degrades content rather than breaking it: after archiving, the article still
returns 200 and simply renders without its image.

### Alt text

English alt text is required — an image with no accessible name is one a
screen-reader user cannot use, and nothing can honestly invent one. Arabic is
optional and its absence is **stated** ("Missing Arabic alt text") in the
library grid, the picker and the detail editor. Nothing is auto-translated.

---

## P8-T04 — Test matrix — **PASS**

### Unit — `npm test` — **137 passed**, 15 files

New: `src/lib/media/dimensions.test.ts` (6), `src/lib/cms/sections.test.ts`
(13), `src/lib/content-boundaries.test.ts` (14). The Phase 6 coffee-media
boundary tests were **retargeted, not weakened**: they follow the guarantees
into the shared pipeline and now additionally assert that the coffee action
never uploads on its own and that dimensions are recorded.

### Live database — `npm run test:integration` — **95 passed**, 7 files

`tests/integration/content-media.test.ts` (10 new) proves the section-type
vocabulary, the snake_case key rule, the `STANDARD` template rejection, the full
media reference matrix with each FK's real delete rule, translation cascade,
the soft-delete gap that motivates the warning, anonymous and customer write
denial on `media`/`site_pages`/`articles`/`site_settings`, Admin write success,
draft invisibility, and the logo resolution predicate under archived,
non-public and dimensionless states.

### Browser — `tests/e2e/content-workflow.spec.ts` — **8/8**

Media upload (valid, hostile-file rejection with value preservation, missing
alt), alt-text editing and usage display, the full CMS build → translate →
section → publish flow with the publish-without-English refusal, section
validation refusals, XSS sanitization on the published page, article creation
with a picked image → publish → public render → draft 404, the archive warning
and confirmation with graceful article degradation, the logo across five
surfaces and both themes plus the clear-to-fallback path, and customer denial
of every Phase 8 Admin route.

### Full regression

| Suite                                  | Result                              |
| -------------------------------------- | ----------------------------------- |
| `npm test`                             | **137 passed**                      |
| `npm run test:integration`             | **95 passed**, 7 files              |
| Playwright desktop, shard 1/2          | **76 passed, 0 failed**             |
| Playwright desktop, shard 2/2          | **70 passed, 4 skipped, 0 failed**  |
| Playwright mobile                      | **71 passed, 83 skipped, 0 failed** |
| Playwright dev config                  | **73 passed, 0 failed**             |
| `npm run typecheck` / `lint` / `build` | clean                               |

The desktop project is sharded because the suite now exceeds a ten-minute
single run. Per the Phase 6 N39 lesson the production server was rebuilt from a
cleared `.next` and **verified before every run** (`/robots.txt` → 200,
`/admin` → 307, `/admin/media|content|articles` → 307).

### XSS

A section body containing `<script>`, an `onerror` attribute and a
`javascript:` link was authored through the Admin and published. On the public
page: `window.__xss` is `undefined`, no `<script src>` exists in `main`, no
`img[src="x"]`, no `a[href^="javascript:"]`, and no Next.js inline script
contains the payload. `rehypeSanitize` + `skipHtml` are unchanged; a structural
test asserts the CMS renderer has no `dangerouslySetInnerHTML` at all and that
the article page's single sink is the JSON-LD script, which never carries prose.

### Scope checks

- **No new column, table or migration.** A structural test scans every source
  file for `image_url`, `image_path`, `gallery_urls`, `featured_image_url`,
  `logo_url`, `logo_path`, `dark_logo_id`, `light_logo_id`.
- **No service-role** in any content path.
- **No Sucafina content.** The only content created was `[QA-P8]` fixtures.
- **No fabricated business claims.** `STAT_ROW` computes nothing; every figure
  is one an Administrator typed.
- **Dynamic business media stays in Supabase.** `public/images` gained nothing.

### Test-data lifecycle

Every fixture account is `e2e-hills-p8-…@example.com` / `p8…@example.com` on the
reserved domain, and every row is `qa-p8-…`. Verified against the live database
after the final run:

```
stray P8 fixture accounts: 0
site_pages qa-p8 rows: 0 | media qa-p8 rows: 0 | article qa-p8 rows: 0
media: 3   media_translations: 6
site_pages: 18   site_page_translations: 0
site_page_sections: 16   site_page_section_translations: 0
articles: 0   article_translations: 0
org_logo_media_id: null
storage media/ objects: 0
Phase 6 QA catalog preserved -> coffees: 2  offers: 3
```

The database is byte-for-byte back to its pre-Phase-8 state. **No QA rows were
left persistent** and **no orphan storage objects exist**. The owner-approved
Phase 6 QA catalog is untouched.

---

## P8-T05 — PHASE 8 ACCEPTANCE GATE — **PASS**

Every P8-T04 condition holds with the runtime and database evidence recorded
above. No claim in this document rests on source inspection alone.

### Findings closed in Phase 8

| ID  | Severity | Finding                                                                   |
| --- | -------- | ------------------------------------------------------------------------- |
| N50 | CRITICAL | no upload recorded intrinsic dimensions, so uploaded media never rendered |
| N51 | HIGH     | four of eight section types had no renderer                               |
| N52 | HIGH     | section-type vocabulary disagreed with the live check constraint          |
| N53 | HIGH     | `org_logo_media_id` was consumed by nothing                               |
| N54 | HIGH     | the default page template was one the database rejects                    |
| N55 | HIGH     | section keys validated as hyphenated slugs, not snake_case                |
| N56 | HIGH     | articles could not have a featured image                                  |
| N57 | HIGH     | a second upload system trusted declared MIME and leaked provider text     |
| N58 | MEDIUM   | route paths validated against the wrong rule                              |
| N59 | MEDIUM   | a rejected Admin submit silently emptied every `<select>`                 |
| N60 | HIGH     | a page created in the Admin returned 404 (hardcoded route allow-list)     |

### Deliberately not done

- **N32** (Variety Arabic translations) — untouched, still awaiting owner
  approval, as instructed.
- **N49** — `updateWorkflowStatusAction` still returns `error.message` for its
  **offers** and **content** branches. Its inquiry branch went in Phase 7; the
  media branches went here with the actions they belonged to. What remains is
  outside Phase 8's surface and stays deferred to Phase 11.
- **Public visual redesign** — Phase 9. **Admin visual redesign** — Phase 10.
- **Origin media UI** — was deferred as **N61 (LOW)**; the owner then asked for
  it, and it is now **CLOSED**. See the addendum below.

### Carried forward

- **P3-T06** remains PENDING on one manual Gmail confirmation.
- **N23** still needs an owner decision.
- The 18 CMS pages remain `DRAFT` with no translations. That is authoring work,
  not implementation: the Admin can now do it without touching code.

---

## Addendum — N61 closed (origin media workflow)

**Recorded**: 2026-09-02. Scope: finding N61 only. No Phase 8 work was reopened.

`origin_media` was already complete in the live schema and unreachable from the
Admin. Its contract mirrors `coffee_media` exactly:

```
origin_media_pkey            PRIMARY KEY (origin_id, media_id)
origin_media_one_hero_image  UNIQUE (origin_id) WHERE role = 'HERO'
origin_media_role            CHECK (role IN ('HERO','GALLERY'))
media_id                     REFERENCES media(id)   ON DELETE RESTRICT
origin_id                    REFERENCES origins(id) ON DELETE CASCADE
sort_order                   integer NOT NULL DEFAULT 0
```

So "exactly one hero" is a database guarantee, and the application's only job is
to promote in an order the index accepts: **demote the current hero first**.
Promoting first is rejected, which is proven both ways in the live suite.

### What was built

- `src/lib/data/origin-media.ts` — the Admin read path, `requireAdmin()`-gated,
  resolving each linked image with its alt text and surfacing an archived one
  rather than hiding it.
- `src/actions/admin-origin-media.ts` — attach (HERO or GALLERY), promote,
  unlink, reorder. Every action re-checks `requireAdmin()`, verifies both
  references server-side, and returns a message key; no provider text.
- `src/components/admin/origin-media.tsx` — mounted on the existing
  `/admin/origins/[id]` editor.

### One deliberate difference from the coffee flow

Removing an image here **unlinks it and stops**. A coffee image is created by
and for that coffee, so Phase 6 deletes the media row with it. An origin image
is _chosen from the shared library_ and may also be an article's featured image
or the site logo — deleting it would destroy someone else's content. That is
also why `origin_media.media_id` is `ON DELETE RESTRICT`: the database expects
the link to be removed first, never the media.

If the removed image was the hero, the first remaining gallery image is promoted
so the origin does not silently lose one.

### No duplicate implementation

The reusable `MediaPicker` is the only way to choose an image, and its own
upload control still routes through the single secure pipeline, so a brand-new
image can be brought in without leaving the page and **no upload code exists in
this feature**. The picker gained one optional `onSelect` callback — the hidden
input remains how a surrounding `<form>` reads the value; this is for the one
consumer that attaches through its own action rather than a form submit.

The Phase 8 media reference check already covered `origin_media`, so an origin
image now appears in the Media Library's usage list and triggers the archive
warning with no change to that code.

### Evidence

**Live database** — `tests/integration/origin-media.test.ts` — **10/10**: an
origin starts empty; `MAIN` is rejected as a role (23514); a second HERO is
rejected (23505); demote-then-promote replaces the hero and leaves exactly one;
many gallery images hold their `sort_order` through a reorder; the same image
twice on one origin is rejected by the composite key; unlinking leaves the
library row intact; a hard delete of media an origin uses is refused by RESTRICT
(23503); the origin appears in that media item's reference query; and anonymous
and customer clients are denied insert, update and delete.

**Browser** — `tests/e2e/origin-media.spec.ts` — **7/7**: the empty state, hero
assignment, hero replacement, gallery build + reorder + promote, removal leaving
every library row alive, the Media Library archive warning naming the origin,
the Arabic workspace rendering RTL with no English leaking and no horizontal
overflow, and a customer denied the origin editor.

**Regression** — `npm test` **137**, `npm run test:integration` **105** (8
files, was 95/7), `tests/e2e/admin-catalog.spec.ts` **18/18** (coffee
MAIN/GALLERY unchanged), `tests/e2e/content-workflow.spec.ts` **8/8**,
typecheck and lint clean.

**Data**: no migration, no schema/RLS/storage change, no new column, table or
bucket. Every `qa-n61` row and fixture account was removed — verified: 0 stray
accounts, 0 `qa-n61` origins or media, `origin_media` back to 0 rows, storage
`media/` empty, Phase 6 QA catalog intact (2 coffees / 3 offers).

---

## Addendum — final runtime UI acceptance sweep

**Recorded**: 2026-09-02. Every Phase 8 surface driven through its real Admin
form: data typed in and submitted, reloaded to prove persistence, opened on the
public side, edited again, and given invalid input to prove the inline
validation. No row was inserted to make a screen look like it worked.

`tests/e2e/phase8-ui-sweep.spec.ts` — **6/6**, with `tests/e2e/ui-audit.ts`
running on every screen in **English and Arabic × light and dark**:

- **raw translation keys** — any dotted path from a real message namespace
  appearing as visible text
- **broken images** — a visible `<img>` that completed loading with
  `naturalWidth === 0`
- **unreadable text** — computed contrast below 3:1 against the element's own
  painted background, across labels, inputs, selects, buttons, headings, table
  headers and both live regions
- **horizontal overflow** — the document scrolling sideways
- **console** — `collectPageProblems` gates every flow on application errors

### Four defects found and fixed

**N62 (HIGH) — a raw translation key on screen.** The Articles create form
resolved `admin.articles.statusPublished`, which does not exist, so next-intl
rendered the literal path as the "Show as featured" option. Real `yes`/`no`
labels were added, and the status and featured selects stopped borrowing
"Choose a category" as their placeholder. A repo-wide audit now confirms every
literal `t("…")` in the tree resolves in both catalogues, and the computed key
families (`status*`, `type*`, `ref*`, `usage*`) and all 55 server-action message
keys were checked exhaustively.

**N63 (HIGH) — type-specific section fields never appeared on the add form.**
`SectionSettingsForm` derived the editor shape from an _existing_ section, so
when creating one the type was chosen in that same form and nothing reacted:
an `ENTITY_LIST` could not be given its feed and a `MEDIA_SPLIT` could not be
given its image. The form now tracks the chosen type and follows it live.

**N64 (MEDIUM) — `STAT_ROW` printed every label twice.** One `sr-only` copy and
one `aria-hidden` copy, so the readable text was hidden from assistive
technology and the announced text from everyone else. Now one `dt` per label,
with `flex-col-reverse` keeping the figure above it visually while the DOM
holds the `dt` → `dd` order a description list needs.

**Placeholder misuse (LOW)** — the article status and "show as featured" selects
offered "Choose a category" as their empty option.

### What the sweep confirmed

All eight approved section types were **created through the Admin editor and
rendered on the published public page**, each with its own structure verified —
card grid headings, a two-term description list, two FAQ disclosures, the CTA
link, the media-split image, the hero, rich text and the entity list. Not one
was accepted on the strength of a parser test.

Articles: every required field reports under itself with `aria-invalid` and an
`aria-describedby` association, an invalid slug is named as such, valid values
survive a rejection, a draft 404s publicly, publishing makes it visible in both
languages with its featured image, and archiving that image degrades the
article rather than breaking it.

Logo: chosen through the picker, persisted across reload, present in the public
header, the Arabic header, the customer auth shell, the Admin workspace sidebar
and the signed-out Admin sign-in shell, in both themes — then reset to the
official artwork.

Language switching preserves both stored translations, and a section still
lacking Arabic is marked `lang="en"` in the markup rather than passed off as
Arabic.

### Results

RAW TRANSLATION KEYS: 1 found (N62), 0 remaining.
BROKEN IMAGES: 0. RAW DB ERRORS: 0. FIELDS WITHOUT INLINE VALIDATION: 0.
UNTRANSLATED UI: 0. LIGHT DEFECTS: 0. DARK DEFECTS: 0. RTL DEFECTS: 0.
CONSOLE ERRORS: 0.

Regression after the fixes: unit **137**, live integration **105** (8 files),
`content-workflow` **8/8**, `origin-media` **7/7**, `admin-catalog` **18/18**,
typecheck, lint and build clean.

Data: every sweep row and fixture account removed — 0 stray accounts, 0 QA rows
in `site_pages`/`media`/`origins`/`articles`, `origin_media` at 0, storage
`media/` empty, `org_logo_media_id` back to NULL, Phase 6 QA catalog intact
(2 coffees / 3 offers).
