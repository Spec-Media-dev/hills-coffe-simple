import Image from "next/image";
import { cn } from "@/lib/utils";
import { BrandImage } from "./brand-image";

/**
 * Official Hills Coffee logo lockup (emblem + wordmark).
 *
 * The project supplies two transparent official assets: dark green for light
 * surfaces and cream for dark surfaces. They are selected with the app's theme
 * class, so the header never needs a coloured plate behind the mark. Surfaces
 * that are permanently dark (the footer and admin sidebar) explicitly request
 * the cream version regardless of the selected site theme.
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
const DARK_LOGO_SRC = "/images/hills-logo-dark.png";
const LIGHT_LOGO_SRC = "/images/hills-logo-light.png";
const LOGO_WIDTH = 2624;
const LOGO_HEIGHT = 996;
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
  variant = "theme",
  label = "Hills Coffee",
  logo = null,
}: {
  className?: string;
  /** Rendered logo height in px. Width is derived from the true aspect ratio. */
  height?: number;
  priority?: boolean;
  /** Use the cream mark where the surrounding surface is always dark. */
  variant?: "theme" | "on-dark";
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
        className,
      )}
    >
      {usable ? (
        // A configured logo may carry its own alt text; otherwise the caller's
        // localized brand label is used. It is never empty.
        <BrandImage
          src={usable.url}
          fallbackSrc={DARK_LOGO_SRC}
          fallbackAspect={LOGO_ASPECT}
          alt={usable.alt || label}
          height={height}
          aspect={aspect}
          priority={priority}
        />
      ) : (
        <>
          <Image
            src={variant === "on-dark" ? LIGHT_LOGO_SRC : DARK_LOGO_SRC}
            width={width}
            height={height}
            alt={label}
            priority={priority}
            className={cn("block", variant === "theme" && "dark:hidden")}
          />
          {variant === "theme" ? (
            <Image
              src={LIGHT_LOGO_SRC}
              width={width}
              height={height}
              alt=""
              priority={priority}
              className="hidden dark:block"
            />
          ) : null}
        </>
      )}
    </span>
  );
}
