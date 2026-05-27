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
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { getLegalConsentItems } from '../lib/legal-status'
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
  const { t } = useTranslation()
  const text =
    variant === 'sign-in'
      ? 'By clicking sign in, you agree to our'
      : 'By creating an account, you agree to our'

  const consentItems = getLegalConsentItems(status ?? null)

  return (
    <p className={cn('text-muted-foreground text-center text-xs', className)}>
      {text}{' '}
      {consentItems.map((item, index) => (
        <span key={item.label}>
          {index > 0 && ` ${t('and')} `}
          {item.href ? (
            <a
              href={item.href}
              className='hover:text-primary underline underline-offset-4'
            >
              {t(item.label)}
            </a>
          ) : (
            <span>{t(item.label)}</span>
          )}
        </span>
      ))}
      .
    </p>
  )
}
