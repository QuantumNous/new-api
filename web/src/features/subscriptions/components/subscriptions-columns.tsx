import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import type { PlanRecord } from '../types'
import { formatDuration, formatResetPeriod } from '../lib'
import { DataTableRowActions } from './data-table-row-actions'

export function useSubscriptionsColumns(): ColumnDef<PlanRecord>[] {
  const { t } = useTranslation()

  return useMemo(
    (): ColumnDef<PlanRecord>[] => [
      {
        accessorFn: (row) => row.plan.id,
        id: 'id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='ID' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            #{row.original.plan.id}
          </span>
        ),
        size: 60,
      },
      {
        accessorFn: (row) => row.plan.title,
        id: 'title',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('套餐')} />
        ),
        cell: ({ row }) => {
          const plan = row.original.plan
          return (
            <div className='max-w-[200px]'>
              <div className='truncate font-medium'>{plan.title}</div>
              {plan.subtitle && (
                <div className='truncate text-xs text-muted-foreground'>
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('价格')} />
        ),
        cell: ({ row }) => (
          <span className='font-semibold text-emerald-600'>
            ${Number(row.original.plan.price_amount || 0).toFixed(2)}
          </span>
        ),
        size: 100,
      },
      {
        id: 'duration',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('有效期')} />
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('重置')} />
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('优先级')} />
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('状态')} />
        ),
        cell: ({ row }) =>
          row.original.plan.enabled ? (
            <Badge variant='success'>{t('启用')}</Badge>
          ) : (
            <Badge variant='secondary'>{t('禁用')}</Badge>
          ),
        size: 80,
      },
      {
        id: 'payment',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('支付渠道')} />
        ),
        cell: ({ row }) => {
          const plan = row.original.plan
          return (
            <div className='flex gap-1'>
              {plan.stripe_price_id && (
                <Badge variant='outline'>Stripe</Badge>
              )}
              {plan.creem_product_id && (
                <Badge variant='outline'>Creem</Badge>
              )}
            </div>
          )
        },
        size: 140,
      },
      {
        id: 'total_amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('总额度')} />
        ),
        cell: ({ row }) => {
          const total = Number(row.original.plan.total_amount || 0)
          return (
            <span className='text-muted-foreground'>
              {total > 0 ? total : t('不限')}
            </span>
          )
        },
        size: 100,
      },
      {
        id: 'upgrade_group',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('升级分组')} />
        ),
        cell: ({ row }) => {
          const group = row.original.plan.upgrade_group
          return (
            <span className='text-muted-foreground'>
              {group || t('不升级')}
            </span>
          )
        },
        size: 100,
      },
      {
        id: 'actions',
        cell: ({ row }) => <DataTableRowActions row={row} />,
        size: 80,
      },
    ],
    [t]
  )
}
