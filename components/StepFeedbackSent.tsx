import { CheckCircle2, RotateCcw } from "lucide-react";
import type { UiStrings } from "@/lib/ui-strings";

type Props = { t: UiStrings; storeName: string; onReset: () => void };

export default function StepFeedbackSent({ t, storeName, onReset }: Props) {
  const [bodyBefore, bodyAfter = ""] = t.feedbackSent.body.split("{store}");
  return (
    <div className="flex flex-col items-center gap-8 text-center py-6">

      {/* Icon */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
        <CheckCircle2 size={28} className="text-white" strokeWidth={1.5} />
      </div>

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

      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 max-w-xs w-full">
        <p className="text-sm text-slate-600 leading-relaxed">
          {t.feedbackSent.closing}
        </p>
      </div>

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
