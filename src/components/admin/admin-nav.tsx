import {
  Boxes,
  ClipboardList,
  Coffee,
  FileText,
  Home,
  MapPin,
  Settings,
  Tags,
  UsersRound,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand/mark";
import { Link } from "@/i18n/navigation";

export async function AdminNav() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const links = [
    {
      href: "/admin",
      label: locale === "ar" ? "نظرة عامة" : "Overview",
      icon: Home,
    },
    { href: "/admin/products", label: t("products"), icon: Coffee },
    { href: "/admin/offers", label: t("offers"), icon: Boxes },
    { href: "/admin/inquiries", label: t("inquiries"), icon: ClipboardList },
    {
      href: "/admin/origins",
      label: locale === "ar" ? "المناشئ" : "Origins",
      icon: MapPin,
    },
    {
      href: "/admin/taxonomy",
      label: locale === "ar" ? "التصنيفات" : "Taxonomy",
      icon: Tags,
    },
    { href: "/admin/users", label: t("users"), icon: UsersRound },
    { href: "/admin/content", label: t("content"), icon: FileText },
    { href: "/admin/settings", label: t("settings"), icon: Settings },
  ];
  return (
    <aside className="border-e border-white/10 bg-[#13241b] p-5 text-[#eee8dc] lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:p-7">
      <Link href="/">
        <BrandMark className="text-white" />
      </Link>
      <nav className="mt-9 flex gap-2 overflow-x-auto lg:grid lg:overflow-visible">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 transition hover:bg-white/8 hover:text-white"
          >
            <Icon className="size-4 text-gold-bright" />
            {label}
          </Link>
        ))}
      </nav>
      <p className="mt-8 hidden border-t border-white/10 pt-5 text-xs leading-5 text-white/40 lg:block">
        {t("protected")}
      </p>
    </aside>
  );
}
