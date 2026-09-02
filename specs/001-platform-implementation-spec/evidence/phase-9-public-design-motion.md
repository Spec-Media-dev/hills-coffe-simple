# Phase 9 — Public design and motion rebuild

**Started**: 2026-09-02  
**Reference reviewed**: <https://sucafina.com/emea>  
**Boundary**: visual and interaction inspiration only. No Sucafina copy, media,
code, brand devices, business claims, or data behavior is copied.

## Pre-implementation design forensics

The current rendered Sucafina EMEA site was reviewed at desktop (1440 × 900)
and mobile (375 × 812) before any Hills public UI change. The review covered
the homepage, offering list, origins index, Brazil and Ethiopia origin detail,
About, News, one article, Contact, FAQ, the desktop offering mega menu, mobile
navigation, responsive offering rows, and the mobile footer.

### Homepage

- **Hierarchy and hero** — a slim family-sites utility strip precedes a clean
  primary header; the hero is nearly viewport-height, image-led, and uses one
  very large condensed statement plus a short sequence of selectable ideas.
- **Typography and spacing** — oversized display type, compact utility labels,
  and long pauses between editorial sections create confidence without adding
  interface chrome.
- **Motion and interaction** — the hero behaves as a staged narrative rather
  than a decorative carousel; highlighted copy and active headings do most of
  the state communication.
- **Useful Hills idea** — give the first screen one strong proposition, then
  let sourcing, available coffee, origins, quality, warehouses, account, and
  knowledge unfold as distinct editorial beats.
- **Do not copy** — the “Source Smart” phrase, its photography, turquoise
  highlight treatment, exact carousel behavior, or corporate family bar.

### Offering list

- **Hierarchy and grid** — the desktop page is a restrained data workspace:
  category tabs, search, filters, a protected-price notice, and dense rows.
  Mobile converts each row into a legible stacked record rather than squeezing
  the table.
- **Typography and ratios** — product names lead; origin, bags, warehouse, and
  status are secondary. The listing favors information density over large
  decorative images.
- **Interaction** — filters are grouped and count their active state; price
  protection is visible before results; each mobile record has a clear detail
  affordance.
- **Useful Hills idea** — preserve Hills’ bounded server query while giving
  search, filters, availability, and price protection a clearer visual order.
- **Do not copy** — field names, table styling, catalog categories, statuses,
  product copy, or any live offering data.

### Origins index

- **Hierarchy and hero** — a short centered introduction opens into a very
  large geographic visual with generous whitespace.
- **Grid and interaction** — regions act as the browsing model; the map is a
  discovery surface rather than a literal inventory table.
- **Useful Hills idea** — make origin browsing feel geographic and editorial,
  while keeping every origin and count sourced from Hills data.
- **Do not copy** — the world-map artwork, region taxonomy, labels, or map
  interaction implementation.

### Origin detail — Brazil and Ethiopia

- **Hierarchy and image ratios** — both pages use an asymmetric color-field
  hero with a large title, narrative copy, and portrait editorial media. Brazil
  uses one tall image and a line illustration; Ethiopia varies the template
  with overlapping crops.
- **Spacing and content** — a clear details band follows the hero, then offers,
  then long-form origin material. Vertical side labels help mark chapters.
- **Motion potential** — image masks and staggered copy suit this composition;
  media should reveal without delaying access to the title or story.
- **Useful Hills idea** — let each origin’s live Supabase hero/gallery media
  vary the composition, with a strong no-media fallback that remains honest.
- **Do not copy** — country art, color scheme, photographs, prose, or the exact
  overlap geometry.

### About

- **Hierarchy and grid** — a centered statement is followed by large,
  alternating information bands. The first visible locations section pairs a
  bold color block/illustration with practical office details.
- **Useful Hills idea** — alternate editorial storytelling with concrete local
  details so the page feels credible, not like a generic company manifesto.
- **Do not copy** — location data, approach language, manifesto structure, or
  illustrations.

### News listing

- **Hero and cards** — one current story receives a full-width split feature;
  supporting stories become a compact visual row before search/category tools
  and the main article grid.
- **Typography and imagery** — portrait or landscape photography is allowed to
  dominate; category and date stay small and consistent.
- **Useful Hills idea** — feature the first published article when real media
  exists, then use a measured editorial grid with an honest empty state.
- **Do not copy** — article content, categories, dates, photography, or the
  turquoise feature background.

