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
import { getCardStatus, isApiSuccess } from '../api'
import type { CardStatus } from '../types'

/**
 * Load the current user's card-binding status.
 */
export function useCardStatus(enabled = true) {
  const query = useQuery({
    queryKey: ['stripe-card-status'],
    queryFn: getCardStatus,
    enabled,
    staleTime: 30_000,
  })

  const status: CardStatus | undefined =
    query.data && isApiSuccess(query.data) ? query.data.data : undefined

  return {
    status,
    cardBound: status?.card_bound ?? false,
    loading: query.isLoading,
    refetch: query.refetch,
  }
}
