import { resolveVertical } from "@/lib/review-pools";

/**
 * The general phrases a café or restaurant guest is offered next to the
 * store's own menu items (2026-10-04, Akio).
 *
 * The keyword step shows: the core phrases, then every menu item the owner
 * declared (keyword_types = "item"), then a few of these. Menu items are
 * always there so a guest can find what they ate; the rest of the row is
 * plain things anyone could have liked about a visit, instead of a random
 * draw from the owner's own attribute phrases ("easy parking", "office
 * treats") that read oddly to a guest at the counter.
 *
 * Attribute-shaped on purpose: the template engine and the prompt both treat
 * them as "attribute" (see generalPillTypes). Written in the store's keyword
 * language, the same as the owner's pills. No Arabic set: LocalReach is built
 * in English, so an Arabic store keeps its own pills.
 *
 * Shops that sell food (grocery, food store) are not restaurants: "generous
 * portions" would be wrong there, so they keep the owner's pills too.
 */

const SETS = {
  cafe: {
    en: ["friendly staff", "quick service", "fresh taste", "good coffee",
         "good value", "relaxed atmosphere", "clean space", "nice presentation"],
    ja: ["親切なスタッフ", "提供の早さ", "できたての味", "おいしいコーヒー",
         "手頃な価格", "落ち着いた雰囲気", "清潔な店内", "見た目のきれいさ"],
  },
  restaurant: {
    en: ["friendly staff", "attentive service", "fresh taste", "generous portions",
         "good value", "relaxed atmosphere", "clean space", "nice presentation"],
    ja: ["親切なスタッフ", "丁寧な接客", "できたての味", "ボリューム",
         "手頃な価格", "落ち着いた雰囲気", "清潔な店内", "見た目のきれいさ"],
  },
} as const;

const NOT_A_PLACE_TO_EAT = /store|shop|grocery|market|supermarket|wholesale|trading|店舗販売/i;

export function generalPillsFor(category: string | null | undefined, language: string | null | undefined): string[] {
  const c = category ?? "";
  if (NOT_A_PLACE_TO_EAT.test(c)) return [];
  const v = resolveVertical(c);
  if (v !== "cafe" && v !== "restaurant") return [];
  const lang = language === "ja" ? "ja" : language === "en" || !language ? "en" : null;
  return lang ? [...SETS[v][lang]] : [];
}

/** keyword_types entries for the general phrases; the owner's own types win. */
export function withGeneralTypes(
  pills: string[],
  types: Record<string, string> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pills) out[p] = "attribute";
  return { ...out, ...(types ?? {}) };
}
