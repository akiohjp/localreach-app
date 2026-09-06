"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import type { UiStrings } from "@/lib/ui-strings";

type Props = {
  t: UiStrings;
  keywords: readonly string[];
  /** `note` is the guest's optional own words ("" when the field is off or empty). */
  onConfirm: (selected: string[], note: string) => void;
  /**
   * Show the one-line "in your own words" field. Only stores with AI drafts
   * switched on: the template engine cannot use free text, and an input that
   * changes nothing is a broken promise.
   */
  noteEnabled?: boolean;
  /** No pills configured at all; the button generates without taps. */
  allowGuestSkip?: boolean;
  /**
   * Pills that start switched ON — the store's own core phrases.
   *
   * They render exactly like every other pill and can be switched off. Before
   * 2026-08-03 these phrases were never shown to the guest and were appended to
   * the draft behind them, which is what Google's policy calls "request[ing]
   * that specific content be included". Offering them pre-ticked keeps the
   * discoverability value while leaving the choice with the guest.
   */
  initialSelected?: readonly string[];
};

export default function StepKeywords({
  t,
  keywords,
  onConfirm,
  allowGuestSkip = false,
  initialSelected = [],
  noteEnabled = false,
}: Props) {
  const [selected, setSelected] = useState<string[]>(() =>
    keywords.filter((k) => initialSelected.includes(k)),
  );
  const [note, setNote] = useState("");

  function toggle(kw: string) {
    setSelected((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
  }

  // Never hard-block the flow: a guest who doesn't want to tag anything must
  // still be able to generate — including switching every pre-ticked pill off,
  // which produces a review with none of the store's phrases in it. That has to
  // stay possible for the pre-ticking to be an offer rather than a requirement.
  const canConfirm = true;

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

      {/* The guest's own words — optional, one line, AI drafts only. This is
          the single biggest lever on how personal the draft reads: the model
          is told to build the review around it and add nothing else. */}
      {noteEnabled && (
        <div className="space-y-1.5">
          <label
            htmlFor="guest-note"
            className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400"
          >
            {t.keywords.noteLabel}
          </label>
          <input
            id="guest-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            maxLength={200}
            placeholder={t.keywords.notePlaceholder}
            autoComplete="off"
            enterKeyHint="done"
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-900
              placeholder:text-slate-400 outline-none focus:border-slate-500"
          />
          <p className="text-[11px] text-slate-500">{t.keywords.noteHint}</p>
        </div>
      )}

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
        onClick={() => canConfirm && onConfirm(selected, noteEnabled ? note.trim() : "")}
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
