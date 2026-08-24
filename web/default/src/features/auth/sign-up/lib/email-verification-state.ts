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

export interface EmailVerificationState {
  sentEmail: string
  verifiedEmail: string
}

function normalizeEmail(email: string): string {
  return email.trim()
}

export function createEmailVerificationState(): EmailVerificationState {
  return { sentEmail: '', verifiedEmail: '' }
}

export function markEmailSent(
  state: EmailVerificationState,
  email: string
): EmailVerificationState {
  const sentEmail = normalizeEmail(email)
  return {
    sentEmail,
    verifiedEmail: state.verifiedEmail === sentEmail ? state.verifiedEmail : '',
  }
}

export function markEmailVerified(
  state: EmailVerificationState,
  email: string
): EmailVerificationState {
  const verifiedEmail = normalizeEmail(email)
  if (!verifiedEmail || state.sentEmail !== verifiedEmail) return state

  return { ...state, verifiedEmail }
}

export function markEmailUnverified(
  state: EmailVerificationState,
  email: string
): EmailVerificationState {
  if (state.verifiedEmail !== normalizeEmail(email)) return state
  return { ...state, verifiedEmail: '' }
}

export function canApplyEmailVerificationStatus(
  state: EmailVerificationState,
  currentEmail: string,
  checkedEmail: string
): boolean {
  const normalizedCheckedEmail = normalizeEmail(checkedEmail)
  return (
    Boolean(normalizedCheckedEmail) &&
    state.sentEmail === normalizedCheckedEmail &&
    normalizeEmail(currentEmail) === normalizedCheckedEmail
  )
}

export function clearVerificationForEmailChange(
  state: EmailVerificationState,
  email: string
): EmailVerificationState {
  if (state.verifiedEmail === normalizeEmail(email)) return state
  if (!state.verifiedEmail) return state
  return { ...state, verifiedEmail: '' }
}

export function isVerifiedEmail(
  state: EmailVerificationState,
  email: string
): boolean {
  const normalizedEmail = normalizeEmail(email)
  return Boolean(normalizedEmail) && state.verifiedEmail === normalizedEmail
}

export function isVerificationCodeRequired(
  state: EmailVerificationState,
  email: string
): boolean {
  return !isVerifiedEmail(state, email)
}
