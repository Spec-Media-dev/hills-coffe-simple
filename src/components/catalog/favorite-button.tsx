"use client";

import { Heart, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { toggleFavoriteAction } from "@/actions/account";
import {
  idleActionState,
  settled,
  type ActionFormState,
} from "@/lib/actions";

/**
 * The save/remove favourite control.
 *
 * Phase 11 moved the underlying action onto the domain-result contract, which
 * this component exists to render: the previous plain `<form action={...}>`
 * could not show an outcome, so an expired session and a rejected write both
 * looked exactly like success.
 *
 * `aria-pressed` carries the state, so this is one toggle rather than two
 * buttons that swap labels, and the single live region announces the result
 * once — the pending state is conveyed by `aria-busy`, not by a second
 * announcement.
 */
export function FavoriteButton({
  coffeeId,
  returnTo,
  favorite,
  className,
}: {
  coffeeId: string;
  returnTo: string;
  /** Whether the coffee was a favourite when the page rendered. */
  favorite: boolean;
  className: string;
}) {
  const t = useTranslations("product");
  const responses = useTranslations("account.responses");
  const [state, action, pending] = useActionState(
    toggleFavoriteAction,
    idleActionState as ActionFormState<{ favorite: boolean }>,
  );
  const outcome = settled(state);

  // The server reports the state it left the row in; until it answers, the
  // value the page rendered with is the truth.
  const isFavorite =
    outcome?.ok && outcome.data ? outcome.data.favorite : favorite;

  return (
    <form action={action}>
      <input type="hidden" name="coffeeId" value={coffeeId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-pressed={isFavorite}
        aria-busy={pending}
        disabled={pending}
        className={className}
      >
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <Heart
            className={`size-4 shrink-0 ${isFavorite ? "fill-current" : ""}`}
            aria-hidden="true"
          />
        )}
        {isFavorite ? t("removeFavourite") : t("saveFavourite")}
      </button>

      {outcome?.messageKey ? (
        <p
          role={outcome.ok ? "status" : "alert"}
          className={
            outcome.ok
              ? "mt-2 text-xs text-muted-foreground"
              : "mt-2 text-xs font-medium text-destructive"
          }
        >
          {responses(outcome.messageKey as Parameters<typeof responses>[0])}
        </p>
      ) : null}
    </form>
  );
}
