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
import { ChevronLeft, ChevronRight, RefreshCw, Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import {
  StatusBadge,
  type StatusBadgeProps,
} from '@/components/status-badge'
import type { InviteCode, InviteCodeUsageFilter } from '../types'

interface InviteCodesHistoryCardProps {
  inviteCodes: InviteCode[]
  total: number
  page: number
  pageSize: number
  usageFilter: InviteCodeUsageFilter
  loading: boolean
  onPageChange: (page: number) => void
  onUsageFilterChange: (usageFilter: InviteCodeUsageFilter) => void
  onRefresh: () => void
}

const inviteCodeUsageFilterOptions: {
  value: InviteCodeUsageFilter
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'unused', label: 'Unused' },
  { value: 'used', label: 'Used' },
]

function getInviteCodeStatus(inviteCode: InviteCode): {
  label: string
  variant: StatusBadgeProps['variant']
} {
  const now = Math.floor(Date.now() / 1000)
  if (
    inviteCode.status === 1 &&
    inviteCode.expired_time > 0 &&
    inviteCode.expired_time < now
  ) {
    return { label: 'Expired', variant: 'warning' }
  }
  if (inviteCode.status === 3) {
    return { label: 'Used', variant: 'neutral' }
  }
  if (inviteCode.status === 2) {
    return { label: 'Disabled', variant: 'danger' }
  }
  return { label: 'Enabled', variant: 'success' }
}

function InviteCodesHistorySkeleton() {
  return (
    <div className='divide-border overflow-hidden rounded-lg border'>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className='grid gap-3 p-3 sm:p-4 lg:grid-cols-3 xl:grid-cols-6'>
          <Skeleton className='h-5 w-36' />
          <Skeleton className='h-5 w-20' />
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-5 w-24' />
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-5 w-32' />
        </div>
      ))}
    </div>
  )
}

function InviteCodeField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className='min-w-0 space-y-1'>
      <div className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase'>
        {label}
      </div>
      <div className='truncate text-sm'>{value}</div>
    </div>
  )
}

export function InviteCodesHistoryCard({
  inviteCodes,
  total,
  page,
  pageSize,
  usageFilter,
  loading,
  onPageChange,
  onUsageFilterChange,
  onRefresh,
}: InviteCodesHistoryCardProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <Card className='py-0'>
      <CardContent className='grid gap-4 p-3 sm:p-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
              <Ticket className='text-muted-foreground size-4' />
            </div>
            <div className='min-w-0'>
              <h3 className='truncate text-sm font-semibold'>
                {t('My Invitation Codes')}
              </h3>
              <p className='text-muted-foreground line-clamp-1 text-xs'>
                {t('Invitation code history and usage records')}
              </p>
            </div>
          </div>
          <div className='flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto'>
            <div
              role='group'
              aria-label={t('Filter')}
              className='bg-muted/40 flex rounded-lg border p-0.5'
            >
              {inviteCodeUsageFilterOptions.map((option) => {
                const active = usageFilter === option.value
                return (
                  <Button
                    key={option.value}
                    type='button'
                    variant='ghost'
                    size='sm'
                    aria-pressed={active}
                    onClick={() => onUsageFilterChange(option.value)}
                    disabled={loading}
                    className={cn(
                      'h-7 rounded-md px-2 text-xs',
                      active &&
                        'bg-background text-foreground shadow-sm hover:bg-background'
                    )}
                  >
                    {t(option.label)}
                  </Button>
                )
              })}
            </div>
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={onRefresh}
              disabled={loading}
              aria-label={t('Refresh')}
              className='bg-background size-9 shrink-0'
            >
              <RefreshCw className='size-4' />
            </Button>
          </div>
        </div>

        {loading ? (
          <InviteCodesHistorySkeleton />
        ) : inviteCodes.length === 0 ? (
          <div className='text-muted-foreground flex h-40 flex-col items-center justify-center rounded-lg border text-center'>
            <p className='text-sm font-medium'>
              {t('No invitation codes found')}
            </p>
            <p className='mt-1 text-xs'>
              {t('Your generated invitation codes will appear here')}
            </p>
          </div>
        ) : (
          <div className='divide-border overflow-hidden rounded-lg border'>
            {inviteCodes.map((inviteCode) => {
              const status = getInviteCodeStatus(inviteCode)
              const usedBy =
                inviteCode.used_user_id > 0
                  ? inviteCode.used_username
                    ? `${inviteCode.used_username} (#${inviteCode.used_user_id})`
                    : `#${inviteCode.used_user_id}`
                  : t('Not Used')

              return (
                <div
                  key={inviteCode.id}
                  className='hover:bg-muted/40 grid gap-3 border-b p-3 transition-colors last:border-b-0 sm:p-4 lg:grid-cols-3 lg:items-center xl:grid-cols-[minmax(150px,1fr)_110px_minmax(150px,1fr)_90px_minmax(150px,1fr)_minmax(150px,1fr)]'
                >
                  <div className='min-w-0 space-y-1'>
                    <div className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase'>
                      {t('Code')}
                    </div>
                    <div className='flex min-w-0 items-center gap-2'>
                      <code className='truncate font-mono text-sm font-medium'>
                        {inviteCode.code}
                      </code>
                      <CopyButton
                        value={inviteCode.code}
                        variant='ghost'
                        className='size-7 shrink-0'
                        iconClassName='size-3.5'
                        tooltip={t('Copy invitation code')}
                        aria-label={t('Copy invitation code')}
                      />
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <div className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase'>
                      {t('Status')}
                    </div>
                    <StatusBadge
                      label={t(status.label)}
                      variant={status.variant}
                      copyable={false}
                    />
                  </div>
                  <InviteCodeField
                    label={t('Created Time')}
                    value={formatTimestampToDate(inviteCode.created_time)}
                  />
                  <InviteCodeField
                    label={t('Uses')}
                    value={`${inviteCode.used_count}/${inviteCode.max_uses}`}
                  />
                  <InviteCodeField label={t('Used By')} value={usedBy} />
                  <InviteCodeField
                    label={t('Used Time')}
                    value={formatTimestampToDate(inviteCode.used_time)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {!loading && total > 0 ? (
          <div className='flex flex-col items-center gap-3 border-t pt-3 sm:flex-row sm:justify-between'>
            <div className='text-muted-foreground text-xs sm:text-sm'>
              {t('Showing')} {start}-{end} {t('of')} {total}
            </div>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className='h-8 w-8 p-0'
                aria-label={t('Previous')}
              >
                <ChevronLeft className='size-4' />
              </Button>
              <div className='text-muted-foreground flex items-center gap-1 text-sm'>
                <span className='font-medium'>{page}</span>
                <span>/</span>
                <span>{totalPages}</span>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className='h-8 w-8 p-0'
                aria-label={t('Next')}
              >
                <ChevronRight className='size-4' />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
