/* Generated-contract equivalent for the approved Post-DB0 snapshot.
 * Refresh with `supabase gen types typescript --linked` when credentials are available.
 *
 * Last synced 2026-09-01 (task P1-T03) against the LIVE PostgREST schema, not
 * against the migration files. The Supabase CLI is still unavailable here (no
 * SUPABASE_ACCESS_TOKEN and no database password), so the Functions block below
 * was derived from the project's live OpenAPI document. Re-run the CLI command
 * above to replace this file wholesale once credentials exist. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type AppRole = "USER" | "ADMIN";
export type ContentLocale = "en" | "ar";
export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type OfferStatus =
  | "ARRIVING_SOON"
  | "NEW_ARRIVAL"
  | "IN_STORE"
  | "DISCOUNT"
  | "SOLD_OUT"
  | "INACTIVE";
export type InquiryType = "GENERAL" | "PRODUCT" | "SAMPLE_REQUEST";
export type InquiryStatus = "NEW" | "RECEIVED" | "CONTACTED" | "CLOSED";

type Table<Row> = {
  Row: Row & Record<string, unknown>;
  Insert: Partial<Row> & Record<string, unknown>;
  Update: Partial<Row> & Record<string, unknown>;
  Relationships: [];
};
type Stamp = { created_at: string; updated_at: string };
type TranslationStamp = Stamp & { locale: ContentLocale };

export interface Profile extends Stamp {
  id: string;
  full_name: string;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  country_code: string | null;
  role: AppRole;
  /* Live columns that were missing from this contract before P1-T03.
   * The four block fields are writable only by admin_set_user_blocked();
   * protect_profile_block_fields() rejects every direct write to them. */
  avatar_path: string | null;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_by: string | null;
  block_reason: string | null;
}
export interface Coffee extends Stamp {
  id: string;
  slug: string;
  coffee_type_id: string;
  origin_id: string;
  region_id: string | null;
  processing_method_id: string | null;
  status: ContentStatus;
  grade: string | null;
  altitude_min_meters: number | null;
  altitude_max_meters: number | null;
  farm_size_hectares: number | null;
  harvest_months: number[] | null;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  is_featured: boolean;
  featured_sort_order: number;
}
export interface CoffeeTranslation extends TranslationStamp {
  coffee_id: string;
  name: string;
  short_description: string | null;
  farm_coop_station: string | null;
  owner_producer: string | null;
  subregion_town: string | null;
  about_this_coffee: string | null;
  cultivation: string | null;
  harvest_post_harvest: string | null;
  processing_story: string | null;
  origin_story: string | null;
  sustainability: string | null;
  traceability: string | null;
  seo_title: string | null;
  seo_description: string | null;
}
export interface CoffeeOffer extends Stamp {
  id: string;
  coffee_id: string;
  warehouse_id: string;
  reference_number: string;
  bags_quantity: number;
  bag_weight_kg: number;
  packaging_type_id: string | null;
  status: OfferStatus;
  cup_score: number | null;
  currency: string;
  pricing_unit: string;
  available_from: string | null;
  is_visible: boolean;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}
export interface PriceTier extends Stamp {
  id: string;
  offer_id: string;
  min_bags: number;
  price_per_kg_usd: number;
}
export interface Warehouse extends Stamp {
  id: string;
  code: "EGYPT" | "DUBAI";
  name: string;
  city: string | null;
  country_code: string;
  address: string | null;
  service_region: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}
