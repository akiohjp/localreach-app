/**
 * Review-generation quality bench (pre-sales debug, 2026-07-25).
 *
 * Statistically validates the zero-API review engine across locales, verticals,
 * keyword counts and ratings:
 *   1. Verbatim guarantee: store name + every selected keyword appear.
 *   2. Length: within the locale's overall [min, max] band; distribution spread.
 *   3. Diversity: exact-duplicate rate and duplicate-opener rate across runs.
 *   4. Tells: repeated sentence inside one review, em/en dashes, leftover
 *      placeholders, double articles, store-name over-mention (>2).
 *
 * Run: npx -y tsx scripts/review-bench.ts
 */

import { generateReview } from "../lib/assembler";

type Case = {
  label: string;
  store: string;
  keywords: string[];
  forcedCount: number;
  locale: "en" | "ja" | "ar";
  category: string;
  rating: number;
  runs: number;
};

const CASES: Case[] = [
  { label: "en/cafe 2kw", store: "Let it dough", keywords: ["fresh doughnuts", "Spanish Latte"], forcedCount: 0, locale: "en", category: "bakery cafe", rating: 5, runs: 300 },
  { label: "en/cafe 5kw+2forced", store: "Let it dough", keywords: ["best doughnuts in Dubai", "WAFI Mall", "fresh doughnuts", "friendly staff", "cozy atmosphere"], forcedCount: 2, locale: "en", category: "bakery cafe", rating: 5, runs: 300 },
  { label: "en/restaurant 8kw", store: "Reef & Beef", keywords: ["best steakhouse in Downtown Dubai", "dry-aged ribeye", "wagyu", "great service", "date night", "sea view", "extensive wine list", "valet parking"], forcedCount: 3, locale: "en", category: "steakhouse restaurant", rating: 5, runs: 300 },
  { label: "en/dental 3kw r4", store: "Pearl Dental Clinic", keywords: ["painless treatment", "Invisalign", "JLT"], forcedCount: 1, locale: "en", category: "dental clinic", rating: 4, runs: 300 },
  { label: "en/generic 0kw", store: "Al Wafaa Group", keywords: [], forcedCount: 0, locale: "en", category: "", rating: 5, runs: 200 },
  { label: "ja/restaurant 4kw", store: "おまかせ屋", keywords: ["ドバイで一番の寿司", "新鮮なネタ", "落ち着いた個室", "丁寧な接客"], forcedCount: 1, locale: "ja", category: "寿司 レストラン", rating: 5, runs: 300 },
  { label: "ja/beauty 2kw r4", store: "サクラサロン", keywords: ["ヘッドスパ", "駅近"], forcedCount: 0, locale: "ja", category: "美容室", rating: 4, runs: 300 },
  { label: "ar/restaurant 3kw", store: "مطعم الياسمين", keywords: ["أفضل مندي في دبي", "خدمة سريعة", "أجواء عائلية"], forcedCount: 1, locale: "ar", category: "restaurant", rating: 5, runs: 300 },
  { label: "en/kw-contains-store", store: "Bloom", keywords: ["Bloom signature latte", "garden seating"], forcedCount: 0, locale: "en", category: "cafe", rating: 5, runs: 200 },
  { label: "en/long-keywords", store: "Marina Motors", keywords: ["certified pre-owned German cars with full service history", "transparent pricing"], forcedCount: 0, locale: "en", category: "auto", rating: 5, runs: 200 },
];

const BAND = {
  // en max = long-bucket 132 × 1.15 stretch for 7-8 woven keywords.
  en: { min: 20, max: 152, measure: (s: string) => s.trim().split(/\s+/).filter(Boolean).length },
  ja: { min: 40, max: 260, measure: (s: string) => s.replace(/\s+/g, "").length },
  ar: { min: 20, max: 115, measure: (s: string) => s.trim().split(/\s+/).filter(Boolean).length },
} as const;

function sentences(text: string, locale: string): string[] {
  const sep = locale === "ja" ? "。" : ".";
  return text
    .split(/\n\n+/)
    .flatMap((p) => p.split(sep))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 8);
}

function countOccurrences(hay: string, needle: string): number {
  let n = 0;
  let i = 0;
  for (;;) {
    i = hay.indexOf(needle, i);
    if (i === -1) return n;
    n++;
    i += needle.length;
  }
}

