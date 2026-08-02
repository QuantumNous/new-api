/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'

import {
  createAffiliateBalanceTransfer,
  getAffiliateInviteeTopUps,
  getAffiliateSummary,
} from '../api'
import { generateAffiliateLink } from '../lib'
import type { AffiliateInviteeTopUpsQuery } from '../types'

const affiliateSummaryKey = ['wallet', 'affiliate', 'summary'] as const
const affiliateTopUpsKey = ['wallet', 'affiliate', 'invitee-topups'] as const
interface AffiliateDetailsQuery {
  topUps: AffiliateInviteeTopUpsQuery
}

const defaultDetailsQuery: AffiliateDetailsQuery = {
  topUps: { page: 1, pageSize: 20, sort: 'recharge_time_desc' },
}

export function useAffiliate(
  loadDetails = false,
  detailsQuery: AffiliateDetailsQuery = defaultDetailsQuery
) {
  const queryClient = useQueryClient()
  const summaryQuery = useQuery({
    queryKey: affiliateSummaryKey,
    queryFn: getAffiliateSummary,
    select: (response) => response.data,
  })
  const canViewTopUps = summaryQuery.data?.rule.show_invitee_topups === true
  const topUpsQuery = useQuery({
    queryKey: [...affiliateTopUpsKey, detailsQuery.topUps],
    queryFn: () => getAffiliateInviteeTopUps(detailsQuery.topUps),
    select: (response) => response.data,
    enabled: loadDetails && canViewTopUps,
  })
  const invalidateAffiliate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: affiliateSummaryKey }),
      queryClient.invalidateQueries({ queryKey: affiliateTopUpsKey }),
    ])
  }

  const transferMutation = useMutation({
    mutationFn: createAffiliateBalanceTransfer,
    onSuccess: async (response) => {
      if (!response.success) return
      toast.success(i18next.t('Cashback transferred to account balance'))
      await invalidateAffiliate()
    },
  })

  const code = summaryQuery.data?.referral_code
  return {
    summary: summaryQuery.data,
    topUps: topUpsQuery.data?.items ?? [],
    topUpsTotal: topUpsQuery.data?.total ?? 0,
    affiliateLink: code ? generateAffiliateLink(code) : '',
    loading: summaryQuery.isLoading,
    loadingDetails: topUpsQuery.isLoading,
    transferring: transferMutation.isPending,
    transferToBalance: transferMutation.mutateAsync,
    refetch: invalidateAffiliate,
  }
}
