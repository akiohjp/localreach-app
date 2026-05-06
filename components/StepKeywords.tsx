"use client";
import { useState } from "react";
import { Check } from "lucide-react";

type Props = {
  keywords: readonly string[];
  onConfirm: (selected: string[]) => void;
  /** No guest pills — only admin forced terms; button generates without taps. */
  allowGuestSkip?: boolean;
};

export default function StepKeywords({
  keywords,
  onConfirm,
  allowGuestSkip = false,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(kw: string) {
    setSelected((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
  }

  const canConfirm =
    (keywords.length > 0 && selected.length > 0) ||
    (allowGuestSkip && keywords.length === 0);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          Step 2 — Keywords
        </p>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          What stood out?
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          {allowGuestSkip && keywords.length === 0 ? (
            <>
              Keywords for your review are preset. Tap continue — you can still edit the
              generated text before posting.
            </>
          ) : (
            <>
              Select all that apply. We&apos;ll craft your review automatically.
            </>
          )}
        </p>
      </div>

      {/* Keyword pills */}
      <div className="flex flex-wrap gap-2">
        {keywords.length === 0 ? (
          <p className="text-xs text-slate-500 italic w-full py-2">
            No optional tags — your review will use the venue&apos;s preset phrases.
          </p>
        ) : (
          keywords.map((kw) => {
            const on = selected.includes(kw);
            return (
              <button
                key={kw}
                onClick={() => toggle(kw)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  border transition-all duration-150 active:scale-95
                  ${
                  on
                    ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                    : "bg-white border-gray-300 text-slate-600 hover:border-slate-500 hover:text-slate-900"
                }`}
              >
                {on && <Check size={10} strokeWidth={2.5} className="text-amber-400 shrink-0" />}
                {kw}
              </button>
            );
          })
        )}
      </div>

      {/* Count */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-[10px] text-slate-400 shrink-0 font-semibold">
          {keywords.length === 0
            ? allowGuestSkip
              ? "Preset highlights"
              : "none selected"
            : selected.length > 0
              ? `${selected.length} selected`
              : "none selected"}
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* CTA */}
      <button
        onClick={() => canConfirm && onConfirm(selected)}
        disabled={!canConfirm}
        className="bg-slate-900 text-white font-semibold rounded-xl shadow-md
          hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full py-3
          disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
          disabled:shadow-none disabled:translate-y-0"
      >
        Generate Review
      </button>
    </div>
  );
}
