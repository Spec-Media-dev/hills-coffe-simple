import Image from "next/image";
import { cn } from "@/lib/utils";

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
 */
const LOGO_SRC = "/images/logo-mark.png";
const LOGO_WIDTH = 529;
const LOGO_HEIGHT = 231;
const LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;

export function BrandMark({
  className,
  height = 44,
  priority = false,
  plate = true,
  label = "Hills Coffee",
}: {
  className?: string;
  /** Rendered logo height in px. Width is derived from the true aspect ratio. */
  height?: number;
  priority?: boolean;
  /** Render the cream plate that keeps the dark artwork legible on dark surfaces. */
  plate?: boolean;
  label?: string;
}) {
  const width = Math.round(height * LOGO_ASPECT);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        // Clear space around the lockup, per the brand clear-space rule.
        plate && "rounded-xl bg-[#eee4d1] px-3 py-1.5",
        className,
      )}
    >
      <Image
        src={LOGO_SRC}
        width={width}
        height={height}
        alt={label}
        priority={priority}
        className="block"
      />
    </span>
  );
}
