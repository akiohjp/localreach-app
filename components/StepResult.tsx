"use client";
import { useState } from "react";
import { Copy, Globe, ExternalLink, RotateCcw, Check, RefreshCw } from "lucide-react";
import { isValidUuid } from "@/lib/is-valid-uuid";
import type { UiStrings } from "@/lib/ui-strings";
import type { SupportedLocale } from "@/types/database";

type ReviewLocaleOption = { code: SupportedLocale; label: string };

type Props = {
  t: UiStrings;
  reviewText: string;
  gbpReviewUrl: string;
  storeId: string;
  selectedKeywords: string[];
  /** Language the current review text is in (drives the picker + translate source). */
  reviewLocale: SupportedLocale;
  /** Languages the guest can switch the generated review between. */
  reviewLocaleOptions: ReviewLocaleOption[];
  /** Regenerate the review in `loc`; returns the new text. */
  onReviewLocaleChange: (loc: SupportedLocale) => string;
  onRetry: () => void;
  /** Fresh nonce + new wording; same merged keywords. For client demos. */
  onRegenerate?: () => string;
  /** Lift edited/regenerated text so reload-persistence keeps the latest wording. */
  onReviewTextChange?: (text: string) => void;
};

type WaState = "idle" | "saving" | "saved" | "error";

function buildTranslateUrl(text: string, sourceLocale: SupportedLocale) {
  // sl must match the review's actual language, or Google mis-detects (e.g. an
  // Arabic review sent as sl=en translates to gibberish).
  return `https://translate.google.com/?sl=${sourceLocale}&tl=auto&text=${encodeURIComponent(text)}`;
}

