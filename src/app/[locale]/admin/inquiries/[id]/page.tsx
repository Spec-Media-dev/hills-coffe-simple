import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StatusPill, TypeBadge } from "@/components/admin/lead-badges";
import { LeadStatusActions } from "@/components/admin/lead-status-actions";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getInquiryDetail } from "@/lib/data/lead-inbox";
import { getInquiryLabels } from "@/lib/inquiries/labels";
import { allowedNextStatuses } from "@/lib/inquiries/transitions";

export const metadata: Metadata = {
  title: "Lead detail",
  robots: { index: false, follow: false },
};

/**
 * One request, with the context an Administrator needs to act on it: who asked,
 * for which coffee and offer, what they said, every status the request has
 * passed through, and — for a sample request — what this customer has asked
 * for on this coffee before.
 *
 * The timeline is read from `inquiry_status_history`, which only the
 * `track_inquiry_status()` trigger writes. Nothing on this page or behind it
 * appends to that table, so the history is exactly what the database recorded.
 */
export default async function AdminLeadDetailPage({
  params,
}: PageProps<"/[locale]/admin/inquiries/[id]">) {
  const { id, locale } = (await params) as { id: string; locale: Locale };
  const t = await getTranslations("admin.leads");
  const labels = await getInquiryLabels();

  // `getInquiryDetail` runs its own `requireAdmin()`; a non-Admin — and an id
  // that does not exist — reach the same 404, revealing nothing either way.
  const lead = await getInquiryDetail(id);
  if (!lead) notFound();

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const when = (value: string | null) =>
    value ? dateTime.format(new Date(value)) : t("none");

  const customerFacts: Array<[string, string, boolean?]> = [
    [t("fullName"), lead.customerName || t("none")],
    [t("email"), lead.customerEmail || t("none"), true],
    [t("phone"), lead.phone || t("none"), true],
    [t("company"), lead.companyName || t("none")],
    [t("address"), lead.address || t("none")],
    [t("country"), lead.countryCode || t("none"), true],
  ];

  const contextFacts: Array<[string, string, boolean?]> = [
    [t("coffee"), lead.coffeeName || t("none")],
    [t("offer"), lead.offerReference || t("none"), true],
    [t("warehouse"), lead.warehouseCode || t("none"), true],
    [t("submitted"), when(lead.createdAt)],
    [t("updated"), when(lead.updatedAt)],
  ];

  const nextStatuses = allowedNextStatuses(lead.type, lead.status);
  const isSample = lead.type === "SAMPLE_REQUEST";

  return (
    <div className="p-5 md:p-8">
      <Link
        href="/admin/inquiries"
        className="inline-flex h-11 min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("backToList")}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-4xl md:text-5xl" dir="ltr">
          {lead.requestCode}
        </h1>
        <TypeBadge type={lead.type} label={labels.type(lead.type)} />
        <StatusPill status={lead.status} label={labels.status(lead.status)} />
      </div>
      <p className="mt-3 text-muted-foreground">{t("detailTitle")}</p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Section title={t("customerSection")}>
          <FactList facts={customerFacts} />
        </Section>

        <Section title={t("coffeeSection")}>
          <FactList facts={contextFacts} />
        </Section>

        <Section title={t("requestSection")}>
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="font-bold">{t("subject")}</dt>
              <dd className="mt-1 text-muted-foreground">
                {lead.subject || t("none")}
              </dd>
            </div>
            <div>
              <dt className="font-bold">{t("message")}</dt>
              {/* Customer-authored text: rendered as text, never as markup. */}
              <dd className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {lead.message || t("none")}
              </dd>
            </div>
          </dl>
        </Section>

        <Section title={t("timelineSection")}>
          <ol className="grid gap-3 text-sm">
            {lead.history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <span className="font-bold">
                  {labels.status(entry.newStatus)}
                  {entry.oldStatus ? (
                    <span className="ms-2 font-normal text-muted-foreground">
                      {t("historyFrom", {
                        status: labels.status(entry.oldStatus),
                      })}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">
                  {when(entry.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        {/* Prior same-coffee requests are what let an Admin tell a legitimate
            new request after a CLOSED one apart from an active duplicate. Only
            meaningful for sample requests, which carry the uniqueness rule. */}
        {isSample ? (
          <Section title={t("priorSection")}>
            {lead.priorRequests.length ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("priorCount", { count: lead.priorRequests.length })}
                </p>
                <ul className="mt-3 grid gap-2 text-sm">
                  {lead.priorRequests.map((prior) => (
                    <li
                      key={prior.requestCode}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                    >
                      <span className="font-bold" dir="ltr">
                        {prior.requestCode}
                      </span>
                      <StatusPill
                        status={prior.status}
                        label={labels.status(prior.status)}
                      />
                      <span className="text-muted-foreground">
                        {when(prior.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("priorNone")}</p>
            )}
          </Section>
        ) : null}

        <Section title={t("actionsSection")}>
          <LeadStatusActions
            inquiryId={lead.id}
            currentStatus={lead.status}
            options={nextStatuses}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FactList({ facts }: { facts: Array<[string, string, boolean?]> }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {facts.map(([label, value, ltr]) => (
        <div key={label}>
          <dt className="font-bold">{label}</dt>
          {/* Identifiers, emails, phone numbers and codes stay LTR in RTL. */}
          <dd
            className="mt-1 break-words text-muted-foreground"
            dir={ltr ? "ltr" : undefined}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
