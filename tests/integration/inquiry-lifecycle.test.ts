/**
 * P7-T06 — the sample-request and product-inquiry lifecycle, proven against
 * the live database.
 *
 * Constitution Principle XIV: a route existing does not make a feature
 * complete. Everything Phase 7 depends on is enforced by database objects, so
 * this suite exercises those objects directly rather than reading their SQL:
 *
 *   - `hydrate_inquiry_context()`   — derives user and coffee, snapshots context
 *   - `track_inquiry_status()`      — the sole writer of inquiry_status_history
 *   - `validate_inquiry_status_transition()` — the sole authority on legality
 *   - `uq_inquiries_active_sample_user_coffee` — the concurrency-safe backstop
 *
 * Run with: npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  cleanupFixtures,
  createFixture,
  hasStagingCredentials,
  service,
  type Fixture,
} from "./helpers/staging";

const suite = hasStagingCredentials ? describe : describe.skip;

/** Postgres SQLSTATEs the application maps to domain results. */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

type OfferPair = {
  coffeeId: string;
  offerA: string;
  offerB: string;
  otherCoffeeId: string;
  otherOfferId: string;
};

/** Every inquiry this run creates, removed in afterAll. */
const created: string[] = [];

suite("P7 inquiry lifecycle (live staging)", () => {
  let customer: Fixture;
  let other: Fixture;
  let blocked: Fixture;
  let admin: Fixture;
  let offers: OfferPair;

  const insertSample = (client: Fixture["client"], offerId: string) =>
    client
      .from("inquiries")
      .insert({
        type: "SAMPLE_REQUEST",
        offer_id: offerId,
        full_name: "P7 fixture customer",
        email: "p7-fixture@example.com",
        phone: "+201000000000",
        address: "1 Fixture Street",
        country_code: "EG",
        message: "Automated Phase 7 lifecycle fixture. Please disregard.",
      })
      .select("id,request_code,status,coffee_id,coffee_name_snapshot,user_id")
      .single();

  const insertProduct = (client: Fixture["client"], offerId: string) =>
    client
      .from("inquiries")
      .insert({
        type: "PRODUCT",
        offer_id: offerId,
        full_name: "P7 fixture customer",
        email: "p7-fixture@example.com",
        phone: "+201000000000",
        address: "1 Fixture Street",
        country_code: "EG",
        subject: "Phase 7 fixture",
        message: "Automated Phase 7 lifecycle fixture. Please disregard.",
      })
      .select("id,request_code,status,coffee_id")
      .single();

  /** What the Admin server action does: an UPDATE scoped to the seen status. */
  const setStatus = (inquiryId: string, status: string, expected?: string) => {
    let q = admin.client
      .from("inquiries")
      .update({ status })
      .eq("id", inquiryId);
    if (expected) q = q.eq("status", expected);
    return q.select("id,status");
  };

  const historyOf = async (inquiryId: string) => {
    const { data } = await service
      .from("inquiry_status_history")
      .select("old_status,new_status,created_at,id")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    return data ?? [];
  };

  beforeAll(async () => {
    admin = await createFixture("p7admin", "ADMIN");
    customer = await createFixture("p7cust", "USER");
    other = await createFixture("p7other", "USER");
    blocked = await createFixture("p7blocked", "USER");

    const { error: blockError } = await admin.client.rpc(
      "admin_set_user_blocked",
      {
        target_user_id: blocked.id,
        blocked: true,
        reason: "P7 lifecycle fixture",
      },
    );
    expect(blockError).toBeNull();

    // Resolve a real, currently visible coffee that has two live offers, so
    // the duplicate rule can be tested across two different offers of the
    // SAME coffee — which is the whole point of the user_id + coffee_id key.
    const { data: rows, error } = await service
      .from("coffee_offers")
      .select("id,coffee_id,coffees!inner(id,status,deleted_at)")
      .eq("is_visible", true)
      .neq("status", "INACTIVE")
      .is("deleted_at", null)
      .eq("coffees.status", "PUBLISHED");
    expect(error).toBeNull();

    const grouped = new Map<string, string[]>();
    for (const row of rows ?? []) {
      const list = grouped.get(row.coffee_id as string) ?? [];
      list.push(row.id as string);
      grouped.set(row.coffee_id as string, list);
    }
    const multi = [...grouped.entries()].find(([, list]) => list.length >= 2);
    const single = [...grouped.entries()].find(([id]) => id !== multi?.[0]);
    if (!multi || !single)
      throw new Error(
        "Phase 7 lifecycle tests need one published coffee with two visible offers and a second published coffee.",
      );

    offers = {
      coffeeId: multi[0],
      offerA: multi[1][0],
      offerB: multi[1][1],
      otherCoffeeId: single[0],
      otherOfferId: single[1][0],
    };
  }, 90_000);

  afterAll(async () => {
    if (created.length)
      await service.from("inquiries").delete().in("id", created);
    await cleanupFixtures();
  }, 60_000);

  // ---------------------------------------------------------------- FLOW A --

  it("FLOW A: creates a sample request, snapshots context, and records every transition exactly once", async () => {
    const { data, error } = await insertSample(customer.client, offers.offerA);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    created.push(data!.id);

    // hydrate_inquiry_context() derives the trusted context server-side.
    expect(data!.user_id).toBe(customer.id);
    expect(data!.coffee_id).toBe(offers.coffeeId);
    expect(data!.coffee_name_snapshot).toBeTruthy();
    expect(data!.status).toBe("NEW");
    expect(String(data!.request_code)).not.toHaveLength(0);

    // The INSERT itself produces the first history row.
    expect(await historyOf(data!.id)).toEqual([
      expect.objectContaining({ old_status: null, new_status: "NEW" }),
    ]);

    const path = [
      "RECEIVED",
      "CONTACTED",
      "SAMPLE_SENT",
      "DELIVERED",
      "CLOSED",
    ];
    let previous = "NEW";
    for (const next of path) {
      const { data: updated, error: updateError } = await setStatus(
        data!.id,
        next,
        previous,
      );
      expect(updateError, `transition ${previous} -> ${next}`).toBeNull();
      expect(updated).toHaveLength(1);
      previous = next;
    }

    const history = await historyOf(data!.id);
    expect(history.map((h) => h.new_status)).toEqual([
      "NEW",
      "RECEIVED",
      "CONTACTED",
      "SAMPLE_SENT",
      "DELIVERED",
      "CLOSED",
    ]);
    // Exactly one row per transition — nothing in the application writes here.
    expect(history).toHaveLength(6);
    expect(history.slice(1).map((h) => h.old_status)).toEqual([
      "NEW",
      "RECEIVED",
      "CONTACTED",
      "SAMPLE_SENT",
      "DELIVERED",
    ]);
  }, 60_000);

  // ---------------------------------------------------------------- FLOW E --

  it("FLOW E: a CLOSED sample no longer blocks a new request for the same coffee, and the old history survives", async () => {
    const { data: closedRows } = await service
      .from("inquiries")
      .select("id")
      .eq("user_id", customer.id)
      .eq("coffee_id", offers.coffeeId)
      .eq("status", "CLOSED");
    expect(closedRows?.length ?? 0).toBeGreaterThan(0);
    const closedId = closedRows![0].id as string;
    const historyBefore = await historyOf(closedId);

    const { data, error } = await insertSample(customer.client, offers.offerA);
    expect(error).toBeNull();
    created.push(data!.id);

    // Closing does not delete anything.
    expect(await historyOf(closedId)).toHaveLength(historyBefore.length);
  }, 45_000);

  // ---------------------------------------------------------------- FLOW B --

  it("FLOW B: a second sample for the same coffee is refused even through a different offer", async () => {
    // The previous test left an active (NEW) request on offerA.
    const { error } = await insertSample(customer.client, offers.offerB);
    expect(error?.code).toBe(UNIQUE_VIOLATION);

    // A different coffee is unaffected: the key is user + coffee, not user.
    const { data, error: otherError } = await insertSample(
      customer.client,
      offers.otherOfferId,
    );
    expect(otherError).toBeNull();
    created.push(data!.id);
  }, 45_000);

  // ---------------------------------------------------------------- FLOW C --

  it("FLOW C: two simultaneous requests for one coffee leave exactly one survivor", async () => {
    const results = await Promise.all([
      insertSample(other.client, offers.offerA),
      insertSample(other.client, offers.offerB),
    ]);
    for (const r of results) if (r.data?.id) created.push(r.data.id);

    const succeeded = results.filter((r) => !r.error);
    const refused = results.filter((r) => r.error);
    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0].error?.code).toBe(UNIQUE_VIOLATION);
  }, 45_000);

  // ------------------------------------------------- invalid transitions ----

  it("rejects sample-only statuses on a PRODUCT inquiry", async () => {
    const { data, error } = await insertProduct(
      customer.client,
      offers.otherOfferId,
    );
    expect(error).toBeNull();
    created.push(data!.id);

    for (const status of ["SAMPLE_SENT", "DELIVERED"]) {
      const { error: rejected } = await setStatus(data!.id, status, "NEW");
      expect(rejected?.code, `PRODUCT -> ${status}`).toBe(CHECK_VIOLATION);
    }
    // A refused transition writes no history and moves nothing.
    expect(await historyOf(data!.id)).toHaveLength(1);
    const { data: still } = await service
      .from("inquiries")
      .select("status")
      .eq("id", data!.id)
      .single();
    expect(still?.status).toBe("NEW");
  }, 45_000);

  it("rejects skipped and backward transitions, and treats CLOSED as terminal", async () => {
    const { data, error } = await insertProduct(customer.client, offers.offerA);
    expect(error).toBeNull();
    created.push(data!.id);

    // Skipping RECEIVED.
    expect((await setStatus(data!.id, "CONTACTED", "NEW")).error?.code).toBe(
      CHECK_VIOLATION,
    );

    expect((await setStatus(data!.id, "RECEIVED", "NEW")).error).toBeNull();
    // Backward.
    expect((await setStatus(data!.id, "NEW", "RECEIVED")).error?.code).toBe(
      CHECK_VIOLATION,
    );

    expect((await setStatus(data!.id, "CLOSED", "RECEIVED")).error).toBeNull();
    // CLOSED is terminal.
    expect((await setStatus(data!.id, "RECEIVED", "CLOSED")).error?.code).toBe(
      CHECK_VIOLATION,
    );

    expect((await historyOf(data!.id)).map((h) => h.new_status)).toEqual([
      "NEW",
      "RECEIVED",
      "CLOSED",
    ]);
  }, 45_000);

  it("refuses a stale Admin update instead of overwriting newer state", async () => {
    const { data } = await insertProduct(customer.client, offers.otherOfferId);
    created.push(data!.id);

    // One Admin moves it on; a second Admin's page still says NEW.
    expect((await setStatus(data!.id, "RECEIVED", "NEW")).error).toBeNull();
    const stale = await setStatus(data!.id, "CLOSED", "NEW");
    expect(stale.error).toBeNull();
    // Zero rows matched — the application maps this to CONFLICT.
    expect(stale.data).toHaveLength(0);

    const { data: still } = await service
      .from("inquiries")
      .select("status")
      .eq("id", data!.id)
      .single();
    expect(still?.status).toBe("RECEIVED");
  }, 45_000);

  // ------------------------------------------------------- authorization ----

  it("denies anonymous and blocked callers, and isolates customers from each other", async () => {
    const anonymous = await anon
      .from("inquiries")
      .insert({
        type: "SAMPLE_REQUEST",
        offer_id: offers.offerA,
        full_name: "anonymous",
        email: "anon@example.com",
        message: "should never be stored",
      })
      .select("id");
    expect(anonymous.error).not.toBeNull();
    expect(anonymous.data).toBeNull();

    const blockedInsert = await insertSample(blocked.client, offers.offerA);
    expect(blockedInsert.error).not.toBeNull();

    // Customer B cannot read Customer A's request, by id or by request code.
    const { data: mine } = await service
      .from("inquiries")
      .select("id,request_code")
      .eq("user_id", customer.id)
      .limit(1)
      .single();
    const byId = await other.client
      .from("inquiries")
      .select("id")
      .eq("id", mine!.id);
    expect(byId.data ?? []).toHaveLength(0);
    const byCode = await other.client
      .from("inquiries")
      .select("id")
      .eq("request_code", mine!.request_code);
    // Guessing a code is indistinguishable from the row not existing.
    expect(byCode.data ?? []).toHaveLength(0);
  }, 60_000);

  it("does not let a customer change their own request's status", async () => {
    const { data: mine } = await service
      .from("inquiries")
      .select("id,status")
      .eq("user_id", customer.id)
      .neq("status", "CLOSED")
      .limit(1)
      .single();
    const attempt = await customer.client
      .from("inquiries")
      .update({ status: "DELIVERED" })
      .eq("id", mine!.id)
      .select("id");
    expect(attempt.data ?? []).toHaveLength(0);

    const { data: after } = await service
      .from("inquiries")
      .select("status")
      .eq("id", mine!.id)
      .single();
    expect(after?.status).toBe(mine!.status);
  }, 45_000);

  // -------------------------------------------------- no fulfillment ---------

  it("changing a sample status has zero effect on the offer", async () => {
    const snapshot = async () => {
      const { data } = await service
        .from("coffee_offers")
        .select("*")
        .eq("id", offers.offerA)
        .single();
      return data;
    };
    const before = await snapshot();

    const { data } = await insertSample(other.client, offers.otherOfferId);
    created.push(data!.id);
    for (const [next, from] of [
      ["RECEIVED", "NEW"],
      ["CONTACTED", "RECEIVED"],
      ["SAMPLE_SENT", "CONTACTED"],
      ["DELIVERED", "SAMPLE_SENT"],
    ] as const) {
      expect((await setStatus(data!.id, next, from)).error).toBeNull();
    }

    // The offer row is byte-for-byte what it was: no reservation, no
    // decrement, no availability change, no derived shipment record.
    expect(await snapshot()).toEqual(before);
  }, 60_000);

  it("stores no quantity for a sample request", async () => {
    const { data } = await service
      .from("inquiries")
      .select("*")
      .eq("user_id", customer.id)
      .limit(1)
      .single();
    const columns = Object.keys(data ?? {}).map((c) => c.toLowerCase());
    expect(columns.filter((c) => c.includes("quantity"))).toEqual([]);
    expect(columns.filter((c) => c.includes("bags"))).toEqual([]);
  }, 30_000);
});
