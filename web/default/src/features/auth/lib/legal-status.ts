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
import type { SystemStatus } from '@/features/auth/types'

export interface LegalStatus {
  hasUserAgreement: boolean
  hasPrivacyPolicy: boolean
  requiresLegalConsent: boolean
}

export interface LegalConsentItem {
  label: string
  href?: string
}

function readBoolean(status: SystemStatus | null | undefined, key: string): boolean {
  const directValue = status?.[key]
  const nestedValue = status?.data?.[key]
  return toBoolean(directValue) || toBoolean(nestedValue)
}

function toBoolean(value: unknown): boolean {
  if (value === true) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
  }
  if (typeof value === 'number') return value === 1
  return false
}

/**
 * Resolve legal-document flags from both flattened `/api/status` data and the
 * older nested response shape. This keeps auth forms stable across cached
 * status payloads and API adapters.
 */
export function getLegalStatus(status?: SystemStatus | null): LegalStatus {
  const hasUserAgreement = readBoolean(status, 'user_agreement_enabled')
  const hasPrivacyPolicy = readBoolean(status, 'privacy_policy_enabled')

  return {
    hasUserAgreement,
    hasPrivacyPolicy,
    requiresLegalConsent: true,
  }
}

/**
 * Build the consent text targets shown in auth forms. When legal documents are
 * not configured yet, the consent block must still remain visible and required.
 */
export function getLegalConsentItems(
  status?: SystemStatus | null
): LegalConsentItem[] {
  const { hasUserAgreement, hasPrivacyPolicy } = getLegalStatus(status)
  const items: LegalConsentItem[] = []

  if (hasUserAgreement) {
    items.push({
      label: 'User Agreement',
      href: '/user-agreement',
    })
  }

  if (hasPrivacyPolicy) {
    items.push({
      label: 'Privacy Policy',
      href: '/privacy-policy',
    })
  }

  if (items.length === 0) {
    items.push({
      label: 'Platform Terms',
    })
  }

  return items
}
