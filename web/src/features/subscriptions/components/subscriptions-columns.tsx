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
import { Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeCell, TruncatedCell } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatQuota } from '@/lib/format'

import { formatDuration, formatResetPeriod } from '../lib'
import type { PlanRecord } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { SubscriptionQuotaSummary } from './subscription-quota-summary'

export function useSubscriptionsColumns(): ColumnDef<PlanRecord>[] {
  const { t } = useTranslation()

  return useMemo(
    (): ColumnDef<PlanRecord>[] => [
      {
        accessorFn: (row) => row.plan.id,
        id: 'id',
        header: t('ID'),
        meta: { mobileHidden: true },
        cell: ({ row }) => <TableId value={row.original.plan.id} />,
        size: 64,
        minSize: 56,
      },
      {
        accessorFn: (row) => row.plan.title,
        id: 'title',
        header: t('Plan'),
        meta: { mobileTitle: true },
        enableHiding: false,
        cell: ({ row, table }) => {
          const plan = row.original.plan
          return (
            <div
              data-slot='subscription-plan-name'
              className='flex w-0 min-w-full flex-col gap-1 py-1'
            >
              <div className='flex min-w-0 items-center gap-2'>
                <TruncatedCell className='max-w-full min-w-0'>
                  {plan.title}
                </TruncatedCell>
                {!table.getColumn('id')?.getIsVisible() && (
                  <span
                    data-table-text='secondary'
                    className='hidden shrink-0 sm:inline'
                  >
                    <TableId value={`#${plan.id}`} />
                  </span>
                )}
              </div>
              {plan.subtitle && (
                <div
                  data-table-text='secondary'
                  className='text-muted-foreground min-w-0'
                >
                  <TruncatedCell>{plan.subtitle}</TruncatedCell>
                </div>
              )}
            </div>
          )
        },
        size: 290,
        minSize: 200,
      },
      {
        accessorFn: (row) => row.plan.price_amount,
        id: 'price',
        header: t('Price'),
        cell: ({ row }) => (
          <span className='text-success font-semibold tabular-nums'>
            ${Number(row.original.plan.price_amount || 0).toFixed(2)}
          </span>
        ),
        size: 100,
        minSize: 90,
      },
      {
        id: 'duration',
        header: t('Validity'),
        cell: ({ row, table }) => (
          <div className='flex flex-col gap-1'>
            <span>{formatDuration(row.original.plan, t)}</span>
            {!table.getColumn('reset')?.getIsVisible() && (
              <span
                data-table-text='secondary'
                className='text-muted-foreground'
              >
                {formatResetPeriod(row.original.plan, t)}
              </span>
            )}
          </div>
        ),
        size: 100,
        minSize: 95,
      },
      {
        id: 'reset',
        accessorFn: (row) => row.plan.quota_reset_period,
        enableSorting: false,
        header: t('Quota Reset'),
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatResetPeriod(row.original.plan, t)}
          </span>
        ),
        size: 100,
      },
      {
        id: 'total_amount',
        accessorFn: (row) => row.plan.total_amount,
        header: t('Total Quota'),
        cell: ({ row }) => (
          <span
            className={
              row.original.plan.total_amount > 0
                ? 'tabular-nums'
                : 'text-muted-foreground'
            }
          >
            {row.original.plan.total_amount > 0
              ? formatQuota(row.original.plan.total_amount)
              : t('Unlimited')}
          </span>
        ),
        size: 110,
        minSize: 95,
        enableSorting: false,
      },
      {
        id: 'period_limits',
        accessorFn: (row) =>
          Math.max(
            row.plan.daily_limit ?? 0,
            row.plan.weekly_limit ?? 0,
            row.plan.monthly_limit ?? 0
          ),
        header: t('Subscription period quotas'),
        cell: ({ row }) => (
          <SubscriptionQuotaSummary plan={row.original.plan} variant='table' />
        ),
        size: 300,
        minSize: 270,
        enableSorting: false,
      },
      {
        accessorFn: (row) => row.plan.enabled,
        id: 'enabled',
        header: t('Status'),
        meta: { mobileBadge: true },
        filterFn: (row, id, value: string[]) =>
          value.includes(String(row.getValue(id))),
        cell: ({ row }) => (
          <BadgeCell className='flex-col items-start gap-1'>
            <StatusBadge
              label={row.original.plan.enabled ? t('Enabled') : t('Disabled')}
              variant={row.original.plan.enabled ? 'success' : 'danger'}
              copyable={false}
            />
            {row.original.plan.recommended && (
              <StatusBadge
                label={t('Recommended')}
                icon={Sparkles}
                variant='info'
                copyable={false}
              />
            )}
          </BadgeCell>
        ),
        size: 100,
        minSize: 90,
      },
      {
        accessorFn: (row) => row.plan.sort_order,
        id: 'sort_order',
        header: t('Priority'),
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <span className='text-muted-foreground tabular-nums'>
            {row.original.plan.sort_order}
          </span>
        ),
        size: 90,
        minSize: 80,
      },
      {
        id: 'payment',
        accessorFn: (row) =>
          [
            row.plan.stripe_price_id,
            row.plan.creem_product_id,
            row.plan.waffo_pancake_product_id,
          ]
            .filter(Boolean)
            .join(', '),
        enableSorting: false,
        header: t('Payment Channel'),
        meta: { mobileHidden: true },
        cell: ({ row }) => {
          const plan = row.original.plan
          return (
            <BadgeCell>
              {plan.stripe_price_id && (
                <StatusBadge
                  label='Stripe'
                  variant='neutral'
                  copyable={false}
                />
              )}
              {plan.creem_product_id && (
                <StatusBadge label='Creem' variant='neutral' copyable={false} />
              )}
              {plan.waffo_pancake_product_id && (
                <StatusBadge
                  label='Waffo Pancake'
                  variant='neutral'
                  copyable={false}
                />
              )}
            </BadgeCell>
          )
        },
        size: 140,
      },
      {
        id: 'upgrade_group',
        accessorFn: (row) => row.plan.upgrade_group || '',
        enableSorting: false,
        header: t('Upgrade Group'),
        meta: { mobileHidden: true },
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
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [t]
  )
}
