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
import { useEffect, useState } from 'react'
import { OPS_DATA_REFETCH_INTERVAL_MS } from '@/lib/query-polling'
import { computeTimeRange } from '@/lib/time'

/** Recomputes a rolling time window on the ops dashboard polling interval. */
export function useOpsRollingTimeRange(days: number) {
  const [timeRange, setTimeRange] = useState(() => computeTimeRange(days))

  useEffect(() => {
    const tick = () => setTimeRange(computeTimeRange(days))
    const intervalId = window.setInterval(tick, OPS_DATA_REFETCH_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [days])

  return timeRange
}
