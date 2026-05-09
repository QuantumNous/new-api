// ----------------------------------------------------------------------------
// Deterministic seeding helpers
// ----------------------------------------------------------------------------
//
// These utilities are used to generate stable, repeatable mock metrics for
// model details (latency, throughput, uptime, app rankings) until the
// backend ships real values. Seeding the PRNG from the model name (and
// optionally the group name) ensures the same model always renders the same
// numbers, instead of jittering on every render.

/** djb2-inspired string hash → non-negative 31-bit integer. */
export function hashStringToSeed(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return Math.abs(hash | 0)
}

/** Linear-congruential generator producing pseudo-random numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = (seed || 1) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

/** Pick a number in [min, max] from a seeded PRNG. */
export function randomInRange(
  rand: () => number,
  min: number,
  max: number
): number {
  return min + rand() * (max - min)
}

/** Pick an integer in [min, max] (inclusive) from a seeded PRNG. */
export function randomIntInRange(
  rand: () => number,
  min: number,
  max: number
): number {
  return Math.floor(randomInRange(rand, min, max + 1))
}
