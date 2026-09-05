import { SiteFooter } from "@/components/navigation/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { WhatsAppFab } from "@/components/contact/whatsapp-fab";
import { whatsAppUrl } from "@/lib/contact/regions";
import { getTranslations } from "next-intl/server";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = await getTranslations("nav");
  const contact = await getTranslations("contact");
  // Absent when no WhatsApp destination is configured, in which case the
  // floating control is not rendered at all rather than linking nowhere.
  const whatsapp = whatsAppUrl();
  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed start-4 top-4 z-[100] rounded-md bg-background px-4 py-3 font-bold focus:not-sr-only"
      >
        {nav("skip")}
      </a>
      <SiteHeader />
      <main id="main-content" className="route-frame">
        {children}
      </main>
      <SiteFooter />
      {whatsapp ? (
        <WhatsAppFab
          href={whatsapp}
          label={contact("whatsapp.open")}
          hint={contact("whatsapp.hint")}
        />
      ) : null}
    </>
  );
}
