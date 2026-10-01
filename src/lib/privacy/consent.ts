export const CONSENT_KEY = "hills:privacy:v1";
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;

export type Consent = { version: 1; analytics: boolean; updatedAt: number };

/** Invalid, expired and future-dated decisions fail closed. */
export function parseConsent(
  raw: string | null,
  now = Date.now(),
): Consent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      typeof value.analytics !== "boolean" ||
      typeof value.updatedAt !== "number" ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt > now ||
      now - value.updatedAt >= CONSENT_MAX_AGE
    )
      return null;
    return {
      version: 1,
      analytics: value.analytics,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}
