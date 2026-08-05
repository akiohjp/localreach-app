/**
 * Dashboard results-panel maths, checked against the live stores' real numbers.
 *
 * Imports lib/review-metrics directly — the logic was briefly duplicated here,
 * which is a test that can pass while the dashboard is wrong.
 *
 * Two properties are asserted for every rating goal:
 *   REACHES — adding that many 5-star reviews really does make Google display
 *             the target.
 *   TIGHT   — one review fewer does NOT already display it, so the owner is
 *             never told to collect more than the arithmetic requires.
 */
const { ratingGoals, reviewActivity } = await import("../lib/review-metrics.ts");

const round1 = (n) => Math.round(n * 10) / 10;
/** What Google would display after x more five-star reviews. */
const displayed = (r, n, x) => round1((r * n + 5 * x) / (n + x));

const STORES = [
  ["Pitfire Pizza", 4.9, 1865],
  ["Kotobuki Clinic", 4.9, 422],
  ["Sengawa Golf", 4.0, 132],
  ["Maru Udon", 4.7, 131],
  ["1004 Gourmet", 4.7, 127],
  ["Ocha Cafe Sakura", 3.9, 75],
  ["Let It Dough!", 4.8, 46],
  ["edge: maxed", 5.0, 1],
  ["edge: rough start", 2.4, 9],
  ["edge: single 1-star", 1.0, 1],
  ["edge: no reviews yet", 0, 0],
];

let fail = 0;
console.log("─── rating goals ───");
for (const [name, rating, count] of STORES) {
  const goals = ratingGoals(rating, count);
  const parts = [];
  const seenCost = new Set();
  for (const { target, needed } of goals) {
    const got = displayed(rating, count, needed);
    const reaches = got >= target - 1e-9;
    const tight = needed === 0 || displayed(rating, count, needed - 1) < target - 1e-9;
    const uniqueCost = !seenCost.has(needed);
    seenCost.add(needed);
    if (!reaches || !tight || !uniqueCost) fail++;
    parts.push(
      `${target.toFixed(1)}=${needed}` +
        (reaches ? "" : " REACH-FAIL") +
        (tight ? "" : " LOOSE") +
        (uniqueCost ? "" : " DUP-COST"),
    );
  }
  console.log(
    `  ${(rating.toFixed(1) + "/" + count).padEnd(10)} ${name.padEnd(21)} ` +
      (parts.length ? parts.join("  ") : "(no target)"),
  );
}

// ---------------------------------------------------------------- activity ---
// Snapshots are not guaranteed daily (the cron can skip a day) and counts can
// go DOWN (Google moderates on its side). Both are represented here on purpose.
const day = (n) => new Date(Date.UTC(2026, 6, 1) + n * 86400000).toISOString().slice(0, 10);
const snap = (d, count, rating = 4.7) => ({ captured_on: day(d), rating, review_count: count });

const ACTIVITY_CASES = [
  {
    name: "steady growth",
    stats: Array.from({ length: 40 }, (_, i) => snap(i, 100 + i)),
    today: day(39),
    expect: { last7: 7, last30: 30, daysSinceNewReview: 0, trackedDays: 39 },
  },
  {
    // Rose to 118 by day 18, flat since. The 30-day window still starts at
    // day 9 (count 109), so it correctly reports the +9 that happened inside
    // the window — a stall shows up in daysSinceNewReview, not in the windows.
    name: "growth then flat for 21 days",
    stats: [
      ...Array.from({ length: 19 }, (_, i) => snap(i, 100 + i)),
      ...Array.from({ length: 21 }, (_, i) => snap(19 + i, 118)),
    ],
    today: day(39),
    expect: { last7: 0, last30: 9, daysSinceNewReview: 21, trackedDays: 39 },
  },
  {
    // The card fell off the counter: nothing has come in for over a month.
    // This is the case the amber "check the QR card" line exists for.
    name: "fully stalled 34 days",
    stats: [
      snap(0, 110),
      snap(5, 118),
      ...Array.from({ length: 34 }, (_, i) => snap(6 + i, 118)),
    ],
    today: day(39),
    expect: { last7: 0, last30: 0, daysSinceNewReview: 34, trackedDays: 39 },
  },
  {
    // Snapshots at days 0/9/20/39. Windows must measure against the newest
    // snapshot at or before the cutoff, not "the row N back": day 39 - 7 = 32,
    // whose baseline is day 20 (110), so 121 - 110 = 11.
    // The increase to 121 was OBSERVED on day 39, so that is the last one known.
    name: "cron skipped days",
    stats: [snap(0, 100), snap(9, 104), snap(20, 110), snap(39, 121)],
    today: day(39),
    expect: { last7: 11, last30: 17, daysSinceNewReview: 0, trackedDays: 39 },
  },
  {
    // Google removed one on day 38. A drop must not register as activity, and
    // must not reset the clock: the last real increase is still day 30.
    name: "count dropped (Google removed one)",
    stats: [snap(0, 100), snap(30, 120), snap(38, 119), snap(39, 119)],
    today: day(39),
    expect: { last7: 0, last30: 19, daysSinceNewReview: 9, trackedDays: 39 },
  },
  {
    name: "brand new store, one snapshot",
    stats: [snap(0, 12)],
    today: day(0),
    expect: { last7: null, last30: null, daysSinceNewReview: null, trackedDays: 0 },
  },
  {
    name: "no snapshots at all",
    stats: [],
    today: day(0),
    expect: { last7: null, last30: null, daysSinceNewReview: null, trackedDays: 0 },
  },
];

console.log("\n─── recent activity ───");
for (const c of ACTIVITY_CASES) {
  const got = reviewActivity(c.stats, c.today);
  const bad = Object.entries(c.expect).filter(([k, v]) => got[k] !== v);
  if (bad.length) fail++;
  console.log(
    `  ${bad.length ? "✗" : "✓"} ${c.name.padEnd(34)} ` +
      `7d=${got.last7} 30d=${got.last30} since=${got.daysSinceNewReview} tracked=${got.trackedDays}` +
      (bad.length ? `  EXPECTED ${bad.map(([k, v]) => `${k}=${v}`).join(", ")}` : ""),
  );
}

console.log(fail ? `\n${fail} CHECK(S) FAILED ❌` : "\nresults-panel maths verified ✅");
process.exitCode = fail ? 1 : 0;
