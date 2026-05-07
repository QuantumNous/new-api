import { useQuery } from '@tanstack/react-query'
import { getRankings } from '../api'
import type { RankingPeriod } from '../types'

export function useRankings(period: RankingPeriod) {
  return useQuery({
    queryKey: ['rankings', period],
    queryFn: () => getRankings(period),
    staleTime: 5 * 60 * 1000,
  })
}
