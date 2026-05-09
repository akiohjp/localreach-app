"use client";
import { useState } from "react";
import { Copy, Globe, ExternalLink, RotateCcw, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { isValidUuid } from "@/lib/is-valid-uuid";

type Props = {
  reviewText: string;
  gbpReviewUrl: string;
  storeId: string;
  selectedKeywords: string[];
  onRetry: () => void;
};

type WaState = "idle" | "saving" | "saved" | "error";

function buildTranslateUrl(text: string) {
  return `https://translate.google.com/?sl=en&tl=auto&text=${encodeURIComponent(text)}`;
}

export default function StepResult({
  reviewText,
  gbpReviewUrl,
  storeId,
  selectedKeywords,
  onRetry,
}: Props) {
  const [text, setText] = useState(reviewText);
  const [copied, setCopied] = useState(false);

  // WhatsApp capture state
  const [customerName, setCustomerName] = useState("");
  const [countryCode, setCountryCode] = useState("+971");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [waState, setWaState] = useState<WaState>("idle");
  /** True when Save succeeded on a preview page (no DB write). */
  const [waSavedWasPreview, setWaSavedWasPreview] = useState(false);

  const canSaveWhatsApp = isValidUuid(storeId);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handlePostOnGoogle() {
    navigator.clipboard.writeText(text);
    window.open(gbpReviewUrl, "_blank");
  }

  async function handleWhatsAppSave() {
    const digits = phone.trim();
    const cc = countryCode.trim();
    if (digits.length < 7 || cc.length < 2) return;

    if (!canSaveWhatsApp) {
      setWaState("saving");
      await new Promise((r) => setTimeout(r, 450));
      setWaSavedWasPreview(true);
      setWaState("saved");
      return;
    }

    setWaSavedWasPreview(false);
    setWaState("saving");
    const supabase = createClient();
    const { error } = await supabase.rpc("capture_store_customer_lead", {
      p_store_id: storeId,
      p_whatsapp_number: `${cc}${digits}`,
      p_opt_in: optIn,
      p_selected_keywords:
        selectedKeywords.length > 0 ? selectedKeywords : null,
      p_customer_name: customerName.trim() ? customerName.trim() : null,
    });
    if (error) {
      console.error("[WhatsApp save]", error.message, error);
    }
    setWaState(error ? "error" : "saved");
    if (!error) {
      fetch("/api/notify-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          customerName: customerName.trim() || null,
          reviewSnippet: text.trim().slice(0, 250) || null,
        }),
      }).catch(() => {});
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          Step 4 — Your Review
        </p>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Ready to post
        </h2>
        <p className="text-sm text-slate-600">Edit freely before submitting.</p>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full p-4 text-sm text-slate-800 leading-relaxed bg-gray-50
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
              {waSavedWasPreview
                ? "Thanks — this is how save looks on the live page."
                : "WhatsApp registered. Thank you!"}
            </p>
            {waSavedWasPreview && (
              <p className="text-[11px] text-green-800/85 leading-relaxed">
                Preview only: your number was not stored. On your store&apos;s real review link
                (QR from the dashboard), the same button saves to the owner&apos;s list.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
            WhatsApp&nbsp;&nbsp;(Optional)
          </p>

          {!canSaveWhatsApp && (
            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 leading-relaxed">
              <span className="font-semibold">Preview mode.</span> The form below matches your
              live review page. Save here is a demo — use your venue&apos;s link from the dashboard
              to capture contacts in the database.
            </p>
          )}

          {/* Name input (optional) */}
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
              focus:outline-none focus:border-slate-500 transition-colors placeholder:text-slate-400"
          />

          {/* Number input row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={countryCode}
              onChange={(e) => {
                setWaState("idle");
                const raw = e.target.value.replace(/[^\d+]/g, "");
                setCountryCode(raw.startsWith("+") ? raw : `+${raw.replace(/\+/g, "")}`);
              }}
              maxLength={5}
              className="w-16 px-2 py-2 text-sm font-semibold text-center border border-gray-300
                rounded-lg bg-white text-slate-700 focus:outline-none focus:border-slate-500
                transition-colors shrink-0"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setWaState("idle");
                setPhone(e.target.value.replace(/\D/g, ""));
              }}
              placeholder="50 123 4567"
              maxLength={12}
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
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
              {waState === "saving" ? "…" : "Save"}
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
              I agree to receive exclusive offers and campaign info via WhatsApp.
            </span>
          </label>

          {waState === "error" && (
            <div className="space-y-1">
              <p className="text-xs text-red-500">Could not save — please try again.</p>
              <p className="text-[11px] text-slate-500">
                If it keeps failing, the review page may be paused or misconfigured. Ask the store to
                check their dashboard.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Copied toast */}
      <div className={`transition-all duration-300 overflow-hidden ${copied ? "max-h-10 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="flex items-center justify-center gap-2 bg-slate-50 border border-gray-300
          rounded-xl py-2.5 text-xs font-semibold text-slate-700">
          <Check size={12} className="text-amber-500" />
          Copied to clipboard
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 bg-white
            text-slate-700 hover:border-slate-500 hover:bg-gray-50 active:scale-[0.98]
            transition-all flex items-center justify-center gap-2"
        >
          <Copy size={13} />
          Copy Review
        </button>

        <a
          href={buildTranslateUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 bg-white
            text-slate-700 hover:border-slate-500 hover:bg-gray-50 active:scale-[0.98]
            transition-all flex items-center justify-center gap-2 text-center block"
        >
          <Globe size={13} />
          Translate via Google
        </a>

        <button
          type="button"
          onClick={handlePostOnGoogle}
          className="bg-slate-900 text-white font-semibold rounded-xl shadow-md
            hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full py-3
            flex items-center justify-center gap-2"
        >
          <ExternalLink size={13} />
          Post on Google
        </button>
      </div>

      {/* How-to guide */}
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
        <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
          How to post
        </p>
        <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Tap <span className="font-semibold text-slate-800">Copy Review</span></li>
          <li>Tap <span className="font-semibold text-slate-800">Post on Google</span> — Maps opens</li>
          <li>Paste and hit <span className="font-semibold text-slate-800">Post</span></li>
        </ol>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="flex items-center justify-center gap-1.5 text-xs text-slate-400
          hover:text-slate-600 transition-colors mx-auto"
      >
        <RotateCcw size={11} />
        Start over
      </button>
    </div>
  );
}
