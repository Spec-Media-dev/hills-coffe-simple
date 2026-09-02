import type { AvatarMimeType } from "@/lib/avatar";

/**
 * Intrinsic image dimensions, read from the file's own header.
 *
 * `media.width` and `media.height` exist in the schema but were never written
 * by any upload path, so every row carried NULL — and the CMS renderer drops
 * media without both, because `next/image` needs them to reserve layout space.
 * The result was that an image uploaded through the Admin could never appear in
 * a CMS section (finding N50).
 *
 * The header is parsed here rather than by adding an image library: only three
 * formats are accepted, each declares its size in a fixed place near the start
 * of the file, and the bytes have already been read for signature sniffing.
 *
 * Every reader is bounds-checked and returns `null` on anything unexpected. A
 * truncated or hostile file yields no dimensions; it never throws and never
 * loops on attacker-controlled lengths.
 */

export type Dimensions = { width: number; height: number };

/** Guards against a header that claims an implausible size. */
const MAX_EDGE = 30_000;

const valid = (width: number, height: number): Dimensions | null =>
  Number.isInteger(width) &&
  Number.isInteger(height) &&
  width > 0 &&
  height > 0 &&
  width <= MAX_EDGE &&
  height <= MAX_EDGE
    ? { width, height }
    : null;

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

/** PNG: IHDR is always the first chunk, at a fixed offset. */
function png(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 24) return null;
  // Bytes 12..15 must spell "IHDR", otherwise this is not a real PNG header.
  if (
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  )
    return null;
  return valid(u32be(bytes, 16), u32be(bytes, 20));
}

/**
 * JPEG: walk the segment chain to the start-of-frame marker.
 *
 * The walk is bounded by the buffer length and by a segment cap, so a file that
 * declares a zero or negative-progress length cannot spin.
 */
function jpeg(bytes: Uint8Array): Dimensions | null {
  let offset = 2;
  for (let segment = 0; segment < 256; segment += 1) {
    // Skip any fill bytes before the marker.
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset + 1 >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;
    // Standalone markers carry no length payload.
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    )
      continue;
    if (offset + 1 >= bytes.length) return null;
    const length = u16be(bytes, offset);
    if (length < 2) return null;
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      // DHT, JPG-extension and DAC share the range but are not frame headers.
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 7 >= bytes.length) return null;
      // length(2) precision(1) height(2) width(2)
      return valid(u16be(bytes, offset + 5), u16be(bytes, offset + 3));
    }
    // Start of scan: pixel data follows, so the frame header is gone.
    if (marker === 0xda) return null;
    offset += length;
    if (offset >= bytes.length) return null;
  }
  return null;
}

/** WebP: three container variants, each storing the canvas size differently. */
function webp(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunk === "VP8 ") {
    // Lossy: a 3-byte start code, then 14-bit width and height.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a)
      return null;
    return valid(u16le(bytes, 26) & 0x3fff, u16le(bytes, 28) & 0x3fff);
  }
  if (chunk === "VP8L") {
    // Lossless: 14 bits each, minus one, packed little-endian after the 0x2f
    // signature byte.
    if (bytes[20] !== 0x2f) return null;
    const packed =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return valid((packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") {
    // Extended: 24-bit canvas size minus one.
    const width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
    const height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
    return valid(width, height);
  }
  return null;
}

/**
 * Reads intrinsic dimensions for an already-sniffed image type.
 *
 * Call this only with the type `sniffImageType` returned, so the parser and the
 * real file format always agree.
 */
export function readImageDimensions(
  bytes: Uint8Array,
  mimeType: AvatarMimeType,
): Dimensions | null {
  try {
    if (mimeType === "image/png") return png(bytes);
    if (mimeType === "image/jpeg") return jpeg(bytes);
    if (mimeType === "image/webp") return webp(bytes);
    return null;
  } catch {
    // A malformed header is a rejected upload, never a server error.
    return null;
  }
}
