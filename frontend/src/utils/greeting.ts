export type GreetingBucket =
  'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

/**
 * Maps a wall-clock hour to a greeting bucket. The noon window is deliberately
 * narrow (11–13) so the lunch prompt lands on a real meal break instead of
 * covering the whole midday, and night wraps past midnight.
 */
export function greetingBucketForHour(hour: number): GreetingBucket {
  if (!Number.isFinite(hour)) return 'morning'

  const normalized = Math.floor(hour)
  if (normalized < 5) return 'night'
  if (normalized < 11) return 'morning'
  if (normalized < 13) return 'noon'
  if (normalized < 18) return 'afternoon'
  if (normalized < 23) return 'evening'
  return 'night'
}
