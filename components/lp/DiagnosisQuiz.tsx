"use client";

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, BarChart3, Users, MessageSquare } from 'lucide-react';

const QUESTIONS = [
  {
    id: 1,
    question: "What is your current average rating on Google Maps?",
    options: [
      { label: "Above 4.5 Stars", score: 10 },
      { label: "4.0 〜 4.4 Stars", score: 5 },
      { label: "Below 4.0 or Very Few Reviews", score: 0 }
    ]
  },
  {
    id: 2,
    question: "How many new reviews do you receive per month?",
    options: [
      { label: "20+ Reviews", score: 10 },
      { label: "5 〜 19 Reviews", score: 5 },
      { label: "Less than 5", score: 0 }
    ]
  },
  {
    id: 3,
    question: "Do you have a digital list (WhatsApp/Email) of your customers?",
    options: [
      { label: "Yes, more than 50% captured", score: 10 },
      { label: "Only some regulars", score: 5 },
      { label: "No list at all", score: 0 }
    ]
  },
  {
    id: 4,
    question: "Do you respond to reviews within 24 hours?",
    options: [
      { label: "Always respond promptly", score: 10 },
      { label: "Sometimes", score: 5 },
      { label: "Rarely or Never", score: 0 }
    ]
  }
];

export default function DiagnosisQuiz() {
  const [currentStep, setCurrentStep] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (score: number) => {
    const nextScore = totalScore + score;
    setTotalScore(nextScore);
    
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResult(true);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 md:p-12">
      {!showResult ? (
        <div>
          <div className="flex justify-between items-end mb-8">
            <h3 className="text-2xl font-bold italic">SEO Efficiency Check</h3>
            <span className="text-sm font-bold text-[#D4AF37]">
              Step {currentStep + 1} / {QUESTIONS.length}
            </span>
          </div>
          
          <div className="mb-10">
            <p className="text-lg font-medium mb-6 text-gray-700">
              {QUESTIONS[currentStep].question}
            </p>
            <div className="space-y-4">
              {QUESTIONS[currentStep].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt.score)}
                  className="w-full text-left p-5 rounded-xl border border-gray-200 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all group flex justify-between items-center"
                >
                  <span className="font-medium group-hover:text-[#D4AF37]">{opt.label}</span>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-[#D4AF37]" />
                </button>
              ))}
            </div>
          </div>

          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-[#D4AF37] h-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#D4AF37]">
            <BarChart3 size={40} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#D4AF37] mb-2">Step Completed</h3>
          <h4 className="text-3xl font-bold mb-6 tracking-tight">Your Strategy is Ready to Build.</h4>
          <p className="text-gray-500 mb-10 leading-relaxed text-lg">
            Based on your answers, we have identified several growth opportunities for your outlet. Book a free consultation now to receive your <b>Custom Local SEO & GEO Strategy Report</b>.
          </p>
          
          <div className="bg-gray-50 rounded-2xl p-6 mb-10 text-left space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-[#D4AF37] mt-1 flex-shrink-0" size={20} />
              <p className="text-sm text-gray-600 font-bold uppercase tracking-wide">Report Contents:</p>
            </div>
            <ul className="text-sm text-gray-500 space-y-2 ml-8 list-disc">
               <li>Market positioning vs competitors</li>
               <li>AI-driven keyword optimization plan</li>
               <li>Customer retention & WhatsApp strategy</li>
            </ul>
          </div>

          <button className="w-full bg-[#D4AF37] text-white px-8 py-5 rounded-full text-lg font-bold hover:bg-[#B8962E] transition-all transform hover:scale-105 flex items-center justify-center gap-3">
            Book a Free Consultation <ArrowRight size={20} />
          </button>
          
          <p className="mt-6 text-xs text-gray-400">
            Our expert will contact you via WhatsApp or Email to confirm the schedule.
          </p>
        </div>
      )}
    </div>
  );
}
