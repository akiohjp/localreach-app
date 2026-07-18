import { useEffect, useRef } from "react";

export type FlowSnapshot = {
  step: string;
  rating: number;
  reviewText: string;
  selectedKeywords: string[];
  /**
   * Language the review text was generated in. Without it, a restore after the
   * top language switcher navigates re-inits from the page locale and the
   * result screen mislabels the text (and the Translate deep-link sends the
   * wrong sl=). Optional for backward-compat with stored snapshots.
   */
  reviewLocale?: string;
};

const TTL_MS = 30 * 60 * 1000; // 30 min — a review session shouldn't outlive this

/**
 * Persists the review flow to sessionStorage (per tab, keyed by store) so an
 * accidental reload / navigation doesn't throw away a generated review and send
 * the guest back to the rating screen. Restores once on mount; clears when the
 * flow returns to the rating step.
 *
 * Transient/interrupted states ("generating") are never restored.
 */
export function useFlowPersistence(
  storeId: string,
  snapshot: FlowSnapshot,
  restore: (s: FlowSnapshot) => void,
) {
  const key = `lr_flow_${storeId}`;
  const restoreRef = useRef(restore);

  // Keep the latest restore callback without retriggering the mount-only effect.
  useEffect(() => {
    restoreRef.current = restore;
  });

  // Restore once on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const s = JSON.parse(raw) as FlowSnapshot & { ts?: number };
      if (!s || typeof s.step !== "string") return;
      if (typeof s.ts === "number" && Date.now() - s.ts > TTL_MS) {
        sessionStorage.removeItem(key);
        return;
      }
      // Only restore meaningful, non-transient progress.
      if (s.step !== "rating" && s.step !== "generating") {
        restoreRef.current({
          step: s.step,
          rating: s.rating ?? 0,
          reviewText: s.reviewText ?? "",
          selectedKeywords: Array.isArray(s.selectedKeywords) ? s.selectedKeywords : [],
          reviewLocale: typeof s.reviewLocale === "string" ? s.reviewLocale : undefined,
        });
      }
    } catch {
      /* private mode / disabled storage — persistence is best-effort */
    }
    // Mount-only; key is stable for a given store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every meaningful change.
  useEffect(() => {
    try {
      if (snapshot.step === "rating") {
        sessionStorage.removeItem(key);
      } else if (snapshot.step !== "generating") {
        sessionStorage.setItem(key, JSON.stringify({ ...snapshot, ts: Date.now() }));
      }
    } catch {
      /* best-effort */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.step, snapshot.rating, snapshot.reviewText, snapshot.selectedKeywords, snapshot.reviewLocale]);
}
