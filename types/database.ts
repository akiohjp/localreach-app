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
 * Channel the guest is asked for on the result screen.
 *
 * 'whatsapp' is the UAE default. 'sms' exists because WhatsApp is not the
 * messaging app in every market — Japan uses LINE, which cannot be collected
 * from a phone number (no public add-a-friend API), so a JP store takes a plain
 * mobile number and the owner follows up by SMS/phone.
 */
export type ContactChannel = "whatsapp" | "sms";

/** Fallback dial code when a store predates the contact_dial_code column. */
export const DEFAULT_DIAL_CODE = "+971";

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

/** What each keyword NAMES: item | service | category | attribute | geo.
 *  Keys are the keyword strings. Absent keys fall back to engine inference,
 *  so this is additive for every store that predates it. */
export type KeywordTypes = Record<string, "item" | "service" | "category" | "attribute" | "geo">;

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
          /** keyword -> what it names; decides which sentence frames it may enter. */
          keyword_types?: KeywordTypes;
          brand_color: string;
          /** Object path `{owner_uuid}/{filename}` in `store-logos` bucket; legacy HTTPS URLs normalized by migration. */
          logo_url: string | null;
          business_category: string | null;
          is_active: boolean;
          /** Contract end (UTC). NULL = no expiry. Effective active = is_active AND not expired. */
          subscription_expires_at: string | null;
          /** Entity layer (AI visibility): branch area woven once into reviews, e.g. "Motor City". */
          entity_area?: string | null;
          /** Entity layer: city occasionally appended after the area, e.g. "Dubai". */
          entity_city?: string | null;
          /** Entity layer: per-locale natural business noun, e.g. {"en":"udon restaurant"}. */
          entity_category_label?: LocalizedText;
          /** Guest contact channel on the result screen: 'whatsapp' (UAE) or 'sms' (e.g. Japan). */
          contact_channel?: ContactChannel;
          /** E.164 prefix pre-filled in the guest number field, e.g. "+971", "+81". */
          contact_dial_code?: string;
          /** Review-reply generator defaults. NULL = built-in defaults. */
          reply_settings?: ReplySettings | null;
          /** Master-admin switch: guests get a Gemini-written draft (template engine stays the fallback). */
          ai_review_enabled?: boolean;
          /** Google Place ID for results reporting (rating/review-count snapshots). */
          google_place_id?: string | null;

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
          /** keyword -> what it names; decides which sentence frames it may enter. */
          keyword_types?: KeywordTypes;
          brand_color?: string;
          logo_url?: string | null;
          business_category?: string | null;
          is_active?: boolean;
          subscription_expires_at?: string | null;
          entity_area?: string | null;
          entity_city?: string | null;
          entity_category_label?: LocalizedText;
          reply_settings?: ReplySettings | null;
          /** Master-admin switch: guests get a Gemini-written draft (template engine stays the fallback). */
          ai_review_enabled?: boolean;

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
          /** keyword -> what it names; decides which sentence frames it may enter. */
          keyword_types?: KeywordTypes;
          brand_color?: string;
          logo_url?: string | null;
          business_category?: string | null;
          is_active?: boolean;
          subscription_expires_at?: string | null;
          entity_area?: string | null;
          entity_city?: string | null;
          entity_category_label?: LocalizedText;
          reply_settings?: ReplySettings | null;
          /** Master-admin switch: guests get a Gemini-written draft (template engine stays the fallback). */
          ai_review_enabled?: boolean;

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
          /** Countable reasons the guest tapped. Empty for a note left with a high rating. */
          topics: string[];
          contact_name: string | null;
          contact_phone: string | null;
          /** NULL = the owner has not opened it yet. Drives the unread badge. */
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          rating: number;
          message: string;
          topics?: string[];
          contact_name?: string | null;
          contact_phone?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          rating?: number;
          message?: string;
          topics?: string[];
          contact_name?: string | null;
          contact_phone?: string | null;
          read_at?: string | null;
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
      /**
       * Web Push endpoints for a store's feedback notifications. Service-role
       * only — RLS is on with no anon/authenticated policy, because a row here
       * says "send this store's guest comments to this device".
       */
      push_subscriptions: {
        Row: {
          id: string;
          store_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_sent_at: string | null;
          /** Set when the push service reports the endpoint is gone (404/410). */
          expired_at: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_sent_at?: string | null;
          expired_at?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          last_sent_at?: string | null;
          expired_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Daily snapshots of a store's public Google rating + review count. */
      review_stats: {
        Row: {
          id: number;
          store_id: string;
          captured_on: string;
          rating: number | null;
          review_count: number;
          created_at: string;
        };
        Insert: {
          store_id: string;
          captured_on: string;
          rating?: number | null;
          review_count: number;
          created_at?: string;
        };
        Update: {
          store_id?: string;
          captured_on?: string;
          rating?: number | null;
          review_count?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_stats_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * Every AI draft attempt from /api/generate-review: the draft the guest
       * received, or why the route fell back to the template engine.
       * Service-role writes; owners read their own store's rows.
       * Backed by migration 20260906120000_ai_review_drafts.sql.
       */
      ai_review_drafts: {
        Row: {
          id: number;
          store_id: string;
          outcome: "ai" | "fallback";
          model: string | null;
          locale: string;
          rating: number;
          keywords: string[];
          guest_note: string | null;
          draft: string | null;
          reason: string | null;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          store_id: string;
          outcome: "ai" | "fallback";
          model?: string | null;
          locale: string;
          rating: number;
          keywords?: string[];
          guest_note?: string | null;
          draft?: string | null;
          reason?: string | null;
          latency_ms?: number | null;
          created_at?: string;
        };
        Update: {
          store_id?: string;
          outcome?: "ai" | "fallback";
          model?: string | null;
          locale?: string;
          rating?: number;
          keywords?: string[];
          guest_note?: string | null;
          draft?: string | null;
          reason?: string | null;
          latency_ms?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_review_drafts_store_id_fkey";
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
          keyword_types: KeywordTypes;
          google_review_url: string;
          brand_color: string;
          default_language: SupportedLocale;
          /** EFFECTIVE active: is_active AND subscription not expired (computed in the view). */
          is_active: boolean;
          logo_url: string | null;
          business_category: string | null;
          /** Entity layer (AI visibility): branch area, e.g. "Motor City". */
          entity_area: string | null;
          entity_city: string | null;
          entity_category_label: LocalizedText;
          /** Guest contact channel on the result screen: 'whatsapp' (UAE) or 'sms' (e.g. Japan). */
          contact_channel: ContactChannel;
          /** E.164 prefix pre-filled in the guest number field, e.g. "+971", "+81". */
          contact_dial_code: string;
          /** Whether the QR page should ask /api/generate-review for a Gemini draft first. */
          ai_review_enabled: boolean;
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

/** One daily snapshot of a store's public Google rating + review count. */
export type ReviewStat = {
  captured_on: string;
  rating: number | null;
  review_count: number;
};
export type StoreInsert = TablesInsert<"stores">;
export type StoreUpdate = TablesUpdate<"stores">;
export type Customer = Tables<"customers">;
export type CustomerInsert = TablesInsert<"customers">;

/** Fields editable from the client self-service portal. */
export type StoreBrandSettings = Pick<
  Store,
  "brand_color" | "logo_url" | "keywords" | "forced_keywords" | "keyword_types"
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
