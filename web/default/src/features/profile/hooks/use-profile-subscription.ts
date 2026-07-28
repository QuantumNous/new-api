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

type ProfileSubscriptionFetcher = () => Promise<
  ApiResponse<SelfSubscriptionDataResponse>
>

export async function loadProfileSubscriptionSummary(
  fetcher: ProfileSubscriptionFetcher = getSelfSubscriptionFull
): Promise<ProfileSubscriptionSummary | null> {
  try {
    const response = await fetcher()
    if (!response.success) return null
    return buildProfileSubscriptionSummary(response.data)
  } catch {
    return null
  }
}

export function useProfileSubscriptionSummary(): ProfileSubscriptionSummary | null {
  const query = useQuery({
    queryKey: PROFILE_SUBSCRIPTION_QUERY_KEY,
    queryFn: () => loadProfileSubscriptionSummary(),
    retry: false,
  })

  return query.data ?? null
}
