"use client";
import { useState } from "react";
import {
  Star, Utensils, Coffee, Wine, Building2, Beef, Fish, Soup, Pizza,
  Croissant, IceCreamCone, Stethoscope, House, Briefcase, Footprints, Package,
  Sofa, Sparkles, ShoppingBag, ShoppingCart, Shirt, Scissors, Dumbbell,
  Car, BookOpen, MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UiStrings } from "@/lib/ui-strings";

type Props = {
  t: UiStrings;
  storeName: string;
  greetingText: string;
  onSelect: (rating: number) => void;
  logoUrl?: string | null;
  businessCategory?: string | null;
  /**
   * Branch this QR belongs to (entity area + city). Shown as a badge under the
   * store name: the store name itself stays the brand alone so generated review
   * text reads naturally, so without this a chain cannot tell two branches'
   * QR codes apart and can print the wrong one for a location.
   */
  branchLabel?: string | null;
};

/**
 * 業種アイコン。客が QR を読んで最初に見る絵なので、業種と合っていないと
 * そこで信用が落ちる。
 *
 * 部分一致で当ててはいけない。"steakhouse" は "tea" を内側に含むので、
 * includes("tea") がステーキハウスをコーヒーカップにしていた
 * （Rowley's、オーナー指摘 2026-09-14）。だから語の境界で当てる。
 *
 * 文体プールの resolveVertical（lib/review-pools.ts）とは粒度が違う。
 * あちらはレビューの声を決めるので "restaurant" で足りるが、絵は寿司と
 * ラーメンとステーキを分けるだけの細かさがいる。業種を足すときは両方を見ること。
 *
 * 並び順は「具体的なものから一般的なものへ」。最初に当たった行が勝つ。
 */
type IconRule = readonly [RegExp, LucideIcon];
const CATEGORY_ICONS: readonly IconRule[] = [
  // 飲食 — 料理が分かるものから先に
  [/\b(steak|steakhouse|grill|grillhouse|barbecue|bbq|butcher|churrascaria)\b/, Beef],
  [/\b(sushi|sashimi|omakase|seafood)\b/, Fish],
  [/\b(ramen|udon|soba|noodle|noodles|pho|izakaya)\b/, Soup],
  [/\b(pizza|pizzeria)\b/, Pizza],
  [/\b(bakery|boulangerie|patisserie|pastry|doughnut|doughnuts|donut|donuts|bread)\b/, Croissant],
  [/\b(dessert|desserts|gelato|creamery|ice ?cream)\b/, IceCreamCone],
  // 食品を「売る」店は、食べさせる店より先に。"food store" の "food" が
  // restaurant 行に当たって Prime Gourmet がフォークになっていた（2026-09-14）。
  [/\b(grocery|groceries|supermarket|hypermarket|greengrocer|delicatessen|food (store|shop|market))\b/, ShoppingCart],
  [/\b(cafe|caf\u00e9|coffee|espresso|roastery|tea|teahouse|matcha)\b/, Coffee],
  [/\b(bar|pub|wine|winery|brewery|lounge|nightclub|cocktail|cocktails)\b/, Wine],
  [/\b(restaurant|dining|diner|bistro|brasserie|eatery|kitchen|canteen|food)\b/, Utensils],
  // 医療と体
  [/\b(clinic|medical|hospital|doctor|dental|dentist|pharmacy|physio|chiro)\b/, Stethoscope],
  [/\b(salon|barber|hair|nail|nails|lash|brow|spa|beauty|aesthetic)\b/, Scissors],
  [/\b(gym|fitness|yoga|pilates|crossfit|golf|sport|sports)\b/, Dumbbell],
  // 専門職と不動産
  [/\b(real ?estate|realty|realtor|property|properties|broker|brokers|brokerage|leasing)\b/, House],
  [/\b(agency|agencies|marketing|advertising|branding|creative|media|studio|consulting|consultancy)\b/, Briefcase],
  [/\b(school|academy|tutor|tutoring|nursery|kindergarten|education|learning|course|courses)\b/, BookOpen],
  [/\b(hotel|inn|motel|resort|hostel|accommodation|lodging)\b/, Building2],
  [/\b(auto|automotive|car|cars|mechanic|garage|tyre|tire|detailing)\b/, Car],
  // 小売 — 何を売る店かが分かる語を先に、"shop" のような一般語は最後
  [/\b(perfume|perfumes|fragrance|fragrances|cosmetics|jewellery|jewelry)\b/, Sparkles],
  [/\b(rug|rugs|carpet|carpets|furniture|interior|homeware)\b/, Sofa],
  [/\b(pet|pets|vet|veterinary|aquarium|koi|pond)\b/, Fish],
  [/\b(clothing|apparel|fashion|menswear|womenswear|tailor)\b/, Shirt],
  [/\b(running|outdoor|sportswear|sneaker|sneakers|footwear)\b/, Footprints],
  [/\b(wholesale|wholesaler|trading|distributor|distribution|supplier|logistics)\b/, Package],
  [/\b(shop|store|retail|boutique|showroom)\b/, ShoppingBag],
];

export function resolveCategoryIcon(category: string | null | undefined): LucideIcon {
  const c = (category ?? "").toLowerCase();
  return CATEGORY_ICONS.find(([re]) => re.test(c))?.[1] ?? Star;
}

function getCategoryIcon(category: string | null | undefined) {
  const Icon = resolveCategoryIcon(category);
  return <Icon size={24} strokeWidth={1.5} />;
}

export default function StepRating({ t, storeName, greetingText, onSelect, logoUrl, businessCategory, branchLabel }: Props) {
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
          {branchLabel && (
            <p className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1
              text-[11px] font-semibold text-slate-600 tracking-tight">
              <MapPin size={11} strokeWidth={2.2} />
              {branchLabel}
            </p>
          )}
          <p className="text-sm text-slate-600 leading-relaxed max-w-[17rem]">
            {greetingText}
          </p>
        </div>
      </div>

      {/* Stars */}
      <div className="space-y-5 w-full">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          {t.rating.rateExperience}
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
                aria-label={t.rating.starAria.replace("{n}", String(star))}
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
          {t.rating.labels[selected]}
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
        {t.rating.continue}
      </button>
    </div>
  );
}
