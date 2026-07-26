import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { useMemo } from 'react'
import { toast } from 'sonner'

import {
  cancelAffiliateWithdrawal,
  createAffiliateWithdrawal,
  getAffiliateStatements,
  getAffiliateSummary,
  getAffiliateWithdrawals,
} from '../api'
import { generateAffiliateLink } from '../lib'

const affiliateSummaryKey = ['wallet', 'affiliate', 'summary'] as const
const affiliateWithdrawalsKey = ['wallet', 'affiliate', 'withdrawals'] as const
const affiliateStatementsKey = ['wallet', 'affiliate', 'statements'] as const

export function useAffiliate() {
  const queryClient = useQueryClient()
  const summaryQuery = useQuery({
    queryKey: affiliateSummaryKey,
    queryFn: getAffiliateSummary,
    select: (response) => response.data,
  })
  const withdrawalsQuery = useQuery({
    queryKey: affiliateWithdrawalsKey,
    queryFn: getAffiliateWithdrawals,
    select: (response) => response.data?.items ?? [],
  })
  const statementsQuery = useQuery({
    queryKey: affiliateStatementsKey,
    queryFn: getAffiliateStatements,
    select: (response) => response.data?.items ?? [],
  })

  const invalidateAffiliate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: affiliateSummaryKey }),
      queryClient.invalidateQueries({ queryKey: affiliateWithdrawalsKey }),
    ])
  }

  const withdrawalMutation = useMutation({
    mutationFn: createAffiliateWithdrawal,
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(i18next.t('Withdrawal request submitted'))
      await invalidateAffiliate()
    },
  })
  const cancelMutation = useMutation({
    mutationFn: cancelAffiliateWithdrawal,
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(i18next.t('Withdrawal request cancelled'))
      await invalidateAffiliate()
    },
  })

  const affiliateLink = useMemo(() => {
    const code = summaryQuery.data?.referral_code
    return code ? generateAffiliateLink(code) : ''
  }, [summaryQuery.data?.referral_code])

  return {
    summary: summaryQuery.data,
    withdrawals: withdrawalsQuery.data ?? [],
    statements: statementsQuery.data ?? [],
    affiliateLink,
    loading:
      summaryQuery.isLoading ||
      withdrawalsQuery.isLoading ||
      statementsQuery.isLoading,
    submittingWithdrawal: withdrawalMutation.isPending,
    cancellingWithdrawal: cancelMutation.isPending,
    createWithdrawal: withdrawalMutation.mutateAsync,
    cancelWithdrawal: cancelMutation.mutateAsync,
    refetch: invalidateAffiliate,
  }
}
