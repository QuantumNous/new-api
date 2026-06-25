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
import { Link } from '@tanstack/react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import {
  USER_STATUS,
  USER_STATUSES,
  USER_ROLES,
  isUserDeleted,
} from '../constants'
import {
  formatUserQuotaDisplay,
  getUserQuotaSummary,
} from '../lib/user-quota-display'
import { type User } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

function getQuotaProgressColor(percentage: number): string {
  if (percentage <= 10) return '[&_[data-slot=progress-indicator]]:bg-rose-500'
  if (percentage <= 30) return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}

function parseAdsAttribution(raw?: string): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'string')
    ) as Record<string, string>
  } catch {
    return {}
  }
}

export function useUsersColumns(): ColumnDef<User>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
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
      meta: { label: t('Select') },
    },
    {
      accessorKey: 'id',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='ID' />
      ),
      cell: ({ row }) => {
        return (
          <TableId value={row.getValue('id') as number} className='w-[60px]' />
        )
      },
      meta: { label: t('ID'), mobileHidden: true },
    },
    {
      accessorKey: 'username',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Username')} />
      ),
      cell: ({ row }) => {
        const username = row.getValue('username') as string
        const displayName = row.original.display_name
        const remark = row.original.remark

        return (
          <div className='flex min-w-[160px] flex-col gap-1'>
            <div className='flex items-center gap-2'>
              <LongText className='max-w-[140px] font-medium'>
                {username}
              </LongText>
              {remark && (
                <Tooltip>
                  <TooltipTrigger
                    render={<StatusBadge variant='success' copyable={false} />}
                  >
                    <LongText className='max-w-[80px]'>{remark}</LongText>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className='text-xs'>{remark}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {displayName && displayName !== username && (
              <LongText className='text-muted-foreground max-w-[180px] text-xs'>
                {displayName}
              </LongText>
            )}
          </div>
        )
      },
      enableHiding: false,
      meta: { label: t('Username'), mobileTitle: true },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const requestCount = user.request_count

        const statusConfig = isUserDeleted(user)
          ? USER_STATUSES[USER_STATUS.DELETED]
          : USER_STATUSES[user.status as keyof typeof USER_STATUSES]

        if (!statusConfig) {
          return null
        }

        return (
          <Tooltip>
            <TooltipTrigger render={<div className='cursor-help' />}>
              <StatusBadge
                label={t(statusConfig.labelKey)}
                variant={statusConfig.variant}
                copyable={false}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className='text-xs'>
                {t('Requests:')} {requestCount.toLocaleString()}
              </p>
            </TooltipContent>
          </Tooltip>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
      enableSorting: false,
      meta: { label: t('Status'), mobileBadge: true },
    },
    {
      id: 'quota',
      accessorKey: 'quota',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Quota')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const quotaSummary = getUserQuotaSummary(user)

        if (quotaSummary.isEmpty) {
          return (
            <StatusBadge
              label={formatUserQuotaDisplay(user, t('No Quota'))}
              variant='neutral'
              copyable={false}
            />
          )
        }

        return (
          <Tooltip>
            <TooltipTrigger
              render={<div className='w-[150px] cursor-help space-y-1' />}
            >
              <div className='flex justify-between text-xs'>
                <span className='font-medium tabular-nums'>
                  {formatQuota(quotaSummary.remaining)}
                </span>
                <span className='text-muted-foreground tabular-nums'>
                  {formatQuota(quotaSummary.total)}
                </span>
              </div>
              <Progress
                value={quotaSummary.percentage}
                className={cn(
                  'h-1.5',
                  getQuotaProgressColor(quotaSummary.percentage)
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className='space-y-1 text-xs'>
                <div>
                  {t('Used:')} {formatQuota(quotaSummary.used)}
                </div>
                <div>
                  {t('Remaining:')} {formatQuota(quotaSummary.remaining)}
                </div>
                <div>
                  {t('Total:')} {formatQuota(quotaSummary.total)}
                </div>
                <div>
                  {t('Percentage:')} {quotaSummary.percentage.toFixed(1)}%
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      meta: { label: t('Quota') },
    },
    {
      id: 'usage_logs',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Usage Logs')} />
      ),
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-foreground size-7'
                aria-label={t('Usage Logs')}
                render={
                  <Link
                    to='/usage-logs/$section'
                    params={{ section: 'common' }}
                    search={{ username: row.original.username, page: 1 }}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              />
            }
          >
            <ScrollText className='size-4' />
          </TooltipTrigger>
          <TooltipContent>{t('Usage Logs')}</TooltipContent>
        </Tooltip>
      ),
      enableSorting: false,
      meta: { label: t('Usage Logs'), mobileHidden: true },
    },
    {
      accessorKey: 'group',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Group')} />
      ),
      cell: ({ row }) => {
        const group = row.getValue('group') as string
        return <GroupBadge group={group} />
      },
      filterFn: (row, id, value) => {
        const group = String(row.getValue(id) || t('User Group')).toLowerCase()
        const searchValue = String(value).toLowerCase()
        return group.includes(searchValue)
      },
      meta: { label: t('Group') },
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Role')} />
      ),
      cell: ({ row }) => {
        const roleValue = row.getValue('role') as number
        const roleConfig = USER_ROLES[roleValue as keyof typeof USER_ROLES]

        if (!roleConfig) {
          return null
        }

        return (
          <div className='flex items-center gap-x-2'>
            {roleConfig.icon && (
              <roleConfig.icon size={16} className='text-muted-foreground' />
            )}
            <span className='text-sm'>{t(roleConfig.labelKey)}</span>
          </div>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
      },
      enableSorting: false,
      meta: { label: t('Role') },
    },
    {
      accessorKey: 'ads_attribution',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Ad Source')} />
      ),
      cell: ({ row }) => {
        const attribution = parseAdsAttribution(row.original.ads_attribution)
        const source =
          attribution.utm_source ||
          (attribution.gclid || attribution.gbraid || attribution.wbraid
            ? 'google_ads'
            : '')
        const campaign =
          attribution.utm_campaign ||
          attribution.hsa_cam ||
          attribution.gad_campaignid ||
          ''
        const term = attribution.utm_term || attribution.hsa_kw || ''

        if (!source && !campaign && !term) {
          return (
            <StatusBadge
              label={t('No ad source')}
              variant='neutral'
              copyable={false}
            />
          )
        }

        return (
          <Tooltip>
            <TooltipTrigger render={<div className='max-w-[180px]' />}>
              <div className='flex flex-col gap-1 text-xs'>
                <StatusBadge
                  label={source || t('Ads')}
                  variant='success'
                  copyable={false}
                />
                {(campaign || term) && (
                  <LongText className='text-muted-foreground max-w-[170px]'>
                    {[campaign, term].filter(Boolean).join(' / ')}
                  </LongText>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className='max-w-sm'>
              <pre className='whitespace-pre-wrap text-xs'>
                {JSON.stringify(attribution, null, 2)}
              </pre>
            </TooltipContent>
          </Tooltip>
        )
      },
      enableSorting: false,
      meta: { label: t('Ad Source'), mobileHidden: true },
    },
    {
      id: 'invite_info',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Invite Info')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const affCount = user.aff_count || 0
        const affHistoryQuota = user.aff_history_quota || 0
        const inviterId = user.inviter_id || 0

        return (
          <div className='flex items-center gap-1'>
            <Tooltip>
              <TooltipTrigger
                render={
                  <StatusBadge
                    label={`${t('Invited')}: ${affCount}`}
                    variant='neutral'
                    copyable={false}
                    className='cursor-help'
                  />
                }
              />
              <TooltipContent>
                <p className='text-xs'>{t('Number of users invited')}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <StatusBadge
                    label={`${t('Revenue')}: ${formatQuota(affHistoryQuota)}`}
                    variant='neutral'
                    copyable={false}
                    className='cursor-help'
                  />
                }
              />
              <TooltipContent>
                <p className='text-xs'>{t('Total invitation revenue')}</p>
              </TooltipContent>
            </Tooltip>
            {inviterId > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <StatusBadge
                      label={`${t('Inviter')}: ${inviterId}`}
                      variant='neutral'
                      copyable={false}
                      className='cursor-help'
                    />
                  }
                />
                <TooltipContent>
                  <p className='text-xs'>
                    {t('Invited by user ID')} {inviterId}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {inviterId === 0 && (
              <StatusBadge
                label={t('No Inviter')}
                variant='neutral'
                copyable={false}
              />
            )}
          </div>
        )
      },
      enableSorting: false,
      meta: { label: t('Invite Info'), mobileHidden: true },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Created At')} />
      ),
      cell: ({ row }) => {
        const ts = row.getValue('created_at') as number | undefined
        return (
          <span className='text-muted-foreground text-sm'>
            {ts ? formatTimestamp(ts) : '-'}
          </span>
        )
      },
      meta: { label: t('Created At'), mobileHidden: true },
    },
    {
      accessorKey: 'last_login_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Last Login')} />
      ),
      cell: ({ row }) => {
        const ts = row.getValue('last_login_at') as number | undefined
        return (
          <span className='text-muted-foreground text-sm'>
            {ts ? formatTimestamp(ts) : '-'}
          </span>
        )
      },
      meta: { label: t('Last Login'), mobileHidden: true },
    },
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { label: t('Actions') },
    },
  ]
}
