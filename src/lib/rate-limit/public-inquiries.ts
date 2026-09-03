import "server-only";
import { headers } from "next/headers";

/**
 * Per-IP throttle for the two anonymous submission forms.
 *
 * **This is best-effort, and deliberately so.** The counter lives in this
 * module's memory, which means it is per server instance and does not
 * survive a restart: on a multi-instance or serverless deployment, a
 * determined caller spreading requests across instances gets a higher
 * effective ceiling than the numbers below suggest. That limitation is
 * accepted rather than hidden — the durable half of the anti-abuse story is
 * the per-normalized-email limit inside `submit_public_inquiry()`, which is
 * enforced by the database and therefore shared by every instance. Making
 * the IP limit durable too would need either a new table or a third-party
 * store, and the owner's clarified decision for this addendum was to add
 * neither (no CAPTCHA vendor, no Redis/Upstash).
 *
 * The two layers cover different attacks: the DB limit stops one address
 * hammering the form, this one stops one host cycling through addresses.
 */

/**
 * Requests permitted from a single address inside `WINDOW_MS`.
 *
 * Set as coarse flood protection, not as a precise cap. Hills sells to
 * roasteries, and a roastery's staff sit behind one corporate NAT — several
 * colleagues sending requests the same morning share an address, so a tight
 * per-IP ceiling would refuse legitimate buyers while barely inconveniencing
 * an abuser, who only has to change address. The precise control is the
 * per-normalized-email limit inside `submit_public_inquiry()`: five an hour,
 * durable, and enforced under an advisory lock so it cannot be raced. A
 * flooder therefore needs both many addresses and many mailboxes.
 */
const MAX_PER_WINDOW = 30;
const WINDOW_MS = 10 * 60 * 1000;

/** Beyond this many tracked addresses, the oldest are dropped. */
const MAX_TRACKED = 5_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Drops expired entries, and the oldest survivors if the map is still large. */
function sweep(now: number) {
  for (const [key, bucket] of buckets)
    if (bucket.resetAt <= now) buckets.delete(key);
  if (buckets.size <= MAX_TRACKED) return;
  const overflow = buckets.size - MAX_TRACKED;
  let dropped = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++dropped >= overflow) break;
  }
}

/**
 * The caller's address, as reported by whatever proxy fronts the app.
 *
 * `x-forwarded-for` is a client-supplied header that a proxy overwrites, so
 * the leftmost entry is only as trustworthy as the deployment in front of
 * this process. It is good enough to slow down casual abuse, which is all
 * this layer claims to do; nothing security-critical depends on it.
 */
async function callerAddress(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return list.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Records one attempt from the current caller.
 *
 * Returns `false` when the caller has already used their allowance, in which
 * case the action must reject before doing any database work.
 */
export async function allowPublicInquiryAttempt(): Promise<boolean> {
  const now = Date.now();
  sweep(now);

  const key = await callerAddress();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

/** Test-only reset so one spec's attempts cannot leak into the next. */
export function __resetPublicInquiryRateLimit() {
  buckets.clear();
}
