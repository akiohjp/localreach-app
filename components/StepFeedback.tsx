"use client";
import { useState } from "react";
import { MessageSquare, Send, ExternalLink } from "lucide-react";
import { isValidUuid } from "@/lib/is-valid-uuid";
import { copyToClipboard, isUsableReviewUrl } from "@/lib/copy-text";
import type { UiStrings } from "@/lib/ui-strings";

type Props = {
  t: UiStrings;
  storeId: string;
  rating: number;
  storeName: string;
  onSubmit: () => void;
  /**
   * Same Google target a 4–5 star guest gets. Offered here side by side with the
   * private option: sending low raters down a private-only path is "selectively
   * solicit positive reviews", which Google prohibits. No draft is generated —
   * the guest's own words are copied so they can paste them.
   */
  googleReviewUrl: string;
};

export default function StepFeedback({ t, storeId, rating, storeName, onSubmit, googleReviewUrl }: Props) {
  const [helpBefore, helpAfter = ""] = t.feedback.help.split("{store}");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyBlocked, setCopyBlocked] = useState(false);

  async function handleSubmit() {
    const message = text.trim();
    if (!message || submitting) return;
    setSubmitting(true);
    setError(null);

    // Preview pages have no real store row — skip the write, keep the UX.
    if (!isValidUuid(storeId)) {
      setSubmitting(false);
      onSubmit();
      return;
    }

    // Only advance on a confirmed save — otherwise keep the guest on the form
    // so their feedback isn't silently discarded (store paused / server error).
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ store_id: storeId, rating, message }),
      });
      if (!res.ok) {
        console.error("[feedback] submit failed", res.status);
        setError(t.feedback.sendError);
        setSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("[feedback] submit failed", err);
      setError(t.feedback.sendError);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSubmit();
  }

  /**
   * Copy whatever the guest wrote (may be empty — they can write straight into
   * Google) alongside the anchor's own navigation. Deliberately does NOT submit
   * the private feedback: which path to take is the guest's choice, not ours.
   */
  function handlePostOnGoogle() {
    const message = text.trim();
    if (!message) return;
    // The result is not discarded: a guest who wrote a complaint, had the copy
    // refused, and landed on Google with an empty clipboard would have to type
    // it all again — and most would simply not bother. Same defect the 5-star
    // path had.
    void copyToClipboard(message).then((ok) => {
      if (ok) return;
      const ta = document.querySelector<HTMLTextAreaElement>("textarea[data-feedback-text]");
      if (ta) {
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
      }
      setCopyBlocked(true);
    });
  }

  const showGoogleOption = isUsableReviewUrl(googleReviewUrl);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg shrink-0">
          <MessageSquare size={20} className="text-white" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {t.feedback.title}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {/* dir=ltr keeps filled→empty star order correct under RTL locales */}
            <span dir="ltr" className="text-amber-500" aria-label={t.feedback.ratingAria.replace("{n}", String(rating))}>
              {"★".repeat(rating)}{"☆".repeat(5 - rating)}
            </span>
            &nbsp;·&nbsp;
            {helpBefore}
            <span className="font-semibold">{storeName}</span>
            {helpAfter}
          </p>
        </div>
      </div>

      {/* Quick tags */}
      <div className="flex flex-wrap gap-1.5">
        {t.feedback.quickTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setText((p) => (p ? `${p}, ${tag}` : tag))}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-slate-600 bg-white
              hover:border-slate-500 hover:text-slate-900 transition-colors active:scale-95"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        data-feedback-text
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.feedback.placeholder}
        aria-label={t.feedback.describeAria}
        rows={5}
        className="w-full p-4 text-base text-slate-800 leading-relaxed bg-gray-50
          border border-gray-300 rounded-xl resize-none
          focus:outline-none focus:border-slate-500 transition-colors placeholder:text-slate-400"
      />

      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* CTA — private to the team, and the public Google path side by side.
          Both are visible at the same moment: a low rater sees exactly the same
          options a happy guest does, so no path is closed off by the rating. */}
      <div className="flex flex-col gap-2.5">
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="bg-slate-900 text-white font-semibold rounded-xl shadow-md
            hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full py-3
            disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
            disabled:shadow-none disabled:translate-y-0
            flex items-center justify-center gap-2"
        >
          <Send size={13} />
          {submitting ? t.feedback.sending : t.feedback.send}
        </button>

        {showGoogleOption && (
          <>
            {/* Anchor, not window.open: in-app webviews (Instagram, LINE — where
                QR scans routinely land) block script-opened popups, and with
                noopener window.open returns null so the block is undetectable
                anyway. A link is a user navigation and is not blocked. */}
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
            <p className="text-[11px] text-slate-500 leading-relaxed text-center">
              {t.feedback.eitherNote}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
