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
import { useCallback, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import {
  getRefundableSubscriptionTerms,
  isApiSuccess,
  refundSubscriptionTerm,
} from '../api'
import type {
  RefundableSubscriptionTermsData,
  RefundedSubscriptionTerm,
} from '../types'

const EMPTY_REFUNDABLE_TERMS: RefundableSubscriptionTermsData = {
  items: [],
  total_refund_money: 0,
  total_refund_quota: 0,
}

type RefundSuccessHandler = (
  result: RefundedSubscriptionTerm
) => void | Promise<void>

type RefundMutationVariables = {
  termSegmentId: number
  onSuccess?: RefundSuccessHandler
}

export const refundableTermsQueryKeys = {
  all: ['subscription', 'self', 'refundable-terms'] as const,
  detail: (userId?: number) =>
    [...refundableTermsQueryKeys.all, userId ?? null] as const,
}

export async function loadRefundableTerms(
  request: typeof getRefundableSubscriptionTerms = getRefundableSubscriptionTerms
): Promise<RefundableSubscriptionTermsData> {
  let response
  try {
    response = await request()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch refundable plan terms:', error)
    toast.error(i18next.t('Failed to load refundable plan terms'))
    throw error instanceof Error
      ? error
      : new Error(i18next.t('Failed to load refundable plan terms'))
  }

  if (isApiSuccess(response) && response.data) {
    return {
      items: response.data.items || [],
      total_refund_money: response.data.total_refund_money || 0,
      total_refund_quota: response.data.total_refund_quota || 0,
    }
  }

  const message =
    response.message || i18next.t('Failed to load refundable plan terms')
  toast.error(i18next.t(message))
  throw new Error(message)
}

async function refundTermSegment(
  termSegmentId: number
): Promise<RefundedSubscriptionTerm> {
  const response = await refundSubscriptionTerm(termSegmentId)
  if (!isApiSuccess(response) || !response.data) {
    throw new Error(response.message || i18next.t('Failed to refund plan term'))
  }
  return response.data
}

export function useRefundableTerms() {
  const userId = useAuthStore((state) => state.auth.user?.id)
  const inFlightTermIdRef = useRef<number | null>(null)
  const { data, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: refundableTermsQueryKeys.detail(userId),
    queryFn: () => loadRefundableTerms(),
    retry: false,
    enabled: userId !== undefined,
  })
  const { mutateAsync, isPending, variables } = useMutation({
    mutationFn: ({ termSegmentId }: RefundMutationVariables) =>
      refundTermSegment(termSegmentId),
    onSuccess: async (result, variables) => {
      toast.success(
        i18next.t('Plan term refunded to your Flatkey available balance.')
      )
      await Promise.all([refetch(), variables.onSuccess?.(result)])
    },
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to refund subscription term:', error)
      toast.error(
        error instanceof Error && error.message
          ? i18next.t(error.message)
          : i18next.t('Failed to refund plan term')
      )
    },
  })

  const refresh = useCallback(async (): Promise<void> => {
    await refetch()
  }, [refetch])

  const refundTerm = useCallback(
    async (
      termSegmentId: number,
      onSuccess?: RefundSuccessHandler
    ): Promise<boolean> => {
      if (inFlightTermIdRef.current !== null) {
        return false
      }

      inFlightTermIdRef.current = termSegmentId
      try {
        await mutateAsync({ termSegmentId, onSuccess })
        return true
      } catch {
        return false
      } finally {
        inFlightTermIdRef.current = null
      }
    },
    [mutateAsync]
  )

  return {
    data: data ?? EMPTY_REFUNDABLE_TERMS,
    loading: isLoading,
    error: isError,
    retrying: isFetching && !isLoading,
    refundingTermId: isPending ? (variables?.termSegmentId ?? null) : null,
    refresh,
    retry: refresh,
    refundTerm,
  }
}
