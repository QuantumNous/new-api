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

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestampToDate } from '@/lib/format'
import { resolveLocalizedText } from '@/lib/localized-text'
import { cn } from '@/lib/utils'

import type { ChannelBalanceResult } from '../types'

type ChannelBalanceDetailsProps = {
  result?: ChannelBalanceResult | null
  /** Unix seconds of the last query; 0 when never queried. */
  updatedTime?: number
  className?: string
}

/**
 * The limits of a balance with their reset times, when it was last queried
 * and the last query error, one line each.
 */
export function ChannelBalanceDetails(props: ChannelBalanceDetailsProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const windows = props.result?.windows ?? []
  const error = props.result?.error?.trim()
  if (windows.length === 0 && !props.updatedTime && !error) return null

  return (
    <ul className={cn('space-y-0.5 text-xs', props.className)}>
      {windows.map((window) => (
        <li key={JSON.stringify(window)}>
          {resolveLocalizedText(window.name, i18n.language) || t('Limit')}:{' '}
          {formatNumber(window.used, locale)} /{' '}
          {formatNumber(window.limit, locale)}
          {window.unit ? ` ${window.unit}` : ''}
          {window.resetAt ? (
            <>
              {' · '}
              {t('Reset at:')} {formatTimestampToDate(window.resetAt)}
            </>
          ) : null}
        </li>
      ))}
      {props.updatedTime ? (
        <li>
          {t('Last updated:')} {formatTimestampToDate(props.updatedTime)}
        </li>
      ) : null}
      {error && (
        <li className='wrap-anywhere'>
          {t('Last error:')} {error}
        </li>
      )}
    </ul>
  )
}
