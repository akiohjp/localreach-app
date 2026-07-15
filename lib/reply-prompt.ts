/**
 * Prompt construction for AI review replies (used by app/api/generate-reply).
 *
 * Lives outside the route so scripts/test-gemini-reply.mjs can exercise the REAL
 * prompt against the live API instead of a copy that quietly drifts out of sync.
 */

export const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  ja: "Japanese (natural, warm 丁寧語 — not stiff business keigo)",
  ar: "Arabic (Modern Standard, friendly)",
};

export function clip(s: unknown, max: number): string {
  return typeof s === "string" ? s.slice(0, max) : "";
}

export function buildPrompt(p: {
  storeName: string; rating: number; reviewText: string; language: string;
  tone: string; geoPhrase: string; geoKeywords: string[]; signature: string;
}): string {
  const sentiment = p.rating >= 4 ? "positive" : p.rating <= 2 ? "negative" : "mixed";
  const kwList = p.geoKeywords.slice(0, 8).map((k) => `"${k}"`).join(", ");
  // Rating-only (stars, no words) is a genuinely different writing job: there is
  // nothing to answer, so the usual "respond to the specifics" instruction would
  // invite invented details. Swap in rules that forbid guessing instead.
  const ratingOnly = !p.reviewText.trim();

  return `You are the owner of "${p.storeName}", a small local business, personally replying to a customer's public Google review. Write ONE reply.

THE REVIEW (${p.rating}/5 stars):
"""
${p.reviewText || "(NO TEXT — the guest left a star rating only.)"}
"""

HOW TO WRITE IT:
${ratingOnly
    ? `- The guest left ONLY a star rating. They wrote nothing, so you know NOTHING about their visit. Invent nothing: no dishes, no staff, no occasion, no "glad you enjoyed…", no "sounds like…", no guessing what they liked or disliked. Acknowledging that you don't know is better than assuming.
- Do NOT thank them for their "words", "review", "comments", "kind message" or "detailed feedback" — there are none. Thank them for the rating itself, if you thank them at all.
${sentiment === "positive"
      ? `- Tone: genuinely pleased but not gushing. It is fine to say you'd love to know what they enjoyed. Keep it light.`
      : sentiment === "mixed"
        ? `- A silent ${p.rating}-star means something fell short and you cannot see what. Say plainly that you don't know what missed, and ASK them to tell you. Do not apologise for anything specific, because you don't know what happened.`
        : `- A silent ${p.rating}-star means something went badly wrong and you cannot see what. Apologise for the experience in general terms only, say honestly that you don't know what happened, and ASK them to tell you so you can put it right. Do not invent the failure.`}
- Length: 3 to 5 sentences. There is nothing to respond to, so a long reply reads as padding.`
    : `- READ the review carefully and respond to its actual content. Reference the specific things the guest mentioned (dishes, staff moments, complaints, details) in your own words. Never write a reply that could be pasted under a different review.
- Length: 4 to 7 sentences (${sentiment === "negative" ? "keep it focused and sincere" : "substantial, not a two-liner"}).`}
- Voice: a real human owner. ${p.tone === "professional" ? "Courteous and composed, but still personal." : "Warm, personal, lightly conversational."} Use contractions. Vary sentence length. No corporate boilerplate ("we strive to", "your satisfaction is our priority"), no exclamation spam, and DO NOT start with "Thank you for" or "Thanks for" (start some other natural way).
- Never use em dashes or en dashes.
${sentiment === "negative"
    ? `- This is an apology: ${ratingOnly ? "stay general (you don't know the details), take responsibility for the experience anyway" : "acknowledge the specific failures plainly, take responsibility without excuses"}, and invite the guest to contact you directly to make it right. Do NOT include marketing phrases, keywords, or the neighbourhood. Stay humble.`
    : ratingOnly && sentiment === "mixed"
      // A quoted marketing phrase under a silent 3-star reads as tone-deaf; the
      // job here is to get the guest talking, not to farm keywords.
      ? `- No marketing phrases and no keywords. You may mention "${p.storeName}" once if it reads naturally.
- End the body by asking them, plainly and without pressure, to tell you what would have made the visit better.`
      : `- Local SEO (weave these in NATURALLY, never as a list, never forced):
  * Mention the business name "${p.storeName}" once inside the body text.
${p.geoPhrase ? `  * Mention the area "${p.geoPhrase}" once, in a natural place-framed way.` : ""}
${kwList ? `  * Work in exactly ONE of these brand phrases, quoted or unquoted, where it fits naturally: ${kwList}.` : ""}
  * If any of these would read awkwardly in context, prioritise natural flow over inclusion.${ratingOnly ? `\n  * This reply is the ONLY text under this rating, so these signals matter here, but a forced-sounding reply is still worse than a plain one.` : ""}
- End the body by inviting them back (vary the wording; not always "see you soon").`}
- Language: ${p.language}.
- Output ONLY the reply body text. No sign-off line (it is appended separately), no quotes around the whole thing, no markdown, no explanations.`;
}
