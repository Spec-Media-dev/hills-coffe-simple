import Image from "next/image";
import { cn } from "@/lib/utils";
import { BrandImage } from "./brand-image";

/**
 * Official Hills Coffee logo lockup (emblem + wordmark).
 *
 * The supplied artwork `/images/logo-mark.png` is 529x231 and is drawn in brand
 * dark green (#173C32) on a transparent background, so it disappears on dark
 * surfaces. Rather than inverting or recolouring official artwork, the lockup is
 * placed on a brand cream plate (#EEE4D1). In the light theme the page
 * background is the same cream, so the plate is visually seamless; on dark
 * surfaces (dark theme, the footer, and the admin sidebar) it keeps the logo
 * legible without altering the artwork.
 *
 * Phase 8 added the `logo` prop: an Administrator's chosen media item, resolved
 * from `site_settings.org_logo_media_id` by `getSiteLogo()`. This component
 * stays presentational and client-safe — the mobile menu is a client component
 * and renders the same mark — so resolution happens in the server parent and
 * arrives as data.
 *
 * The static asset is never removed. It is the fallback for every way the
 * dynamic logo can be unavailable, so the mark cannot disappear because of a
 * NULL relation, an archived row, or a missing storage object.
 */
const LOGO_SRC = "/images/logo-mark.png";
const LOGO_WIDTH = 529;
const LOGO_HEIGHT = 231;
const LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;

export type BrandLogo = {
  url: string;
  width: number;
  height: number;
  alt: string | null;
};

export function BrandMark({
  className,
  height = 44,
  priority = false,
  plate = true,
  label = "Hills Coffee",
  logo = null,
}: {
  className?: string;
  /** Rendered logo height in px. Width is derived from the true aspect ratio. */
  height?: number;
  priority?: boolean;
  /** Render the cream plate that keeps the dark artwork legible on dark surfaces. */
  plate?: boolean;
  label?: string;
  /** The Administrator's configured logo, or null for the official artwork. */
  logo?: BrandLogo | null;
}) {
  // The configured logo keeps its own aspect ratio: an uploaded lockup is not
  // stretched to match the official artwork's proportions.
  const usable = logo && logo.width > 0 && logo.height > 0 ? logo : null;
  const aspect = usable ? usable.width / usable.height : LOGO_ASPECT;
  const width = Math.round(height * aspect);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        // Clear space around the lockup, per the brand clear-space rule.
        plate && "rounded-xl bg-[#eee4d1] px-3 py-1.5",
        className,
      )}
    >
      {usable ? (
        // A configured logo may carry its own alt text; otherwise the caller's
        // localized brand label is used. It is never empty.
        <BrandImage
          src={usable.url}
          fallbackSrc={LOGO_SRC}
          fallbackAspect={LOGO_ASPECT}
          alt={usable.alt || label}
          height={height}
          aspect={aspect}
          priority={priority}
        />
      ) : (
        <Image
          src={LOGO_SRC}
          width={width}
          height={height}
          alt={label}
          priority={priority}
          className="block"
        />
      )}
    </span>
  );
}
