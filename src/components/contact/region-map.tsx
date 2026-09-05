"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

/**
 * An embedded Google map that loads only when the reader asks for it.
 *
 * The embed itself needs no API key — `output=embed` is the keyless form — so
 * nothing here depends on a credential, and none was provisioned. What it does
 * need is a deliberate load: a Google map is several hundred kilobytes of
 * third-party JavaScript that sets its own cookies, and mounting two of them
 * on every visit to `/contact` would cost the page its LCP and hand every
 * visitor to a third party before they asked for a map.
 *
 * So the resting state is a placeholder painted with the site's own map
 * texture, and one click swaps in the live map in the same box. The box has a
 * fixed aspect ratio, so the swap moves nothing around it. The card always
 * carries a plain "Open in Google Maps" link as well, which needs neither this
 * component nor JavaScript at all.
 */
export function RegionMap({
  src,
  title,
  action,
  placeName,
}: {
  src: string;
  /** Accessible name of the frame, e.g. "Map of the Dubai office". */
  title: string;
  /** Label of the button that loads the map. */
  action: string;
  placeName: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
      {loaded ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="origin-map-field absolute inset-0 grid place-items-center gap-3 p-6 text-center transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <span className="grid gap-2 justify-items-center">
            <MapPin className="size-7 text-highlight" aria-hidden="true" />
            <span className="font-heading text-lg font-bold">{placeName}</span>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold">
              {action}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