export interface WarehouseTranslation extends TranslationStamp {
  warehouse_id: string;
  name: string;
  city: string | null;
  address: string | null;
  service_region: string | null;
}
export interface Origin extends Stamp {
  id: string;
  slug: string;
  country_code: string | null;
  continent: string | null;
  harvest_months: number[] | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  is_featured: boolean;
  featured_sort_order: number;
}
export interface OriginTranslation extends TranslationStamp {
  origin_id: string;
  name: string;
  summary: string | null;
  coffee_history: string | null;
  cultivation_processing: string | null;
  sourcing_story: string | null;
  sustainability: string | null;
  seo_title: string | null;
  seo_description: string | null;
}
export interface NamedEntity extends Stamp {
  id: string;
  slug: string;
  name?: string;
  is_active: boolean;
}
export interface NamedTranslation extends TranslationStamp {
  name: string;
  description?: string | null;
}
export interface Media extends Stamp {
  id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  is_public: boolean;
  uploaded_by: string | null;
  deleted_at: string | null;
}
export interface MediaTranslation extends TranslationStamp {
  media_id: string;
  alt_text: string | null;
  caption: string | null;
}
export interface SitePage extends Stamp {
  id: string;
  page_key: string;
  template: string;
  route_path: string | null;
  status: ContentStatus;
  published_at: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}
export interface SitePageTranslation extends TranslationStamp {
  page_id: string;
  title: string;
  h1: string | null;
  summary: string | null;
  body_markdown: string | null;
  seo_title: string | null;
  seo_description: string | null;
  cta_label: string | null;
}
export interface SiteSection extends Stamp {
  id: string;
  page_id: string;
  section_key: string;
  section_type: string;
  sort_order: number;
  is_visible: boolean;
  media_id: string | null;
  cta_href: string | null;
  entity_ref: string | null;
  entity_limit: number | null;
}
export interface SiteSectionTranslation extends TranslationStamp {
  section_id: string;
  heading: string | null;
  subheading: string | null;
  body_markdown: string | null;
  cta_label: string | null;
}
export interface SiteSettings {
  id: string;
  org_legal_name: string | null;
  org_brand_name: string | null;
  org_email: string | null;
  org_phone: string | null;
  org_logo_media_id: string | null;
  org_default_og_media_id: string | null;
  org_same_as: string[] | null;
  default_seo_title_template: string | null;
  default_seo_description: string | null;
  low_stock_threshold: number;
  updated_by: string | null;
  updated_at: string;
}
export interface SiteSettingsTranslation extends TranslationStamp {
  settings_id: string;
  org_display_name: string | null;
  org_tagline: string | null;
  org_address: string | null;
  default_seo_title: string | null;
  default_seo_description: string | null;
  global_cta_label: string | null;
}
export interface Inquiry extends Stamp {
  id: string;
  inquiry_number: number;
  request_code: string;
  type: InquiryType;
  user_id: string | null;
  coffee_id: string | null;
  offer_id: string | null;
  coffee_name_snapshot: string | null;
  offer_reference_snapshot: string | null;
  warehouse_code_snapshot: string | null;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string;
  address: string | null;
  country_code: string | null;
  subject: string | null;
  message: string | null;
  status: InquiryStatus;
}
export interface InquiryHistory {
  id: string;
  inquiry_id: string;
  old_status: InquiryStatus | null;
  new_status: InquiryStatus;
  changed_by: string | null;
  created_at: string;
}
export interface Article extends Stamp {
  id: string;
  category_id: string | null;
  featured_media_id: string | null;
  status: ContentStatus;
  is_featured: boolean;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}
