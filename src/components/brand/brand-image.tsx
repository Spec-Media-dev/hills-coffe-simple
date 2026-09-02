"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The configured logo, with the official artwork as a live fallback.
 *
 * `getSiteLogo()` already rules out a NULL relation, an archived row, a
 * non-public row and missing dimensions. One failure it cannot rule out from
 * the database is a **storage object that is no longer there** — a bucket
 * cleaned by hand, a restore that missed a file. That only becomes visible
 * when the browser tries to load it.
 *
 * So the last fallback lives here: on a load error the component swaps to the
 * static asset. Without it, "the logo must never disappear" would hold for
 * every case except the one the database cannot see (§20, §33).
 */
export function BrandImage({
  src,
  fallbackSrc,
  fallbackAspect,
  alt,
  height,
  aspect,
  priority,
}: {
  src: string;
  fallbackSrc: string;
  fallbackAspect: number;
  alt: string;
  height: number;
  aspect: number;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const usingFallback = failed;
  const activeAspect = usingFallback ? fallbackAspect : aspect;
  const width = Math.round(height * activeAspect);

  return (
    <Image
      key={usingFallback ? "fallback" : "configured"}
      src={usingFallback ? fallbackSrc : src}
      width={width}
      height={height}
      alt={alt}
      priority={priority}
      // The remote object is served as-is: the image optimizer would turn a
      // missing object into its own error response, which fires no load error
      // on the element and so would never reach the fallback below.
      unoptimized={!usingFallback}
      onError={() => setFailed(true)}
      className="block"
      style={{ height, width }}
    />
  );
}
