import { describe, expect, it } from "vitest";
import {
  ACTIVE_SAMPLE_STATUSES,
  processSampleRequest,
  type SampleInsert,
  type SampleRequester,
} from "./sample-request";

const userA: SampleRequester = {
  id: "user-a",
  email: "a@example.com",
  emailVerified: true,
  fullName: "Buyer A",
  phone: "+201000000000",
  companyName: "Roastery A",
  address: "Cairo delivery address",
  countryCode: "EG",
};

const offers = new Map([
  ["offer-a-egypt", "coffee-a"],
  ["offer-a-dubai", "coffee-a"],
  ["offer-b-egypt", "coffee-b"],
]);

type Existing = {
  userId: string;
  coffeeId: string;
  status: "NEW" | "RECEIVED" | "CONTACTED" | "CLOSED";
  requestCode: string;
};

function harness(existing: Existing[] = []) {
  const inserted: SampleInsert[] = [];
  return {
    inserted,
    repository: {
      resolveVisibleOffer: async (offerId: string) => {
        const coffeeId = offers.get(offerId);
        return coffeeId ? { offerId, coffeeId } : null;
      },
      findActiveRequest: async (userId: string, coffeeId: string) => {
        const request = existing.find(
          (item) =>
            item.userId === userId &&
            item.coffeeId === coffeeId &&
            ACTIVE_SAMPLE_STATUSES.includes(
              item.status as (typeof ACTIVE_SAMPLE_STATUSES)[number],
            ),
        );
        return request && request.status !== "CLOSED"
          ? {
              requestCode: request.requestCode,
              status: request.status,
            }
          : null;
      },
      insertRequest: async (input: SampleInsert) => {
        inserted.push(input);
        return { requestCode: `SAMPLE-${inserted.length}` };
      },
    },
  };
}

const submit = (
  repository: ReturnType<typeof harness>["repository"],
  viewer: SampleRequester | null = userA,
  offerId = "offer-a-egypt",
) =>
  processSampleRequest(
    {
      viewer,
      offerId,
      subject: "Sample review",
      message: "Please review this sample request.",
    },
    repository,
  );

describe("sample request business rule", () => {
  it("allows User A to request Coffee A", async () => {
    const test = harness();
    expect(await submit(test.repository)).toMatchObject({ ok: true });
  });

  it("allows the same user to request a different Coffee B", async () => {
    const test = harness([
      {
        userId: "user-a",
        coffeeId: "coffee-a",
        status: "NEW",
        requestCode: "A-1",
      },
    ]);
    expect(await submit(test.repository, userA, "offer-b-egypt")).toMatchObject(
      { ok: true },
    );
  });

  it.each(["NEW", "RECEIVED", "CONTACTED"] as const)(
    "blocks the same user and Coffee A while status is %s",
    async (status) => {
      const test = harness([
        {
          userId: "user-a",
          coffeeId: "coffee-a",
          status,
          requestCode: `A-${status}`,
        },
      ]);
      expect(await submit(test.repository)).toEqual({
        ok: false,
        reason: "ACTIVE_SAMPLE_EXISTS",
        requestCode: `A-${status}`,
      });
      expect(test.inserted).toHaveLength(0);
    },
  );

  it("blocks the same coffee through a different warehouse offer", async () => {
    const test = harness([
      {
        userId: "user-a",
        coffeeId: "coffee-a",
        status: "NEW",
        requestCode: "A-1",
      },
    ]);
    expect(await submit(test.repository, userA, "offer-a-dubai")).toMatchObject(
      {
        ok: false,
        reason: "ACTIVE_SAMPLE_EXISTS",
      },
    );
  });

  it("allows another user to request Coffee A", async () => {
    const test = harness([
      {
        userId: "user-a",
        coffeeId: "coffee-a",
        status: "NEW",
        requestCode: "A-1",
      },
    ]);
    expect(
      await submit(test.repository, {
        ...userA,
        id: "user-b",
        email: "b@example.com",
      }),
    ).toMatchObject({ ok: true });
  });

  it("allows a new manual-review request after the previous request is CLOSED", async () => {
    const test = harness([
      {
        userId: "user-a",
        coffeeId: "coffee-a",
        status: "CLOSED",
        requestCode: "A-OLD",
      },
    ]);
    expect(await submit(test.repository)).toMatchObject({ ok: true });
  });

  it("blocks an anonymous user with a sign-in reason", async () => {
    const test = harness();
    expect(await submit(test.repository, null)).toEqual({
      ok: false,
      reason: "AUTH_REQUIRED",
    });
  });

  it("blocks an unverified user with a verification reason", async () => {
    const test = harness();
    expect(
      await submit(test.repository, { ...userA, emailVerified: false }),
    ).toEqual({ ok: false, reason: "EMAIL_VERIFICATION_REQUIRED" });
  });

  it.each([
    ["phone", { phone: "" }],
    ["address", { address: null }],
    ["country", { countryCode: " " }],
  ] as const)(
    "reports a clear missing %s profile field",
    async (field, change) => {
      const test = harness();
      expect(await submit(test.repository, { ...userA, ...change })).toEqual({
        ok: false,
        reason: "PROFILE_INCOMPLETE",
        missingFields: [field],
      });
    },
  );

  it("has no quantity field", async () => {
    const test = harness();
    await submit(test.repository);
    expect(Object.keys(test.inserted[0])).not.toContain("quantity");
  });

  it("stores the inquiry as SAMPLE_REQUEST and never PRODUCT", async () => {
    const test = harness();
    await submit(test.repository);
    expect(test.inserted[0].type).toBe("SAMPLE_REQUEST");
  });

  it("does not create shipment, inventory reservation, approval, or fulfillment data", async () => {
    const test = harness();
    await submit(test.repository);
    expect(test.inserted[0]).not.toHaveProperty("shipment");
    expect(test.inserted[0]).not.toHaveProperty("inventory");
    expect(test.inserted[0]).not.toHaveProperty("approved");
    expect(test.inserted[0]).not.toHaveProperty("fulfillment");
  });
});
