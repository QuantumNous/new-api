/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getCommissionRedemptions } from '../api'

export function useCommissionRedemptions(page: number, size = 20) {
  return useQuery({
    queryKey: ['commission', 'redemptions', page, size],
    queryFn: () => getCommissionRedemptions({ page, size }),
    placeholderData: keepPreviousData,
  })
}
