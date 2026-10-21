/*
Copyright (C) 2023-2026 QuantumNous
...
*/
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { redeemCommission } from '../api'

export function useRedeemCommission() {
  const qc = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (cents: number) => redeemCommission(cents),
    onSuccess: (data) => {
      toast.success(
        `${t('Redeem success')} +${data.quota_credited.toLocaleString()}`
      )
      // Refresh both commission counters and the user's wallet quota.
      void qc.invalidateQueries({ queryKey: ['commission'] })
      void qc.invalidateQueries({ queryKey: ['self'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
