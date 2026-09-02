import {
  saveArticleAction,
  saveNamedEntityAction,
  saveOriginAction,
  saveRegionAction,
  saveVarietyAction,
  saveWarehouseAction,
} from "@/actions/admin-operations";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import type { AdminActionState } from "@/lib/admin/action-state";
import type { AdminOption } from "@/lib/data/admin";

type EditorAction = (
  state: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;
type Field = {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "email" | "tel" | "textarea" | "select";
  options?: AdminOption[];
  step?: string;
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

const statuses = (items: string[]) =>
  items.map((item) => ({ id: item, label: item }));
const activeOptions = [
  { id: "true", label: "Active / visible" },
  { id: "false", label: "Inactive / hidden" },
];

function definition(module: string, options: Options) {
  const definitions: Record<
    string,
    { action: EditorAction; fields: Field[]; hidden?: Record<string, string> }
  > = {
    origins: {
      action: saveOriginAction,
      fields: [
        { name: "slug", label: "Slug", required: true },
        { name: "countryCode", label: "ISO country code", required: true },
        { name: "continent", label: "Continent" },
        { name: "nameEn", label: "English name", required: true },
        { name: "nameAr", label: "Arabic name", required: true },
        { name: "summaryEn", label: "English summary", type: "textarea" },
        { name: "summaryAr", label: "Arabic summary", type: "textarea" },
        {
          name: "isActive",
          label: "State",
          type: "select",
          options: activeOptions,
          required: true,
        },
      ],
    },
    regions: {
      action: saveRegionAction,
      fields: [
        {
          name: "originId",
          label: "Origin",
          type: "select",
          options: options.origins,
          required: true,
        },
        { name: "slug", label: "Slug", required: true },
        { name: "nameEn", label: "English name", required: true },
        { name: "nameAr", label: "Arabic name", required: true },
        {
          name: "descriptionEn",
          label: "English description",
          type: "textarea",
        },
        {
          name: "descriptionAr",
          label: "Arabic description",
          type: "textarea",
        },
        {
          name: "isActive",
          label: "State",
          type: "select",
          options: activeOptions,
          required: true,
        },
      ],
    },
    warehouses: {
      action: saveWarehouseAction,
      fields: [
        {
          name: "code",
          label: "Code",
          type: "select",
          options: statuses(["EGYPT", "DUBAI"]),
          required: true,
        },
        { name: "name", label: "English name", required: true },
        { name: "nameAr", label: "Arabic name", required: true },
        { name: "countryCode", label: "ISO country code", required: true },
        { name: "city", label: "City" },
        { name: "address", label: "Address" },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Phone", type: "tel" },
        {
          name: "isActive",
          label: "State",
          type: "select",
          options: activeOptions,
          required: true,
        },
      ],
    },
    varieties: {
      action: saveVarietyAction,
      fields: [
        { name: "slug", label: "Slug", required: true },
        { name: "name", label: "Name", required: true },
        {
          name: "isActive",
          label: "State",
          type: "select",
          options: activeOptions,
          required: true,
        },
      ],
    },
    articles: {
      action: saveArticleAction,
      fields: [
        {
          name: "categoryId",
          label: "Category",
          type: "select",
          options: options.articleCategories,
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: statuses(["DRAFT", "PUBLISHED", "ARCHIVED"]),
          required: true,
        },
        { name: "slugEn", label: "English slug", required: true },
        { name: "slugAr", label: "Arabic slug", required: true },
        { name: "titleEn", label: "English title", required: true },
        { name: "titleAr", label: "Arabic title", required: true },
        { name: "excerptEn", label: "English excerpt", type: "textarea" },
        { name: "excerptAr", label: "Arabic excerpt", type: "textarea" },
        { name: "bodyEn", label: "English Markdown", type: "textarea" },
        { name: "bodyAr", label: "Arabic Markdown", type: "textarea" },
      ],
    },
    "article-categories": {
      action: saveNamedEntityAction,
      hidden: { entity: "article_categories" },
      fields: [
        { name: "slug", label: "Slug", required: true },
        { name: "nameEn", label: "English name", required: true },
        { name: "nameAr", label: "Arabic name", required: true },
        {
          name: "descriptionEn",
          label: "English description",
          type: "textarea",
        },
        {
          name: "descriptionAr",
          label: "Arabic description",
          type: "textarea",
        },
        {
          name: "isActive",
          label: "State",
          type: "select",
          options: activeOptions,
          required: true,
        },
      ],
    },
    taxonomy: {
      action: saveNamedEntityAction,
      fields: [
        { name: "slug", label: "Slug", required: true },
        { name: "nameEn", label: "English name", required: true },
        { name: "nameAr", label: "Arabic name", required: true },
        {
          name: "descriptionEn",
          label: "English description",
          type: "textarea",
        },
        {
          name: "descriptionAr",
          label: "Arabic description",
          type: "textarea",
        },
        {
          name: "isActive",
          label: "State",
          type: "select",
          options: activeOptions,
          required: true,
        },
      ],
    },
  };
  return definitions[module];
}

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
  const editor = definition(module, options);
  if (!editor) return null;
  return (
    <AdminActionForm
      action={editor.action}
      submitLabel="Save changes"
      className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-2 xl:grid-cols-3"
    >
      <input type="hidden" name="id" value={recordId} />
      {Object.entries(editor.hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {module === "taxonomy" ? (
        <input type="hidden" name="entity" value={String(values.entity)} />
      ) : null}
      {editor.fields.map((field) => {
        const value = String(values[field.name] ?? "");
        return (
          <label key={field.name} className="grid gap-1.5 text-sm font-bold">
            {field.label}
            {field.type === "textarea" ? (
              <textarea
                name={field.name}
                required={field.required}
                defaultValue={value}
                rows={field.name.startsWith("body") ? 10 : 4}
                className="rounded-lg border border-input bg-background p-3 text-sm font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            ) : field.type === "select" ? (
              <select
                name={field.name}
                required={field.required}
                defaultValue={value}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                {!field.required ? <option value="">None</option> : null}
                {field.options?.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.name}
                required={field.required}
                type={field.type ?? "text"}
                step={field.step}
                defaultValue={value}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            )}
          </label>
        );
      })}
    </AdminActionForm>
  );
}
