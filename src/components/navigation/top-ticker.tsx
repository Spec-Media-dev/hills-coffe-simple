/**
 * The category strip above the header.
 *
 * Decorative and inert by design: no links, no buttons, no live region. Every
 * label it shows is already reachable — and reachable *properly* — through the
 * Products menu directly beneath it, so the whole strip is `aria-hidden` rather
 * than making a screen reader sit through a loop of duplicated text.
 *
 * The content is real. `SiteHeader` already loads `getCatalogFacets(locale)` for
 * the mega menu, and this reuses that same object: published coffee types and
 * processing methods, already localized, with no second query and no invented
 * copy. If the catalogue is too sparse to fill a loop the strip renders nothing
 * at all, rather than cycling two words forever.
 *
 * Three details are load-bearing rather than cosmetic:
 *
 * **Exactly two identical groups.** Both `<ul>`s render the same `shown` array
 * with the same markup, so the browser lays them out at the same measured
 * width — nothing here has to compute or track that width in script. The
 * animation then translates the track by exactly -50%, which is therefore
 * exactly one group's width: the second group is already sitting where the
 * first one started, so the loop has no seam and no blank gap. Any other
 * multiple of two copies would still be mathematically seamless, but would
 * animate that many more DOM nodes for no benefit — two is the minimum that
 * closes the loop and the right number to render.
 *
 * **The track is forced to `dir="ltr"`.** The strip must travel physically
 * right-to-left in both languages. Pinning the flex order makes the layout and
 * the translate agree in every locale instead of depending on how a browser
 * resolves overflow direction for an RTL box wider than its container. Each
 * label still shapes its own text correctly — bidi handles that within the span
 * — and no letter-spacing is applied anywhere here, because tracking would break
 * Arabic letterforms and this element sits outside the `[dir="rtl"]` guard that
 * protects `.eyebrow`.
 *
 * **The second group is `aria-hidden`.** Not that it matters for a screen
 * reader — the wrapper above already hides the whole strip — but it keeps the
 * duplication honest: there is exactly one accessible copy of this decorative
 * list, the second exists purely so the animation has something to scroll into.
 */

/** Below this there is not enough material to look like a loop. */
const MIN_ITEMS = 4;
/** Long enough to read, short enough that the track stays cheap to animate. */
const MAX_ITEMS = 18;

export function TopTicker({ items }: { items: string[] }) {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (unique.length < MIN_ITEMS) return null;
  const shown = unique.slice(0, MAX_ITEMS);

  return (
    <div
      aria-hidden="true"
      className="ticker border-b border-white/10 bg-primary text-primary-foreground"
    >
      <div className="ticker-track" dir="ltr">
       {Array.from({ length: 6 }, (_, copy) => (
  <ul
    key={copy}
    aria-hidden={copy > 0}
    className="flex shrink-0 items-center"
  >
    {shown.map((item, index) => (
      <li
        key={`${copy}-${index}`}
        className="flex shrink-0 items-center gap-6 py-1.5 pe-6 text-xs font-semibold whitespace-nowrap text-primary-foreground/70"
      >
        {item}
        <span className="text-gold-bright/70">·</span>
      </li>
    ))}
  </ul>
))}
      </div>
    </div>
  );
}
