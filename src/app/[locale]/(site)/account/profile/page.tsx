import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/forms/account-forms";
import type { Locale } from "@/i18n/routing";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage({
  params,
}: PageProps<"/[locale]/account/profile">) {
  const { locale } = (await params) as { locale: Locale };
  // The account layout already guarantees an authenticated viewer.
  const viewer = await getViewer();
  if (!viewer) return null;
  const t = await getTranslations("account.profileForm");
  return (
    <section className="site-container section-space">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="display-lg mt-4">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t("intro")}</p>
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 md:p-8">
        <ProfileForm
          locale={locale}
          labels={{
            name: t("name"),
            phone: t("phone"),
            company: t("company"),
            address: t("address"),
            country: t("country"),
            countryHint: t("countryHint"),
            save: t("save"),
          }}
          defaults={{
            fullName: viewer.fullName ?? "",
            phone: viewer.phone ?? "",
            companyName: viewer.companyName ?? "",
            address: viewer.address ?? "",
            countryCode: viewer.countryCode ?? "",
          }}
        />
      </div>
    </section>
  );
}
