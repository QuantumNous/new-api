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
import { Trans } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface TermsFooterProps {
  variant?: 'sign-in' | 'sign-up'
  className?: string
  status?: SystemStatus | null
}

export function TermsFooter({
  variant = 'sign-in',
  className,
  status,
}: TermsFooterProps) {
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  let messageKey =
    variant === 'sign-in'
      ? 'By clicking sign in, you agree to our <privacyPolicy>Privacy Policy</privacyPolicy>.'
      : 'By creating an account, you agree to our <privacyPolicy>Privacy Policy</privacyPolicy>.'
  if (hasUserAgreement && hasPrivacyPolicy) {
    messageKey =
      variant === 'sign-in'
        ? 'By clicking sign in, you agree to our <userAgreement>User Agreement</userAgreement> and <privacyPolicy>Privacy Policy</privacyPolicy>.'
        : 'By creating an account, you agree to our <userAgreement>User Agreement</userAgreement> and <privacyPolicy>Privacy Policy</privacyPolicy>.'
  } else if (hasUserAgreement) {
    messageKey =
      variant === 'sign-in'
        ? 'By clicking sign in, you agree to our <userAgreement>User Agreement</userAgreement>.'
        : 'By creating an account, you agree to our <userAgreement>User Agreement</userAgreement>.'
  }

  return (
    <p className={cn('text-muted-foreground text-center text-xs', className)}>
      <Trans
        i18nKey={messageKey}
        components={{
          userAgreement: (
            <a
              href='/user-agreement'
              className='hover:text-primary underline underline-offset-4'
            />
          ),
          privacyPolicy: (
            <a
              href='/privacy-policy'
              className='hover:text-primary underline underline-offset-4'
            />
          ),
        }}
      />
    </p>
  )
}
