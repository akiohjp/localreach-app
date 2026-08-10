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
  /** Feedback saved — advance to the thank-you screen. */
  onSubmit: (text: string) => void;
  /**
   * Left without sending. Lands on the SAME next screen with the SAME Google
   * option: the public path must never be conditional on completing a private
   * step, or the flow has quietly put an obstacle in front of unhappy guests
   * only — which is the "discourage negative reviews" clause, not a UX detail.
   */
  onSkip: () => void;
  /** Optional contact prefix, e.g. "+971" — same source as the 5-star screen. */
  dialCode?: string;
};

export default function StepFeedback({ t, storeId, rating, storeName, onSubmit, onSkip, dialCode }: Props) {
  const [helpBefore, helpAfter = ""] = t.feedback.help.split("{store}");
  const [text, setText] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(key: string) {
    setTopics((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSubmit() {
    const message = text.trim();
    // A tapped chip is a complete answer. Requiring prose would lose the
    // feedback from exactly the guest least willing to type one.
    if ((!message && topics.length === 0) || submitting) return;
    setSubmitting(true);
    setError(null);

    // Preview pages have no real store row — skip the write, keep the UX.
    if (!isValidUuid(storeId)) {
      setSubmitting(false);
      onSubmit(message);
      return;
    }

    // Only advance on a confirmed save — otherwise keep the guest on the form
    // so their feedback isn't silently discarded (store paused / server error).
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          rating,
          message,
          topics,
          contact_name: name.trim(),
          contact_phone: phone.trim() ? `${dialCode ?? ""}${phone.trim()}` : "",
        }),
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
    onSubmit(message);
  }

  const canSend = (text.trim().length > 0 || topics.length > 0) && !submitting;

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

      {/* Topics — selected, not pasted into the text. The old version appended
          the label to the textarea, which read back as prose and could not be
          counted across guests, so the owner could see that something was wrong
          but never what. */}
      <div className="flex flex-wrap gap-1.5">
        {t.feedback.topics.map((topic) => {
          const on = topics.includes(topic.key);
          return (
            <button
              key={topic.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleTopic(topic.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors active:scale-95 ${
                on
                  ? "bg-slate-900 text-white border-slate-900"
                  : "border-gray-300 text-slate-600 bg-white hover:border-slate-500 hover:text-slate-900"
              }`}
            >
              {topic.label}
            </button>
          );
        })}
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

      {/* Optional contact — the difference between a complaint the store reads
          and a guest the store can actually win back. */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2.5">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-700">{t.feedback.contactHeading}</p>
          <p className="text-[11px] text-slate-500">{t.feedback.contactNote}</p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.feedback.contactName}
          className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg bg-white
            focus:outline-none focus:border-slate-500 transition-colors"
        />
        <div className="flex gap-2">
          {dialCode && (
            <span className="px-3 py-2 text-base border border-gray-300 rounded-lg bg-white text-slate-600 shrink-0">
              {dialCode}
            </span>
          )}
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            maxLength={12}
            placeholder={t.feedback.contactPhone}
            className="flex-1 min-w-0 px-3 py-2 text-base border border-gray-300 rounded-lg bg-white
              focus:outline-none focus:border-slate-500 transition-colors"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* Send, and a way past it. The Google option lives on the next screen —
          reached either way, so nothing about the public path depends on
          whether the guest filled this in. */}
      <div className="flex flex-col gap-2.5">
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className="bg-slate-900 text-white font-semibold rounded-xl shadow-md
            hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full py-3
            disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
            disabled:shadow-none disabled:translate-y-0
            flex items-center justify-center gap-2"
        >
          <Send size={13} />
          {submitting ? t.feedback.sending : t.feedback.send}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={submitting}
          className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800
            transition-colors disabled:text-slate-300"
        >
          {t.feedback.skip}
        </button>
      </div>
    </div>
  );
}
