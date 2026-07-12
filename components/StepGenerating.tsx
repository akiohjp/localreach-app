import { Sparkles } from "lucide-react";
import type { UiStrings } from "@/lib/ui-strings";

/**
 * Shown while the review is assembled. The wait is short and bounded, so the
 * bar is DETERMINATE: it visibly fills to completion (duration matches the
 * flow's generate delay). A bar that finishes reads as "almost done"; endless
 * pulsing dots read as "stuck" and make the same wait feel longer.
 */
export default function StepGenerating({
  t,
  brandColor = "#0f172a",
  durationMs = 900,
}: {
  t: UiStrings;
  brandColor?: string;
  durationMs?: number;
}) {
  return (
    <div
      className="flex flex-col items-center gap-8 text-center py-8"
      role="status"
      aria-live="polite"
    >

      {/* Icon */}
      <div className="relative size-16">
        <div className="absolute inset-0 rounded-full bg-slate-100 animate-ping opacity-60" aria-hidden="true" />
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg relative">
          <Sparkles size={24} className="text-amber-400" strokeWidth={1.5} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          {t.generating.stepLabel}
        </p>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          {t.generating.title}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-[15rem]">
          {t.generating.subtitle}
        </p>
      </div>

      {/* Determinate progress bar — fills over the actual generate delay. */}
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: brandColor,
            animation: `progress-fill ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
          }}
        />
      </div>
    </div>
  );
}
