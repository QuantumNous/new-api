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
import type { AxiosError } from 'axios'

export interface VerificationRequiredInfo {
  code?: string
  message: string
  required: boolean
}

/**
 * Determine whether an Axios error indicates secure verification is required.
 */
export function isVerificationRequiredError(
  error: unknown
): error is AxiosError {
  if (!error || typeof error !== 'object') return false
  const axiosError = error as AxiosError<{ code?: string }>
  const status = axiosError.response?.status
  if (status !== 403) return false

  const code = axiosError.response?.data?.code
  if (!code) return false

  const verificationCodes = new Set([
    'VERIFICATION_REQUIRED',
    'VERIFICATION_EXPIRED',
    'VERIFICATION_INVALID',
  ])

  return verificationCodes.has(code)
}

/**
 * Extract verification requirement info from an Axios error.
 */
export function extractVerificationInfo(
  error: unknown
): VerificationRequiredInfo {
  const axiosError = error as AxiosError<{ code?: string; message?: string }>
  const code = axiosError.response?.data?.code
  const message =
    axiosError.response?.data?.message ?? 'Secure verification is required'

  return {
    code,
    message,
    required: true,
  }
}
