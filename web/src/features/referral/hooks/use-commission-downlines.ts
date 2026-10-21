/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getCommissionDownlines } from '../api'

export function useCommissionDownlines(level: 1 | 2, page: number, size = 20) {
  return useQuery({
    queryKey: ['commission', 'downlines', level, page, size],
    queryFn: () => getCommissionDownlines({ level, page, size }),
    placeholderData: keepPreviousData,
  })
}
