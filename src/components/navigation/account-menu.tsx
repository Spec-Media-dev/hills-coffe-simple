"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/actions/auth";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export type AccountMenuLink = { href: string; label: string };

/**
 * Signed-in customer affordance in the public header.
 *
 * Deliberately never renders an Admin entry: the master plan requires the
 * Admin portal to stay out of public navigation, and this component is only
 * given customer links by its server parent.
 */
export function AccountMenu({
  locale,
  name,
  initials,
  avatarUrl,
  links,
  labels,
}: {
  locale: Locale;
  name: string;
  initials: string;
  avatarUrl: string | null;
  links: AccountMenuLink[];
  labels: {
    open: string;
    signOut: string;
    confirmTitle: string;
    confirmBody: string;
    confirmAction: string;
    cancel: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Close on outside click and on Escape, and return focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Arrow-key roving focus within the open menu.
  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ??
        [],
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown"
        ? items[(index + 1 + items.length) % items.length]
        : items[(index - 1 + items.length) % items.length];
    next?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={labels.open}
        /*
         * Below `sm` this collapses to a 44px circle carrying just the avatar.
         * The signed-in header has one control more than the signed-out one
         * (the sign-in link is `hidden sm:flex`), and at 360px the full pill
         * pushed the row to 388px inside a 340px container — in Arabic that
         * clipped the whole control group off the leading edge. Nothing is
         * hidden here: the menu is still present, still a 44px target, and
         * still opens the same panel. Only the name and chevron — both
         * redundant beside an avatar — wait for room.
         */
        className="flex h-11 min-h-11 w-11 items-center justify-center rounded-full border border-border bg-card transition hover:border-gold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-auto sm:justify-start sm:gap-2 sm:ps-1 sm:pe-3"
      >
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-bold text-gold-bright">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="size-9 object-cover"
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </span>
        <span className="hidden max-w-[9rem] truncate text-xs font-bold sm:inline">
          {name}
        </span>
        <ChevronDown
          className="hidden size-4 shrink-0 sm:block"
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          onKeyDown={onMenuKeyDown}
          // `end-0` keeps the panel inside the viewport in both directions.
          className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-soft)]"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              data-menu-item
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold transition hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserRound className="size-4 shrink-0" aria-hidden="true" />
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            data-menu-item
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl border-t border-border px-3 text-sm font-bold text-destructive transition hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut
              className="size-4 shrink-0 rtl:rotate-180"
              aria-hidden="true"
            />
            {labels.signOut}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={labels.confirmTitle}
        description={labels.confirmBody}
        confirmLabel={labels.confirmAction}
        cancelLabel={labels.cancel}
        onCancel={() => setConfirming(false)}
      >
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="inline-flex h-11 min-h-11 items-center rounded-full px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            {labels.confirmAction}
          </button>
        </form>
      </ConfirmDialog>
    </div>
  );
}
