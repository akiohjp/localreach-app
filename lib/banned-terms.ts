/**
 * Per-store forbidden vocabulary — the single source of truth.
 *
 * Why this exists: on 2026-08-07 a banned term ("Persian") reached the
 * client's phone during a meeting (scripts/bench-db-stores.mjs carries the
 * incident note). Cinar sells TURKISH rugs; describing them with Persian /
 * Iranian vocabulary is the one mistake that owner does not forgive, and it
 * has already cost us the right to write their GBP copy. Keyed by store-name
 * substring ("*" applies to every store) so all three Cinar branches share
 * one entry.
 *
 * Two strengths (split 2026-09-06, owner direction):
 *   - BANNED_TERMS       never, in any context. Origin words.
 *   - SOFT_BANNED_TERMS  the owner would not say it, but guests search with it
 *                        ("premium carpets in Dubai"). Allowed ONLY inside an
 *                        owner-configured phrase the guest tapped, or when a
 *                        reply echoes a guest who used it; never volunteered
 *                        by the model ("this carpet shop").
 *
 * Consumers — every path that can put words in front of a guest or an owner:
 *   - scripts/bench-db-stores.mjs   offline: generated reviews from live configs
 *   - app/api/generate-reply        runtime: LLM replies (prompt + post-filter)
 *   - app/api/generate-review       runtime: LLM guest drafts (prompt + post-filter)
 *   - lib/reply-engine.ts           runtime: template replies (guest-echo filter)
 *
 * Matching is case-insensitive on word boundaries with an optional plural "s"
 * ("carpet" also matches "carpets"). ASCII terms only — extend the matcher
 * before adding non-Latin vocabulary.
 */
export const BANNED_TERMS: Record<string, readonly string[]> = {
  Cinar: [
    "persian", "iranian", "oriental", "kashmir", "afghan", "moroccan",
    "tabriz", "isfahan", "qom", "nuruosmaniye", "antalya",
  ],
};

export const SOFT_BANNED_TERMS: Record<string, readonly string[]> = {
  Cinar: ["carpet"],
};

function termsFor(table: Record<string, readonly string[]>, storeName: string): readonly string[] {
  const name = storeName ?? "";
  const out: string[] = [];
  for (const [key, terms] of Object.entries(table)) {
    if (key === "*" || name.includes(key)) out.push(...terms);
  }
  return out;
}

/** Hard terms: never, anywhere. */
export function bannedTermsFor(storeName: string): readonly string[] {
  return termsFor(BANNED_TERMS, storeName);
}

/** Soft terms: only inside a phrase or quote that licenses them. */
export function softBannedTermsFor(storeName: string): readonly string[] {
  return termsFor(SOFT_BANNED_TERMS, storeName);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRe(term: string): RegExp {
  return new RegExp(`\\b${escapeRe(term)}s?\\b`, "i");
}

export function termMatches(term: string, text: string): boolean {
  return !!text && termRe(term).test(text);
}

/** First term from the list found in the text, or null when clean. */
export function findBannedTermIn(terms: readonly string[], text: string): string | null {
  if (!text) return null;
  for (const term of terms) {
    if (termRe(term).test(text)) return term;
  }
  return null;
}

/**
 * Drop whole sentences containing a listed term and rejoin the rest. Sentence
 * granularity on purpose: surgically excising one word leaves a grammatical
 * hole, and the surrounding sentence is usually about the banned concept
 * anyway ("just like the Persian rugs we saw in…").
 */
export function stripBannedSentencesIn(terms: readonly string[], text: string): string {
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

/** First HARD term for this store found in the text, or null when clean. */
export function findBannedTerm(storeName: string, text: string): string | null {
  return findBannedTermIn(bannedTermsFor(storeName), text);
}

/** stripBannedSentencesIn over this store's HARD terms. */
export function stripBannedSentences(storeName: string, text: string): string {
  return stripBannedSentencesIn(bannedTermsFor(storeName), text);
}

/**
 * Which of this store's soft terms the given contexts license. A soft term
 * that appears in a tapped phrase (guest draft) or in the guest's own review
 * (reply) is allowed inside that context; every other soft term is treated
 * like a hard one for this generation.
 */
export function splitSoftTerms(
  storeName: string,
  contexts: readonly string[],
): { allowed: string[]; forbidden: string[] } {
  const allowed: string[] = [];
  const forbidden: string[] = [];
  for (const term of softBannedTermsFor(storeName)) {
    (contexts.some((c) => termMatches(term, c)) ? allowed : forbidden).push(term);
  }
  return { allowed, forbidden };
}

/**
 * A licensed soft term used anywhere other than inside the phrases that
 * license it ("premium carpets in Dubai" is fine; "this carpet shop" is not).
 */
export function findTermOutsidePhrases(
  terms: readonly string[],
  text: string,
  phrases: readonly string[],
): string | null {
  if (!terms.length || !text) return null;
  let residue = text;
  for (const p of phrases) {
    if (p) residue = residue.replace(new RegExp(escapeRe(p), "gi"), " ");
  }
  return findBannedTermIn(terms, residue);
}
