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

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface LegalConsentProps {
  status: SystemStatus | null
  checked: boolean
  onCheckedChange: (nextValue: boolean) => void
  className?: string
}

export function LegalConsent({
  status,
  checked,
  onCheckedChange,
  className,
}: LegalConsentProps) {
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  const handleChange = (value: boolean) => {
    onCheckedChange(value === true)
  }

  let messageKey =
    'I have read and agree to the <privacyPolicy>Privacy Policy</privacyPolicy>.'
  if (hasUserAgreement && hasPrivacyPolicy) {
    messageKey =
      'I have read and agree to the <userAgreement>User Agreement</userAgreement> and <privacyPolicy>Privacy Policy</privacyPolicy>.'
  } else if (hasUserAgreement) {
    messageKey =
      'I have read and agree to the <userAgreement>User Agreement</userAgreement>.'
  }

  return (
    <div
      className={cn(
        'border-border/60 bg-muted/40 flex items-start gap-3 rounded-md border p-3',
        className
      )}
    >
      <Checkbox
        id='legal-consent'
        checked={checked}
        onCheckedChange={handleChange}
        className='mt-0.5'
      />
      <Label
        htmlFor='legal-consent'
        className='text-muted-foreground items-start gap-1 text-left text-xs leading-5 font-normal'
      >
        <span>
          <Trans
            i18nKey={messageKey}
            components={{
              userAgreement: (
                <a
                  href='/user-agreement'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline'
                />
              ),
              privacyPolicy: (
                <a
                  href='/privacy-policy'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline'
                />
              ),
            }}
          />
        </span>
      </Label>
    </div>
  )
}
