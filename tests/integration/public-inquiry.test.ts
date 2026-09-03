/**
 * OA-T01/OA-T02/OA-T10 — the anonymous public submission path, against the
 * real database.
 *
 * These are the proofs that matter for this addendum: a form that renders is
 * not evidence, a row that exists is. Everything here runs as the `anon`
 * role through PostgREST — the same role a visitor's request arrives as —
 * so what passes here is what an anonymous visitor can actually do.
 *
 * The `submit_public_inquiry` cases require migration PP12-T02 to have been
 * applied. Until then they fail loudly rather than skipping quietly, because
 * a silent skip is indistinguishable from a pass in a summary line.
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
} from "./helpers/staging";

/** Everything this suite creates carries this tag and is deleted afterwards. */
const TAG = "[QA-OA-INT]";
const email = (suffix: string) =>
  `qa-oa-int-${suffix}-${Date.now().toString(36)}@example.invalid`;

type OfferRef = { offerId: string; coffeeId: string };

let coffeeA: OfferRef;
let coffeeB: OfferRef;

/** Rows created through the function, removed in afterAll by email tag. */
const usedEmails = new Set<string>();

async function submit(params: Record<string, unknown>) {
  if (typeof params.p_email === "string") usedEmails.add(params.p_email);
  return anon.rpc("submit_public_inquiry", params as never);
}

const baseFields = (address: string) => ({
  p_full_name: `${TAG} Buyer`,
  p_phone: "+201000000123",
  p_message: "Integration probe: looking for washed lots for Q3 roasting.",
  ...(address
    ? { p_address: `${address}`, p_country_code: "AE" }
    : {}),
});

