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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatQuota } from '@/lib/format'

import { formatDuration, formatResetPeriod } from '../lib'
import type { PlanRecord } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useSubscriptionsColumns(): ColumnDef<PlanRecord>[] {
  const { t } = useTranslation()

  return useMemo(
    (): ColumnDef<PlanRecord>[] => [
      {
        accessorFn: (row) => row.plan.id,
        id: 'id',
        header: t('ID'),
        meta: {
          cardRole: 'secondary',
          cardOrder: 10,
          cardSpan: 2,
          contentMode: 'full',
        },
        cell: ({ row }) => <TableId value={row.original.plan.id} />,
        size: 60,
      },
      {
        accessorFn: (row) => row.plan.title,
        id: 'title',
        header: t('Plan'),
        meta: {
          cardRole: 'title',
          cardSpan: 2,
          contentMode: 'wrap',
        },
        cell: ({ row }) => {
          const plan = row.original.plan
          return (
            <div className='max-w-full min-w-0'>
              <div className='font-medium'>{plan.title}</div>
              {plan.subtitle && (
                <div className='text-muted-foreground text-xs'>
                  {plan.subtitle}
                </div>
              )}
            </div>
          )
        },
        size: 200,
      },
      {
        accessorFn: (row) => row.plan.price_amount,
        id: 'price',
        header: t('Price'),
        meta: {
          cardRole: 'primary',
          cardOrder: 10,
          contentMode: 'full',
        },
        cell: ({ row }) => (
          <span className='text-success font-semibold'>
            ${Number(row.original.plan.price_amount || 0).toFixed(2)}
          </span>
        ),
        size: 100,
      },
      {
        id: 'duration',
        header: t('Validity'),
        meta: {
          cardRole: 'primary',
          cardOrder: 20,
          contentMode: 'wrap',
        },
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatDuration(row.original.plan, t)}
          </span>
        ),
        size: 100,
      },
      {
        id: 'reset',
        header: t('Quota Reset'),
        meta: {
          cardRole: 'secondary',
          cardOrder: 20,
          contentMode: 'wrap',
        },
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatResetPeriod(row.original.plan, t)}
          </span>
        ),
        size: 100,
      },
      {
        accessorFn: (row) => row.plan.sort_order,
        id: 'sort_order',
        header: t('Priority'),
        meta: {
          cardRole: 'secondary',
          cardOrder: 30,
          contentMode: 'full',
        },
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.original.plan.sort_order}
          </span>
        ),
        size: 100,
      },
      {
        accessorFn: (row) => row.plan.enabled,
        id: 'enabled',
        header: t('Status'),
        meta: { cardRole: 'badge', contentMode: 'full' },
        cell: ({ row }) =>
          row.original.plan.enabled ? (
            <StatusBadge variant='success'>{t('Enable')}</StatusBadge>
          ) : (
            <StatusBadge variant='neutral'>{t('Disable')}</StatusBadge>
          ),
        size: 80,
      },
      {
        id: 'payment',
        header: t('Payment Channel'),
        meta: {
          cardRole: 'secondary',
          cardOrder: 40,
          cardSpan: 2,
          contentMode: 'wrap',
        },
        cell: ({ row }) => {
          const plan = row.original.plan
          return (
            <BadgeCell>
              {plan.stripe_price_id && (
                <StatusBadge variant='neutral'>Stripe</StatusBadge>
              )}
              {plan.creem_product_id && (
                <StatusBadge variant='neutral'>Creem</StatusBadge>
              )}
              {plan.waffo_pancake_product_id && (
                <StatusBadge variant='neutral'>Waffo Pancake</StatusBadge>
              )}
            </BadgeCell>
          )
        },
        size: 140,
      },
      {
        id: 'total_amount',
        header: t('Plan Quota'),
        meta: {
          cardRole: 'secondary',
          cardOrder: 50,
          contentMode: 'full',
        },
        cell: ({ row }) => {
          const total = Number(row.original.plan.total_amount || 0)
          return (
            <span className='text-muted-foreground'>
              {total > 0 ? formatQuota(total) : t('Unlimited')}
            </span>
          )
        },
        size: 150,
      },
      {
        id: 'upgrade_group',
        header: t('Upgrade Group'),
        meta: {
          cardRole: 'secondary',
          cardOrder: 60,
          cardSpan: 2,
          contentMode: 'wrap',
        },
        cell: ({ row }) => {
          const group = row.original.plan.upgrade_group
          if (!group) {
            return (
              <span className='text-muted-foreground'>{t('No Upgrade')}</span>
            )
          }
          return (
            <BadgeCell>
              <GroupBadge group={group} />
            </BadgeCell>
          )
        },
        size: 120,
      },
      {
        id: 'actions',
        header: () => t('Actions'),
        cell: ({ row }) => <DataTableRowActions row={row} />,
        meta: { pinned: 'right' as const },
      },
    ],
    [t]
  )
}
