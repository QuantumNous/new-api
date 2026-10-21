/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getCommissionRecords } from '../api'

export function useCommissionRecords(params: {
  status?: string
  page: number
  size?: number
}) {
  return useQuery({
    queryKey: ['commission', 'records', params],
    queryFn: () => getCommissionRecords(params),
    placeholderData: keepPreviousData,
  })
}
