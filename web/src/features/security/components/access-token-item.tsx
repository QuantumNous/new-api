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
import { History, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { toIntlLocale } from '@/i18n/languages'
import { formatGregorianTitle } from '@/lib/format'

import type { AccessTokenItem as AccessToken } from '../api'

const VISIBLE_RESOURCE_BADGES = 3

interface AccessTokenItemProps {
  token: AccessToken
  /** Label keys of the catalog resources, keyed by resource. */
  resourceLabels: ReadonlyMap<string, string>
  formatTime: (seconds: number) => string
  now: number
  disabled: boolean
  /** False while the permission catalog needed for editing is unavailable. */
  canEdit: boolean
  onEdit: (token: AccessToken) => void
  onShowRecords: (token: AccessToken) => void
  onRevoke: (token: AccessToken) => void
}

export function AccessTokenItem(props: AccessTokenItemProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const token = props.token
  const resources = [
    ...new Set(token.scopes.map((scope) => scope.split(':', 1)[0])),
  ]
  // Resources the catalog no longer offers are only counted, never shown by key.
  const labels = resources.flatMap((resource) => {
    const label = props.resourceLabels.get(resource)
    return label ? [t(label)] : []
  })
  const hiddenCount =
    resources.length - Math.min(labels.length, VISIBLE_RESOURCE_BADGES)
  let expiry = (
    <span title={formatGregorianTitle(token.expires_at, locale)}>
      {t('Expires {{time}}', { time: props.formatTime(token.expires_at) })}
    </span>
  )
  if (token.expires_at === 0) {
    expiry = <span className='text-warning'>{t('Never expires')}</span>
  } else if (token.expires_at * 1000 <= props.now) {
    expiry = <span className='text-destructive'>{t('Expired')}</span>
  }
  let lastUsed = t('Never used')
  if (token.last_used_at) {
    lastUsed = t('Last used {{time}}', {
      time: props.formatTime(token.last_used_at),
    })
    if (token.last_used_ip) lastUsed += ` · ${token.last_used_ip}`
  }

  return (
    <div className='flex items-start gap-3 py-3'>
      <div className='min-w-0 flex-1 space-y-1.5'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
          <p className='font-medium break-all'>{token.name}</p>
          <code className='text-muted-foreground text-xs'>
            nap_…{token.token_hint}
          </code>
        </div>
        <div className='flex flex-wrap gap-1'>
          {labels.slice(0, VISIBLE_RESOURCE_BADGES).map((label) => (
            <Badge key={label} variant='secondary'>
              {label}
            </Badge>
          ))}
          {hiddenCount > 0 && <Badge variant='outline'>+{hiddenCount}</Badge>}
        </div>
        <p className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs'>
          <span title={formatGregorianTitle(token.created_at, locale)}>
            {t('Created {{time}}', {
              time: props.formatTime(token.created_at),
            })}
          </span>
          {expiry}
          <span
            className='break-all'
            title={formatGregorianTitle(token.last_used_at, locale)}
          >
            {lastUsed}
          </span>
        </p>
      </div>
      <DataTableRowActionMenu ariaLabel={t('Open menu')}>
        <DropdownMenuItem
          disabled={props.disabled || !props.canEdit}
          onClick={() => props.onEdit(token)}
        >
          {t('Edit')}
          <DropdownMenuShortcut>
            <Pencil size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => props.onShowRecords(token)}>
          {t('Access records')}
          <DropdownMenuShortcut>
            <History size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={props.disabled}
          className='text-destructive focus:text-destructive'
          onClick={() => props.onRevoke(token)}
        >
          {t('Revoke')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>
    </div>
  )
}
