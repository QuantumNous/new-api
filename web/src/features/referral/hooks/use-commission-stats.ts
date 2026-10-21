/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useQuery } from '@tanstack/react-query'

import { getCommissionStats } from '../api'

export function useCommissionStats() {
  return useQuery({
    queryKey: ['commission', 'stats'],
    queryFn: getCommissionStats,
    staleTime: 30_000,
  })
}