describe.skipIf(!hasStagingCredentials)(
  "public inquiry submission (anonymous)",
  () => {
    beforeAll(async () => {
      // Two distinct published coffees with visible offers — the Coffee A /
      // Coffee B distinction the duplicate rule is defined against.
      const { data } = await service
        .from("coffee_offers")
        .select("id,coffee_id,is_visible,status,deleted_at")
        .eq("is_visible", true)
        .neq("status", "INACTIVE")
        .is("deleted_at", null);

      const byCoffee = new Map<string, string>();
      for (const row of data ?? [])
        if (!byCoffee.has(String(row.coffee_id)))
          byCoffee.set(String(row.coffee_id), String(row.id));

      const pairs = [...byCoffee.entries()];
      if (pairs.length < 2)
        throw new Error(
          "This suite needs two published coffees with visible offers.",
        );
      coffeeA = { coffeeId: pairs[0][0], offerId: pairs[0][1] };
      coffeeB = { coffeeId: pairs[1][0], offerId: pairs[1][1] };
    });

    afterAll(async () => {
      for (const address of usedEmails)
        await service.from("inquiries").delete().eq("email", address);
      await cleanupFixtures();
    });

    // ------------------------------------------------ the security boundary

    it("still denies a direct anonymous INSERT — the function is the only way in", async () => {
      const { error } = await anon.from("inquiries").insert({
        type: "GENERAL",
        status: "NEW",
        full_name: `${TAG} direct`,
        email: email("direct"),
        phone: "+201000000000",
        message: "direct insert must not be possible",
      });
      expect(error, "anonymous direct INSERT was allowed").not.toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("denies EXECUTE to a signed-in customer — the grant really is anon-only", async () => {
      // The migration's own DO block asserts this by OID at apply time; this
      // proves it again from the outside, as a real `authenticated` session
      // rather than as a catalogue lookup. A verified customer has their own
      // path (createSampleRequestInquiry) and must not reach this one.
      const customer = await createFixture("oa-auth");
      const { error } = await customer.client.rpc("submit_public_inquiry", {
        p_full_name: `${TAG} authenticated`,
        p_email: email("authenticated"),
        p_phone: "+201000000123",
        p_message: "an authenticated caller must not reach this function",
      });
      expect(error, "authenticated was able to execute the function").not.toBeNull();
      // Postgres reports a missing privilege as 42501; PostgREST may also
      // report the function as unexposed for that role. Either is a denial;
      // succeeding is not.
      expect(["42501", "PGRST202"]).toContain(error?.code);
    });

    it("does not let an anonymous caller read the inquiries table", async () => {
      const { data, error } = await anon.from("inquiries").select("id").limit(5);
      // RLS may deny outright or filter to nothing; either is acceptable,
      // returning somebody else's row is not.
      expect(error ? true : (data?.length ?? 0) === 0).toBe(true);
    });

    // ------------------------------------------------------- GENERAL RFQ

    it("creates a GENERAL row with no account, status NEW, and a request code", async () => {
      const address = email("rfq");
      const { data, error } = await submit({
        ...baseFields(""),
        p_email: address,
        p_company_name: `${TAG} Roastery`,
        p_subject: "Sourcing enquiry",
      });
      expect(error, `RFQ submit failed: ${error?.message}`).toBeNull();

      const payload = data as { request_code?: string } | null;
      expect(payload?.request_code).toBeTruthy();

      const { data: row } = await service
        .from("inquiries")
        .select("type,status,user_id,coffee_id,offer_id,email,request_code")
        .eq("email", address)
        .single();

      expect(row?.type).toBe("GENERAL");
      expect(row?.status).toBe("NEW");
      expect(row?.user_id).toBeNull();
      // A GENERAL RFQ is coffee-agnostic: it must not silently become an
      // offer-specific inquiry.
      expect(row?.coffee_id).toBeNull();
      expect(row?.offer_id).toBeNull();
      expect(row?.request_code).toBe(payload?.request_code);
    });

    it("accepts repeated GENERAL submissions — no duplicate rule applies", async () => {
      const address = email("rfq-repeat");
      const first = await submit({ ...baseFields(""), p_email: address });
      const second = await submit({ ...baseFields(""), p_email: address });
      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
    });

    // --------------------------------------------------- SAMPLE_REQUEST

    it("creates a SAMPLE_REQUEST with the coffee derived server-side", async () => {
      const address = email("sample");
      const { data, error } = await submit({
        ...baseFields("1 Test Street, Dubai"),
        p_email: address,
        p_offer_id: coffeeA.offerId,
      });
      expect(error, `sample submit failed: ${error?.message}`).toBeNull();
      expect((data as { request_code?: string } | null)?.request_code).toBeTruthy();

      const { data: row } = await service
        .from("inquiries")
        .select("type,status,user_id,coffee_id,coffee_name_snapshot,address,country_code")
        .eq("email", address)
        .single();

      expect(row?.type).toBe("SAMPLE_REQUEST");
      expect(row?.status).toBe("NEW");
      expect(row?.user_id).toBeNull();
      // Derived from the trusted offer, never supplied by the caller.
      expect(row?.coffee_id).toBe(coffeeA.coffeeId);
      expect(row?.coffee_name_snapshot).toBeTruthy();
      expect(row?.country_code).toBe("AE");
    });

    it("requires an address and country for a sample, and says so as validation", async () => {
      const { error } = await submit({
        p_full_name: `${TAG} No Address`,
        p_email: email("no-address"),
        p_phone: "+201000000123",
        p_message: "sample request with no delivery details at all",
        p_offer_id: coffeeA.offerId,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toContain("public_inquiry_missing_field");
    });

    it("rejects an offer that is not publicly visible", async () => {
      const { error } = await submit({
        ...baseFields("1 Test Street, Dubai"),
        p_email: email("bad-offer"),
        // A well-formed uuid that is not a visible offer.
        p_offer_id: "00000000-0000-4000-8000-000000000000",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toContain("public_inquiry_invalid_offer");
    });

    // -------------------------------------- the anonymous duplicate rule

    it("blocks a second active sample for the same normalized email and coffee", async () => {
      const address = email("dupe");
      const first = await submit({
        ...baseFields("1 Test Street, Dubai"),
        p_email: address,
        p_offer_id: coffeeA.offerId,
      });
      expect(first.error).toBeNull();

      // Same person, same coffee, deliberately messy casing/whitespace —
      // the index normalizes, so this must still collide.
      const second = await submit({
        ...baseFields("1 Test Street, Dubai"),
        p_email: `  ${address.toUpperCase()}  `,
        p_offer_id: coffeeA.offerId,
      });
      expect(second.error?.code).toBe("23505");
      expect(second.error?.message).toContain(
        "uq_inquiries_active_sample_anon_email_coffee",
      );
    });

    it("allows the same email to request a sample of a different coffee", async () => {
      const address = email("other-coffee");
      const first = await submit({
        ...baseFields("1 Test Street, Dubai"),
        p_email: address,
        p_offer_id: coffeeA.offerId,
      });
      const second = await submit({
        ...baseFields("1 Test Street, Dubai"),
        p_email: address,
        p_offer_id: coffeeB.offerId,
      });
      expect(first.error).toBeNull();
      expect(second.error, "a different coffee must be independent").toBeNull();
    });

    it("allows a new sample for the same coffee once the previous one is CLOSED", async () => {
      const address = email("reopen");
      const first = await submit({
        ...baseFields("1 Test Street, Dubai"),
        p_email: address,
        p_offer_id: coffeeA.offerId,
      });
      expect(first.error).toBeNull();

      // Walk the real Admin lifecycle to CLOSED rather than editing the row
      // into a state the transition guard would never produce.
      const { data: row } = await service
        .from("inquiries")
        .select("id")
        .eq("email", address)
        .single();
      const { error: closeError } = await service
        .from("inquiries")
        .update({ status: "CLOSED" })
        .eq("id", row!.id);
      expect(closeError, "closing the request failed").toBeNull();

      const reopened = await submit({
        ...baseFields("1 Test Street, Dubai"),
        p_email: address,
        p_offer_id: coffeeA.offerId,
      });
      expect(reopened.error, "CLOSED must free the pair again").toBeNull();
    });

    // ------------------------------------------------ what stays impossible

    it("offers no way to create a PRODUCT inquiry anonymously", async () => {
      // The function has no `type` parameter at all, so the only anonymous
      // route to PRODUCT would be a direct insert — which RLS denies, and
      // which the constraint would reject even with the service role.
      const { error } = await service.from("inquiries").insert({
        type: "PRODUCT",
        status: "NEW",
        user_id: null,
        // A coffee is supplied deliberately: without one the separate
        // inquiries_product_needs_coffee rule trips first, and this test is
        // specifically about the owner requirement.
        coffee_id: coffeeA.coffeeId,
        full_name: `${TAG} product`,
        email: email("product"),
        phone: "+201000000000",
        message: "PRODUCT without an owner must stay impossible",
      });
      expect(error?.code).toBe("23514");
      expect(error?.message).toContain("inquiries_product_needs_user");
    });

    // ------------------------------ bounds enforced for a direct RPC caller

    it("enforces field bounds even when the application layer is bypassed", async () => {
      // Every call here goes straight to PostgREST as `anon`, exactly as a
      // script would — the Zod schema in the server action never runs.
      const cases: [string, Record<string, unknown>][] = [
        ["over-long name", { p_full_name: `${TAG} ${"x".repeat(300)}` }],
        ["malformed email", { p_email: "not-an-email" }],
        ["over-long email", { p_email: `${"x".repeat(320)}@example.invalid` }],
        ["bad phone", { p_phone: "not a phone!!" }],
        ["short message", { p_message: "too short" }],
        ["over-long message", { p_message: "x".repeat(2100) }],
        ["over-long company", { p_company_name: "x".repeat(200) }],
        ["over-long subject", { p_subject: "x".repeat(200) }],
      ];

      for (const [label, override] of cases) {
        const { error } = await submit({
          ...baseFields(""),
          p_email: email("bounds"),
          ...override,
        });
        expect(error, `${label} was accepted`).not.toBeNull();
        expect(
          error?.message.includes("public_inquiry_invalid_field") ||
            error?.message.includes("public_inquiry_missing_field"),
          `${label} raised an unexpected error: ${error?.message}`,
        ).toBe(true);
      }
    });

    it("rejects a country code that is not exactly two letters", async () => {
      for (const country of ["A", "ARE", "1E"]) {
        const { error } = await submit({
          ...baseFields("1 Test Street, Dubai"),
          p_email: email("country"),
          p_offer_id: coffeeA.offerId,
          p_country_code: country,
        });
        expect(error, `country "${country}" was accepted`).not.toBeNull();
      }
    });

    it("never exposes raw database text through any rejection", async () => {
      const { error } = await submit({
        ...baseFields(""),
        p_email: "not-an-email",
      });
      // The token is machine-readable and deliberately opaque: no table,
      // column, constraint name, or SQL fragment travels with it.
      expect(error?.message).toContain("public_inquiry_invalid_field");
      expect(error?.message).not.toMatch(/relation|column|pg_|SELECT|INSERT/i);
    });

    it("enforces the per-email rate limit inside the database", async () => {
      const address = email("rate");
      const results = [];
      // The function permits 5 per hour per normalized email.
      for (let attempt = 0; attempt < 7; attempt += 1)
        results.push(await submit({ ...baseFields(""), p_email: address }));

      const limited = results.filter((result) =>
        result.error?.message.includes("public_inquiry_rate_limited"),
      );
      expect(limited.length, "the per-email limit never engaged").toBeGreaterThan(0);
    });

    it("cannot be raced past the per-email limit by concurrent callers", async () => {
      const address = email("race");
      // Fired together, not in sequence. Without the transaction-scoped
      // advisory lock these all read a count below the ceiling before any of
      // them inserts, and every one of them succeeds — which is precisely
      // the bypass the lock exists to close.
      const attempts = 10;
      const results = await Promise.all(
        Array.from({ length: attempts }, () =>
          submit({ ...baseFields(""), p_email: address }),
        ),
      );

      const accepted = results.filter((result) => !result.error).length;
      const limited = results.filter((result) =>
        result.error?.message.includes("public_inquiry_rate_limited"),
      ).length;

      // Five per hour is the ceiling; concurrency must not lift it.
      expect(
        accepted,
        `${accepted} of ${attempts} concurrent submissions were accepted`,
      ).toBeLessThanOrEqual(5);
      expect(limited, "no concurrent attempt was rate-limited").toBeGreaterThan(0);

      // And the database agrees with what the callers were told.
      const { count } = await service
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("email", address);
      expect(count ?? 0).toBeLessThanOrEqual(5);
    });
  },
);
