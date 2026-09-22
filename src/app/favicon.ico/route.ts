import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Browsers still probe this legacy URL even though the App Router metadata
 * declares the branded PNG icon. Serve that same approved Hills asset here so
 * the probe is a real 200 rather than a noisy development 404.
 */
export async function GET() {
  const icon = await readFile(
    join(process.cwd(), "public", "images", "hills-favicon-green.png"),
  );
  return new Response(icon, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
