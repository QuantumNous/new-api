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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useDebounce } from '@/hooks/use-debounce'

import {
  deleteInvitationCode,
  getInvitationCodes,
  updateInvitationCodeStatus,
} from '../api'
import { INVITATION_CODE_STATUS } from '../constants'
import type { InvitationCode } from '../types'
import { InvitationCodesDataView } from './invitation-codes-data-view'

const PAGE_SIZE = 20

export function InvitationCodesTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<InvitationCode | null>(
    null
  )
  const debouncedKeyword = useDebounce(keyword, 300)

  const query = useQuery({
    queryKey: [
      'invitation-codes',
      { keyword: debouncedKeyword, status, page, pageSize: PAGE_SIZE },
    ],
    queryFn: async () => {
      const result = await getInvitationCodes({
        keyword: debouncedKeyword,
        status,
        p: page,
        page_size: PAGE_SIZE,
      })
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to load invitation codes')
      }
      return result.data
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (invitationCode: InvitationCode) => {
      const nextStatus =
        invitationCode.status === INVITATION_CODE_STATUS.ENABLED
          ? INVITATION_CODE_STATUS.DISABLED
          : INVITATION_CODE_STATUS.ENABLED
      return updateInvitationCodeStatus(invitationCode.id, nextStatus)
    },
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to update invitation code'))
        return
      }
      toast.success(t('Invitation code updated'))
      queryClient.invalidateQueries({ queryKey: ['invitation-codes'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInvitationCode,
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.message || t('Failed to delete invitation code'))
        return
      }
      toast.success(t('Invitation code deleted'))
      setPendingDelete(null)
      queryClient.invalidateQueries({ queryKey: ['invitation-codes'] })
    },
  })

  const pageInfo = query.data
  const items = pageInfo?.items ?? []
  const total = pageInfo?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  const handleKeywordChange = (value: string) => {
    setKeyword(value)
    setPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <div className='relative w-full sm:max-w-sm'>
          <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
          <Input
            value={keyword}
            onChange={(event) => handleKeywordChange(event.target.value)}
            placeholder={t('Search invitation codes')}
            aria-label={t('Search invitation codes')}
            className='pl-8'
          />
        </div>
        <NativeSelect
          value={status}
          onChange={(event) => handleStatusChange(event.target.value)}
          aria-label={t('Filter by status')}
          className='w-full sm:w-44'
        >
          <NativeSelectOption value=''>{t('All statuses')}</NativeSelectOption>
          <NativeSelectOption value='enabled'>{t('Unused')}</NativeSelectOption>
          <NativeSelectOption value='used'>{t('Used')}</NativeSelectOption>
          <NativeSelectOption value='disabled'>
            {t('Disabled')}
          </NativeSelectOption>
          <NativeSelectOption value='expired'>
            {t('Expired')}
          </NativeSelectOption>
        </NativeSelect>
      </div>

      <div className='min-h-0 flex-1 overflow-auto rounded-lg border'>
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? (
          <ErrorState
            description={t('Failed to load invitation codes')}
            onRetry={() => query.refetch()}
          />
        ) : null}
        {!query.isLoading && !query.isError && items.length === 0 ? (
          <EmptyState
            title={t('No invitation codes')}
            description={t('Generate a code to allow new account registration')}
          />
        ) : null}

        {!query.isLoading && !query.isError && items.length > 0 ? (
          <InvitationCodesDataView
            items={items}
            isUpdating={statusMutation.isPending}
            onStatusChange={statusMutation.mutate}
            onDelete={setPendingDelete}
          />
        ) : null}
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
        <span className='text-muted-foreground'>
          {t('{{start}}-{{end}} of {{total}}', {
            start: rangeStart,
            end: rangeEnd,
            total,
          })}
        </span>
        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || query.isFetching}
          >
            {t('Previous')}
          </Button>
          <span className='min-w-16 text-center'>
            {page} / {totalPages}
          </span>
          <Button
            size='sm'
            variant='outline'
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={page >= totalPages || query.isFetching}
          >
            {t('Next')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        destructive
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('Delete invitation code?')}
        desc={t('This invitation code will be permanently deleted.')}
        confirmText={t('Delete')}
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
        }}
      />
    </div>
  )
}
