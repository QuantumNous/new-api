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
import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { resolveLocalizedText } from '@/lib/localized-text'

import type { MarketplaceRevokedEntry } from '../types'

/** Tells the administrator that the installed code was taken down, and why. */
export function RevokedPluginWarning(props: {
  entry?: MarketplaceRevokedEntry
}) {
  const { t, i18n } = useTranslation()
  if (!props.entry) return null
  const reason = resolveLocalizedText(props.entry.reason, i18n.language)
  return (
    <p
      role='alert'
      className='text-destructive flex min-w-60 items-start gap-1.5 text-sm font-medium whitespace-normal'
    >
      <TriangleAlert className='mt-0.5 size-4 shrink-0' aria-hidden='true' />
      <span className='min-w-0'>
        {t('This version was taken down from community plugins.')}
        {reason && <> {t('Reason: {{reason}}', { reason })}</>}
      </span>
    </p>
  )
}