### Article detail

- **Hierarchy and ratio** — the article begins with a large split image/title
  composition, followed by a narrow reading column, tags/sharing, previous/next
  navigation, and related cards.
- **Useful Hills idea** — separate the visual masthead from a comfortable
  reading measure and keep featured media prominent when the CMS supplies it.
- **Do not copy** — article text, portrait, share services, or related-story
  selection logic.

### Contact and FAQ

- **Contact** — the public contact surface delegates its form to an embedded
  provider; during review the iframe body was blank, which is a useful warning
  against making an external embed the only visible contact experience.
- **FAQ** — questions are grouped by topic in wide, quiet accordion rows with
  one chevron and ample touch space. The page keeps the introduction short.
- **Useful Hills idea** — retain server-owned Hills contact details and forms;
  use the CMS FAQ renderer for progressive disclosure with visible focus and
  reduced-motion-safe expansion.
- **Do not copy** — questions, answers, topics, embedded form, or contact data.

### Desktop navigation

- **Structure** — a stable white header separates the mark, four primary
  families, search, region, and login. Hover/focus opens a two-column mega menu:
  category families on the left and immediate destinations on the right.
- **Interaction** — the panel is aligned to its trigger, arrives with a short
  translate/fade, and remains reachable through focus-within.
- **Useful Hills idea** — one Hills catalog mega panel can expose catalog,
  origins, warehouse shortcuts, and protected-pricing context without creating
  a second data source.
- **Do not copy** — menu labels, regional selector, family sites, or layout
  dimensions.

### Mobile navigation

- **Structure** — the header reduces to hamburger, mark, search, and region.
  The drawer is a full-height white surface with a close action, four large
  chapter rows, and a separate login card anchored near the bottom.
- **Useful Hills idea** — use a full-height, focus-trapped drawer with strong
  row targets, progressive sub-navigation, and a clearly separated account
  action.
- **Do not copy** — its four labels, numbering, region treatment, or login
  wording.

### Footer and responsive behavior

- **Desktop/mobile footer** — desktop groups account, legal, contact, social,
  mark, and newsletter. Mobile stacks the same information on a bold color
  field and places copyright in a contrasting final strip.
- **Responsive pattern** — tables become records, navigation becomes a drawer,
  editorial splits stack image-first or copy-first, and touch targets stay
  generous. Content is re-composed, not merely shrunk.
- **Useful Hills idea** — build a richer Hills footer from real navigation,
  warehouse, and contact data; preserve honest omissions when settings are
  empty.
- **Do not copy** — newsletter workflow, social accounts, legal text, yellow
  field, or visual identity.

## Hills design translation

- Keep the approved Hills palette: forest `#173C32`, cream `#EEE4D1`, ochre
  `#CE8A39`, and orange `#A44819`.
- Keep the configured `BrandMark`, Manrope/Cairo/Readex typography, EN/AR route
  parity, RTL logical properties, light/dark themes, and server-rendered data.
- Prefer border-led editorial surfaces, purposeful color fields, restrained
  radii, and one dominant composition per section.
- Use motion to explain hierarchy: page arrival, section reveal, image mask,
  hover lift, underline, mega-menu/drawer disclosure, accordion expansion,
  filter/result transition, modal/status feedback.
- Under `prefers-reduced-motion: reduce`, render every element immediately and
  remove translation, scale, parallax, stagger, and view-transition animation.

## Baseline matrix

Pre-change screenshots are stored under `evidence/phase-9/baseline/`, captured
from the clean Phase 8 commit (`27648ca`) in a temporary detached worktree.
Post-change captures are stored under `evidence/phase-9/final/`.

## Source-reference implementation table

| Reference observation                   | Hills adaptation                                                                                             | Explicit exclusion                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Desktop offering-family disclosure      | Accessible Products mega panel with catalog, origin, and warehouse shortcuts sourced from Hills routes       | No region selector, Sucafina labels, dimensions, or content |
| Mobile full-height navigation           | Focus-trapped logical-side Hills drawer with account action and Escape/focus return                          | No copied numbering, regions, or login copy                 |
| Offering filters and responsive records | Existing bounded Hills query presented through desktop filters and a counted mobile drawer                   | No copied fields, status model, prices, or inventory        |
| Restrained product hover                | Five-pixel lift and 1.025 media scale on Hills catalog cards                                                 | No copied card geometry, imagery, or offer data             |
| Editorial origin/story pacing           | Asymmetric Hills color fields, large display hierarchy, CMS/database media, and an original CSS map fallback | No copied country artwork, map, prose, or photography       |
| Featured-news hierarchy                 | First real published Hills article becomes the feature; later articles use a border-led grid                 | No copied categories, dates, story selection, or assets     |

