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
import type { StartVerificationOptions } from './types'

type SecureVerificationRequest<T> = {
  apiCall: () => Promise<T>
  options?: StartVerificationOptions
}

type SecureVerificationHandler = <T>(
  request: SecureVerificationRequest<T>
) => Promise<T>

let handler: SecureVerificationHandler | null = null

export function registerSecureVerificationHandler(
  nextHandler: SecureVerificationHandler
) {
  handler = nextHandler

  return () => {
    if (handler === nextHandler) {
      handler = null
    }
  }
}

export function requestSecureVerification<T>(
  apiCall: () => Promise<T>,
  options?: StartVerificationOptions
) {
  if (!handler) {
    return Promise.reject(new Error('Secure verification is not ready'))
  }

  return handler({ apiCall, options })
}
