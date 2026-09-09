"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { UiStrings } from "@/lib/ui-strings";

/**
 * Shown while the review is assembled. The wait is short and bounded, so the
 * bar is DETERMINATE: it visibly fills to completion (duration matches the
 * flow's generate delay). A bar that finishes reads as "almost done"; endless
 * pulsing dots read as "stuck" and make the same wait feel longer.
 *
 * `openEnded` is for AI drafts, whose wait can outrun `durationMs` by several
 * seconds. There the bar reaches 88% on schedule and then keeps creeping with
 * a highlight sweeping along it, and once the expected time is clearly past
 * the copy switches to "still writing" with pulsing dots. Something is always
 * moving, so a slow model never looks like a page that has hung.
 */

/** How far past `durationMs` before the copy admits the wait is running long. */
const SLOW_GRACE_MS = 1500;

export default function StepGenerating({
  t,
  brandColor = "#0f172a",
  durationMs = 900,
  subtitle,
  openEnded = false,
}: {
  t: UiStrings;
  brandColor?: string;
  durationMs?: number;
  /** Overrides t.generating.subtitle (AI drafts say what is happening). */
  subtitle?: string;
  /** The wait may exceed `durationMs`: keep the bar moving past it. */
  openEnded?: boolean;
}) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!openEnded) return;
    const id = setTimeout(() => setSlow(true), durationMs + SLOW_GRACE_MS);
    return () => clearTimeout(id);
  }, [openEnded, durationMs]);

  const barAnimation = openEnded
    ? `progress-fill-open ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1) forwards, progress-creep 20000ms ${durationMs}ms linear forwards`
    : `progress-fill ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`;

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
          {slow ? t.generating.stillWriting : (subtitle ?? t.generating.subtitle)}
          {slow && (
            <span className="inline-flex gap-0.5 ms-1.5 align-baseline" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block size-1 rounded-full bg-slate-500"
                  style={{ animation: `dot-pulse 1.2s ${i * 180}ms ease-in-out infinite` }}
                />
              ))}
            </span>
          )}
        </p>
      </div>

      {/* Progress bar — determinate over the generate delay; in open-ended mode
          it keeps creeping and shimmering after that instead of freezing full. */}
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className="relative h-full overflow-hidden rounded-full"
          style={{ backgroundColor: brandColor, animation: barAnimation }}
        >
          {openEnded && (
            <span
              className="progress-shimmer absolute inset-0 opacity-0"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                animation: `progress-shimmer 1.4s ${durationMs}ms linear infinite`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
