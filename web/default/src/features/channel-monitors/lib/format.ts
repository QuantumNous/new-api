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

import dayjs from 'dayjs'

export function formatMonitorAvailability(value: number | null): string {
  return value == null ? '--' : `${value.toFixed(2)}%`
}

export function formatMonitorTime(value: number | null): string {
  return value == null ? '--' : dayjs.unix(value).format('YYYY-MM-DD HH:mm:ss')
}

export function getMonitorApiHost(apiURL: string): string {
  try {
    return new URL(apiURL).host
  } catch {
    return apiURL
  }
}
