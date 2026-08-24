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
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  canApplyEmailVerificationStatus,
  clearVerificationForEmailChange,
  createEmailVerificationState,
  isVerificationCodeRequired,
  isVerifiedEmail,
  markEmailSent,
  markEmailVerified,
} from './email-verification-state'

const signUpFormSource = readFileSync(
  new URL('../components/sign-up-form.tsx', import.meta.url),
  'utf8'
)

describe('registration email verification state', () => {
  test('binds verified status to the exact trimmed email', () => {
    const sent = markEmailSent(
      createEmailVerificationState(),
      '  user@example.com  '
    )
    const verified = markEmailVerified(sent, 'user@example.com')

    expect(verified.sentEmail).toBe('user@example.com')
    expect(isVerifiedEmail(verified, ' user@example.com ')).toBe(true)
    expect(isVerifiedEmail(verified, 'other@example.com')).toBe(false)
  })

  test('clears verified status when the email changes', () => {
    const verified = markEmailVerified(
      markEmailSent(createEmailVerificationState(), 'user@example.com'),
      'user@example.com'
    )

    expect(
      clearVerificationForEmailChange(verified, 'other@example.com')
        .verifiedEmail
    ).toBe('')
  })

  test('clears a stale verification code when the email changes', () => {
    expect(signUpFormSource).toMatch(
      /onChange=\{\(event\) => \{[\s\S]*?setVerificationCode\(''\)[\s\S]*?clearVerificationForEmailChange/
    )
  })

  test('does not require a code for the matching verified email', () => {
    const verified = markEmailVerified(
      markEmailSent(createEmailVerificationState(), 'user@example.com'),
      'user@example.com'
    )

    expect(isVerificationCodeRequired(verified, ' user@example.com ')).toBe(
      false
    )
  })

  test('still requires a code for an unverified email', () => {
    const state = markEmailSent(
      createEmailVerificationState(),
      'user@example.com'
    )

    expect(isVerificationCodeRequired(state, 'user@example.com')).toBe(true)
    expect(isVerificationCodeRequired(state, 'other@example.com')).toBe(true)
  })

  test('rejects a stale status response after the email changes', () => {
    const state = markEmailSent(
      createEmailVerificationState(),
      'user@example.com'
    )

    expect(
      canApplyEmailVerificationStatus(
        state,
        'other@example.com',
        'user@example.com'
      )
    ).toBe(false)
    expect(
      canApplyEmailVerificationStatus(
        state,
        ' user@example.com ',
        'user@example.com'
      )
    ).toBe(true)
  })
})