export default function StepResult({
  t,
  reviewText,
  gbpReviewUrl,
  storeId,
  selectedKeywords,
  reviewLocale,
  reviewLocaleOptions,
  onReviewLocaleChange,
  onRetry,
  onRegenerate,
  onReviewTextChange,
}: Props) {
  const [text, setText] = useState(reviewText);
  const [copied, setCopied] = useState(false);

  function handleLanguageChange(loc: SupportedLocale) {
    if (loc === reviewLocale) return;
    setCopied(false);
    const next = onReviewLocaleChange(loc);
    setText(next);
    onReviewTextChange?.(next);
  }

  // WhatsApp capture state
  const [customerName, setCustomerName] = useState("");
  const [countryCode, setCountryCode] = useState("+971");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [waState, setWaState] = useState<WaState>("idle");
  /** True when Save succeeded on a preview page (no DB write). */
  const [waSavedWasPreview, setWaSavedWasPreview] = useState(false);

  const canSaveWhatsApp = isValidUuid(storeId);

  async function copyToClipboard(value: string): Promise<boolean> {
    // clipboard.writeText can reject in iOS WebViews / non-secure contexts.
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  async function handleCopy() {
    const ok = await copyToClipboard(text);
    if (!ok) return; // leave the textarea for manual select rather than a false toast
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handlePostOnGoogle() {
    // Fire-and-forget copy (can't throw), and keep window.open in the same user
    // gesture tick so the popup isn't blocked.
    void copyToClipboard(text);
    window.open(gbpReviewUrl, "_blank", "noopener,noreferrer");
  }

  function handleRegenerateWording() {
    if (!onRegenerate) return;
    setCopied(false);
    const next = onRegenerate();
    setText(next);
    onReviewTextChange?.(next);
  }

  async function handleWhatsAppSave() {
    const cc = countryCode.trim();
    // Drop a local trunk-zero (e.g. UAE "050…" typed after "+971") so the
    // number is stored in deliverable E.164 form, not "+9710…".
    const digits = phone.trim().replace(/^0+/, "");
    if (digits.length < 7 || cc.length < 2) return;

    if (!canSaveWhatsApp) {
      // Preview pages (non-UUID store) simulate the save without a DB write.
      setWaState("saving");
      await new Promise((r) => setTimeout(r, 450));
      setWaSavedWasPreview(true);
      setWaState("saved");
      return;
    }

    // Single validated write path — the server (service role) inserts the lead.
    setWaSavedWasPreview(false);
    setWaState("saving");
    try {
      const res = await fetch("/api/customer-leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          whatsapp_number: `${cc}${digits}`,
          opt_in: optIn,
          selected_keywords: selectedKeywords.length > 0 ? selectedKeywords : null,
          customer_name: customerName.trim() || null,
        }),
      });
      if (res.ok) {
        setWaState("saved");
        return;
      }
      console.error(
        "[WhatsApp save] API error",
        res.status,
        await res.text().catch(() => ""),
      );
      setWaState("error");
    } catch (err) {
      console.error("[WhatsApp save] network error", err);
      setWaState("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          {t.result.stepLabel}
        </p>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          {t.result.title}
        </h2>
        <p className="text-sm text-slate-600">{t.result.subtitle}</p>
      </div>

      {/* Review-language picker — the guest chooses which language the review is
          written in (English / العربية / 日本語), independent of the page UI. */}
      {reviewLocaleOptions.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
            {t.result.reviewLanguage}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {reviewLocaleOptions.map((opt) => {
              const active = opt.code === reviewLocale;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => handleLanguageChange(opt.code)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all active:scale-[0.98] ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-gray-300 hover:border-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onReviewTextChange?.(e.target.value);
          }}
          rows={6}
          aria-label={t.result.reviewAria}
          className="w-full p-4 text-base text-slate-800 leading-relaxed bg-gray-50
            border border-gray-300 rounded-xl resize-none
            focus:outline-none focus:border-slate-500 transition-colors"
        />
        <span className="absolute bottom-3 right-3 text-[10px] text-slate-400 select-none">
          {text.length}
        </span>
      </div>

      {/* WhatsApp — full UI on every page; preview simulates Save without DB */}
      {waState === "saved" ? (
        <div className="flex items-start gap-2.5 border border-green-200 bg-green-50 rounded-xl px-4 py-3">
          <Check size={13} className="text-green-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-green-800">
              {waSavedWasPreview ? t.result.savedPreview : t.result.savedLive}
            </p>
            {waSavedWasPreview && (
              <p className="text-[11px] text-green-800/85 leading-relaxed">
                {t.result.savedPreviewDetail}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
            {t.result.whatsappOptional}
          </p>

          {!canSaveWhatsApp && (
            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 leading-relaxed">
              {t.result.previewBanner}
            </p>
          )}

          {/* Name input (optional) */}
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t.result.namePlaceholder}
            aria-label={t.result.namePlaceholder}
            className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg bg-white
              focus:outline-none focus:border-slate-500 transition-colors placeholder:text-slate-400"
          />

          {/* Number input row — force LTR so the country code + digits keep phone
              order even when the page locale is RTL (Arabic). */}
          <div className="flex gap-2" dir="ltr">
            <input
              type="text"
              inputMode="tel"
              value={countryCode}
              aria-label={t.result.countryCodeAria}
              onChange={(e) => {
                setWaState("idle");
                const raw = e.target.value.replace(/[^\d+]/g, "");
                setCountryCode(raw.startsWith("+") ? raw : `+${raw.replace(/\+/g, "")}`);
              }}
              maxLength={5}
              className="w-16 px-2 py-2 text-base font-semibold text-center border border-gray-300
                rounded-lg bg-white text-slate-700 focus:outline-none focus:border-slate-500
                transition-colors shrink-0"
            />
            <input
              type="tel"
              value={phone}
              aria-label={t.result.phoneAria}
              onChange={(e) => {
                setWaState("idle");
                setPhone(e.target.value.replace(/\D/g, ""));
              }}
              placeholder={t.result.phonePlaceholder}
              maxLength={12}
              className="flex-1 min-w-0 px-3 py-2 text-base border border-gray-300 rounded-lg bg-white
                focus:outline-none focus:border-slate-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleWhatsAppSave}
              disabled={phone.trim().length < 7 || countryCode.trim().length < 2 || waState === "saving"}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg
                hover:bg-slate-800 active:scale-[0.98] transition-all
                disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {waState === "saving" ? "…" : t.result.save}
            </button>
          </div>

          {/* Opt-in checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(e) => setOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300
                accent-slate-900 cursor-pointer"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              {t.result.optIn}
            </span>
          </label>

          {waState === "error" && (
            <div className="space-y-1" role="alert">
              <p className="text-xs text-red-500">{t.result.saveError}</p>
            </div>
          )}
        </div>
      )}

      {/* Copied toast */}
      <div className={`transition-all duration-300 overflow-hidden ${copied ? "max-h-10 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="flex items-center justify-center gap-2 bg-slate-50 border border-gray-300
          rounded-xl py-2.5 text-xs font-semibold text-slate-700">
          <Check size={12} className="text-amber-500" />
          {t.result.copiedToast}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2.5">
        {onRegenerate && (
          <button
            type="button"
            onClick={handleRegenerateWording}
            className="w-full py-3 rounded-xl font-semibold text-sm border border-dashed border-slate-300 bg-slate-50/80
              text-slate-700 hover:bg-slate-100 hover:border-slate-400 active:scale-[0.98]
              transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={13} />
            {t.result.tryAnotherWording}
          </button>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 bg-white
            text-slate-700 hover:border-slate-500 hover:bg-gray-50 active:scale-[0.98]
            transition-all flex items-center justify-center gap-2"
        >
          <Copy size={13} />
          {t.result.copyReview}
        </button>

        <a
          href={buildTranslateUrl(text, reviewLocale)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 bg-white
            text-slate-700 hover:border-slate-500 hover:bg-gray-50 active:scale-[0.98]
            transition-all flex items-center justify-center gap-2 text-center block"
        >
          <Globe size={13} />
          {t.result.translate}
        </a>

        <button
          type="button"
          onClick={handlePostOnGoogle}
          className="bg-slate-900 text-white font-semibold rounded-xl shadow-md
            hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full py-3
            flex items-center justify-center gap-2"
        >
          <ExternalLink size={13} />
          {t.result.postOnGoogle}
        </button>
      </div>

      {/* How-to guide */}
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
        <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
          {t.result.howToTitle}
        </p>
        <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
          {t.result.howToSteps.map((stepText, i) => (
            <li key={i} className="font-medium text-slate-700">{stepText}</li>
          ))}
        </ol>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="flex items-center justify-center gap-1.5 text-xs text-slate-400
          hover:text-slate-600 transition-colors mx-auto"
      >
        <RotateCcw size={11} />
        {t.result.startOver}
      </button>
    </div>
  );
}