export interface ArticleTranslation extends TranslationStamp {
  article_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_markdown: string | null;
  seo_title: string | null;
  seo_description: string | null;
}
export interface AuditLog {
  id: number;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_data: Json | null;
  new_data: Json | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>;
      coffees: Table<Coffee>;
      coffee_translations: Table<CoffeeTranslation>;
      coffee_offers: Table<CoffeeOffer>;
      offer_price_tiers: Table<PriceTier>;
      warehouses: Table<Warehouse>;
      warehouse_translations: Table<WarehouseTranslation>;
      origins: Table<Origin>;
      origin_translations: Table<OriginTranslation>;
      coffee_types: Table<NamedEntity>;
      coffee_type_translations: Table<
        NamedTranslation & { coffee_type_id: string }
      >;
      processing_methods: Table<NamedEntity>;
      processing_method_translations: Table<
        NamedTranslation & { processing_method_id: string }
      >;
      packaging_types: Table<NamedEntity>;
      packaging_type_translations: Table<
        NamedTranslation & { packaging_type_id: string }
      >;
      sensory_notes: Table<NamedEntity>;
      sensory_note_translations: Table<
        NamedTranslation & { sensory_note_id: string }
      >;
      tags: Table<NamedEntity>;
      tag_translations: Table<NamedTranslation & { tag_id: string }>;
      certifications: Table<NamedEntity>;
      certification_translations: Table<
        NamedTranslation & { certification_id: string }
      >;
      varieties: Table<NamedEntity>;
      regions: Table<
        NamedEntity & { origin_id: string; deleted_at: string | null }
      >;
      region_translations: Table<NamedTranslation & { region_id: string }>;
      offer_sensory_notes: Table<{ offer_id: string; sensory_note_id: string }>;
      offer_tags: Table<{ offer_id: string; tag_id: string }>;
      coffee_tags: Table<{ coffee_id: string; tag_id: string }>;
      coffee_certifications: Table<{
        coffee_id: string;
        certification_id: string;
      }>;
      coffee_varieties: Table<{ coffee_id: string; variety_id: string }>;
      media: Table<Media>;
      media_translations: Table<MediaTranslation>;
      coffee_media: Table<{
        coffee_id: string;
        media_id: string;
        role: string;
        sort_order: number;
      }>;
      origin_media: Table<{
        origin_id: string;
        media_id: string;
        role: string;
        sort_order: number;
      }>;
      favorites: Table<{
        user_id: string;
        coffee_id: string;
        created_at: string;
      }>;
      inquiries: Table<Inquiry>;
      inquiry_status_history: Table<InquiryHistory>;
      articles: Table<Article>;
      article_translations: Table<ArticleTranslation>;
      article_categories: Table<NamedEntity>;
      article_category_translations: Table<
        NamedTranslation & { category_id: string }
      >;
      site_pages: Table<SitePage>;
      site_page_translations: Table<SitePageTranslation>;
      site_page_sections: Table<SiteSection>;
      site_page_section_translations: Table<SiteSectionTranslation>;
      site_settings: Table<SiteSettings>;
      site_settings_translations: Table<SiteSettingsTranslation>;
      audit_logs: Table<AuditLog>;
    };
    Views: Record<string, never>;
    Functions: {
      /* P1-T03: synced 2026-09-01 with the applied P1-T02 extension.
       * Every parameter is optional, so an existing no-argument call still
       * returns page 1 at 25 rows. `page_size` is clamped to 100 server-side. */
      admin_list_users: {
        Args: {
          email_query?: string | null;
          name_query?: string | null;
          blocked_filter?: boolean | null;
          page?: number | null;
          page_size?: number | null;
        };
        Returns: {
          id: string;
          full_name: string;
          phone: string | null;
          company_name: string | null;
          email: string;
          email_verified: boolean;
          registered_at: string;
          favorites_count: number;
          inquiries_count: number;
          is_blocked: boolean;
          blocked_at: string | null;
          block_reason: string | null;
          avatar_path: string | null;
          total_count: number;
        }[];
      };
      admin_set_user_blocked: {
        Args: {
          target_user_id: string;
          blocked: boolean;
          reason?: string | null;
        };
        Returns: undefined;
      };
      hills_is_admin: { Args: Record<string, never>; Returns: boolean };
      hills_is_blocked: { Args: Record<string, never>; Returns: boolean };
      hills_is_verified_user: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_email_verified: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      content_locale: ContentLocale;
      coffee_status: ContentStatus;
      article_status: ContentStatus;
      offer_status: OfferStatus;
      inquiry_type: InquiryType;
      inquiry_status: InquiryStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
