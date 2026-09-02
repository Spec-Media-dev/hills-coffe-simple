"use client";

import {
  BadgeDollarSign,
  Boxes,
  Building2,
  ClipboardList,
  Coffee,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Library,
  Map,
  MapPin,
  Newspaper,
  ScrollText,
  Settings,
  ShieldCheck,
  Sprout,
  Tags,
  UsersRound,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

const icons = {
  BadgeDollarSign,
  Boxes,
  Building2,
  ClipboardList,
  Coffee,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Library,
  Map,
  MapPin,
  Newspaper,
  ScrollText,
  Settings,
  ShieldCheck,
  Sprout,
  Tags,
  UsersRound,
} as const;

export type AdminNavIcon = keyof typeof icons;

export function AdminNavLink({
  href,
  label,
  hint,
  icon,
}: {
  href: string;
  label: string;
  hint?: string;
  icon: AdminNavIcon;
}) {
  const Icon = icons[icon];
  const pathname = usePathname();
  // "/admin" must only match exactly, otherwise every child route looks active.
  const active =
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:min-h-11 ${
        active
          ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
          : "text-white/65 hover:bg-white/8 hover:text-white"
      }`}
    >
      <Icon
        className={`size-4 shrink-0 ${active ? "text-gold-bright" : "text-gold-bright/70"}`}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {hint ? (
          <span className="hidden truncate text-[11px] font-normal leading-4 text-white/60 lg:block">
            {hint}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
