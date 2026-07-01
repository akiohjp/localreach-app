"use client";

import { useState } from "react";
import { STORE_CONFIG, type Step } from "@/lib/config";
import { isValidUuid } from "@/lib/is-valid-uuid";
import { createReviewNonce, generateReview } from "@/lib/assembler";
import StepRating from "@/components/StepRating";
import StepKeywords from "@/components/StepKeywords";
import StepGenerating from "@/components/StepGenerating";
import StepResult from "@/components/StepResult";
import StepFeedback from "@/components/StepFeedback";
import StepFeedbackSent from "@/components/StepFeedbackSent";
import { getUiStrings } from "@/lib/ui-strings";
import { useFlowPersistence } from "@/lib/use-flow-persistence";

const POSITIVE_STEPS: Step[] = ["rating", "keywords", "generating", "result"];

// The `/` demo is English-only.
const t = getUiStrings("en");

const DEMO_STORE_ID =
  typeof process.env.NEXT_PUBLIC_DEMO_STORE_ID === "string"
    ? process.env.NEXT_PUBLIC_DEMO_STORE_ID
    : "";
/** Home `/` uses a non-UUID placeholder unless `NEXT_PUBLIC_DEMO_STORE_ID` is set. */
const RESULT_STORE_ID = isValidUuid(DEMO_STORE_ID) ? DEMO_STORE_ID : "demo";

export default function ReviewPage() {
  const [step, setStep] = useState<Step>("rating");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  // Survive an accidental reload so a generated review isn't lost back to rating.
  useFlowPersistence(
    RESULT_STORE_ID,
    { step, rating, reviewText, selectedKeywords },
    (s) => {
      setStep(s.step as Step);
      setRating(s.rating);
      setReviewText(s.reviewText);
      setSelectedKeywords(s.selectedKeywords);
    },
  );

  const progressIdx = POSITIVE_STEPS.indexOf(step);

  function handleRating(value: number) {
    setRating(value);
    setStep(value >= 4 ? "keywords" : "feedback");
  }

  async function handleKeywords(selected: string[]) {
    setSelectedKeywords(selected);
    setStep("generating");
    await new Promise((r) => setTimeout(r, 1200));
    setReviewText(
      generateReview(STORE_CONFIG.storeName, selected, {
        nonce: createReviewNonce(),
        outletKey: `${RESULT_STORE_ID}|demo|${STORE_CONFIG.storeName}`,
      }),
    );
    setStep("result");
  }

  function reset() {
    setStep("rating");
    setRating(0);
    setReviewText("");
    setSelectedKeywords([]);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-sm">

        {/* Brand label */}
        <div className="mb-5 px-1 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400">
            LocalReach
          </span>
          <span className="text-[10px] text-slate-400 tracking-wider">
            Review Platform
          </span>
        </div>

        {/* Card — border-t-4 accent line + deep shadow */}
        <div className="bg-white border-t-4 border-slate-900 rounded-2xl overflow-hidden shadow-2xl">

          {/* Top bar */}
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400 mb-0.5">
                  {t.flow.shareExperience}
                </p>
                <p className="text-sm font-bold text-slate-900 tracking-tight">
                  {STORE_CONFIG.storeName}
                </p>
              </div>
              {progressIdx > 0 && (
                <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                  {progressIdx} / {POSITIVE_STEPS.length - 1}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {progressIdx > 0 && (
              <div className="flex gap-1 mt-4">
                {POSITIVE_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                      i <= progressIdx ? "bg-slate-900" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Step content */}
          <div className="p-6">
            {step === "rating" && (
              <StepRating
                t={t}
                storeName={STORE_CONFIG.storeName}
                greetingText={STORE_CONFIG.greetingText}
                onSelect={handleRating}
              />
            )}
            {step === "keywords" && (
              <StepKeywords
                t={t}
                keywords={STORE_CONFIG.keywords}
                onConfirm={handleKeywords}
              />
            )}
            {step === "generating" && <StepGenerating t={t} />}
            {step === "result" && (
              <StepResult
                t={t}
                reviewText={reviewText}
                gbpReviewUrl={STORE_CONFIG.gbpReviewUrl}
                storeId={RESULT_STORE_ID}
                selectedKeywords={selectedKeywords}
                onRetry={reset}
                onRegenerate={() =>
                  generateReview(STORE_CONFIG.storeName, selectedKeywords, {
                    nonce: createReviewNonce(),
                    outletKey: `${RESULT_STORE_ID}|demo|${STORE_CONFIG.storeName}`,
                  })}
              />
            )}
            {step === "feedback" && (
              <StepFeedback
                t={t}
                storeId={RESULT_STORE_ID}
                rating={rating}
                storeName={STORE_CONFIG.storeName}
                onSubmit={() => setStep("feedback_sent")}
              />
            )}
            {step === "feedback_sent" && (
              <StepFeedbackSent t={t} storeName={STORE_CONFIG.storeName} onReset={reset} />
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400 mt-5 tracking-widest uppercase">
          Powered by LocalReach
        </p>
        <p className="text-center mt-2">
          <a
            href="/demo"
            className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2"
          >
            Demo guide for presentations
          </a>
        </p>
      </div>
    </main>
  );
}
