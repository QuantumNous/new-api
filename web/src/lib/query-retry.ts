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
import axios from 'axios'

const MAX_TRANSIENT_RETRIES = 2

function getHttpStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) return error.response?.status
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined
  }

  const status = Number(error.status)
  return Number.isInteger(status) ? status : undefined
}

export function shouldRetryQuery(
  failureCount: number,
  error: unknown
): boolean {
  const status = getHttpStatus(error)
  if (status !== undefined && status >= 400 && status < 500) {
    return false
  }

  return failureCount < MAX_TRANSIENT_RETRIES
}
