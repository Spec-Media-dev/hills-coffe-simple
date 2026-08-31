import {
  saveArticleAction,
  saveCoffeeAction,
  saveNamedEntityAction,
  saveOfferAction,
  saveOriginAction,
  saveRegionAction,
  saveVarietyAction,
  saveWarehouseAction,
  updateSiteSettingsAction,
  uploadMediaAction,
} from "@/actions/admin-operations";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import type { AdminOption } from "@/lib/data/admin";

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

const field =
  "h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const textarea = `${field} min-h-24 py-3`;
const grid =
  "mt-7 grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 xl:grid-cols-3";

function Input({
  name,
  label,
  required,
  type = "text",
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number | null;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold">
      {label}
      <input
        name={name}
        required={required}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className={field}
      />
    </label>
  );
}

function Textarea({ name, label }: { name: string; label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold">
      {label}
      <textarea name={name} className={textarea} />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  required,
  empty = "None",
}: {
  name: string;
  label: string;
  options: AdminOption[];
  required?: boolean;
  empty?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold">
      {label}
      <select name={name} required={required} className={field} defaultValue="">
        <option value="">{empty}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const booleanOptions = [
  { id: "true", label: "Active / visible" },
  { id: "false", label: "Inactive / hidden" },
];

export function AdminModuleForm({
  module,
  options,
  settings,
}: {
  module: string;
  options: Options;
  settings: SettingsData;
}) {
  if (module === "products")
    return (
      <AdminActionForm
        action={saveCoffeeAction}
        submitLabel="Create coffee"
        className={grid}
      >
        <Input name="slug" label="Slug" required placeholder="ethiopia-guji" />
        <Select
          name="coffeeTypeId"
          label="Coffee type"
          options={options.coffeeTypes}
          required
        />
        <Select
          name="originId"
          label="Origin"
          options={options.origins}
          required
        />
        <Select name="regionId" label="Region" options={options.regions} />
        <Select
          name="processingMethodId"
          label="Processing method"
          options={options.processingMethods}
        />
        <Input name="grade" label="Grade" />
        <Select
          name="status"
          label="Status"
          required
          options={["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => ({
            id: value,
            label: value,
          }))}
          empty="Choose status"
        />
        <Input name="nameEn" label="English name" required />
        <Input name="nameAr" label="Arabic name" required />
        <Textarea name="descriptionEn" label="English short description" />
        <Textarea name="descriptionAr" label="Arabic short description" />
      </AdminActionForm>
    );
  if (module === "offers")
    return (
      <AdminActionForm
        action={saveOfferAction}
        submitLabel="Create offer"
        className={grid}
      >
        <Select
          name="coffeeId"
          label="Coffee"
          options={options.coffees}
          required
        />
        <Select
          name="warehouseId"
          label="Warehouse"
          options={options.warehouses}
          required
        />
        <Input name="referenceNumber" label="Reference number" required />
        <Input
          name="bagsQuantity"
          label="Bags available"
          type="number"
          required
          defaultValue={0}
        />
        <Input
          name="bagWeightKg"
          label="Bag weight (kg)"
          type="number"
          required
          defaultValue={60}
        />
        <Select
          name="status"
          label="Status"
          required
          options={[
            "ARRIVING_SOON",
            "NEW_ARRIVAL",
            "IN_STORE",
            "DISCOUNT",
            "SOLD_OUT",
            "INACTIVE",
          ].map((value) => ({ id: value, label: value }))}
          empty="Choose status"
        />
        <Input name="currency" label="Currency" required defaultValue="USD" />
        <Input
          name="pricingUnit"
          label="Pricing unit"
          required
          defaultValue="KG"
        />
        <Select
          name="isVisible"
          label="Visibility"
          options={booleanOptions}
          required
          empty="Choose visibility"
        />
      </AdminActionForm>
    );
  if (module === "origins")
    return (
      <AdminActionForm
        action={saveOriginAction}
        submitLabel="Create origin"
        className={grid}
      >
        <Input name="slug" label="Slug" required />
        <Input
          name="countryCode"
          label="ISO country code"
          required
          placeholder="ET"
        />
        <Input name="continent" label="Continent" />
        <Input name="nameEn" label="English name" required />
        <Input name="nameAr" label="Arabic name" required />
        <Textarea name="summaryEn" label="English summary" />
        <Textarea name="summaryAr" label="Arabic summary" />
        <Select
          name="isActive"
          label="State"
          options={booleanOptions}
          required
          empty="Choose state"
        />
      </AdminActionForm>
    );
  if (module === "regions")
    return (
      <AdminActionForm
        action={saveRegionAction}
        submitLabel="Create region"
        className={grid}
      >
        <Select
          name="originId"
          label="Origin"
          options={options.origins}
          required
        />
        <Input name="slug" label="Slug" required />
        <Input name="nameEn" label="English name" required />
        <Input name="nameAr" label="Arabic name" required />
        <Textarea name="descriptionEn" label="English description" />
        <Textarea name="descriptionAr" label="Arabic description" />
        <Select
          name="isActive"
          label="State"
          options={booleanOptions}
          required
          empty="Choose state"
        />
      </AdminActionForm>
    );
  if (module === "warehouses")
    return (
      <AdminActionForm
        action={saveWarehouseAction}
        submitLabel="Create warehouse"
        className={grid}
      >
        <Select
          name="code"
          label="Warehouse code"
          required
          options={[
            { id: "EGYPT", label: "EGYPT" },
            { id: "DUBAI", label: "DUBAI" },
          ]}
          empty="Choose code"
        />
        <Input name="name" label="English name" required />
        <Input name="nameAr" label="Arabic name" required />
        <Input name="countryCode" label="ISO country code" required />
        <Input name="city" label="City" />
        <Input name="address" label="Address" />
        <Input name="email" label="Email" type="email" />
        <Input name="phone" label="Phone" type="tel" />
        <Select
          name="isActive"
          label="State"
          options={booleanOptions}
          required
          empty="Choose state"
        />
      </AdminActionForm>
    );
  if (module === "taxonomy" || module === "article-categories")
    return (
      <AdminActionForm
        action={saveNamedEntityAction}
        submitLabel="Create term"
        className={grid}
      >
        {module === "taxonomy" ? (
          <Select
            name="entity"
            label="Taxonomy"
            required
            empty="Choose taxonomy"
            options={[
              "coffee_types",
              "processing_methods",
              "packaging_types",
              "sensory_notes",
              "certifications",
              "tags",
            ].map((value) => ({
              id: value,
              label: value.replaceAll("_", " "),
            }))}
          />
        ) : (
          <input type="hidden" name="entity" value="article_categories" />
        )}
        <Input name="slug" label="Slug" required />
        <Input name="nameEn" label="English name" required />
        <Input name="nameAr" label="Arabic name" required />
        <Textarea name="descriptionEn" label="English description" />
        <Textarea name="descriptionAr" label="Arabic description" />
        <Select
          name="isActive"
          label="State"
          options={booleanOptions}
          required
          empty="Choose state"
        />
      </AdminActionForm>
    );
  if (module === "varieties")
    return (
      <AdminActionForm
        action={saveVarietyAction}
        submitLabel="Create variety"
        className={grid}
      >
        <Input name="slug" label="Slug" required />
        <Input name="name" label="Name" required />
        <Select
          name="isActive"
          label="State"
          options={booleanOptions}
          required
          empty="Choose state"
        />
      </AdminActionForm>
    );
  if (module === "articles")
    return (
      <AdminActionForm
        action={saveArticleAction}
        submitLabel="Create article"
        className={grid}
      >
        <Select
          name="categoryId"
          label="Category"
          options={options.articleCategories}
        />
        <Select
          name="status"
          label="Status"
          required
          options={["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => ({
            id: value,
            label: value,
          }))}
          empty="Choose status"
        />
        <Input name="slugEn" label="English slug" required />
        <Input name="slugAr" label="Arabic slug" required />
        <Input name="titleEn" label="English title" required />
        <Input name="titleAr" label="Arabic title" required />
        <Textarea name="excerptEn" label="English excerpt" />
        <Textarea name="excerptAr" label="Arabic excerpt" />
        <Textarea name="bodyEn" label="English Markdown" />
        <Textarea name="bodyAr" label="Arabic Markdown" />
      </AdminActionForm>
    );
  if (module === "media")
    return (
      <AdminActionForm
        action={uploadMediaAction}
        submitLabel="Upload media"
        encType="multipart/form-data"
        className={grid}
      >
        <label className="grid gap-1.5 text-sm font-bold">
          Image (JPEG, PNG, WebP, AVIF; maximum 10 MB)
          <input
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/avif"
            className={`${field} py-2`}
          />
        </label>
        <Input name="altEn" label="English alt text" required />
        <Input name="altAr" label="Arabic alt text" required />
      </AdminActionForm>
    );
  if (module === "settings" && settings) {
    const en = settings.translations.find((row) => row.locale === "en") ?? {};
    const ar = settings.translations.find((row) => row.locale === "ar") ?? {};
    return (
      <AdminActionForm
        action={updateSiteSettingsAction}
        submitLabel="Save settings"
        className={grid}
      >
        <input type="hidden" name="id" value={String(settings.settings.id)} />
        <Input
          name="brandName"
          label="Brand name"
          defaultValue={String(settings.settings.org_brand_name ?? "")}
        />
        <Input
          name="legalName"
          label="Legal name"
          defaultValue={String(settings.settings.org_legal_name ?? "")}
        />
        <Input
          name="email"
          label="Organisation email"
          type="email"
          defaultValue={String(settings.settings.org_email ?? "")}
        />
        <Input
          name="phone"
          label="Organisation phone"
          defaultValue={String(settings.settings.org_phone ?? "")}
        />
        <Input
          name="lowStockThreshold"
          label="Low-stock threshold"
          type="number"
          required
          defaultValue={Number(settings.settings.low_stock_threshold ?? 20)}
        />
        <Input
          name="displayNameEn"
          label="English display name"
          defaultValue={String(en.org_display_name ?? "")}
        />
        <Input
          name="displayNameAr"
          label="Arabic display name"
          defaultValue={String(ar.org_display_name ?? "")}
        />
        <Input
          name="taglineEn"
          label="English tagline"
          defaultValue={String(en.org_tagline ?? "")}
        />
        <Input
          name="taglineAr"
          label="Arabic tagline"
          defaultValue={String(ar.org_tagline ?? "")}
        />
        <Input
          name="addressEn"
          label="English address"
          defaultValue={String(en.org_address ?? "")}
        />
        <Input
          name="addressAr"
          label="Arabic address"
          defaultValue={String(ar.org_address ?? "")}
        />
      </AdminActionForm>
    );
  }
  return null;
}
