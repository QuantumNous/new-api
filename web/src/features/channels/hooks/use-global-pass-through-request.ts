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

import { requireServerSuccess } from '@/lib/server-error-message'

import { getChannelOps } from '../api'

/**
 * Site-wide request body passthrough, which overrides every channel switch.
 * Shares the `channel-ops` cache entry with the channels page, and stays quiet
 * on failure so an unavailable side hint never blocks channel editing.
 */
export function useGlobalPassThroughRequest(enabled: boolean) {
  const query = useQuery({
    queryKey: ['channel-ops'],
    queryFn: async () => requireServerSuccess(await getChannelOps()),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
    meta: { errorToast: false },
  })
  return query.data?.data?.pass_through_request_enabled === true
}
