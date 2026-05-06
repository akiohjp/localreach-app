import { Sparkles } from "lucide-react";

export default function StepGenerating() {
  return (
    <div className="flex flex-col items-center gap-8 text-center py-8">

      {/* Icon */}
      <div className="relative size-16">
        <div className="absolute inset-0 rounded-full bg-slate-100 animate-ping opacity-60" />
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg relative">
          <Sparkles size={24} className="text-amber-400" strokeWidth={1.5} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          Step 3 — Generating
        </p>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Crafting your review
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-[15rem]">
          Assembling a unique review from your keywords.
        </p>
      </div>

      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="size-1.5 rounded-full bg-slate-300 animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
