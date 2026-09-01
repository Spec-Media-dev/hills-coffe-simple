import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { ACTIVE_SAMPLE_STATUSES } from "@/lib/inquiries/sample-request";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  InquiryStatus,
  InquiryType,
} from "@/lib/supabase/types.generated";

/**
 * P7-T03 — the Admin Lead Inbox read path
 * (`contracts/inquiry-actions.md`: `listLeadInbox` / `getInquiryDetail`).
 *
 * `requireAdmin()` is re-checked here rather than inherited from the Admin
 * layout, and RLS restricts `inquiries` to Administrators independently, so
 * there are three layers between a customer and someone else's request.
 *
 * Search, filtering and pagination are evaluated by the database. The list
 * reads only the snapshot columns the row already carries
 * (`coffee_name_snapshot`, `offer_reference_snapshot`,
 * `warehouse_code_snapshot`, written by `hydrate_inquiry_context()`), so a
 * page costs one bounded query rather than a join fan-out per row.
 */

export const LEAD_PAGE_SIZE = 20;

/**
 * The filter vocabularies, mirroring the live `inquiry_type` / `inquiry_status`
 * enums. A query string is attacker-controlled, so a value that is not one of
 * these is dropped rather than forwarded: an unknown enum label would otherwise
 * make PostgREST answer with a schema error instead of a page of results.
 */
export const LEAD_TYPES = [
  "GENERAL",
  "PRODUCT",
  "SAMPLE_REQUEST",
] as const satisfies readonly InquiryType[];

export const LEAD_STATUSES = [
  "NEW",
  "RECEIVED",
  "CONTACTED",
  "SAMPLE_SENT",
  "DELIVERED",
  "CLOSED",
] as const satisfies readonly InquiryStatus[];

export type LeadFilters = {
  query?: string;
  type?: string;
  status?: string;
  page: number;
};

export type LeadRow = {
  id: string;
  requestCode: string;
  type: string;
  status: InquiryStatus;
  customerName: string;
  customerEmail: string;
  coffeeName: string;
  offerReference: string | null;
  warehouseCode: string | null;
  createdAt: string;
};

export type LeadPage = {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  configured: boolean;
};

const EMPTY: LeadPage = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: LEAD_PAGE_SIZE,
  pageCount: 0,
  configured: false,
};

const LIST_COLUMNS =
  "id,request_code,type,status,full_name,email,coffee_name_snapshot,offer_reference_snapshot,warehouse_code_snapshot,created_at";

const toRow = (row: Record<string, unknown>): LeadRow => ({
  id: String(row.id),
  requestCode: String(row.request_code),
  type: String(row.type),
  status: row.status as InquiryStatus,
  customerName: String(row.full_name ?? ""),
  customerEmail: String(row.email ?? ""),
  coffeeName: String(row.coffee_name_snapshot ?? ""),
  offerReference: row.offer_reference_snapshot
    ? String(row.offer_reference_snapshot)
    : null,
  warehouseCode: row.warehouse_code_snapshot
    ? String(row.warehouse_code_snapshot)
    : null,
  createdAt: String(row.created_at),
});

export async function listLeadInbox(filters: LeadFilters): Promise<LeadPage> {
  if (!(await requireAdmin())) return EMPTY;
  if (!isSupabaseConfigured()) return EMPTY;

  const db = await createSupabaseServerClient();
  const page = Math.max(1, filters.page || 1);
  const from = (page - 1) * LEAD_PAGE_SIZE;

  let query = db.from("inquiries").select(LIST_COLUMNS, { count: "exact" });

  const type = LEAD_TYPES.find((value) => value === filters.type);
  const status = LEAD_STATUSES.find((value) => value === filters.status);
  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);
  if (filters.query) {
    // One OR across the columns an Admin would actually search by. The value
    // is escaped for PostgREST's filter grammar before interpolation.
    const term = filters.query.replace(/[(),*]/g, " ").trim();
    if (term)
      query = query.or(
        [
          `request_code.ilike.%${term}%`,
          `full_name.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `coffee_name_snapshot.ilike.%${term}%`,
        ].join(","),
      );
  }

  // Newest first, with the primary key as a tie-breaker so a row can never
  // appear on two pages or on none.
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + LEAD_PAGE_SIZE - 1);

  if (error) {
    // PGRST103 is a page past the last row: an ordinary empty page.
    if (error.code === "PGRST103")
      return { ...EMPTY, page, total: count ?? 0, configured: true };
    console.error(`[lead-inbox] list failed: ${error.code ?? "upstream"}`);
    return { ...EMPTY, configured: true };
  }

  const total = count ?? 0;
  return {
    rows: (data ?? []).map((row) =>
      toRow(row as unknown as Record<string, unknown>),
    ),
    total,
    page,
    pageSize: LEAD_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE)),
    configured: true,
  };
}

export type LeadHistoryEntry = {
  id: string;
  oldStatus: InquiryStatus | null;
  newStatus: InquiryStatus;
  createdAt: string;
};

export type PriorRequest = {
  requestCode: string;
  status: InquiryStatus;
  createdAt: string;
  active: boolean;
};

export type LeadDetail = LeadRow & {
  coffeeId: string | null;
  userId: string | null;
  companyName: string | null;
  phone: string | null;
  address: string | null;
  countryCode: string | null;
  subject: string | null;
  message: string | null;
  updatedAt: string;
  history: LeadHistoryEntry[];
  /** Same customer, same coffee, any status — excluding this request. */
  priorRequests: PriorRequest[];
};

export async function getInquiryDetail(
  inquiryId: string,
): Promise<LeadDetail | null> {
  if (!(await requireAdmin()) || !isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();

  const { data: row } = await db
    .from("inquiries")
    .select("*")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!row) return null;

  const [historyQ, priorQ] = await Promise.all([
    db
      .from("inquiry_status_history")
      .select("id,old_status,new_status,created_at")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true }),
    // Prior same-coffee history is what lets an Admin tell a legitimate
    // post-CLOSED request apart from an active duplicate (FR-040).
    row.user_id && row.coffee_id
      ? db
          .from("inquiries")
          .select("request_code,status,created_at")
          .eq("user_id", row.user_id)
          .eq("coffee_id", row.coffee_id)
          .eq("type", "SAMPLE_REQUEST")
          .neq("id", inquiryId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const active = new Set<string>(ACTIVE_SAMPLE_STATUSES);
  return {
    ...toRow(row as Record<string, unknown>),
    coffeeId: row.coffee_id ? String(row.coffee_id) : null,
    userId: row.user_id ? String(row.user_id) : null,
    companyName: row.company_name ? String(row.company_name) : null,
    phone: row.phone ? String(row.phone) : null,
    address: row.address ? String(row.address) : null,
    countryCode: row.country_code ? String(row.country_code) : null,
    subject: row.subject ? String(row.subject) : null,
    message: row.message ? String(row.message) : null,
    updatedAt: String(row.updated_at),
    history: (historyQ.data ?? []).map((entry) => ({
      id: String(entry.id),
      oldStatus: entry.old_status as InquiryStatus | null,
      newStatus: entry.new_status as InquiryStatus,
      createdAt: String(entry.created_at),
    })),
    priorRequests: (priorQ.data ?? []).map((entry) => ({
      requestCode: String(entry.request_code),
      status: entry.status as InquiryStatus,
      createdAt: String(entry.created_at),
      active: active.has(String(entry.status)),
    })),
  };
}
