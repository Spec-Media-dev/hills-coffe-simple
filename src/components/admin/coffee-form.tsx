"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveCoffeeAction } from "@/actions/admin-catalog";
import {
  AdminCheckboxGroup,
  AdminField,
  AdminForm,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-form";
import type {
  AdminCoffeeRecord,
  CatalogFormOptions,
} from "@/lib/data/admin-catalog";

/**
 * Create/edit form for a coffee.
 *
 * The origin → region dependency is real, not cosmetic: the region list is
 * narrowed to the selected origin, and changing the origin clears a region
 * that no longer belongs to it rather than silently submitting a mismatched
 * pair. The server re-checks the same relationship, because a form post can
 * carry any id it likes.
 */
export function CoffeeForm({
  options,
  record,
}: {
  options: CatalogFormOptions;
  record?: AdminCoffeeRecord;
}) {
  const t = useTranslations("admin.catalog");
  const [originId, setOriginId] = useState(record?.originId ?? "");
  const [regionId, setRegionId] = useState(record?.regionId ?? "");
  const [isFeatured, setIsFeatured] = useState(
    record?.isFeatured ? "true" : "false",
  );

  const regionsForOrigin = options.regions.filter(
    (region) => region.originId === originId,
  );

  const sectionClass =
    "grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 xl:grid-cols-3";

  return (
    <AdminForm
      action={saveCoffeeAction}
      submitLabel={t("save")}
      pendingLabel={t("saving")}
      className="mt-7 grid gap-6"
    >
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <fieldset className={sectionClass}>
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("identity")}
        </legend>
        <AdminField
          name="slug"
          label={t("slug")}
          hint={t("slugHint")}
          dir="ltr"
          defaultValue={record?.slug}
        />
        <AdminSelect
          name="status"
          label={t("status")}
          placeholder={t("selectStatus")}
          defaultValue={record?.status ?? "DRAFT"}
          options={[
            { id: "DRAFT", label: t("statusDraft") },
            { id: "PUBLISHED", label: t("statusPublished") },
            { id: "ARCHIVED", label: t("statusArchived") },
          ]}
        />
        <AdminField
          name="grade"
          label={t("grade")}
          defaultValue={record?.grade}
        />
      </fieldset>

      {/*
       * `is_featured` and `featured_sort_order` already existed on `coffees`
       * and already drove the home page's Current highlights band; the only
       * thing missing was a way to set them outside the Supabase table editor.
       */}
      <fieldset className={sectionClass}>
        <legend className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {t("featured")}
        </legend>
        <p className="text-xs leading-5 text-muted-foreground md:col-span-2 xl:col-span-3">
          {t("featuredHint")}
        </p>
        <AdminSelect
          name="isFeatured"
          label={t("featured")}
          placeholder={t("selectFeatured")}
          value={isFeatured}
          onValueChange={setIsFeatured}
          options={[
            { id: "true", label: t("optionYes") },
            { id: "false", label: t("optionNo") },
          ]}
        />
        {/*
         * De-emphasised rather than `disabled` when not featured: a disabled
         * input is omitted from the form post, so unfeaturing a coffee would
         * silently reset its stored order to the column default. The value
         * stays submittable and simply reads as inactive.
         */}
        <div
          className={
            isFeatured === "true" ? undefined : "opacity-55 transition-opacity"
          }
        >
          <AdminField
            name="featuredSortOrder"
            label={t("featuredOrder")}
            hint={t("featuredOrderHint")}
            type="number"
            min="0"
            step="1"
            dir="ltr"
            defaultValue={record?.featuredSortOrder ?? 0}
          />
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("classification")}
        </legend>
        <AdminSelect
          name="coffeeTypeId"
          label={t("coffeeType")}
          placeholder={t("selectCoffeeType")}
          options={options.coffeeTypes}
          defaultValue={record?.coffeeTypeId}
          emptyMessage={t("noCoffeeTypes")}
          emptyHref="/admin/taxonomy"
          emptyCta={t("createOne")}
        />
        <AdminSelect
          name="originId"
          label={t("origin")}
          placeholder={t("selectOrigin")}
          options={options.origins}
          value={originId}
          onValueChange={(next) => {
            setOriginId(next);
            // A region from the previous origin is now invalid, so it is
            // cleared rather than submitted as a mismatched pair.
            if (
              regionId &&
              !options.regions.some(
                (region) => region.id === regionId && region.originId === next,
              )
            )
              setRegionId("");
          }}
          emptyMessage={t("noOrigins")}
          emptyHref="/admin/origins"
          emptyCta={t("createOne")}
        />
        <AdminSelect
          name="regionId"
          label={t("region")}
          optional
          optionalLabel={originId ? t("optionNone") : t("selectOriginFirst")}
          placeholder={t("selectRegion")}
          options={regionsForOrigin}
          value={regionId}
          onValueChange={setRegionId}
          emptyMessage={originId ? t("noRegions") : t("selectOriginFirst")}
          emptyHref={originId ? "/admin/regions" : undefined}
          emptyCta={originId ? t("createOne") : undefined}
        />
        <AdminSelect
          name="processingMethodId"
          label={t("processingMethod")}
          optional
          optionalLabel={t("optionNone")}
          placeholder={t("selectProcessingMethod")}
          options={options.processingMethods}
          defaultValue={record?.processingMethodId}
          emptyMessage={t("noProcessingMethods")}
          emptyHref="/admin/taxonomy"
          emptyCta={t("createOne")}
        />
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("content")}
        </legend>
        <AdminField
          name="nameEn"
          label={t("nameEn")}
          dir="ltr"
          defaultValue={record?.nameEn}
        />
        <AdminField
          name="nameAr"
          label={t("nameAr")}
          dir="rtl"
          defaultValue={record?.nameAr}
        />
        <div className="xl:col-span-1" />
        <AdminTextarea
          name="descriptionEn"
          label={t("descriptionEn")}
          defaultValue={record?.descriptionEn}
        />
        <AdminTextarea
          name="descriptionAr"
          label={t("descriptionAr")}
          defaultValue={record?.descriptionAr}
        />
      </fieldset>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5">
        <AdminCheckboxGroup
          name="varietyIds"
          label={t("variety")}
          options={options.varieties}
          defaultValue={record?.varietyIds}
          emptyMessage={t("noVarieties")}
        />
        <AdminCheckboxGroup
          name="certificationIds"
          label={t("certifications")}
          options={options.certifications}
          defaultValue={record?.certificationIds}
          emptyMessage={t("noCertifications")}
        />
        <AdminCheckboxGroup
          name="tagIds"
          label={t("tags")}
          options={options.tags}
          defaultValue={record?.tagIds}
          emptyMessage={t("noTags")}
        />
      </div>
    </AdminForm>
  );
}
