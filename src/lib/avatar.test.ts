import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_BYTES,
  buildAvatarPath,
  isOwnedAvatarPath,
  sniffImageType,
  validateAvatarBytes,
} from "./avatar";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("avatar signature sniffing", () => {
  it("identifies the supported formats from their bytes", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("returns null for anything that is not one of them", () => {
    // An SVG, a PDF, and a shell script all carry image-ish extensions in the
    // wild; none of them is an accepted raster image here.
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("#!/bin/sh\n"))).toBeNull();
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull();
  });
});

describe("validateAvatarBytes", () => {
  it("accepts a well-formed file whose declared type matches its bytes", () => {
    const result = validateAvatarBytes(PNG, "image/png");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mimeType).toBe("image/png");
  });

  it("rejects an empty file", () => {
    expect(validateAvatarBytes(new Uint8Array(), "image/png")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects a file over the 5 MiB limit, measured from the bytes", () => {
    const oversize = new Uint8Array(AVATAR_MAX_BYTES + 1);
    oversize.set(PNG, 0);
    expect(validateAvatarBytes(oversize, "image/png")).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects a MIME type outside the allow-list", () => {
    expect(validateAvatarBytes(PNG, "image/gif")).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
    expect(validateAvatarBytes(PNG, "image/svg+xml")).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
  });

  it("rejects content that does not match its declared type", () => {
    // The decisive case: a browser can claim anything, so a PNG announced as
    // JPEG — or a script announced as PNG — must not be stored (FR-019).
    expect(validateAvatarBytes(PNG, "image/jpeg")).toEqual({
      ok: false,
      reason: "signature_mismatch",
    });
    const script = new TextEncoder().encode("#!/bin/sh\nrm -rf /");
    expect(validateAvatarBytes(script, "image/png")).toEqual({
      ok: false,
      reason: "signature_mismatch",
    });
  });
});

describe("buildAvatarPath", () => {
  it("always roots the object in the owner's own folder", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"] as const) {
      const path = buildAvatarPath(OWNER, type);
      expect(path.startsWith(`${OWNER}/`)).toBe(true);
      expect(path).not.toContain("..");
    }
  });

  it("produces a distinct path per call so a replacement is a new object", () => {
    const first = buildAvatarPath(OWNER, "image/png");
    const second = buildAvatarPath(OWNER, "image/png");
    expect(first).not.toBe(second);
  });
});

describe("isOwnedAvatarPath", () => {
  it("accepts only paths inside the owner's folder", () => {
    expect(isOwnedAvatarPath(`${OWNER}/avatar-1.png`, OWNER)).toBe(true);
  });

  it("rejects another customer's path, traversal, and absolute paths", () => {
    expect(isOwnedAvatarPath(`${OTHER}/avatar-1.png`, OWNER)).toBe(false);
    expect(isOwnedAvatarPath(`${OWNER}/../${OTHER}/a.png`, OWNER)).toBe(false);
    expect(isOwnedAvatarPath(`/${OWNER}/a.png`, OWNER)).toBe(false);
    expect(isOwnedAvatarPath("../secrets.png", OWNER)).toBe(false);
  });

  it("treats a missing path as not owned", () => {
    expect(isOwnedAvatarPath(null, OWNER)).toBe(false);
    expect(isOwnedAvatarPath("", OWNER)).toBe(false);
  });
});
