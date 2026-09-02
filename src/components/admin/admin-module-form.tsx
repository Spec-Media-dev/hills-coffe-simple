"use client";

import { useTranslations } from "next-intl";
import {
  saveNamedEntityAction,
  saveOriginAction,
  saveRegionAction,
  saveVarietyAction,
  saveWarehouseAction,
  updateSiteSettingsAction,
} from "@/actions/admin-operations";
import {
  AdminField,
  AdminForm,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-form";
import type { AdminOption } from "@/lib/data/admin";

/**
 * Create forms for the reference modules — origins, regions, warehouses,
 * varieties, taxonomy, article categories and site settings.
 *
 * Phase 10 moved these off the legacy form. The previous version hardcoded 69
 * English strings, so the Arabic Admin read English labels on eight modules;
 * it used the browser's own `required` popups as the final validation UX; it
 * printed failures as a list of `fieldName: Zod message` at the bottom of the
 * form rather than under the input that failed; and because its inputs were
 * uncontrolled, a rejected submit wiped everything the Admin had typed
 * (findings N65, N66, N67).
 *
 * All of that is what the Phase 6 `AdminForm` family already solved for the
 * catalog. Using it here rather than a second system means one validation
 * behaviour across the whole Admin: `noValidate`, an inline message beneath
 * each field, values preserved on rejection, focus moved to the first real
 * failure, and every string resolved from the catalogue.
 *
 * The server actions are untouched: same schemas, same queries, same guards.
 */

type Options = {
  coffees: AdminOption[];
  origins: AdminOption[];
  regions: AdminOption[];
  coffeeTypes: AdminOption[];
  processingMethods: AdminOption[];
  warehouses: AdminOption[];
  articleCategories: AdminOption[];
  offers: AdminOption[];
};

type SettingsData = {
  settings: Record<string, unknown>;
  translations: Record<string, unknown>[];
} | null;

const GRID = "grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 xl:grid-cols-3";

/** The seven tables `saveNamedEntityAction` accepts, in one place. */
const TAXONOMIES = [
  "coffee_types",
  "processing_methods",
  "packaging_types",
  "sensory_notes",
  "certifications",
  "tags",
] as const;

export function AdminModuleForm({
  module,
  options,
  settings,
}: {
  module: string;
  options: Options;
  settings: SettingsData;
}) {
  const t = useTranslations("admin.modules");

  const stateOptions = [
    { id: "true", label: t("stateActive") },
    { id: "false", label: t("stateInactive") },
  ];
  const shared = {
    submitLabel: t("create"),
    pendingLabel: t("saving"),
    className: `mt-7 ${GRID}`,
  };

  if (module === "origins")
    return (
      <AdminForm action={saveOriginAction} {...shared}>
        <AdminField name="slug" label={t("slug")} hint={t("slugHint")} dir="ltr" />
        <AdminField
          name="countryCode"
          label={t("countryCode")}
          hint={t("countryCodeHint")}
          dir="ltr"
        />
        <AdminField name="continent" label={t("continent")} />
        <AdminField name="nameEn" label={t("nameEn")} dir="ltr" />
        <AdminField name="nameAr" label={t("nameAr")} dir="rtl" />
        <AdminTextarea name="summaryEn" label={t("summaryEn")} dir="ltr" />
        <AdminTextarea name="summaryAr" label={t("summaryAr")} dir="rtl" />
        <AdminSelect
          name="isActive"
          label={t("state")}
          placeholder={t("chooseState")}
          defaultValue="true"
          options={stateOptions}
        />
      </AdminForm>
    );

  if (module === "regions")
    return (
      <AdminForm action={saveRegionAction} {...shared}>
        {/* A region cannot exist without its origin, so an empty list says so
            and links to the page that fixes it rather than showing a select
            with nothing in it. */}
        <AdminSelect
          name="originId"
          label={t("origin")}
          placeholder={t("chooseOrigin")}
          options={options.origins}
          emptyMessage={t("noOrigins")}
          emptyHref="/admin/origins"
          emptyCta={t("goToOrigins")}
        />
        <AdminField name="slug" label={t("slug")} hint={t("slugHint")} dir="ltr" />
        <AdminField name="nameEn" label={t("nameEn")} dir="ltr" />
        <AdminField name="nameAr" label={t("nameAr")} dir="rtl" />
        <AdminTextarea
          name="descriptionEn"
          label={t("descriptionEn")}
          dir="ltr"
        />
        <AdminTextarea
          name="descriptionAr"
          label={t("descriptionAr")}
          dir="rtl"
        />
        <AdminSelect
          name="isActive"
          label={t("state")}
          placeholder={t("chooseState")}
          defaultValue="true"
          options={stateOptions}
        />
      </AdminForm>
    );

  if (module === "warehouses")
    return (
      <AdminForm action={saveWarehouseAction} {...shared}>
        {/* The code is a closed set in the database, so it is a select rather
            than free text that could only ever fail a check constraint. */}
        <AdminSelect
          name="code"
          label={t("warehouseCode")}
          placeholder={t("chooseWarehouseCode")}
          options={[
            { id: "EGYPT", label: "EGYPT" },
            { id: "DUBAI", label: "DUBAI" },
          ]}
        />
        <AdminField name="name" label={t("name")} dir="ltr" />
        <AdminField name="nameAr" label={t("nameAr")} dir="rtl" />
        <AdminField
          name="countryCode"
          label={t("countryCode")}
          hint={t("countryCodeHint")}
          dir="ltr"
        />
        <AdminField name="city" label={t("city")} />
        <AdminField name="address" label={t("address")} />
        <AdminField name="email" label={t("email")} type="email" dir="ltr" />
        <AdminField name="phone" label={t("phone")} dir="ltr" />
        <AdminSelect
          name="isActive"
          label={t("state")}
          placeholder={t("chooseState")}
          defaultValue="true"
          options={stateOptions}
        />
      </AdminForm>
    );

  if (module === "varieties")
    return (
      <AdminForm action={saveVarietyAction} {...shared}>
        <AdminField name="slug" label={t("slug")} hint={t("slugHint")} dir="ltr" />
        <AdminField name="name" label={t("name")} dir="ltr" />
        <AdminSelect
          name="isActive"
          label={t("state")}
          placeholder={t("chooseState")}
          defaultValue="true"
          options={stateOptions}
        />
      </AdminForm>
    );

  if (module === "taxonomy" || module === "article-categories") {
    // Article categories are one of the seven tables the same action serves;
    // on their own page the table is fixed rather than chosen.
    const isCategories = module === "article-categories";
    return (
      <AdminForm action={saveNamedEntityAction} {...shared}>
        {isCategories ? (
          <input type="hidden" name="entity" value="article_categories" />
        ) : (
          <AdminSelect
            name="entity"
            label={t("taxonomy")}
            placeholder={t("chooseTaxonomy")}
            options={TAXONOMIES.map((id) => ({
              id,
              label: t(id as Parameters<typeof t>[0]),
            }))}
          />
        )}
        <AdminField name="slug" label={t("slug")} hint={t("slugHint")} dir="ltr" />
        <AdminField name="nameEn" label={t("nameEn")} dir="ltr" />
        <AdminField name="nameAr" label={t("nameAr")} dir="rtl" />
        <AdminTextarea
          name="descriptionEn"
          label={t("descriptionEn")}
          dir="ltr"
        />
        <AdminTextarea
          name="descriptionAr"
          label={t("descriptionAr")}
          dir="rtl"
        />
        <AdminSelect
          name="isActive"
          label={t("state")}
          placeholder={t("chooseState")}
          defaultValue="true"
          options={stateOptions}
        />
      </AdminForm>
    );
  }

  if (module === "settings" && settings) {
    const row = settings.settings as Record<string, string | number | null>;
    const translation = (locale: string) =>
      (settings.translations.find((item) => item.locale === locale) ??
        {}) as Record<string, string | null>;
    const en = translation("en");
    const ar = translation("ar");
    return (
      <AdminForm
        action={updateSiteSettingsAction}
        submitLabel={t("save")}
        pendingLabel={t("saving")}
        className={`mt-7 ${GRID}`}
      >
        <input type="hidden" name="id" value={String(row.id ?? "")} />
        <AdminField
          name="brandName"
          label={t("brandName")}
          defaultValue={row.org_brand_name as string | null}
        />
        <AdminField
          name="legalName"
          label={t("legalName")}
          defaultValue={row.org_legal_name as string | null}
        />
        <AdminField
          name="email"
          label={t("orgEmail")}
          type="email"
          dir="ltr"
          defaultValue={row.org_email as string | null}
        />
        <AdminField
          name="phone"
          label={t("orgPhone")}
          dir="ltr"
          defaultValue={row.org_phone as string | null}
        />
        <AdminField
          name="lowStockThreshold"
          label={t("lowStockThreshold")}
          hint={t("lowStockHint")}
          type="number"
          min="0"
          defaultValue={row.low_stock_threshold as number | null}
        />
        <AdminField
          name="displayNameEn"
          label={t("displayNameEn")}
          dir="ltr"
          defaultValue={en.org_display_name}
        />
        <AdminField
          name="displayNameAr"
          label={t("displayNameAr")}
          dir="rtl"
          defaultValue={ar.org_display_name}
        />
        <AdminField
          name="taglineEn"
          label={t("taglineEn")}
          dir="ltr"
          defaultValue={en.org_tagline}
        />
        <AdminField
          name="taglineAr"
          label={t("taglineAr")}
          dir="rtl"
          defaultValue={ar.org_tagline}
        />
        <AdminField
          name="addressEn"
          label={t("addressEn")}
          dir="ltr"
          defaultValue={en.org_address}
        />
        <AdminField
          name="addressAr"
          label={t("addressAr")}
          dir="rtl"
          defaultValue={ar.org_address}
        />
      </AdminForm>
    );
  }

  return null;
}