let totalIssues = 0;

for (const c of CASES) {
  const texts: string[] = [];
  const issues: Record<string, number> = {};
  const samplesByIssue: Record<string, string> = {};
  const lens: number[] = [];

  const bump = (k: string, sample?: string) => {
    issues[k] = (issues[k] ?? 0) + 1;
    if (sample && !samplesByIssue[k]) samplesByIssue[k] = sample;
  };

  for (let i = 0; i < c.runs; i++) {
    const text = generateReview(c.store, c.keywords, {
      nonce: `bench-${c.label}-${i}`,
      outletKey: "11111111-2222-3333-4444-555555555555",
      locale: c.locale,
      category: c.category,
      forcedCount: c.forcedCount,
      rating: c.rating,
    });
    texts.push(text);

    // 1. verbatim keywords
    for (const kw of c.keywords) {
      if (!text.includes(kw)) bump(`missing-kw:${kw}`, text);
    }
    // 2. store name
    if (!text.includes(c.store)) bump("missing-store", text);
    const storeMentions = countOccurrences(text, c.store);
    if (storeMentions > 2 && !c.keywords.some((k) => k.includes(c.store))) {
      bump("store-overmention", text);
    }
    // 3. length band
    const band = BAND[c.locale];
    const n = band.measure(text);
    lens.push(n);
    if (n < band.min) bump("too-short", text);
    if (n > band.max) bump("too-long", text);
    // 4. tells
    if (/[—–]/.test(text)) bump("long-dash", text);
    if (/\{(store|list|kw|a|b)\}/.test(text)) bump("placeholder-leak", text);
    if (/\bthe the\b/i.test(text)) bump("double-article", text);
    if (/ {2,}/.test(text)) bump("double-space", text);
    if (c.locale !== "ja" && c.locale !== "ar") {
      // Sentence-initial lowercase (start of text, after ". ", or after \n\n).
      if (/(^|\.\s+|\n\n)(?:the |a |an )?[a-z]/.test(text) && /(^|\.\s|\n\n)[a-z]/.test(text)) {
        bump("lowercase-sentence-start", text);
      }
    }
    // Bottom-heavy wall: a last paragraph of 6+ sentences reads as stacked filler.
    const lastPara = text.split(/\n\n+/).filter(Boolean).pop() ?? "";
    const lastCount = lastPara.split(c.locale === "ja" ? "。" : ".").filter((s) => s.trim().length > 2).length;
    if (lastCount >= 6) bump("bottom-heavy-wall", text);
    const ss = sentences(text, c.locale);
    const seen = new Set<string>();
    for (const s of ss) {
      if (seen.has(s)) { bump("repeated-sentence", text); break; }
      seen.add(s);
    }
  }

  // diversity across runs
  const uniq = new Set(texts);
  const dupRate = 1 - uniq.size / texts.length;
  const openers = texts.map((t) => t.split(/[.。]/)[0]!.trim());
  const openerCounts = new Map<string, number>();
  for (const o of openers) openerCounts.set(o, (openerCounts.get(o) ?? 0) + 1);
  const topOpener = [...openerCounts.entries()].sort((a, b) => b[1] - a[1])[0]!;

  lens.sort((a, b) => a - b);
  const p = (q: number) => lens[Math.min(lens.length - 1, Math.floor(q * lens.length))];

  const issueCount = Object.values(issues).reduce((a, b) => a + b, 0);
  totalIssues += issueCount;

  console.log(`\n=== ${c.label} (${c.runs} runs) ===`);
  console.log(`len p5/p50/p95: ${p(0.05)}/${p(0.5)}/${p(0.95)}  exact-dup: ${(dupRate * 100).toFixed(1)}%  top-opener: ${((topOpener[1] / c.runs) * 100).toFixed(1)}% "${topOpener[0].slice(0, 60)}"`);
  if (issueCount === 0) {
    console.log("issues: none");
  } else {
    for (const [k, v] of Object.entries(issues)) {
      console.log(`ISSUE ${k}: ${v}/${c.runs}`);
      console.log(`  sample: ${samplesByIssue[k]?.replace(/\n/g, " | ").slice(0, 300)}`);
    }
  }
}

console.log(`\n=== TOTAL ISSUES: ${totalIssues} ===`);
if (totalIssues > 0) process.exitCode = 1;
