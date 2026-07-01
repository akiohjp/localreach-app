"use client";
import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { isValidUuid } from "@/lib/is-valid-uuid";
import type { UiStrings } from "@/lib/ui-strings";

type Props = {
  t: UiStrings;
  storeId: string;
  rating: number;
  storeName: string;
  onSubmit: () => void;
};

export default function StepFeedback({ t, storeId, rating, storeName, onSubmit }: Props) {
  const [helpBefore, helpAfter = ""] = t.feedback.help.split("{store}");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const message = text.trim();
    if (!message || submitting) return;
    setSubmitting(true);

    // Preview pages have no real store row — skip the write, keep the UX.
    if (isValidUuid(storeId)) {
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ store_id: storeId, rating, message }),
        });
      } catch (err) {
        // Never block the thank-you on a network hiccup; just log it.
        console.error("[feedback] submit failed", err);
      }
    }

    setSubmitting(false);
    onSubmit();
  }

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
            <span dir="ltr" className="text-amber-500" aria-label={`${rating} out of 5 stars`}>
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
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.feedback.placeholder}
        aria-label={t.feedback.describeAria}
        rows={5}
        className="w-full p-4 text-base text-slate-800 leading-relaxed bg-gray-50
          border border-gray-300 rounded-xl resize-none
          focus:outline-none focus:border-slate-500 transition-colors placeholder:text-slate-400"
      />

      {/* CTA */}
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
    </div>
  );
}
