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
import { getRollingDateRange } from '@/lib/time'

export type CodexLimitReportTimeRange = {
  start_timestamp: number
  end_timestamp: number
}

export function buildCodexLimitReportTimeRange(
  days: number,
  fromDate?: Date
): CodexLimitReportTimeRange {
  const { start, end } = getRollingDateRange(days, fromDate)
  return {
    start_timestamp: Math.floor(start.getTime() / 1000),
    end_timestamp: Math.floor(end.getTime() / 1000),
  }
}

export function isSameCodexLimitReportTimeRange(
  current: CodexLimitReportTimeRange,
  next: CodexLimitReportTimeRange
): boolean {
  return (
    current.start_timestamp === next.start_timestamp &&
    current.end_timestamp === next.end_timestamp
  )
}