Repository scans found zero case-insensitive `sucafina` references in
application source or public assets. Every final image is an approved Hills
static asset or a URL read from the existing Supabase media relationships.

## Delivered public system

- Added exactly the 12 approved motion primitives:
  `PageReveal`, `SectionReveal`, `ImageReveal`, `HoverLift`,
  `NavUnderline`, `MegaMenuReveal`, `DrawerReveal`, `AccordionExpand`,
  `FilterTransition`, `Toast`, `Modal`, and `Status`.
- Persistent page content animates with transform or clipping, never from
  opacity zero. This keeps first paint readable and prevents transient
  contrast failures. Reduced motion removes translation, scale, clipping,
  stagger, and delay while retaining every control and content node.
- Rebuilt the homepage in the approved order: hero, sourcing, featured
  coffees, origin discovery, quality, warehouses, account CTA, knowledge,
  footer. Live-empty sections state that content is unavailable instead of
  fabricating it.
- Reworked the public shell, catalog list/detail, origins list/detail,
  knowledge list/detail, About, Contact, request-a-quote, CMS FAQ/media
  sections, filters, cards, mobile drawer, and modal presentation.
- Preserved the existing database schema, route model, server query bounds,
  Auth and price gates, JSON-LD placement, CMS sanitization, and Admin
  separation.
- Localized global accessibility labels, continent presentation, bag labels,
  offer statuses, and empty states in EN/AR; all layout and directional motion
  uses logical RTL-safe placement.

## Visual and runtime evidence

### Screenshot sets

- `evidence/phase-9/baseline/`: 8 genuine pre-change homepage captures
  (EN/AR × light/dark × 375/1440).
- `evidence/phase-9/final/`: the matching 8 homepage captures plus curated
  catalog desktop/mobile, origin detail, Arabic About tablet, and Contact
  desktop captures.
- The automated test also wrote the full 72-screen route matrix
  (6 routes × 2 locales × 2 themes × 3 viewports) to the ignored local
  `artifacts/phase-9/` directory while checking headings, price leakage,
  broken images, raw translation keys, contrast, and horizontal overflow.

### Verification results

| Gate                           | Result                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| TypeScript                     | `npm run typecheck` — PASS                                                                                      |
| ESLint                         | `npm run lint` — PASS                                                                                           |
| Unit                           | `npm test` — 16 files, 139/139 PASS                                                                             |
| Live integration               | `npm run test:integration` — 8 files, 105/105 PASS                                                              |
| Production build               | `npm run build` — PASS, 76 static pages generated                                                               |
| Phase 9 Playwright             | 5/5 PASS, including all 72 matrix screens                                                                       |
| Accessibility                  | 36/36 executable desktop/mobile axe scans PASS; 4 credential-dependent shell scans remain intentionally skipped |
| Locale/public/theme regression | 90 PASS, 4 viewport-specific skips                                                                              |
| Changed-file formatting        | Prettier PASS for every Phase 9 file                                                                            |

The repository-wide `npm run format:check` still reports 40 pre-existing
format warnings in skill/config/spec documents outside this change. Phase 9
did not rewrite those unrelated files; a direct check of every changed
TypeScript, TSX, JSON, CSS, and Markdown file passes.

### Production performance

Measured from the optimized local production build with buffered
`PerformanceObserver` entries:

| Viewport    |    LCP |    CLS | Target                   |
| ----------- | -----: | -----: | ------------------------ |
| 375 × 812   | 496 ms | 0.0000 | PASS (≤ 2500 ms / ≤ 0.1) |
| 1440 × 1000 | 388 ms | 0.0000 | PASS (≤ 2500 ms / ≤ 0.1) |

## Gate result

`P9-T01` through `P9-T06` pass. The public website is visually distinctive,
responsive from 375 through 1440, bilingual/RTL-safe, light/dark capable,
keyboard and reduced-motion accessible, backed by real Hills content, and
free of copied Sucafina content or assets. Phase 10 and Phase 11 were not
started.
