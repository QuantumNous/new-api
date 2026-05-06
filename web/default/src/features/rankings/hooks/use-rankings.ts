import { useMemo } from 'react'
import { buildRankingsSnapshot } from '../lib/mock-rankings'
import type { RankingPeriod, RankingsSnapshot } from '../types'

/**
 * Memoised rankings snapshot for a period.
 *
 * Currently this synchronously builds deterministic mock data. When the
 * backend ships real analytics endpoints, swap the body to a
 * `useQuery`-based fetch — the consuming components don't care which side
 * produced the data as long as it conforms to {@link RankingsSnapshot}.
 */
export function useRankings(period: RankingPeriod): RankingsSnapshot {
  return useMemo(() => buildRankingsSnapshot(period), [period])
}
