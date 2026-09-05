/**
 * Per-store forbidden vocabulary — the single source of truth.
 *
 * Why this exists: on 2026-08-07 a banned term ("Persian") reached the
 * client's phone during a meeting (scripts/bench-db-stores.mjs carries the
 * incident note). Cinar sells TURKISH rugs; describing them with Persian /
 * Iranian carpet vocabulary is the one mistake that owner does not forgive,
 * and it has already cost us the right to write their GBP copy. Keyed by
 * store-name substring ("*" applies to every store) so all three Cinar
 * branches share one entry.
 *
 * Consumers — every path that can put words in front of a guest or an owner:
 *   - scripts/bench-db-stores.mjs   offline: generated reviews from live configs
 *   - app/api/generate-reply        runtime: LLM replies (prompt + post-filter)
 *   - lib/reply-engine.ts           runtime: template replies (guest-echo filter)
 *
 * Matching is case-insensitive on word boundaries with an optional plural "s"
 * ("carpet" also blocks "carpets"). ASCII terms only — extend the matcher
 * before adding non-Latin vocabulary.
 */
export const BANNED_TERMS: Record<string, readonly string[]> = {
  Cinar: [
    "persian", "iranian", "oriental", "kashmir", "afghan", "moroccan",
    "tabriz", "isfahan", "qom", "carpet", "nuruosmaniye", "antalya",
  ],
};

export function bannedTermsFor(storeName: string): readonly string[] {
  const name = storeName ?? "";
  const out: string[] = [];
  for (const [key, terms] of Object.entries(BANNED_TERMS)) {
    if (key === "*" || name.includes(key)) out.push(...terms);
  }
  return out;
}

function termRe(term: string): RegExp {
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i");
}

/** First banned term found in the text for this store, or null when clean. */
export function findBannedTerm(storeName: string, text: string): string | null {
  if (!text) return null;
  for (const term of bannedTermsFor(storeName)) {
    if (termRe(term).test(text)) return term;
  }
  return null;
}

/**
 * Drop whole sentences containing a banned term and rejoin the rest. Sentence
 * granularity on purpose: surgically excising one word leaves a grammatical
 * hole, and the surrounding sentence is usually about the banned concept
 * anyway ("just like the Persian rugs we saw in…").
 */
export function stripBannedSentences(storeName: string, text: string): string {
  const terms = bannedTermsFor(storeName);
  if (!terms.length || !text) return text;
  return text
    .split(/\n{2,}/)
    .map((par) =>
      par
        .split(/(?<=[.!?！？。؟])\s+/)
        .filter((sen) => !terms.some((t) => termRe(t).test(sen)))
        .join(" "),
    )
    .filter((par) => par.trim())
    .join("\n\n")
    .trim();
}
