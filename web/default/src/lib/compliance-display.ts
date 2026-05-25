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
import i18next from 'i18next'

export type ComplianceToastContext = 'redemption' | 'payment' | 'quota' | 'general'

const COMPLIANCE_ERROR_PATTERNS = [
  /compliance/i,
  /合规/,
  /payment\.compliance_required/,
  /兑换码/,
  /redemption/i,
  /subscription/i,
  /订阅/,
  /邀请返利/,
  /invitation reward/i,
]

export function isPaymentComplianceErrorMessage(message?: string): boolean {
  if (!message?.trim()) return false
  return COMPLIANCE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

export function resolveComplianceErrorMessage(
  message: string | undefined,
  context: ComplianceToastContext = 'general'
): string {
  if (!isPaymentComplianceErrorMessage(message)) {
    return message?.trim() || i18next.t('Something went wrong!')
  }

  switch (context) {
    case 'redemption':
      return i18next.t(
        'Redemption feature is disabled until the administrator completes compliance confirmation to enable resource redemption.'
      )
    case 'payment':
      return i18next.t(
        'Payment features are not enabled yet. Ask an administrator to complete compliance confirmation in Platform Configuration Center.'
      )
    case 'quota':
      return i18next.t(
        'Non-zero invitation rewards require compliance confirmation in Payment Gateway settings.'
      )
    default:
      return i18next.t(
        'Payment, redemption, and subscription features are not enabled yet. Ask an administrator to complete compliance confirmation in Platform Configuration Center.'
      )
  }
}
