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
*/
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestampToDate } from '@/lib/format'

import { listDistributorSubUsers } from '../api'
import { ERROR_MESSAGES } from '../constants'

const PAGE_SIZE = 20

export function DistributorSubUsersTab({
  distributorId,
}: {
  distributorId: number
}) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['distributor-sub-users', distributorId, page],
    queryFn: async () => {
      const result = await listDistributorSubUsers(distributorId, {
        page,
        page_size: PAGE_SIZE,
      })
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_SUB_USERS_FAILED))
        return { items: [], total: 0 }
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className='space-y-4'>
      <div className='overflow-hidden rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('ID')}</TableHead>
              <TableHead>{t('Username')}</TableHead>
              <TableHead>{t('Email')}</TableHead>
              <TableHead>{t('Quota')}</TableHead>
              <TableHead>{t('Used Quota')}</TableHead>
              <TableHead>{t('Created At')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-8 text-center'>
                  {t('Loading...')}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-8 text-center'>
                  {t('No sub-users found')}
                </TableCell>
              </TableRow>
            )}
            {items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className='tabular-nums'>{user.id}</TableCell>
                <TableCell className='font-medium'>{user.username}</TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {user.email || '-'}
                </TableCell>
                <TableCell className='tabular-nums'>{user.quota}</TableCell>
                <TableCell className='tabular-nums'>
                  {user.used_quota}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {user.created_at > 0
                    ? formatTimestampToDate(user.created_at)
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground text-sm'>
            {t('Page')} {page} / {totalPages}
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
