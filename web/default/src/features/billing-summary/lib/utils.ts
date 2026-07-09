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
import dayjs from '@/lib/dayjs'

// Default view: last 7 days, matching the page's "最近7天" quick preset.
export function getDefaultBillingTimeRange(): { start: Date; end: Date } {
  const now = dayjs()
  return {
    start: now.subtract(6, 'day').startOf('day').toDate(),
    end: now.endOf('day').toDate(),
  }
}
