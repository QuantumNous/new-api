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
const FALLBACK_CSV_FILENAME = 'usage-logs.csv'

function safeCsvFilename(value: string): string {
  const basename = value
    .split(/[\\/]/)
    .pop()
    ?.replaceAll(/\p{Cc}/gu, '')
  if (!basename) return FALLBACK_CSV_FILENAME
  return basename.toLowerCase().endsWith('.csv') ? basename : `${basename}.csv`
}

export function getCsvFilename(contentDisposition?: string): string {
  if (!contentDisposition) return FALLBACK_CSV_FILENAME

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return safeCsvFilename(decodeURIComponent(encodedMatch[1].trim()))
    } catch {
      return safeCsvFilename(encodedMatch[1].trim())
    }
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return filenameMatch?.[1]
    ? safeCsvFilename(filenameMatch[1].trim())
    : FALLBACK_CSV_FILENAME
}
