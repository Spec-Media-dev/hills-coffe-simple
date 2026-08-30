import "server-only";

const prices: Record<string, { amount: number; currency: "USD" }> = {
  "off-ham-eg": { amount: 10.8, currency: "USD" },
  "off-ham-du": { amount: 11.15, currency: "USD" },
  "off-dia-eg": { amount: 5.15, currency: "USD" },
  "off-dia-du": { amount: 5.35, currency: "USD" },
  "off-esp-eg": { amount: 8.7, currency: "USD" },
  "off-nye-du": { amount: 12.4, currency: "USD" },
  "off-gic-eg": { amount: 9.45, currency: "USD" },
  "off-gic-du": { amount: 9.8, currency: "USD" },
  "off-hue-du": { amount: 6.4, currency: "USD" },
};

export function getProtectedPrice(offerId: string) {
  return prices[offerId] ?? null;
}
