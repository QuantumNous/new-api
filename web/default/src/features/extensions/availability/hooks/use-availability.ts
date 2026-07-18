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

import { useStatus } from '@/hooks/use-status'

import { getExtensionsAvailability } from '../api'

const DEFAULT_REFRESH_SECONDS = 10
const MIN_REFRESH_SECONDS = 5
const MAX_REFRESH_SECONDS = 3600

export function resolveAvailabilityRefreshSeconds(
  raw: unknown
): number {
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : NaN
  if (!Number.isFinite(value)) {
    return DEFAULT_REFRESH_SECONDS
  }
  const seconds = Math.trunc(value)
  if (seconds < MIN_REFRESH_SECONDS) {
    return MIN_REFRESH_SECONDS
  }
  if (seconds > MAX_REFRESH_SECONDS) {
    return MAX_REFRESH_SECONDS
  }
  return seconds
}

export function useAvailability() {
  const { status } = useStatus()
  const refreshSeconds = resolveAvailabilityRefreshSeconds(
    status?.availability_monitor_refresh_interval ??
      status?.data?.availability_monitor_refresh_interval
  )
  const refreshMs = refreshSeconds * 1000

  const query = useQuery({
    queryKey: ['extensions-availability'],
    queryFn: getExtensionsAvailability,
    refetchInterval: refreshMs,
    staleTime: refreshMs / 2,
  })

  return { ...query, refreshSeconds }
}
