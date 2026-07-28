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
import { useQuery } from '@tanstack/react-query'
import type { ApiRequestConfig } from '@/lib/api'
import { getSelfSubscriptionFull } from '@/features/subscriptions/api'
import type {
  ApiResponse,
  SelfSubscriptionDataResponse,
} from '@/features/subscriptions/types'
import {
  buildProfileSubscriptionSummary,
  type ProfileSubscriptionSummary,
} from '../lib'

export const PROFILE_SUBSCRIPTION_QUERY_KEY = [
  'profile',
  'subscription-summary',
] as const

type ProfileSubscriptionFetcher = (
  config?: ApiRequestConfig
) => Promise<ApiResponse<SelfSubscriptionDataResponse>>

const PROFILE_SUBSCRIPTION_REQUEST_CONFIG = {
  skipBusinessError: true,
  skipErrorHandler: true,
} satisfies ApiRequestConfig

export async function loadProfileSubscriptionSummary(
  fetcher: ProfileSubscriptionFetcher = getSelfSubscriptionFull
): Promise<ProfileSubscriptionSummary | null> {
  try {
    const response = await fetcher(PROFILE_SUBSCRIPTION_REQUEST_CONFIG)
    if (!response.success) return null
    return buildProfileSubscriptionSummary(response.data)
  } catch {
    return null
  }
}

export function createProfileSubscriptionSummaryQueryOptions(
  userId: number | null | undefined
) {
  const resolvedUserId = userId ?? null

  return {
    queryKey: [...PROFILE_SUBSCRIPTION_QUERY_KEY, resolvedUserId],
    queryFn: () => loadProfileSubscriptionSummary(),
    enabled: resolvedUserId !== null,
    retry: false,
  }
}

export function useProfileSubscriptionSummary(
  userId: number | null | undefined
): ProfileSubscriptionSummary | null {
  const query = useQuery(createProfileSubscriptionSummaryQueryOptions(userId))

  return query.data ?? null
}
