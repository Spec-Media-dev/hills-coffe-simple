"use client";

import { useTranslations } from "next-intl";
import { savePriceTierAction, saveOfferAction } from "@/actions/admin-catalog";
import {
  AdminCheckboxGroup,
  AdminField,
  AdminForm,
  AdminSelect,
} from "@/components/admin/admin-form";
import type {
  AdminOfferRecord,
  CatalogFormOptions,
} from "@/lib/data/admin-catalog";

const section =
  "grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 xl:grid-cols-3";

/**
 * Create/edit form for an offer.
 *
 * Coffee and warehouse are required references, so neither is ever presented
 * as a bare "None": with data they show a localized "Select …" prompt, and
 * without data they say which dependency to create and link to it.
 */
export function OfferForm({
  options,
  record,
}: {
  options: CatalogFormOptions;
  record?: AdminOfferRecord;
}) {
  const t = useTranslations("admin.catalog");
  return (
    <AdminForm
      action={saveOfferAction}
      submitLabel={t("save")}
      pendingLabel={t("saving")}
      className="mt-7 grid gap-6"
    >
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <fieldset className={section}>
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("identity")}
        </legend>
        <AdminSelect
          name="coffeeId"
          label={t("coffee")}
          placeholder={t("selectCoffee")}
          options={options.coffees}
          defaultValue={record?.coffeeId}
          emptyMessage={t("noCoffees")}
          emptyHref="/admin/products/new"
          emptyCta={t("createOne")}
        />
        <AdminSelect
          name="warehouseId"
          label={t("warehouse")}
          placeholder={t("selectWarehouse")}
          options={options.warehouses}
          defaultValue={record?.warehouseId}
          emptyMessage={t("noWarehouses")}
          emptyHref="/admin/warehouses"
          emptyCta={t("createOne")}
        />
        <AdminField
          name="referenceNumber"
          label={t("referenceNumber")}
          dir="ltr"
          defaultValue={record?.referenceNumber}
        />
      </fieldset>

      <fieldset className={section}>
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("classification")}
        </legend>
        <AdminField
          name="bagsQuantity"
          label={t("bagsQuantity")}
          type="number"
          min="0"
          defaultValue={record?.bagsQuantity ?? 0}
        />
        <AdminField
          name="bagWeightKg"
          label={t("bagWeightKg")}
          type="number"
          min="0"
          step="0.01"
          defaultValue={record?.bagWeightKg ?? 60}
        />
        <AdminField
          name="cupScore"
          label={t("cupScore")}
          type="number"
          min="0"
          step="0.25"
          defaultValue={record?.cupScore}
        />
        <AdminSelect
          name="packagingTypeId"
          label={t("packagingType")}
          optional
          optionalLabel={t("optionNone")}
          placeholder={t("selectPackagingType")}
          options={options.packagingTypes}
          defaultValue={record?.packagingTypeId}
          emptyMessage={t("noPackagingTypes")}
          emptyHref="/admin/taxonomy"
          emptyCta={t("createOne")}
        />
        {/* The database pins both of these to a single legal value today, so
            they are presented as closed choices rather than free text. */}
        <AdminSelect
          name="currencyCode"
          label={t("currencyCode")}
          placeholder={t("currencyCode")}
          defaultValue={record?.currencyCode ?? "USD"}
          options={[{ id: "USD", label: "USD" }]}
        />
        <AdminSelect
          name="pricingUnit"
          label={t("pricingUnit")}
          placeholder={t("pricingUnit")}
          defaultValue={(record?.pricingUnit ?? "KG").toUpperCase()}
          options={[{ id: "KG", label: t("perKilogram") }]}
        />
        <AdminSelect
          name="status"
          label={t("status")}
          placeholder={t("selectStatus")}
          defaultValue={record?.status ?? "IN_STORE"}
          options={[
            { id: "ARRIVING_SOON", label: t("offerArrivingSoon") },
            { id: "NEW_ARRIVAL", label: t("offerNewArrival") },
            { id: "IN_STORE", label: t("offerInStore") },
            { id: "DISCOUNT", label: t("offerDiscount") },
            { id: "SOLD_OUT", label: t("offerSoldOut") },
            { id: "INACTIVE", label: t("offerInactive") },
          ]}
        />
        <AdminSelect
          name="isVisible"
          label={t("visibility")}
          placeholder={t("selectVisibility")}
          defaultValue={record ? String(record.isVisible) : "true"}
          options={[
            { id: "true", label: t("visible") },
            { id: "false", label: t("hidden") },
          ]}
        />
      </fieldset>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5">
        {/* Sensory notes and tags attach to the offer in this schema. */}
        <AdminCheckboxGroup
          name="sensoryNoteIds"
          label={t("sensoryNotes")}
          options={options.sensoryNotes}
          defaultValue={record?.sensoryNoteIds}
          emptyMessage={t("noSensoryNotes")}
        />
        <AdminCheckboxGroup
          name="offerTagIds"
          label={t("tags")}
          options={options.tags}
          defaultValue={record?.offerTagIds}
          emptyMessage={t("noTags")}
        />
      </div>
    </AdminForm>
  );
}

/** Protected volume pricing for one offer. */
export function PriceTierForm({
  options,
  defaultOfferId,
}: {
  options: CatalogFormOptions;
  defaultOfferId?: string;
}) {
  const t = useTranslations("admin.catalog");
  return (
    <AdminForm
      action={savePriceTierAction}
      submitLabel={t("save")}
      pendingLabel={t("saving")}
      className="mt-7 grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <AdminSelect
        name="offerId"
        label={t("offer")}
        placeholder={t("selectOffer")}
        options={options.offers}
        defaultValue={defaultOfferId}
        emptyMessage={t("noOffers")}
        emptyHref="/admin/offers/new"
        emptyCta={t("createOne")}
      />
      <AdminField name="minBags" label={t("minBags")} type="number" min="1" />
      {/* Named `price` to match the action's field-error key, so a rejected
          price renders its message under this exact input. */}
      <AdminField
        name="price"
        label={t("pricePerKg")}
        type="number"
        min="0"
        step="0.01"
      />
    </AdminForm>
  );
}
