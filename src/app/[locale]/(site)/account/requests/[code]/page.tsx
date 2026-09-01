import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireVerifiedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Request",
  robots: { index: false, follow: false },
};

export default async function RequestDetailPage({
  params,
}: PageProps<"/[locale]/account/requests/[code]">) {
  const { code } = (await params) as { locale: Locale; code: string };
  // The account layout already guarantees an authenticated viewer.
  const viewer = await requireVerifiedUser();
  if (!viewer) return null;

  const db = await createSupabaseServerClient();
  // Scoped to the signed-in user; RLS enforces the same boundary server-side.
  const { data: request } = await db
    .from("inquiries")
    .select(
      "id,request_code,type,status,subject,message,coffee_name_snapshot,offer_reference_snapshot,warehouse_code_snapshot,full_name,email,phone,company_name,address,country_code,created_at,updated_at",
    )
    .eq("user_id", viewer.id)
    .eq("request_code", code)
    .maybeSingle();
  if (!request) notFound();

  const { data: history } = await db
    .from("inquiry_status_history")
    .select("id,old_status,new_status,created_at")
    .eq("inquiry_id", request.id)
    .order("created_at", { ascending: true });

  const t = await getTranslations("account.requestDetail");
  const format = await getFormatter();
  const when = (value: string | null) =>
    value
      ? format.dateTime(new Date(value), {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  // Explicit maps keep these localized labels type-safe against the
  // inquiry_status / inquiry_type enums instead of relying on dynamic keys.
  const statuses: Record<string, string> = {
    NEW: t("statuses.NEW"),
    RECEIVED: t("statuses.RECEIVED"),
    CONTACTED: t("statuses.CONTACTED"),
    CLOSED: t("statuses.CLOSED"),
  };
  const types: Record<string, string> = {
    GENERAL: t("types.GENERAL"),
    PRODUCT: t("types.PRODUCT"),
    SAMPLE_REQUEST: t("types.SAMPLE_REQUEST"),
  };
  const statusLabel = (status: unknown) =>
    statuses[String(status)] ?? String(status);
  const typeLabel = (type: unknown) => types[String(type)] ?? String(type);

  const facts: Array<[string, string]> = [
    [t("code"), request.request_code],
    [t("type"), typeLabel(request.type)],
    [t("status"), statusLabel(request.status)],
    [t("submitted"), when(request.created_at)],
    [t("coffee"), request.coffee_name_snapshot ?? "—"],
    [t("offer"), request.offer_reference_snapshot ?? "—"],
    [t("warehouse"), request.warehouse_code_snapshot ?? "—"],
  ];
  const contact: Array<[string, string]> = [
    [t("contactName"), request.full_name],
    [t("contactEmail"), request.email],
    [t("contactPhone"), request.phone],
    [t("contactCompany"), request.company_name ?? "—"],
    [t("contactAddress"), request.address ?? "—"],
    [t("contactCountry"), request.country_code ?? "—"],
  ];

  return (
    <section className="site-container section-space">
      <Link
        href="/account/requests"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("back")}
      </Link>

      <p className="eyebrow mt-7">{t("eyebrow")}</p>
      <h1 className="display-lg mt-4" dir="ltr">
        {request.request_code}
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t("intro")}</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-7">
          <h2 className="text-xl">{t("summary")}</h2>
          <dl className="mt-6 grid gap-4">
            {facts.map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-7">
          <h2 className="text-xl">{t("contactTitle")}</h2>
          <dl className="mt-6 grid gap-4">
            {contact.map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {request.message ? (
          <div className="rounded-2xl border border-border bg-card p-6 md:p-7 lg:col-span-2">
            <h2 className="text-xl">{t("messageTitle")}</h2>
            {request.subject ? (
              <p className="mt-4 font-bold">{request.subject}</p>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap leading-7 text-muted-foreground">
              {request.message}
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-card p-6 md:p-7 lg:col-span-2">
          <h2 className="text-xl">{t("timelineTitle")}</h2>
          {history?.length ? (
            <ol className="mt-6 grid gap-5">
              {history.map((entry) => (
                <li key={entry.id} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2.5 shrink-0 rounded-full bg-highlight"
                  />
                  <div>
                    <p className="text-sm font-bold">
                      {statusLabel(entry.new_status)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {when(entry.created_at)}
                    </p>
                    {entry.old_status ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("changedFrom", {
                          status: statusLabel(entry.old_status),
                        })}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("timelineEmpty")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
