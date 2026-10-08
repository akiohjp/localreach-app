"use client";
import { useEffect, useRef } from "react";
import { ExternalLink, RotateCcw, Star } from "lucide-react";
import { isUsableReviewUrl } from "@/lib/copy-text";
import { logGuestEvent } from "@/lib/guest-event";
import type { UiStrings } from "@/lib/ui-strings";

type Props = {
  t: UiStrings;
  storeId: string;
  storeName: string;
  googleReviewUrl: string;
  brandColor: string;
  locale: string;
  onReset: () => void;
};

/**
 * Rating-only stores (lib/review-mode): the screen after the stars. One button
 * to the store's Google review form and nothing else — no draft, no copy, no
 * suggested words. Whatever the guest writes there is entirely theirs.
 */
export default function StepGoogle({
  t,
  storeId,
  storeName,
  googleReviewUrl,
  brandColor,
  locale,
  onReset,
}: Props) {
  const [bodyBefore, bodyAfter = ""] = t.google.body.split("{store}");
  const usable = isUsableReviewUrl(googleReviewUrl);

  // One google_shown per screen (the ref survives React's dev double-run).
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logGuestEvent(storeId, "google_shown", locale);
  }, [storeId, locale]);

  return (
    <div className="flex flex-col items-center gap-7 text-center py-4">
      <div className="text-white p-4 rounded-2xl shadow-lg" style={{ backgroundColor: brandColor }}>
        <Star size={28} className="text-white" strokeWidth={1.5} />
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">{t.google.title}</h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-[17rem]">
          {bodyBefore}
          <span className="font-semibold text-slate-900">{storeName}</span>
          {bodyAfter}
        </p>
      </div>

      {usable && (
        <div className="max-w-xs w-full space-y-2.5">
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logGuestEvent(storeId, "post_click", locale)}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white shadow-md
              active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: brandColor }}
          >
            <ExternalLink size={14} />
            {t.google.button}
          </a>
          <p className="text-[11px] text-slate-500 leading-relaxed">{t.google.starsAgain}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <RotateCcw size={11} />
        {t.feedbackSent.backToStart}
      </button>
    </div>
  );
}
