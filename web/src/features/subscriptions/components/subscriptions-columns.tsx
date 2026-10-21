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

import { DataTableColumnHeader } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatQuota } from '@/lib/format'

import { formatDuration, formatResetPeriod } from '../lib'
import { formatSubscriptionPlanPrice } from '../lib/subscription-price-format'
import type { PlanRecord } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { useSubscriptions } from './subscriptions-provider'

export function useSubscriptionsColumns(): ColumnDef<PlanRecord>[] {
  const { t } = useTranslation()
  const { subscriptionPaymentAvailability } = useSubscriptions()

  return useMemo(
    (): ColumnDef<PlanRecord>[] => [
      {
        accessorFn: (row) => row.plan.id,
        id: 'id',
        meta: { label: 'ID', mobileHidden: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='ID' />
        ),
        cell: ({ row }) => <TableId value={row.original.plan.id} />,
        size: 60,
      },
      {
        accessorFn: (row) => row.plan.title,
        id: 'title',
        meta: { label: t('Plan'), mobileTitle: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Plan')} />
        ),
        cell: ({ row }) => {
          const plan = row.original.plan
          return (
            <div className='max-w-[200px]'>
              <div className='truncate font-medium'>{plan.title}</div>
              {plan.subtitle && (
                <div className='text-muted-foreground truncate text-xs'>
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
        meta: { label: t('Price') },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Price')} />
        ),
        cell: ({ row }) => (
          <span className='font-semibold text-emerald-600'>
            {formatSubscriptionPlanPrice(row.original.plan.price_amount)}
          </span>
        ),
        size: 100,
      },
      {
        id: 'duration',
        meta: { label: t('Validity') },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Validity')} />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatDuration(row.original.plan, t)}
          </span>
        ),
        size: 100,
      },
      {
        id: 'reset',
        meta: { label: t('Quota Reset'), mobileHidden: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Quota Reset')} />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatResetPeriod(row.original.plan, t)}
          </span>
        ),
        size: 80,
      },
      {
        accessorFn: (row) => row.plan.sort_order,
        id: 'sort_order',
        meta: { label: t('Priority'), mobileHidden: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Priority')} />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.original.plan.sort_order}
          </span>
        ),
        size: 80,
      },
      {
        accessorFn: (row) => row.plan.enabled,
        id: 'enabled',
        meta: { label: t('Status'), mobileBadge: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Status')} />
        ),
        cell: ({ row }) =>
          row.original.plan.enabled ? (
            <StatusBadge
              label={t('Enabled')}
              variant='success'
              copyable={false}
            />
          ) : (
            <StatusBadge
              label={t('Disabled')}
              variant='neutral'
              copyable={false}
            />
          ),
        size: 80,
      },
      {
        id: 'payment',
        meta: { label: t('Payment Channel'), mobileHidden: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Payment Channel')} />
        ),
        cell: ({ row }) => {
          const plan = row.original.plan
          const showNative = plan.price_amount > 0
          return (
            <div className='flex gap-1'>
              {plan.stripe_price_id &&
                subscriptionPaymentAvailability.stripe && (
                  <StatusBadge
                    label='Stripe'
                    variant='neutral'
                    copyable={false}
                  />
                )}
              {plan.creem_product_id &&
                subscriptionPaymentAvailability.creem && (
                  <StatusBadge
                    label='Creem'
                    variant='neutral'
                    copyable={false}
                  />
                )}
              {plan.waffo_pancake_product_id &&
                subscriptionPaymentAvailability.waffoPancake && (
                  <StatusBadge
                    label='Waffo Pancake'
                    variant='neutral'
                    copyable={false}
                  />
                )}
              {showNative && subscriptionPaymentAvailability.alipay && (
                <StatusBadge
                  label='Alipay'
                  variant='neutral'
                  copyable={false}
                />
              )}
              {showNative && subscriptionPaymentAvailability.wechat && (
                <StatusBadge
                  label='WeChat Pay'
                  variant='neutral'
                  copyable={false}
                />
              )}
              {showNative && subscriptionPaymentAvailability.epay && (
                <StatusBadge label='Epay' variant='neutral' copyable={false} />
              )}
            </div>
          )
        },
        size: 140,
      },
      {
        id: 'total_amount',
        meta: { label: t('Received amount'), mobileHidden: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Received amount')} />
        ),
        cell: ({ row }) => {
          const total = Number(row.original.plan.total_amount || 0)
          return (
            <span className='text-muted-foreground'>
              {total > 0 ? formatQuota(total) : t('Unlimited')}
            </span>
          )
        },
        size: 100,
      },
      {
        id: 'upgrade_group',
        meta: { label: t('Upgrade Group'), mobileHidden: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Upgrade Group')} />
        ),
        cell: ({ row }) => {
          const group = row.original.plan.upgrade_group
          if (!group) {
            return (
              <span className='text-muted-foreground'>{t('No Upgrade')}</span>
            )
          }
          return <GroupBadge group={group} />
        },
        size: 100,
      },
      {
        id: 'actions',
        cell: ({ row }) => <DataTableRowActions row={row} />,
        size: 80,
      },
    ],
    [t, subscriptionPaymentAvailability]
  )
}
