"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AccordionExpand } from "@/components/motion/primitives";
import type { CatalogRow, CatalogRowDetail } from "@/lib/data/catalog-query";

/**
 * One catalog result, as a row on desktop and a stacked card on a phone.
 *
 * Deliberately one component rather than a table for wide screens and a
 * separate card list for narrow ones: two implementations of the same row drift
 * apart, and the desktop table shape is unusable at 375px. The layout switches
 * with `md:` grid columns, so the markup — and therefore the accessibility tree
 * and the expand behaviour — is identical in both.
 *
 * `price` arrives already resolved by the server for a viewer who passed the
 * protected-pricing gate. This component never reads a price, so it cannot leak
 * one; for everyone else it is `undefined` and nothing is rendered in its place.
 */

export type CatalogItemLabels = {
  bags: string;
  bagWeight: string;
  view: string;
  expand: string;
  collapse: string;
  reference: string;
  grade: string;
  region: string;
  process: string;
  warehouse: string;
  cupScore: string;
  availableFrom: string;
  packaging: string;
  certifications: string;
  tags: string;
  sensory: string;
  variety: string;
  status: string;
};

/** A definition pair, rendered only when the value is genuinely present. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

export function CatalogItem({
  item,
  detail,
  price,
  statusLabel,
  labels,
}: {
  item: CatalogRow;
  detail?: CatalogRowDetail;
  price?: number;
  statusLabel: string;
  labels: CatalogItemLabels;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  /*
   * Every entry is filtered on a real value before it reaches the list, so an
   * absent cup score or an offer with no certifications renders nothing rather
   * than a labelled void. The reference screenshot shows exactly that failure —
   * "Tags", "Certifications", "Cupping Score" and "Sensories" printed as empty
   * headings — and it is what makes a detail panel feel broken.
   */
  const joined = (values?: string[]) =>
    values && values.length ? values.join(" · ") : null;

  const fields: { label: string; value: React.ReactNode }[] = [
    // Latin identifiers stay LTR so a reference code is not reordered in Arabic.
    {
      label: labels.reference,
      value: <span dir="ltr">{item.reference}</span>,
    },
    { label: labels.status, value: statusLabel },
    { label: labels.region, value: item.region },
    { label: labels.process, value: item.process },
    { label: labels.grade, value: item.grade },
    { label: labels.warehouse, value: item.warehouse },
    {
      label: labels.bagWeight,
      value: <span dir="ltr">{`${item.bags} × ${item.bagWeightKg} kg`}</span>,
    },
    {
      label: labels.cupScore,
      value:
        item.cupScore == null ? null : <span dir="ltr">{item.cupScore}</span>,
    },
    {
      label: labels.availableFrom,
      value: item.availableFrom ? (
        <span dir="ltr">{item.availableFrom}</span>
      ) : null,
    },
    { label: labels.packaging, value: detail?.packaging ?? null },
    { label: labels.variety, value: joined(detail?.varieties) },
    { label: labels.certifications, value: joined(detail?.certifications) },
    { label: labels.tags, value: joined(detail?.tags) },
    { label: labels.sensory, value: joined(detail?.sensory) },
  ].filter((field) => field.value !== null && field.value !== undefined);

  return (
    <article className="border border-border bg-card transition-colors duration-300 hover:border-highlight">
      <div className="grid gap-4 p-4 md:grid-cols-[auto_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-5 md:p-5">
        <div className="relative hidden size-16 shrink-0 overflow-hidden bg-muted md:block">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.imageAlt}
              fill
              unoptimized
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center text-xl opacity-30"
            >
              ☕
            </span>
          )}
        </div>

        <div className="min-w-0">
          <p className="eyebrow">{item.origin}</p>
          <h2 className="mt-1.5 truncate text-lg font-bold md:text-xl">
            <Link
              href={`/green-coffee-offer-list/${item.slug}`}
              className="rounded transition-colors hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.name}
            </Link>
          </h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {[item.region, item.process, item.grade]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <p className="text-sm text-muted-foreground md:text-center">
          <span className="md:sr-only">{labels.warehouse}: </span>
          {item.warehouse}
        </p>

        <p className="text-sm md:text-center" dir="ltr">
          <span className="sr-only">{labels.bags}: </span>
          {`${item.bags} × ${item.bagWeightKg} kg`}
        </p>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          {price == null ? null : (
            /*
             * A template literal, not `${"$"}{expr} / kg` as JSX children.
             * Adjacent JSX children become separate text nodes, which React
             * serializes with `<!-- -->` separators — so the markup read
             * `$<!-- -->7.50<!-- --> / kg` and every price scan that matches
             * rendered HTML silently stopped matching. One node keeps the
             * output identical to what the catalog card produced before.
             */
            <p className="font-bold text-highlight" dir="ltr">
              {`$${price.toFixed(2)} / kg`}
            </p>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border transition-colors hover:border-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">
              {open ? labels.collapse : labels.expand}
            </span>
            <ChevronDown
              className={`size-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/*
       * The region exists in the DOM whether or not it is expanded, so
       * `aria-controls` always resolves to a real element; only its contents
       * animate in and out.
       */}
      <div id={panelId} role="region" aria-label={item.name}>
        <AccordionExpand open={open}>
          <div className="border-t border-border p-4 md:p-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {fields.map((field) => (
                <Field
                  key={field.label}
                  label={field.label}
                  value={field.value}
                />
              ))}
            </dl>
            {/* The preview never replaces the canonical detail page. */}
            <Link
              href={`/green-coffee-offer-list/${item.slug}`}
              className="mt-5 inline-flex min-h-11 items-center bg-primary px-5 py-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {labels.view}
            </Link>
          </div>
        </AccordionExpand>
      </div>
    </article>
  );
}
