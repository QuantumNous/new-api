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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { SystemStatus } from '@/features/auth/types'
import { getLegalConsentItems, getLegalStatus } from './legal-status.ts'

describe('getLegalStatus', () => {
  test('reads flattened /api/status legal flags', () => {
    assert.deepEqual(
      getLegalStatus({
        user_agreement_enabled: true,
        privacy_policy_enabled: false,
      }),
      {
        hasUserAgreement: true,
        hasPrivacyPolicy: false,
        requiresLegalConsent: true,
      }
    )
  })

  test('reads nested cached response legal flags', () => {
    assert.deepEqual(
      getLegalStatus({
        data: {
          user_agreement_enabled: false,
          privacy_policy_enabled: true,
        },
      }),
      {
        hasUserAgreement: false,
        hasPrivacyPolicy: true,
        requiresLegalConsent: true,
      }
    )
  })

  test('requires legal consent even when documents are not configured', () => {
    assert.deepEqual(getLegalStatus(null), {
      hasUserAgreement: false,
      hasPrivacyPolicy: false,
      requiresLegalConsent: true,
    })
  })

  test('accepts boolean-like values from cached status payloads', () => {
    assert.deepEqual(
      getLegalStatus({
        user_agreement_enabled: 'true',
        data: {
          privacy_policy_enabled: 1,
        },
      } as unknown as SystemStatus),
      {
        hasUserAgreement: true,
        hasPrivacyPolicy: true,
        requiresLegalConsent: true,
      }
    )
  })
})

describe('getLegalConsentItems', () => {
  test('keeps a non-linked fallback item when legal documents are disabled', () => {
    assert.deepEqual(getLegalConsentItems(null), [
      {
        label: 'Platform Terms',
      },
    ])
  })

  test('uses configured legal document links when available', () => {
    assert.deepEqual(
      getLegalConsentItems({
        user_agreement_enabled: true,
        privacy_policy_enabled: true,
      }),
      [
        {
          label: 'User Agreement',
          href: '/user-agreement',
        },
        {
          label: 'Privacy Policy',
          href: '/privacy-policy',
        },
      ]
    )
  })
})
