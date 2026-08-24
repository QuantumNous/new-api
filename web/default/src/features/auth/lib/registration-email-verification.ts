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
declare global {
  interface Window {
    __registrationEmailVerificationRequest?: Promise<unknown>
  }
}

let bootstrappedRegistrationEmailRequest: Promise<unknown> | null | undefined

export function consumeRegistrationEmailVerificationRequest(): Promise<unknown> | null {
  if (bootstrappedRegistrationEmailRequest !== undefined) {
    return bootstrappedRegistrationEmailRequest
  }
  if (typeof window === 'undefined') return null

  bootstrappedRegistrationEmailRequest =
    window.__registrationEmailVerificationRequest ?? null
  delete window.__registrationEmailVerificationRequest
  return bootstrappedRegistrationEmailRequest
}

export type EmailVerificationScreenState =
  | 'verifying'
  | 'verified'
  | 'unavailable'

export async function resolveRegistrationEmailVerification(
  request: Promise<unknown> | null
): Promise<EmailVerificationScreenState> {
  if (!request) return 'unavailable'

  try {
    const response = await request
    return isRegistrationEmailVerified(response) ? 'verified' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export function startRegistrationEmailVerificationEffect(
  request: Promise<unknown> | null,
  onResolved: (state: EmailVerificationScreenState) => void
): () => void {
  let active = true
  void resolveRegistrationEmailVerification(request).then((nextState) => {
    if (active) onResolved(nextState)
  })
  return () => {
    active = false
  }
}

export function isRegistrationEmailVerified(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false

  const envelope = response as Record<string, unknown>
  if (envelope.success !== true) return false
  if (!envelope.data || typeof envelope.data !== 'object') return false

  const data = envelope.data as Record<string, unknown>
  return data.verified === true
}
