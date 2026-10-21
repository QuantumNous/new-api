/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useQuery } from '@tanstack/react-query'

import { previewQuotaCredit } from '../api'

export function useQuotaPreview(cents: number) {
  return useQuery({
    queryKey: ['commission', 'preview', cents],
    queryFn: () => previewQuotaCredit(cents),
    // Skip while cents is 0 so the user typing "0" doesn't spam the endpoint.
    enabled: cents > 0,
    staleTime: 60_000,
  })
}
