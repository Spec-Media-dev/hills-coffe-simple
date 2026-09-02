import { describe, expect, it } from "vitest";
import { readImageDimensions } from "./dimensions";

/**
 * Fixtures are real encoded images, not handwritten header bytes: a fixture
 * invented to match the parser proves only that the parser agrees with itself.
 * Each is a genuine minimal file produced by an encoder, so the byte layout is
 * the one real uploads have.
 */
const decode = (base64: string) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** 1x1 PNG. */
const PNG_1x1 = decode(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
);
/** 8x4 PNG. */
const PNG_8x4 = decode(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAYAAACzzX7wAAAAFElEQVR4nGP8//8/AzbAxIALjEQJAM+bBAWqjIRfAAAAAElFTkSuQmCC",
);
/** 2x3 JPEG. */
const JPEG_2x3 = decode(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAADAAIBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiv/9k=",
);
/** 4x2 lossy WebP (VP8 ). */
const WEBP_4x2 = decode(
  "UklGRjIAAABXRUJQVlA4WAoAAAAQAAAAAwAAAQAAQUxQSAoAAAABBxAREYiI/gcAAFZQOCAOAAAAMAEAnQEqBAACAAJAJaQAA3AA/vuUAAA=",
);

describe("intrinsic image dimensions", () => {
  it("reads PNG dimensions from the IHDR chunk", () => {
    expect(readImageDimensions(PNG_1x1, "image/png")).toEqual({
      width: 1,
      height: 1,
    });
    expect(readImageDimensions(PNG_8x4, "image/png")).toEqual({
      width: 8,
      height: 4,
    });
  });

  it("walks the JPEG segment chain to the frame header", () => {
    expect(readImageDimensions(JPEG_2x3, "image/jpeg")).toEqual({
      width: 2,
      height: 3,
    });
  });

  it("reads WebP dimensions from the VP8 chunk", () => {
    expect(readImageDimensions(WEBP_4x2, "image/webp")).toEqual({
      width: 4,
      height: 2,
    });
  });

  it("returns null rather than throwing on a truncated or hostile header", () => {
    // Truncated part-way through the header.
    expect(readImageDimensions(PNG_1x1.slice(0, 20), "image/png")).toBeNull();
    expect(readImageDimensions(JPEG_2x3.slice(0, 4), "image/jpeg")).toBeNull();
    expect(readImageDimensions(WEBP_4x2.slice(0, 16), "image/webp")).toBeNull();
    // Right signature length, wrong content.
    expect(readImageDimensions(new Uint8Array(64), "image/png")).toBeNull();
    expect(readImageDimensions(new Uint8Array(64), "image/jpeg")).toBeNull();
    expect(readImageDimensions(new Uint8Array(64), "image/webp")).toBeNull();
  });

  it("does not spin on a JPEG whose segment lengths make no progress", () => {
    // A declared length below the two length bytes themselves would loop
    // forever if the walk trusted it.
    const hostile = new Uint8Array(64);
    hostile.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00], 0);
    expect(readImageDimensions(hostile, "image/jpeg")).toBeNull();
  });

  it("refuses an implausible declared size", () => {
    // A PNG header claiming a 100000px edge: valid bytes, impossible image.
    const huge = new Uint8Array(PNG_1x1);
    const view = new DataView(huge.buffer);
    view.setUint32(16, 100_000);
    view.setUint32(20, 100_000);
    expect(readImageDimensions(huge, "image/png")).toBeNull();
  });
});
