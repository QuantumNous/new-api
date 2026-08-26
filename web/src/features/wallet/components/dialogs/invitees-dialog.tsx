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
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestampToDate } from '@/lib/format'

import { getUserInvitees, isApiSuccess } from '../../api'

interface InviteesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SKELETON_ROW_IDS = [
  'invitee-skeleton-1',
  'invitee-skeleton-2',
  'invitee-skeleton-3',
  'invitee-skeleton-4',
  'invitee-skeleton-5',
]

export function InviteesDialog(props: InviteesDialogProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ['wallet', 'invitees', page, pageSize],
    queryFn: async () => {
      const response = await getUserInvitees(page, pageSize)
      if (!isApiSuccess(response) || !response.data) {
        throw new Error(response.message || t('Failed to load invite details'))
      }
      return response.data
    },
    enabled: props.open,
  })

  const invitees = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const firstVisibleInvitee = (page - 1) * pageSize + 1
  const lastVisibleInvitee = Math.min(page * pageSize, total)
  const pageSizeItems = [
    { value: '10', label: t('10 / page') },
    { value: '20', label: t('20 / page') },
    { value: '50', label: t('50 / page') },
    { value: '100', label: t('100 / page') },
  ]

  const handleOpenChange = (open: boolean) => {
    if (!open) setPage(1)
    props.onOpenChange(open)
  }

  const handlePageSizeChange = (value: string | null) => {
    if (value === null) return
    setPageSize(Number.parseInt(value, 10))
    setPage(1)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('Invite Details')}
      description={t('View users who joined through your referral link.')}
      contentClassName='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-4xl'
      contentHeight='auto'
      bodyClassName='flex flex-col gap-3'
    >
      <div className='flex justify-end'>
        <Label htmlFor='invitees-page-size' className='sr-only'>
          {t('Rows per page')}
        </Label>
        <Select
          items={pageSizeItems}
          value={pageSize.toString()}
          onValueChange={handlePageSizeChange}
        >
          <SelectTrigger id='invitees-page-size' className='h-9 w-32'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {pageSizeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className='border-border/70 max-h-[min(54vh,520px)] overflow-auto rounded-md border'>
        {isLoading ? (
          <Table className='min-w-[420px]'>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Display Name')}</TableHead>
                <TableHead>{t('Invited At')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SKELETON_ROW_IDS.map((rowId) => (
                <TableRow key={rowId}>
                  <TableCell>
                    <Skeleton className='h-4 w-32' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-36' />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {!isLoading && isError ? (
          <EmptyState
            title={t('Failed to load invite details')}
            description={error.message || undefined}
            action={
              <Button variant='outline' onClick={() => void refetch()}>
                {t('Retry')}
              </Button>
            }
            className='min-h-56'
          />
        ) : null}
        {!isLoading && !isError && invitees.length === 0 ? (
          <EmptyState
            title={t('No invitees yet')}
            description={t(
              'Users who register through your referral link will appear here.'
            )}
            className='min-h-56'
          />
        ) : null}
        {!isLoading && !isError && invitees.length > 0 ? (
          <Table className='min-w-[420px]'>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Display Name')}</TableHead>
                <TableHead>{t('Invited At')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitees.map((invitee) => (
                <TableRow key={invitee.id}>
                  <TableCell className='max-w-64 font-medium'>
                    <div className='flex min-w-0 items-center gap-2'>
                      <span className='truncate'>{invitee.display_name}</span>
                      {invitee.is_new ? (
                        <Badge variant='secondary' className='shrink-0'>
                          {t('New')}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatTimestampToDate(invitee.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>

      {!isLoading && !isError && invitees.length > 0 ? (
        <div className='flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between'>
          <div className='text-muted-foreground text-xs sm:text-sm'>
            {t('Showing {{from}}-{{to}} of {{total}}', {
              from: firstVisibleInvitee,
              to: lastVisibleInvitee,
              total,
            })}
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='icon'
              onClick={() => setPage((currentPage) => currentPage - 1)}
              disabled={page <= 1}
              aria-label={t('Previous page')}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden='true' />
            </Button>
            <div className='text-muted-foreground flex items-center gap-1 text-sm'>
              <span className='font-medium'>{page}</span>
              <span>/</span>
              <span>{totalPages}</span>
            </div>
            <Button
              variant='outline'
              size='icon'
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={page >= totalPages}
              aria-label={t('Next page')}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden='true' />
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
