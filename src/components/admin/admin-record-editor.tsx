"use client";

import { useTranslations } from "next-intl";
import {
  saveNamedEntityAction,
  saveOriginAction,
  saveRegionAction,
  saveVarietyAction,
  saveWarehouseAction,
} from "@/actions/admin-operations";
import {
  AdminField,
  AdminForm,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/admin-form";
import type { ActionFormState, ActionResult } from "@/lib/actions";
import type { AdminOption } from "@/lib/data/admin";

/**
 * Edit forms for the reference modules.
 *
 * The mirror of `admin-module-form.tsx`, and moved onto the same Phase 6 form
 * family for the same reasons: localized labels, an inline message under the
 * field that failed, no browser popup as the final word, and typed values that
 * survive a rejection.
 *
 * One field registry drives both the create and edit forms, so a field cannot
 * exist on one and be forgotten on the other.
 */

type EditorAction = (
  state: ActionFormState,
  formData: FormData,
) => Promise<ActionResult>;

type Field = {
  name: string;
  /** Key inside `admin.modules`. */
  label: string;
  hint?: string;
  kind?: "text" | "number" | "email" | "textarea" | "select";
  dir?: "ltr" | "rtl";
  options?: AdminOption[];
  placeholder?: string;
  emptyMessage?: string;
  emptyHref?: string;
  emptyCta?: string;
};

type Options = {
  coffees: AdminOption[];
  origins: AdminOption[];
  regions: AdminOption[];
  coffeeTypes: AdminOption[];
  processingMethods: AdminOption[];
  warehouses: AdminOption[];
  articleCategories: AdminOption[];
};

export function AdminRecordEditor({
  module,
  recordId,
  values,
  options,
}: {
  module: string;
  recordId: string;
  values: Record<string, unknown>;
  options: Options;
}) {
  const t = useTranslations("admin.modules");

  const stateField: Field = {
    name: "isActive",
    label: "state",
    kind: "select",
    placeholder: "chooseState",
    options: [
      { id: "true", label: t("stateActive") },
      { id: "false", label: t("stateInactive") },
    ],
  };

  const registry: Record<
    string,
    { action: EditorAction; fields: Field[]; hidden?: Record<string, string> }
  > = {
    origins: {
      action: saveOriginAction,
      fields: [
        { name: "slug", label: "slug", hint: "slugHint", dir: "ltr" },
        {
          name: "countryCode",
          label: "countryCode",
          hint: "countryCodeHint",
          dir: "ltr",
        },
        { name: "continent", label: "continent" },
        { name: "nameEn", label: "nameEn", dir: "ltr" },
        { name: "nameAr", label: "nameAr", dir: "rtl" },
        { name: "summaryEn", label: "summaryEn", kind: "textarea", dir: "ltr" },
        { name: "summaryAr", label: "summaryAr", kind: "textarea", dir: "rtl" },
        stateField,
      ],
    },
    regions: {
      action: saveRegionAction,
      fields: [
        {
          name: "originId",
          label: "origin",
          kind: "select",
          placeholder: "chooseOrigin",
          options: options.origins,
          emptyMessage: "noOrigins",
          emptyHref: "/admin/origins",
          emptyCta: "goToOrigins",
        },
        { name: "slug", label: "slug", hint: "slugHint", dir: "ltr" },
        { name: "nameEn", label: "nameEn", dir: "ltr" },
        { name: "nameAr", label: "nameAr", dir: "rtl" },
        {
          name: "descriptionEn",
          label: "descriptionEn",
          kind: "textarea",
          dir: "ltr",
        },
        {
          name: "descriptionAr",
          label: "descriptionAr",
          kind: "textarea",
          dir: "rtl",
        },
        stateField,
      ],
    },
    warehouses: {
      action: saveWarehouseAction,
      fields: [
        {
          name: "code",
          label: "warehouseCode",
          kind: "select",
          placeholder: "chooseWarehouseCode",
          options: [
            { id: "EGYPT", label: "EGYPT" },
            { id: "DUBAI", label: "DUBAI" },
          ],
        },
        { name: "name", label: "name", dir: "ltr" },
        { name: "nameAr", label: "nameAr", dir: "rtl" },
        {
          name: "countryCode",
          label: "countryCode",
          hint: "countryCodeHint",
          dir: "ltr",
        },
        { name: "city", label: "city" },
        { name: "address", label: "address" },
        { name: "email", label: "email", kind: "email", dir: "ltr" },
        { name: "phone", label: "phone", dir: "ltr" },
        stateField,
      ],
    },
    varieties: {
      action: saveVarietyAction,
      fields: [
        { name: "slug", label: "slug", hint: "slugHint", dir: "ltr" },
        { name: "name", label: "name", dir: "ltr" },
        stateField,
      ],
    },
    taxonomy: {
      action: saveNamedEntityAction,
      fields: [
        { name: "slug", label: "slug", hint: "slugHint", dir: "ltr" },
        { name: "nameEn", label: "nameEn", dir: "ltr" },
        { name: "nameAr", label: "nameAr", dir: "rtl" },
        {
          name: "descriptionEn",
          label: "descriptionEn",
          kind: "textarea",
          dir: "ltr",
        },
        {
          name: "descriptionAr",
          label: "descriptionAr",
          kind: "textarea",
          dir: "rtl",
        },
        stateField,
      ],
    },
    "article-categories": {
      action: saveNamedEntityAction,
      hidden: { entity: "article_categories" },
      fields: [
        { name: "slug", label: "slug", hint: "slugHint", dir: "ltr" },
        { name: "nameEn", label: "nameEn", dir: "ltr" },
        { name: "nameAr", label: "nameAr", dir: "rtl" },
        {
          name: "descriptionEn",
          label: "descriptionEn",
          kind: "textarea",
          dir: "ltr",
        },
        {
          name: "descriptionAr",
          label: "descriptionAr",
          kind: "textarea",
          dir: "rtl",
        },
        stateField,
      ],
    },
  };

  const editor = registry[module];
  if (!editor) return null;
  const label = (key: string) => t(key as Parameters<typeof t>[0]);
  const read = (name: string) => {
    const value = values[name];
    return value === null || value === undefined ? "" : String(value);
  };

  return (
    <AdminForm
      action={editor.action}
      submitLabel={t("saveChanges")}
      pendingLabel={t("saving")}
      className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-2 xl:grid-cols-3"
    >
      <input type="hidden" name="id" value={recordId} />
      {Object.entries(editor.hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {/* Taxonomy rows carry which of the seven tables they came from; the
          action needs it and the Admin cannot change it after creation. */}
      {module === "taxonomy" ? (
        <input type="hidden" name="entity" value={read("entity")} />
      ) : null}

      {editor.fields.map((field) => {
        if (field.kind === "select")
          return (
            <AdminSelect
              key={field.name}
              name={field.name}
              label={label(field.label)}
              placeholder={label(field.placeholder ?? "chooseState")}
              defaultValue={read(field.name) || null}
              options={field.options ?? []}
              emptyMessage={
                field.emptyMessage ? label(field.emptyMessage) : undefined
              }
              emptyHref={field.emptyHref}
              emptyCta={field.emptyCta ? label(field.emptyCta) : undefined}
            />
          );
        if (field.kind === "textarea")
          return (
            <AdminTextarea
              key={field.name}
              name={field.name}
              label={label(field.label)}
              hint={field.hint ? label(field.hint) : undefined}
              dir={field.dir}
              defaultValue={read(field.name)}
            />
          );
        return (
          <AdminField
            key={field.name}
            name={field.name}
            label={label(field.label)}
            hint={field.hint ? label(field.hint) : undefined}
            type={field.kind === "email" ? "email" : (field.kind ?? "text")}
            dir={field.dir}
            defaultValue={read(field.name)}
          />
        );
      })}
    </AdminForm>
  );
}
