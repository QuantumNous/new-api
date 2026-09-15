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
import utc from 'dayjs/plugin/utc'
import { useEffect, useState } from 'react'

import dayjs from '@/lib/dayjs'
import { useAuthStore } from '@/stores/auth-store'

import { getUserLogSummary } from '../api'

dayjs.extend(utc)

export function useUsageSummary(days: 1 | 7 | 10) {
  const userId = useAuthStore((state) => state.auth.user?.id)
  // Match the server's fixed-offset day buckets, including across DST changes.
  const [now, setNow] = useState(() => dayjs())

  useEffect(() => {
    const nextMidnight = now.add(1, 'day').startOf('day')
    const timer = window.setTimeout(
      () => setNow(dayjs()),
      Math.max(1, nextMidnight.valueOf() - now.valueOf())
    )
    return () => window.clearTimeout(timer)
  }, [now])

  const timezoneOffset = now.utcOffset()
  const today = dayjs.utc(now.format('YYYY-MM-DD'))
  const start = today
    .subtract(days - 1, 'day')
    .subtract(timezoneOffset, 'minute')
    .utcOffset(timezoneOffset)
  const end = today
    .endOf('day')
    .subtract(timezoneOffset, 'minute')
    .utcOffset(timezoneOffset)
  const query = useQuery({
    queryKey: [
      'terminal',
      'usage-summary',
      userId,
      start.unix(),
      end.unix(),
      timezoneOffset,
    ],
    queryFn: () =>
      getUserLogSummary({
        start_timestamp: start.unix(),
        end_timestamp: end.unix(),
        timezone_offset: timezoneOffset,
      }),
    staleTime: 60000,
  })
  return { ...query, start, end }
}
