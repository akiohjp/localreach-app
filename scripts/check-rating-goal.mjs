// Verify the rating-goal arithmetic against every live store's real numbers:
// the answer must actually make Google DISPLAY the target, and one review
// fewer must not.
const STORES = [
  ["Pitfire Pizza", 4.9, 1865],
  ["Kotobuki Clinic", 4.9, 422],
  ["Sengawa Golf", 4.0, 132],
  ["Maru Udon", 4.7, 131],
  ["1004 Gourmet", 4.7, 127],
  ["Ocha Cafe Sakura", 3.9, 75],
  ["Let It Dough!", 4.8, 46],
  ["edge: brand new", 5.0, 1],
  ["edge: rough start", 2.4, 9],
  ["edge: single 1-star", 1.0, 1],
];

const round1 = (n) => Math.round(n * 10) / 10;

function reviewsToReach(rating, count, target) {
  if (target <= rating) return 0;
  const threshold = target - 0.05;
  if (threshold >= 5) return null;
  return Math.max(0, Math.ceil((count * (threshold - rating)) / (5 - threshold) - 1e-9));
}
function ratingTargets(rating) {
  const nextTenth = round1(rating + 0.1);
  const nextHalf = Math.ceil(rating * 2) / 2 > rating ? Math.ceil(rating * 2) / 2 : rating + 0.5;
  return [...new Set([nextTenth, round1(nextHalf)])]
    .filter((t) => t > rating && t <= 5)
    .sort((a, b) => a - b);
}

/** What Google would display after adding x five-star reviews. */
const displayed = (r, n, x) => round1((r * n + 5 * x) / (n + x));

let fail = 0;
for (const [name, rating, count] of STORES) {
  const targets = ratingTargets(rating);
  const parts = [];
  for (const t of targets) {
    const need = reviewsToReach(rating, count, t);
    if (need == null) { parts.push(`${t.toFixed(1)}=n/a`); continue; }
    const got = displayed(rating, count, need);
    const justBelow = need > 0 ? displayed(rating, count, need - 1) : null;
    const reaches = got >= t - 1e-9;
    // Tightness: one fewer review should NOT already display the target.
    const tight = need === 0 || justBelow < t - 1e-9;
    if (!reaches || !tight) { fail++; }
    parts.push(
      `${t.toFixed(1)} needs ${need} -> ${got.toFixed(1)}${reaches ? "" : " REACH-FAIL"}` +
      `${tight ? "" : ` LOOSE(${need - 1} already ${justBelow?.toFixed(1)})`}`
    );
  }
  console.log(
    `${(rating.toFixed(1) + "/" + count).padEnd(10)} ${name.padEnd(20)} ` +
    (parts.length ? parts.join("  |  ") : "(no target — rating is maxed)")
  );
}
console.log(fail ? `\n${fail} CHECK(S) FAILED` : "\nall targets reachable and tight ✅");
process.exitCode = fail ? 1 : 0;
