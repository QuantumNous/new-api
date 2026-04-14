import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import { MaskedValueDisplay } from '@/components/masked-value-display'
import { StatusBadge } from '@/components/status-badge'
import { REDEMPTION_FILTER_EXPIRED, REDEMPTION_STATUSES } from '../constants'
import { isRedemptionExpired, isTimestampExpired } from '../lib'
import { type Redemption } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useRedemptionsColumns(): ColumnDef<Redemption>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      meta: { label: t('Select') },
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'id',
      meta: { label: t('ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('ID')} />
      ),
      cell: ({ row }) => {
        return <div className='w-[60px]'>{row.getValue('id')}</div>
      },
    },
    {
      accessorKey: 'name',
      meta: { label: t('Name'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Name')} />
      ),
      cell: ({ row }) => {
        return (
          <div className='max-w-[150px] truncate font-medium'>
            {row.getValue('name')}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      meta: { label: t('Status'), mobileBadge: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => {
        const redemption = row.original
        const statusValue = row.getValue('status') as number

        // Check if expired
        if (isRedemptionExpired(redemption.expired_time, statusValue)) {
          return (
            <StatusBadge
              label={t('Expired')}
              variant='warning'
              showDot={true}
              copyable={false}
            />
          )
        }

        const statusConfig = REDEMPTION_STATUSES[statusValue]

        if (!statusConfig) {
          return null
        }

        return (
          <StatusBadge
            label={t(statusConfig.labelKey)}
            variant={statusConfig.variant}
            showDot={statusConfig.showDot}
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => {
        const redemption = row.original
        const statusValue = row.getValue(id) as number

        // Check if expired status is being filtered
        if (value.includes(REDEMPTION_FILTER_EXPIRED)) {
          if (isRedemptionExpired(redemption.expired_time, statusValue)) {
            return true
          }
        }

        // Check regular status
        return value.includes(String(statusValue))
      },
    },
    {
      id: 'code',
      accessorKey: 'key',
      meta: { label: t('Code') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Code')} />
      ),
      cell: function CodeCell({ row }) {
        const redemption = row.original
        const key = redemption.key
        const maskedKey = `${key.slice(0, 8)}${'*'.repeat(16)}${key.slice(-8)}`

        return (
          <MaskedValueDisplay
            label={t('Full Code')}
            fullValue={key}
            maskedValue={maskedKey}
            copyTooltip={t('Copy code')}
            copyAriaLabel={t('Copy redemption code')}
          />
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'quota',
      meta: { label: t('Quota') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Quota')} />
      ),
      cell: ({ row }) => {
        const quota = row.getValue('quota') as number
        return (
          <StatusBadge
            label={formatQuota(quota)}
            variant='neutral'
            copyable={false}
          />
        )
      },
    },
    {
      accessorKey: 'created_time',
      meta: { label: t('Created'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Created')} />
      ),
      cell: ({ row }) => {
        return (
          <div className='min-w-[140px] font-mono text-sm'>
            {formatTimestampToDate(row.getValue('created_time'))}
          </div>
        )
      },
    },
    {
      accessorKey: 'expired_time',
      meta: { label: t('Expires'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Expires')} />
      ),
      cell: ({ row }) => {
        const expiredTime = row.getValue('expired_time') as number
        if (expiredTime === 0) {
          return (
            <StatusBadge
              label={t('Never')}
              variant='neutral'
              copyable={false}
            />
          )
        }
        const isExpired = isTimestampExpired(expiredTime)
        return (
          <div
            className={`min-w-[140px] font-mono text-sm ${isExpired ? 'text-destructive' : ''}`}
          >
            {formatTimestampToDate(expiredTime)}
          </div>
        )
      },
    },
    {
      accessorKey: 'used_user_id',
      meta: { label: t('Redeemed By'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Redeemed By')} />
      ),
      cell: ({ row }) => {
        const userId = row.getValue('used_user_id') as number
        const redemption = row.original

        if (userId === 0) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <StatusBadge
                label={t('User {{id}}', { id: userId })}
                variant='neutral'
                copyable={false}
                className='cursor-help'
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className='space-y-1 text-xs'>
                <div>
                  {t('User ID:')} {userId}
                </div>
                {redemption.redeemed_time > 0 && (
                  <div>
                    {t('Redeemed:')}{' '}
                    {formatTimestampToDate(redemption.redeemed_time)}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
    },
  ]
}
