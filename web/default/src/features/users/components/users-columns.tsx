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
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { parseCountry } from '@/lib/country'
import { DataTableColumnHeader } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import { USER_STATUSES, USER_ROLES, isUserDeleted } from '../constants'
import { type User } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { useUsers } from './users-provider'

function getQuotaProgressColor(percentage: number): string {
  if (percentage <= 10) return '[&_[data-slot=progress-indicator]]:bg-rose-500'
  if (percentage <= 30) return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}

export function useUsersColumns(): ColumnDef<User>[] {
  const { t } = useTranslation()
  const { setSelectedUserId, setUserInfoDialogOpen } = useUsers()

  const openUserInfo = (userId: number) => {
    setSelectedUserId(userId)
    setUserInfoDialogOpen(true)
  }

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
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
          <button
            type='button'
            className='w-[60px] text-left font-mono text-sm hover:underline'
            onClick={(e) => {
              e.stopPropagation()
              openUserInfo(row.original.id)
            }}
          >
            {row.getValue('id')}
          </button>
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
        const email = row.original.email
        const displayName = row.original.display_name
        const email = row.original.email
        const remark = row.original.remark
        const secondaryText =
          email || (displayName && displayName !== username ? displayName : '')

        return (
          <div className='flex min-w-[160px] flex-col gap-1'>
            <div className='flex items-center gap-2'>
              <button
                type='button'
                className='min-w-0 max-w-[140px] text-left font-medium hover:underline'
                onClick={(e) => {
                  e.stopPropagation()
                  openUserInfo(row.original.id)
                }}
              >
                <LongText className='max-w-[140px]'>{username}</LongText>
              </button>
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
            {secondaryText && (
              <LongText className='text-muted-foreground max-w-[180px] text-xs'>
                {secondaryText}
              </LongText>
            )}
            {email && (
              <button
                type='button'
                className='text-muted-foreground max-w-[220px] text-left text-xs hover:underline'
                onClick={(e) => {
                  e.stopPropagation()
                  openUserInfo(row.original.id)
                }}
              >
                <LongText className='max-w-[220px]'>{email}</LongText>
              </button>
            )}
          </div>
        )
      },
      enableHiding: false,
      meta: { label: t('Username'), mobileTitle: true },
    },
    {
      id: 'registration_provider',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Registration Method')} />
      ),
      cell: ({ row }) => {
        const provider = row.original.registration_provider
        const labels: Record<string, string> = {
          email: 'Email',
          google: 'Google',
          github: 'GitHub',
          twitter: 'Twitter',
        }
        if (!provider || !labels[provider]) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        return (
          <StatusBadge variant='info' copyable={false}>
            {labels[provider]}
          </StatusBadge>
        )
      },
      enableSorting: false,
      meta: { label: t('Registration Method'), mobileHidden: true },
    },
    {
      accessorKey: 'country',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='国家' />
      ),
      cell: ({ row }) => {
        const c = parseCountry(row.getValue('country') as string | undefined)
        return c
          ? <div className='flex flex-col gap-0.5'>
              <span className='text-xs font-medium'>{c.code}</span>
              {c.name && <span className='text-muted-foreground text-xs'>{c.name}</span>}
            </div>
          : <span className='text-muted-foreground text-xs'>—</span>
      },
      enableSorting: false,
      meta: { label: '国家', mobileHidden: true },
    },
    {
      accessorKey: 'language',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Language')} />
      ),
      cell: ({ row }) => {
        const lang = row.getValue('language') as string | undefined
        return lang
          ? <span className='text-xs font-medium'>{lang}</span>
          : <span className='text-muted-foreground text-xs'>—</span>
      },
      enableSorting: false,
      meta: { label: '语言', mobileHidden: true },
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
          ? USER_STATUSES.DELETED
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
                showDot={statusConfig.showDot}
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
        const used = user.used_quota
        const remaining = user.quota
        const total = used + remaining
        const percentage = total > 0 ? (remaining / total) * 100 : 0

        if (total === 0) {
          return (
            <StatusBadge
              label={t('No Quota')}
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
                  {formatQuota(remaining)}
                </span>
                <span className='text-muted-foreground tabular-nums'>
                  {formatQuota(total)}
                </span>
              </div>
              <Progress
                value={percentage}
                className={cn('h-1.5', getQuotaProgressColor(percentage))}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className='space-y-1 text-xs'>
                <div>
                  {t('Used:')} {formatQuota(used)}
                </div>
                <div>
                  {t('Remaining:')} {formatQuota(remaining)}
                </div>
                <div>
                  {t('Total:')} {formatQuota(total)}
                </div>
                <div>
                  {t('Percentage:')} {percentage.toFixed(1)}%
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      meta: { label: t('Quota') },
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
      id: 'invite_info',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Invited Count')} />
      ),
      cell: ({ row }) => {
        const user = row.original
        const affCount = user.aff_count || 0
        const affHistoryQuota = user.aff_history_quota || 0
        const inviterId = user.inviter_id || 0

        return (
          <Tooltip>
            <TooltipTrigger render={<div className='cursor-help' />}>
              <div className='flex items-center gap-1.5 text-sm font-medium'>
                <span>{affCount}</span>
                <span className='text-muted-foreground text-xs'>
                  {t('people')}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className='space-y-1 text-xs'>
                <div>
                  {t('Number of users invited')}: {affCount}
                </div>
                <div>
                  {t('Total invitation revenue')}:{' '}
                  {formatQuota(affHistoryQuota)}
                </div>
                {inviterId > 0 && (
                  <div>
                    {t('Invited by user ID')} {inviterId}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      enableSorting: false,
      meta: { label: t('Invited Count'), mobileHidden: true },
    },
    {
      id: 'registration_channel',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('Registration Channel')}
        />
      ),
      cell: ({ row }) => {
        const user = row.original
        const channelCode = user.registration_channel_code
        const channelName = user.registration_channel_name
        const inviterEmail = user.registration_inviter_email
        const sourceUrl = user.registration_source_url
        const registrationUtm = user.registration_utm

        // direct (or unattributed) shows blank; referral shows the inviter email.
        if (!channelCode || channelCode === 'direct') {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        const headline =
          channelCode === 'referral'
            ? inviterEmail || channelName || channelCode
            : channelName || channelCode

        return (
          <Tooltip>
            <TooltipTrigger render={<div className='cursor-help' />}>
              <div className='flex min-w-[140px] flex-col gap-1'>
                <span className='text-sm font-medium'>
                  {headline}
                </span>
                <code className='text-muted-foreground text-xs'>
                  {channelCode}
                </code>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className='max-w-[320px] space-y-1 text-xs'>
                {sourceUrl && (
                  <div className='break-all'>
                    {t('Source')}: {sourceUrl}
                  </div>
                )}
                {registrationUtm && (
                  <div className='break-all'>
                    {t('UTM')}: {registrationUtm}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      enableSorting: false,
      meta: { label: t('Registration Channel'), mobileHidden: true },
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
