export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ----------------------------------------------------------------
// i18n primitives
// ----------------------------------------------------------------

/** ISO 639-1 codes supported by this application. */
export type SupportedLocale = "en" | "ja" | "ar";

/**
 * Shape of every JSONB multilingual field in the database.
 * At least one locale key should be present at runtime, but all are
 * optional so partial objects (e.g. during INSERT) are accepted.
 *
 * Example value stored in Postgres:
 *   { "en": "Sakura Sushi", "ja": "桜寿司", "ar": "ساكورا سوشي" }
 */
export type LocalizedText = Partial<Record<SupportedLocale, string>>;

/**
 * Owner defaults for the review-reply generator (stores.reply_settings JSONB).
 * All fields optional; NULL/missing = the generator's built-in defaults.
 */
export type ReplySettings = {
  tone?: "warm" | "professional";
  /** Real neighbourhood/area woven into replies for Local SEO (e.g. "Dubai Marina"). */
  locality?: string;
  weaveGeo?: boolean;
  /** Weave one forced GEO keyword per reply (AIO signal). Default true. */
  weaveKw?: boolean;
  /** Custom sign-off (verbatim; "{store}" is replaced with the store name). */
  signature?: string;
};

// ----------------------------------------------------------------
// Database schema
// ----------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          owner_id: string;

          // Multilingual JSONB fields
          store_name: LocalizedText;
          greeting_text: LocalizedText;
          description: LocalizedText;

          // ISO 639-1 primary language of the store.
          // Drives dir="rtl" for Arabic, font selection for Japanese, etc.
          default_language: SupportedLocale;

          // Language-neutral fields
          google_review_url: string;
          keywords: string[];
          /** Always woven into generated reviews (admin “forced” GEO terms). */
          forced_keywords?: string[];
          brand_color: string;
          /** Object path `{owner_uuid}/{filename}` in `store-logos` bucket; legacy HTTPS URLs normalized by migration. */
          logo_url: string | null;
          business_category: string | null;
          is_active: boolean;
          /** Contract end (UTC). NULL = no expiry. Effective active = is_active AND not expired. */
          subscription_expires_at: string | null;
          /** Review-reply generator defaults. NULL = built-in defaults. */
          reply_settings?: ReplySettings | null;

          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;

          store_name: LocalizedText;
          greeting_text?: LocalizedText;
          description?: LocalizedText;

          default_language?: SupportedLocale;

          google_review_url: string;
          keywords?: string[];
          forced_keywords?: string[];
          brand_color?: string;
          logo_url?: string | null;
          business_category?: string | null;
          is_active?: boolean;
          subscription_expires_at?: string | null;
          reply_settings?: ReplySettings | null;

          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;

          store_name?: LocalizedText;
          greeting_text?: LocalizedText;
          description?: LocalizedText;

          default_language?: SupportedLocale;

          google_review_url?: string;
          keywords?: string[];
          forced_keywords?: string[];
          brand_color?: string;
          logo_url?: string | null;
          business_category?: string | null;
          is_active?: boolean;
          subscription_expires_at?: string | null;
          reply_settings?: ReplySettings | null;

          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          store_id: string;
          whatsapp_number: string;
          opt_in: boolean;
          selected_keywords: string[] | null;
          customer_name?: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          whatsapp_number: string;
          opt_in?: boolean;
          selected_keywords?: string[] | null;
          customer_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          whatsapp_number?: string;
          opt_in?: boolean;
          selected_keywords?: string[] | null;
          customer_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback: {
        Row: {
          id: string;
          store_id: string;
          rating: number;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          rating: number;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          rating?: number;
          message?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      /**
       * Anon-safe projection of `stores` for the public QR review page.
       * Deliberately excludes owner_id, notification_email, description and
       * timestamps so the anon key cannot read cross-tenant PII.
       * Backed by migration 20260701120000_stores_public_review_view.sql.
       */
      public_store_review: {
        Row: {
          id: string;
          store_name: LocalizedText;
          greeting_text: LocalizedText;
          keywords: string[];
          forced_keywords: string[];
          google_review_url: string;
          brand_color: string;
          default_language: SupportedLocale;
          /** EFFECTIVE active: is_active AND subscription not expired (computed in the view). */
          is_active: boolean;
          logo_url: string | null;
          business_category: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      capture_store_customer_lead: {
        Args: {
          p_customer_name: string | null;
          p_opt_in: boolean;
          p_selected_keywords: string[] | null;
          p_store_id: string;
          p_whatsapp_number: string;
        };
        Returns: string;
      };
      bump_rate_limit: {
        Args: {
          p_key: string;
          p_window_seconds: number;
          p_max: number;
        };
        Returns: { allowed: boolean; retry_after_seconds: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// ----------------------------------------------------------------
// Convenience helpers
// ----------------------------------------------------------------

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Shorthand aliases
export type Store = Tables<"stores">;
export type StoreInsert = TablesInsert<"stores">;
export type StoreUpdate = TablesUpdate<"stores">;
export type Customer = Tables<"customers">;
export type CustomerInsert = TablesInsert<"customers">;

/** Fields editable from the client self-service portal. */
export type StoreBrandSettings = Pick<
  Store,
  "brand_color" | "logo_url" | "keywords" | "forced_keywords"
>;

// ----------------------------------------------------------------
// Runtime utility: resolve localized text with fallback chain
// ----------------------------------------------------------------

/**
 * Returns the best available string for the requested locale.
 * Falls back: requested → default_language → first available → "".
 *
 * @example
 *   getLocalizedText(store.store_name, "ar", store.default_language)
 *   // → "ساكورا سوشي" if available, else English, else whatever exists
 */
export function getLocalizedText(
  field: LocalizedText,
  locale: SupportedLocale,
  defaultLocale: SupportedLocale = "en"
): string {
  return (
    field[locale] ??
    field[defaultLocale] ??
    (Object.values(field).find((v) => v !== undefined) as string | undefined) ??
    ""
  );
}

/** Returns true when the locale is written right-to-left. */
export function isRtlLocale(locale: SupportedLocale): boolean {
  return locale === "ar";
}
