"use client";
import { useState } from "react";
import { CheckCircle2, MessageSquare, RotateCcw, ExternalLink } from "lucide-react";
import { copyToClipboard, isUsableReviewUrl } from "@/lib/copy-text";
import type { UiStrings } from "@/lib/ui-strings";

type Props = {
  t: UiStrings;
  storeName: string;
  onReset: () => void;
  /** The public path stays open after sending privately — never a dead end. */
  googleReviewUrl: string;
  /**
   * What the guest wrote, so it can be copied on the way to Google. It used to
   * be copied by the button on the previous screen; that button moved here, and
   * the text had to come with it or a guest would arrive at Google with an
   * empty clipboard and retype everything.
   */
  feedbackText?: string;
  /** False when the guest came through without sending — don't thank them for
   *  something they did not do. */
  sent?: boolean;
};

export default function StepFeedbackSent({
  t,
  storeName,
  onReset,
  googleReviewUrl,
  feedbackText = "",
  sent = true,
}: Props) {
  const [bodyBefore, bodyAfter = ""] = t.feedbackSent.body.split("{store}");
  const [copyBlocked, setCopyBlocked] = useState(false);

  function handlePostOnGoogle() {
    const message = feedbackText.trim();
    if (!message) return;
    // The result is not discarded: in-app webviews refuse the clipboard
    // routinely, and a guest who lands on Google with nothing to paste mostly
    // gives up rather than retyping.
    void copyToClipboard(message).then((ok) => {
      if (!ok) setCopyBlocked(true);
    });
  }

  return (
    <div className="flex flex-col items-center gap-8 text-center py-6">

      {/* Icon */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
        {sent ? (
          <CheckCircle2 size={28} className="text-white" strokeWidth={1.5} />
        ) : (
          <MessageSquare size={28} className="text-white" strokeWidth={1.5} />
        )}
      </div>

      {sent && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {t.feedbackSent.title}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-[17rem]">
            {bodyBefore}
            <span className="font-semibold text-slate-900">{storeName}</span>
            {bodyAfter}
          </p>
        </div>
      )}

      {sent && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 max-w-xs w-full">
          <p className="text-sm text-slate-600 leading-relaxed">
            {t.feedbackSent.closing}
          </p>
        </div>
      )}

      {isUsableReviewUrl(googleReviewUrl) && (
        <div className="max-w-xs w-full space-y-2.5">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {t.feedbackSent.alsoOnGoogle}
          </p>
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handlePostOnGoogle}
            className="w-full py-3 rounded-xl font-semibold text-sm border border-gray-300 bg-white
              text-slate-700 hover:border-slate-500 hover:bg-gray-50 active:scale-[0.98]
              transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink size={13} />
            {t.feedback.postOnGoogle}
          </a>
          {copyBlocked && (
            <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-300
              rounded-xl py-2.5 px-3 text-xs font-semibold text-amber-800 text-center">
              {t.feedback.copyBlocked}
            </div>
          )}
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
