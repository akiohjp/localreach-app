/**
 * Paragraph shaping for owner replies.
 *
 * Both reply paths used to emit one unbroken block. Google's reply box keeps the
 * line breaks it is given, so a wall of text is what the owner ends up pasting —
 * hard to read on the profile and hard to edit in the draft box (owner report
 * 2026-07-30). Everything that produces a draft runs through here so the text is
 * already in short paragraphs, copy-paste ready.
 *
 * The AI is asked for paragraphs in the prompt; this is the guarantee for when it
 * ignores that, and the only mechanism on the template-engine path.
 */

/**
 * Split into sentences. Latin terminators need trailing whitespace and a
 * non-lowercase next character, so "e.g. the" and "4.5 stars" stay intact; CJK
 * terminators (。！？) split on their own because Japanese has no such space.
 */
export function splitSentences(text: string): string[] {
  const t = text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  if (!t) return [];
  return t
    .split(/(?<=[.!?؟])\s+(?=[^a-z\s])|(?<=[。！？])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Re-join sentences. Japanese carries its own gap in 。！？, so a space after one
 * is a visible typo; Latin and Arabic need the space.
 */
function joinRun(sentences: string[]): string {
  return sentences.reduce((acc, s) => (!acc ? s : /[。！？]$/.test(acc) ? acc + s : `${acc} ${s}`), "");
}

/** Sizes of `groups` paragraphs over `n` sentences, front-loaded (3,2,2 not 2,2,3). */
function distribute(n: number, groups: number): number[] {
  const base = Math.floor(n / groups);
  const extra = n % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Break a reply body into blank-line-separated paragraphs of 2–3 sentences.
 * Text that already carries paragraph breaks is respected (only normalised), so
 * an AI reply that followed the prompt is never re-cut.
 */
export function paragraphize(text: string, maxParagraphs = 3): string {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return "";

  // Already broken up by the writer (or hand-edited): keep the author's breaks.
  const existing = t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (existing.length > 1) return existing.join("\n\n");
  // Single newlines used as paragraph breaks — widen them, same intent.
  const singleLines = t.split(/\n/).map((p) => p.trim()).filter(Boolean);
  if (singleLines.length > 1) return singleLines.join("\n\n");

  const sentences = splitSentences(t);
  if (sentences.length < 4) return joinRun(sentences).trim() || t;

  const groups = Math.min(maxParagraphs, Math.max(1, Math.round(sentences.length / 2.5)));
  const sizes = distribute(sentences.length, groups);

  const out: string[] = [];
  let i = 0;
  for (const size of sizes) {
    out.push(joinRun(sentences.slice(i, i + size)).trim());
    i += size;
  }
  return out.filter(Boolean).join("\n\n");
}

/**
 * Join pre-built sentence groups into paragraphs. `groups` are ordered beats;
 * empty ones drop out. JA joins without spaces (its punctuation carries the gap).
 */
export function joinParagraphs(groups: string[][], glue: string): string {
  return groups
    .map((g) => g.map((s) => s.trim()).filter(Boolean).join(glue).trim())
    .filter(Boolean)
    .join("\n\n");
}
