import type { Metadata } from "next";
import { ArrowRight, ClipboardList } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { getInquiryLabels } from "@/lib/inquiries/labels";
import { Link } from "@/i18n/navigation";
import { requireVerifiedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Requests",
  robots: { index: false, follow: false },
};

export default async function RequestsPage() {
  // The account layout already guarantees an authenticated viewer.
  const viewer = await requireVerifiedUser();
  if (!viewer) return null;
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("inquiries")
    .select("id,request_code,type,coffee_name_snapshot,status,created_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false });

  const t = await getTranslations("account.requests");
  const format = await getFormatter();
  const labels = await getInquiryLabels();

  return (
    <section className="site-container section-space">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="display-lg mt-4">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t("intro")}</p>

      {data?.length ? (
        <ul className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
          {data.map((row) => (
            <li key={row.id} className="border-b border-border last:border-0">
              <Link
                href={`/account/requests/${row.request_code}`}
                className="grid gap-3 p-6 transition hover:bg-page md:grid-cols-[1.4fr_1fr_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <strong className="block truncate">
                    {row.coffee_name_snapshot ?? labels.type(row.type)}
                  </strong>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {row.request_code}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {labels.type(row.type)}
                </p>
                <span className="justify-self-start rounded-full bg-muted px-3 py-1 text-xs font-bold">
                  {labels.status(row.status)}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {row.created_at
                    ? format.dateTime(new Date(row.created_at), {
                        dateStyle: "medium",
                      })
                    : null}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 rounded-2xl border border-border bg-card p-12 text-center">
          <ClipboardList className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-5 font-bold">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Link
            href="/green-coffee-offer-list"
            className="mt-7 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light"
          >
            {t("emptyCta")}
          </Link>
        </div>
      )}
    </section>
  );
}
