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

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatTimestampToDate } from '@/lib/format'

import { MARKET_MODEL_STATUSES, formatMarketPrice } from '../constants'
import type { MarketModel } from '../types'
import { MarketModelsRowActions } from './market-models-row-actions'

export function useMarketModelsColumns(): ColumnDef<MarketModel>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        return (
          <TableId value={row.getValue('id') as number} className='w-[60px]' />
        )
      },
      size: 80,
    },
    {
      accessorKey: 'model',
      header: t('Model'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.getValue('model')}</span>
      ),
      size: 200,
    },
    {
      accessorKey: 'provider',
      header: t('Provider'),
      cell: ({ row }) => {
        const provider = row.getValue('provider') as string
        return <span>{provider || '-'}</span>
      },
      size: 140,
    },
    {
      accessorKey: 'category',
      header: t('Category'),
      cell: ({ row }) => {
        const category = row.getValue('category') as string
        return (
          <StatusBadge
            label={category}
            variant='neutral'
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 140,
    },
    {
      accessorKey: 'input_price',
      header: t('Input Price'),
      cell: ({ row }) => {
        const mm = row.original
        return <span>{formatMarketPrice(mm.input_price, mm.currency)}</span>
      },
      size: 130,
    },
    {
      accessorKey: 'output_price',
      header: t('Output Price'),
      cell: ({ row }) => {
        const mm = row.original
        return <span>{formatMarketPrice(mm.output_price, mm.currency)}</span>
      },
      size: 130,
    },
    {
      accessorKey: 'unit',
      header: t('Unit'),
      cell: ({ row }) => (
        <span className='text-muted-foreground text-sm'>
          {row.getValue('unit')}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: 'featured',
      header: t('Featured'),
      cell: ({ row }) => {
        const featured = row.getValue('featured') as boolean
        if (!featured) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        return (
          <StatusBadge
            label={t('Yes')}
            variant='success'
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 100,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const statusValue = row.getValue('status') as number
        const statusConfig = MARKET_MODEL_STATUSES[statusValue]

        if (!statusConfig) {
          return null
        }

        return (
          <StatusBadge
            label={t(statusConfig.labelKey)}
            variant={statusConfig.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 120,
    },
    {
      accessorKey: 'created_at',
      header: t('Created'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        return (
          <div className='min-w-[160px] font-mono text-sm'>
            {formatTimestampToDate(row.getValue('created_at'))}
          </div>
        )
      },
      size: 180,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <MarketModelsRowActions row={row} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
