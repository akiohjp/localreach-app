/**
 * Arithmetic behind the owner dashboard's results panel.
 *
 * Lives in lib rather than inside the component so the check script exercises
 * the SAME code the dashboard renders. It was duplicated for one commit and
 * that is a test that can pass while the product is wrong.
 */

export type ReviewSnapshot = {
  captured_on: string
  rating: number | null
  review_count: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * How many more 5-star reviews it takes to move the number Google displays.
 *
 * Plain arithmetic, not a forecast: N reviews averaging R, plus x reviews at
 * 5 stars, average (R*N + 5x)/(N + x). Reaching T therefore needs
 * x >= N(T - R)/(5 - T).
 *
 * The threshold is the ROUNDING boundary, not the target: Google publishes one
 * decimal, so 4.4 shows once the average reaches 4.35. Using the target
 * directly overstated the work badly on small counts — a 46-review store at
 * 4.8 came out as "46 more" when 16 actually gets there.
 *
 * R is itself the rounded public rating, so the answer is an estimate; the UI
 * says so rather than presenting it as a promise.
 */
export function reviewsToReach(rating: number, count: number, target: number): number | null {
  if (target <= rating) return 0
  const threshold = target - 0.05
  if (threshold >= 5) return null
  // EPS absorbs float noise: 0.45/0.55 arithmetic lands a hair above a whole
  // number and Math.ceil then charges the owner one review too many (measured
  // on four of the seven live stores).
  const EPS = 1e-9
  const needed = Math.ceil((count * (threshold - rating)) / (5 - threshold) - EPS)
  return Math.max(0, needed)
}

/** Next displayed decimal, plus the next half-star milestone. */
export function ratingTargets(rating: number): number[] {
  const nextTenth = round1(rating + 0.1)
  const nextHalf = Math.ceil(rating * 2) / 2 > rating ? Math.ceil(rating * 2) / 2 : rating + 0.5
  return [...new Set([nextTenth, round1(nextHalf)])]
    .filter((t) => t > rating && t <= 5)
    .sort((a, b) => a - b)
}

/**
 * Targets an owner should actually be shown: the ones that cost different
 * amounts. On a handful of reviews a single 5-star clears several decimals at
 * once, and listing "1.1 needs 1 / 1.5 needs 1" reads like a broken calculator.
 * Highest target wins each price.
 */
export function ratingGoals(
  rating: number,
  count: number,
): { target: number; needed: number }[] {
  if (count === 0) return []
  const byCost = new Map<number, number>()
  for (const t of ratingTargets(rating)) {
    const need = reviewsToReach(rating, count, t)
    if (need == null) continue
    const prev = byCost.get(need)
    if (prev == null || t > prev) byCost.set(need, t)
  }
  return [...byCost.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([needed, target]) => ({ target, needed }))
}

const DAY_MS = 86_400_000
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)

export type ReviewActivity = {
  /** Reviews gained over the trailing window. Null when history is too short. */
  last7: number | null
  last30: number | null
  /** Days since the count last went UP, or null if it never has on record. */
  daysSinceNewReview: number | null
  /** Calendar days the store has been tracked. */
  trackedDays: number
}

/**
 * Recent review activity, derived entirely from the daily snapshots — no extra
 * table, no per-owner "last seen" state.
 *
 * `daysSinceNewReview` is the number worth surfacing: a store whose count has
 * not moved in three weeks has a card that fell off the counter, and nothing
 * else in the product would say so.
 *
 * Two things the data does, that naive deltas get wrong:
 *  - Snapshots can be MISSING (the cron skips a day, or the store was created
 *    mid-window), so a window is measured against the newest snapshot at or
 *    before the cutoff — never against "the row 7 back".
 *  - Counts can go DOWN. Google removes reviews on its own side, so a drop is
 *    normal and must not read as new activity; only increases count as new.
 */
export function reviewActivity(stats: ReviewSnapshot[], todayIso?: string): ReviewActivity {
  if (stats.length === 0) {
    return { last7: null, last30: null, daysSinceNewReview: null, trackedDays: 0 }
  }
  const rows = [...stats].sort((a, b) => a.captured_on.localeCompare(b.captured_on))
  const first = rows[0]!
  const last = rows[rows.length - 1]!
  const today = dayNumber(todayIso ?? last.captured_on)
  const trackedDays = today - dayNumber(first.captured_on)

  const windowGain = (days: number): number | null => {
    if (trackedDays < days) return null
    const cutoff = today - days
    // Newest snapshot at or before the cutoff — tolerates missing days.
    let baseline: ReviewSnapshot | null = null
    for (const r of rows) {
      if (dayNumber(r.captured_on) <= cutoff) baseline = r
      else break
    }
    if (!baseline) return null
    return Math.max(0, last.review_count - baseline.review_count)
  }

  let lastIncreaseDay: number | null = null
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.review_count > rows[i - 1]!.review_count) {
      lastIncreaseDay = dayNumber(rows[i]!.captured_on)
    }
  }

  return {
    last7: windowGain(7),
    last30: windowGain(30),
    daysSinceNewReview: lastIncreaseDay == null ? null : today - lastIncreaseDay,
    trackedDays,
  }
}
