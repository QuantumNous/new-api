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
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { StatusBadge } from '@/components/status-badge'
import { toIntlLocale } from '@/i18n/languages'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatNumber, formatTimestampToDate } from '@/lib/format'

import { getPaymentProviderLabel, getPaymentStatusBadge } from '../constants'
import type { PaymentLogEntry } from '../types'

export function usePaymentLogColumns(): ColumnDef<PaymentLogEntry>[] {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return [
    {
      accessorKey: 'trade_no',
      header: t('Transaction Reference'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <div className='flex max-w-[300px] min-w-[220px] items-center gap-1'>
          <span
            className='truncate font-mono text-sm'
            title={row.original.trade_no}
            dir='ltr'
          >
            {row.original.trade_no}
          </span>
          <CopyButton
            value={row.original.trade_no}
            tooltip={t('Copy transaction reference')}
            aria-label={t('Copy transaction reference')}
            className='h-6 w-6'
            iconClassName='size-3.5'
          />
        </div>
      ),
      size: 300,
    },
    {
      accessorKey: 'user_email',
      header: t('User'),
      meta: { mobileOrder: 20 },
      cell: ({ row }) => {
        const entry = row.original
        const primary =
          entry.user_email || entry.username || `#${entry.user_id}`
        return (
          <div className='flex min-w-[180px] flex-col gap-0.5'>
            <span className='truncate text-sm font-medium' dir='ltr'>
              {primary}
            </span>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {t('User ID')}: {entry.user_id}
            </span>
          </div>
        )
      },
      size: 220,
    },
    {
      accessorKey: 'payment_provider',
      header: t('Payment gateway'),
      meta: { mobileOrder: 30 },
      cell: ({ row }) => (
        <div className='flex min-w-[130px] flex-col gap-0.5'>
          <span className='text-sm font-medium'>
            {getPaymentProviderLabel(row.original.payment_provider, t)}
          </span>
          {row.original.payment_method && (
            <span className='text-muted-foreground text-xs'>
              {row.original.payment_method}
            </span>
          )}
        </div>
      ),
      filterFn: (row, id, value) =>
        (value as string[]).includes(String(row.getValue(id))),
      size: 150,
    },
    {
      accessorKey: 'amount',
      header: t('Credited amount'),
      meta: { mobileOrder: 40 },
      cell: ({ row }) => (
        <span className='text-sm font-semibold tabular-nums' dir='ltr'>
          {formatCurrencyFromUSD(row.original.amount, {
            digitsLarge: 2,
            digitsSmall: 2,
            abbreviate: false,
            locale,
          })}
        </span>
      ),
      size: 150,
    },
    {
      accessorKey: 'money',
      header: t('Paid amount'),
      meta: { mobileOrder: 50 },
      cell: ({ row }) => (
        <span className='text-sm tabular-nums' dir='ltr'>
          {formatNumber(row.original.money, locale)}
        </span>
      ),
      size: 130,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const badge = getPaymentStatusBadge(row.original.status, t)
        return (
          <StatusBadge
            label={badge.label}
            variant={badge.variant}
            copyable={false}
            className='-ms-1.5'
          />
        )
      },
      filterFn: (row, id, value) =>
        (value as string[]).includes(String(row.getValue(id))),
      size: 120,
    },
    {
      accessorKey: 'create_time',
      header: t('Created'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <div className='min-w-[160px] font-mono text-sm' dir='ltr'>
          {formatTimestampToDate(row.original.create_time)}
        </div>
      ),
      size: 180,
    },
  ]
}
