"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { AdminOption } from "@/lib/data/admin";

export function OfferPicker({ offers }: { offers: AdminOption[] }) {
  const t = useTranslations("admin.offerPicker");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? offers.filter((offer) =>
          offer.label.toLocaleLowerCase().includes(normalized),
        )
      : offers;
  }, [offers, query]);
  return (
    <div className="grid gap-2">
      <label className="sr-only" htmlFor="offer-search">
        {t("search")}
      </label>
      <input
        id="offer-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
      />
      <label className="sr-only" htmlFor="offer-id">
        {t("offer")}
      </label>
      <select
        id="offer-id"
        name="offerId"
        required
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
        defaultValue=""
      >
        <option value="">{t("choose")}</option>
        {filtered.map((offer) => (
          <option key={offer.id} value={offer.id}>
            {offer.label}
          </option>
        ))}
      </select>
      {filtered.length === 0 ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("noMatch")}
        </p>
      ) : null}
    </div>
  );
}
