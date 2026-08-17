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

export function getCurrentReportMonth(): string {
  return dayjs().format('YYYY-MM')
}

export function parseReportMonth(value: string): {
  year: number
  month: number
} {
  const [year, month] = value.split('-').map(Number)
  return { year, month }
}

export function formatDong(amount: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(amount)
}
