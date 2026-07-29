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

import { getCheckinLeaderboard, getUsageLeaderboard } from '../api'
import type { UsagePeriod } from '../types'

// Backend caches results for 2 minutes; mirror that on the client so we
// avoid hammering the aggregation queries on tab switches. Data is also
// refetched on window focus, but staleTime keeps the UI snappy.
const USAGE_STALE_TIME = 2 * 60 * 1000

export function useUsageLeaderboard(period: UsagePeriod) {
  return useQuery({
    queryKey: ['usage-leaderboard', period],
    queryFn: () => getUsageLeaderboard(period),
    staleTime: USAGE_STALE_TIME,
    gcTime: 10 * 60 * 1000,
  })
}

export function useCheckinLeaderboard() {
  return useQuery({
    queryKey: ['usage-checkin-leaderboard'],
    queryFn: () => getCheckinLeaderboard(),
    staleTime: USAGE_STALE_TIME,
    gcTime: 10 * 60 * 1000,
  })
}
