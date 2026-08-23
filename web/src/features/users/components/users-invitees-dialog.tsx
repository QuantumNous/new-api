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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota, formatTimestamp } from '@/lib/format'

import { getUserInvitees } from '../api'
import { USER_STATUSES, USER_STATUS } from '../constants'
import type { UserInvitee } from '../types'
import { useUsers } from './users-provider'

function inviteeStatus(invitee: UserInvitee) {
  if (invitee.deleted) {
    return USER_STATUSES[USER_STATUS.DELETED]
  }
  return (
    USER_STATUSES[invitee.status as keyof typeof USER_STATUSES] ??
    USER_STATUSES[USER_STATUS.ENABLED]
  )
}

function InviteesDialogBody({
  isLoading,
  items,
}: {
  isLoading: boolean
  items: UserInvitee[]
}) {
  const { t } = useTranslation()
  if (isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-12 w-full' />
        <Skeleton className='h-12 w-full' />
        <Skeleton className='h-12 w-full' />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <p className='text-muted-foreground py-6 text-center text-sm'>
        {t('No invited users yet')}
      </p>
    )
  }
  return (
    <div className='divide-y'>
      {items.map((invitee) => (
        <InviteeRow key={invitee.id} invitee={invitee} />
      ))}
    </div>
  )
}

function InviteeRow({ invitee }: { invitee: UserInvitee }) {
  const { t } = useTranslation()
  const status = inviteeStatus(invitee)

  return (
    <div className='flex items-center justify-between gap-3 py-2.5'>
      <div className='min-w-0'>
        <div className='truncate text-sm font-medium'>
          {invitee.display_name || invitee.username}
        </div>
        <div className='text-muted-foreground truncate text-xs'>
          ID {invitee.id}
          {invitee.display_name ? ` · ${invitee.username}` : ''}
        </div>
      </div>
      <div className='flex shrink-0 flex-col items-end gap-1'>
        <StatusBadge
          label={t(status.labelKey)}
          variant={status.variant}
          copyable={false}
        />
        <span className='text-muted-foreground text-[11px] tabular-nums'>
          {invitee.created_at ? formatTimestamp(invitee.created_at) : '-'}
        </span>
      </div>
    </div>
  )
}

export function UsersInviteesDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow } = useUsers()
  const [page, setPage] = useState(1)
  const pageSize = 10
  const visible = open === 'invitees' && currentRow != null

  useEffect(() => {
    setPage(1)
  }, [currentRow?.id])

  const query = useQuery({
    queryKey: ['user-invitees', currentRow?.id, page],
    queryFn: () => {
      if (currentRow == null) {
        return Promise.reject(new Error('missing user'))
      }
      return getUserInvitees(currentRow.id, { p: page, page_size: pageSize })
    },
    enabled: visible,
  })

  const items = query.data?.data?.items ?? []
  const total = query.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <Dialog
      open={visible}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setOpen(null)
          setPage(1)
        }
      }}
      title={t('Invited users')}
      description={
        currentRow
          ? t(
              '{{count}} users invited by {{username}}. Invitation revenue: {{revenue}}.',
              {
                count: currentRow.aff_count ?? total,
                username: currentRow.username,
                revenue: formatQuota(currentRow.aff_history_quota ?? 0),
              }
            )
          : undefined
      }
      contentClassName='sm:max-w-lg'
    >
      <InviteesDialogBody isLoading={query.isLoading} items={items} />
      {total > pageSize ? (
        <div className='flex items-center justify-between pt-3'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('Previous')}
          </Button>
          <span className='text-muted-foreground text-xs tabular-nums'>
            {page} / {totalPages}
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={page >= totalPages || query.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      ) : null}
    </Dialog>
  )
}
