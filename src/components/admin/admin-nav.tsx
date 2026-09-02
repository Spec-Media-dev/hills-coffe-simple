import { getLocale, getTranslations } from "next-intl/server";
import {
  AdminNavLink,
  type AdminNavIcon,
} from "@/components/admin/admin-nav-link";
import { BrandMark } from "@/components/brand/mark";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSiteLogo } from "@/lib/data/site-logo";

type NavItem = {
  href: string;
  label: string;
  hint?: string;
  icon: AdminNavIcon;
};
type NavGroup = { id: string; label: string; items: NavItem[] };

export async function AdminNav() {
  const t = await getTranslations("admin");
  const nav = await getTranslations("admin.nav");
  const groupLabels = await getTranslations("admin.groups");
  const logo = await getSiteLogo((await getLocale()) as Locale);

  // Every href below maps to a module the admin router actually serves.
  const groups: NavGroup[] = [
    {
      id: "overview",
      label: groupLabels("overview"),
      items: [
        { href: "/admin", label: nav("overview"), icon: "LayoutDashboard" },
      ],
    },
    {
      id: "catalog",
      label: groupLabels("catalog"),
      items: [
        { href: "/admin/products", label: nav("products"), icon: "Coffee" },
        { href: "/admin/offers", label: nav("offers"), icon: "Boxes" },
        {
          href: "/admin/pricing",
          label: nav("pricing"),
          icon: "BadgeDollarSign",
        },
      ],
    },
    {
      id: "coffee-data",
      label: groupLabels("coffeeData"),
      items: [
        { href: "/admin/origins", label: nav("origins"), icon: "MapPin" },
        { href: "/admin/regions", label: nav("regions"), icon: "Map" },
        { href: "/admin/varieties", label: nav("varieties"), icon: "Sprout" },
        {
          href: "/admin/warehouses",
          label: nav("warehouses"),
          icon: "Building2",
        },
        {
          href: "/admin/taxonomy",
          label: nav("taxonomy"),
          hint: nav("taxonomyHint"),
          icon: "Tags",
        },
      ],
    },
    {
      id: "content",
      label: groupLabels("content"),
      items: [
        {
          href: "/admin/content",
          label: nav("contentPages"),
          icon: "FileText",
        },
        {
          href: "/admin/articles",
          label: nav("articles"),
          icon: "Newspaper",
        },
        {
          href: "/admin/article-categories",
          label: nav("articleCategories"),
          icon: "Library",
        },
        { href: "/admin/media", label: nav("media"), icon: "ImageIcon" },
        {
          href: "/admin/settings",
          label: nav("siteSettings"),
          icon: "Settings",
        },
      ],
    },
    {
      id: "customers",
      label: groupLabels("customers"),
      items: [
        { href: "/admin/users", label: nav("users"), icon: "UsersRound" },
        {
          href: "/admin/inquiries",
          label: nav("inquiries"),
          icon: "ClipboardList",
        },
      ],
    },
    {
      id: "system",
      label: groupLabels("system"),
      items: [
        { href: "/admin/audit", label: nav("audit"), icon: "ScrollText" },
        { href: "/admin/account", label: nav("account"), icon: "ShieldCheck" },
      ],
    },
  ];

  return (
    <aside className="border-e border-white/10 bg-[#13241b] text-[#eee8dc] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-72 lg:shrink-0 lg:flex-col">
      <div className="shrink-0 px-5 pt-5 lg:px-6 lg:pt-7">
        <Link href="/" className="inline-block">
          <BrandMark className="text-white" logo={logo} />
        </Link>
      </div>

      <nav
        aria-label={nav("primary")}
        className="flex gap-2 overflow-x-auto px-5 py-4 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-6 lg:overflow-x-hidden lg:overflow-y-auto lg:px-4 lg:py-6"
      >
        {groups.map((group) => (
          <div key={group.id} className="contents lg:block">
            <p className="hidden px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35 lg:block">
              {group.label}
            </p>
            <div className="contents lg:grid lg:gap-1">
              {group.items.map((item) => (
                <AdminNavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="hidden shrink-0 border-t border-white/10 px-6 py-5 lg:block">
        <p className="text-xs leading-5 text-white/40">{t("protected")}</p>
      </div>
    </aside>
  );
}
