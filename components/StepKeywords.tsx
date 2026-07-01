"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import type { UiStrings } from "@/lib/ui-strings";

type Props = {
  t: UiStrings;
  keywords: readonly string[];
  onConfirm: (selected: string[]) => void;
  /** No guest pills — only admin forced terms; button generates without taps. */
  allowGuestSkip?: boolean;
};

export default function StepKeywords({
  t,
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
          {t.keywords.stepLabel}
        </p>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          {t.keywords.title}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          {allowGuestSkip && keywords.length === 0
            ? t.keywords.presetIntro
            : t.keywords.selectIntro}
        </p>
      </div>

      {/* Keyword pills */}
      <div className="flex flex-wrap gap-2">
        {keywords.length === 0 ? (
          <p className="text-xs text-slate-500 italic w-full py-2">
            {t.keywords.noOptionalTags}
          </p>
        ) : (
          keywords.map((kw) => {
            const on = selected.includes(kw);
            return (
              <button
                key={kw}
                type="button"
                onClick={() => toggle(kw)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  border transition-all duration-150 active:scale-95
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1
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
              ? t.keywords.presetHighlights
              : t.keywords.noneSelected
            : selected.length > 0
              ? t.keywords.selectedCount.replace("{n}", String(selected.length))
              : t.keywords.noneSelected}
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
        {t.keywords.generate}
      </button>
    </div>
  );
}
