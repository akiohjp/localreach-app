/**
 * Deterministic RNG for offline review assembly (same algo as assembler + independent forks).
 * Forking avoids correlated picks when the same RNG stream consumes keyword shuffle + every slot.
 */

export function createSequentialRng(seedInit: number): () => number {
  let seed = seedInit >>> 0;
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uncorrelated stream for template slots (opener / core / bridge / ...). */
export function forkRng(seed: number, salt: number): () => number {
  const mixed =
    (Math.imul(seed ^ salt, 0x9e3779b1) ^
      Math.imul(salt >>> 16, 0x85ebca6b) ^
      (seed << 13)) >>>
    0;
  return createSequentialRng(mixed === 0 ? 0xf33d87c1 : mixed);
}
