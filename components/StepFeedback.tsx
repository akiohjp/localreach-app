"use client";
import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";

type Props = { rating: number; storeName: string; onSubmit: () => void };

const QUICK_TAGS = ["Food quality", "Service", "Wait time", "Pricing", "Cleanliness", "Other"];

export default function StepFeedback({ rating, storeName, onSubmit }: Props) {
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg shrink-0">
          <MessageSquare size={20} className="text-white" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            We&apos;re sorry to hear that.
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {"★".repeat(rating)}{"☆".repeat(5 - rating)}&nbsp;·&nbsp;
            Help <span className="font-semibold">{storeName}</span> improve.
          </p>
        </div>
      </div>

      {/* Quick tags */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TAGS.map((tag) => (
          <button
            key={tag}
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
        placeholder="Describe your experience..."
        rows={5}
        className="w-full p-4 text-sm text-slate-800 leading-relaxed bg-gray-50
          border border-gray-300 rounded-xl resize-none
          focus:outline-none focus:border-slate-500 transition-colors placeholder:text-slate-400"
      />

      {/* CTA */}
      <button
        onClick={onSubmit}
        disabled={!text.trim()}
        className="bg-slate-900 text-white font-semibold rounded-xl shadow-md
          hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full py-3
          disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
          disabled:shadow-none disabled:translate-y-0
          flex items-center justify-center gap-2"
      >
        <Send size={13} />
        Send Feedback
      </button>
    </div>
  );
}
