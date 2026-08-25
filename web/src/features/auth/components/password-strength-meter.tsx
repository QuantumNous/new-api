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
import type { ReactElement } from 'react'

import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import {
  PASSWORD_MIN_STRENGTH_SCORE,
  passwordStrength,
} from '../lib/password-strength'

interface PasswordStrengthMeterProps {
  value: string
}

export function PasswordStrengthMeter(
  props: PasswordStrengthMeterProps
): ReactElement | null {
  const { t } = useTranslation()
  if (!props.value) return null

  const strength = passwordStrength(props.value)
  const segments = [1, 2, 3, 4]
  const isBelowMinimum = strength.score < PASSWORD_MIN_STRENGTH_SCORE

  return (
    <div className='space-y-1.5'>
      <div
        role='progressbar'
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength.score}
        aria-label={t('Password strength')}
        aria-valuetext={t(strength.labelKey)}
        className='flex gap-1'
      >
        {segments.map((segment) => (
          <div
            key={segment}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              segment <= strength.score ? strength.color : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className='text-xs' aria-live='polite'>
        <span className={cn('font-medium', strength.color)}>
          {t(strength.labelKey)}
        </span>
        {isBelowMinimum && (
          <>
            <span className='text-muted-foreground'> · </span>
            <span className='text-muted-foreground'>
              {t('Use at least 3 of letters, numbers and symbols')}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
