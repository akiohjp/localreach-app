"use client";
import { useState } from "react";
import {
  Star, Utensils, Coffee, Wine, Building2,
  ShoppingBag, Scissors, Dumbbell, Car, BookOpen, Plus,
} from "lucide-react";

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

type Props = {
  storeName: string;
  greetingText: string;
  onSelect: (rating: number) => void;
  logoUrl?: string | null;
  businessCategory?: string | null;
};

function getCategoryIcon(category: string | null | undefined) {
  const c = (category ?? "").toLowerCase();
  if (c.includes("restaurant") || c.includes("food") || c.includes("dining") || c.includes("sushi") || c.includes("ramen"))
    return <Utensils size={24} strokeWidth={1.5} />;
  if (c.includes("cafe") || c.includes("coffee") || c.includes("tea") || c.includes("bakery"))
    return <Coffee size={24} strokeWidth={1.5} />;
  if (c.includes("bar") || c.includes("pub") || c.includes("wine") || c.includes("lounge") || c.includes("nightclub"))
    return <Wine size={24} strokeWidth={1.5} />;
  if (c.includes("hotel") || c.includes("inn") || c.includes("motel") || c.includes("accommodation") || c.includes("hostel"))
    return <Building2 size={24} strokeWidth={1.5} />;
  if (c.includes("shop") || c.includes("store") || c.includes("retail") || c.includes("boutique") || c.includes("market"))
    return <ShoppingBag size={24} strokeWidth={1.5} />;
  if (c.includes("salon") || c.includes("beauty") || c.includes("spa") || c.includes("nail") || c.includes("hair") || c.includes("barber"))
    return <Scissors size={24} strokeWidth={1.5} />;
  if (c.includes("gym") || c.includes("fitness") || c.includes("sport") || c.includes("yoga") || c.includes("pilates"))
    return <Dumbbell size={24} strokeWidth={1.5} />;
  if (c.includes("medical") || c.includes("clinic") || c.includes("dental") || c.includes("hospital") || c.includes("doctor") || c.includes("pharmacy"))
    return <Plus size={24} strokeWidth={1.5} />;
  if (c.includes("auto") || c.includes("car") || c.includes("mechanic") || c.includes("garage"))
    return <Car size={24} strokeWidth={1.5} />;
  if (c.includes("school") || c.includes("education") || c.includes("learning") || c.includes("academy") || c.includes("tutor"))
    return <BookOpen size={24} strokeWidth={1.5} />;
  return <Star size={24} strokeWidth={1.5} />;
}

export default function StepRating({ storeName, greetingText, onSelect, logoUrl, businessCategory }: Props) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const active = hovered || selected;

  return (
    <div className="flex flex-col items-center gap-8 text-center">

      {/* Store identity — logo image if available, else category/generic icon */}
      <div className="flex flex-col items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={storeName}
            className="h-16 w-auto max-w-[10rem] object-contain rounded-xl"
          />
        ) : (
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
            {getCategoryIcon(businessCategory)}
          </div>
        )}
        <div className="space-y-1.5">
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            {storeName}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-[17rem]">
            {greetingText}
          </p>
        </div>
      </div>

      {/* Stars */}
      <div className="space-y-5 w-full">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          Rate your experience
        </p>

        <div
          className="flex gap-1 sm:gap-2.5 justify-center touch-manipulation"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isActive = star <= active;
            return (
              <button
                key={star}
                type="button"
                onPointerDown={(e) => {
                  // Reliable tap/click on touch devices; ignore non–primary mouse buttons
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  setSelected(star);
                }}
                onClick={() => setSelected(star)}
                onMouseEnter={() => setHovered(star)}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2
                  flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
                  transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                aria-label={`${star} star`}
                aria-pressed={selected === star}
              >
                <Star
                  size={36}
                  strokeWidth={2}
                  className={`pointer-events-none transition-colors duration-150 ${
                    isActive
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-gray-300"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <p
          className={`text-sm font-semibold h-5 transition-all duration-200 ${
            selected > 0 ? "text-amber-500" : "text-transparent"
          }`}
        >
          {LABELS[selected]}
        </p>
      </div>

      {/* CTA button */}
      <button
        type="button"
        onClick={() => selected > 0 && onSelect(selected)}
        disabled={selected === 0}
        className="bg-slate-900 text-white font-semibold rounded-xl shadow-md
          hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full py-3
          disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
          disabled:shadow-none disabled:translate-y-0"
      >
        Continue
      </button>
    </div>
  );
}
