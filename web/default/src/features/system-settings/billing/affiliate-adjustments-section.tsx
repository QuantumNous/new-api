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
import { ChevronLeft, ChevronRight, MinusCircle, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  formatQuotaAsCNY,
  formatTimestampToDate,
  parseQuotaFromCNY,
  quotaUnitsToCNY,
} from '@/lib/format'

import { adjustAffiliateReward, getAffiliateAdminRewards } from '../api'
import type { AffiliateAdminReward } from '../types'

const PAGE_SIZE = 20

function formatCNY(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100)
}

export function AffiliateAdjustmentsSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<AffiliateAdminReward>()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const query = useQuery({
    queryKey: ['admin', 'affiliate', 'rewards', page, keyword, status],
    queryFn: () =>
      getAffiliateAdminRewards({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        status: status || undefined,
      }),
    select: (response) => response.data,
  })
  const mutation = useMutation({
    mutationFn: (request: {
      rewardId: number
      amount_quota: number
      reason: string
      request_key: string
    }) =>
      adjustAffiliateReward(request.rewardId, {
        amount_quota: request.amount_quota,
        reason: request.reason,
        request_key: request.request_key,
      }),
    onSuccess: async (response) => {
      if (!response.success || !response.data) return
      if (response.data.pending_manual_quota > 0) {
        toast.warning(
          t('{{amount}} requires separate manual handling', {
            amount: formatQuotaAsCNY(response.data.pending_manual_quota),
          })
        )
      } else {
        toast.success(t('Cashback adjustment recorded'))
      }
      setSelected(undefined)
      setAmount('')
      setReason('')
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'affiliate', 'rewards'],
      })
    },
  })

  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const statusLabels = {
    pending: t('Frozen'),
    available: t('Available to transfer'),
    transferred: t('Transferred'),
    adjusted: t('Adjusted'),
  }

  function search(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setKeyword(searchInput.trim())
  }

  function openAdjustment(reward: AffiliateAdminReward) {
    setSelected(reward)
    setAmount(
      String(quotaUnitsToCNY(reward.actual_quota - reward.adjusted_quota))
    )
    setReason('')
  }

  function submitAdjustment(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const amountQuota = parseQuotaFromCNY(Number(amount))
    if (amountQuota <= 0 || !reason.trim()) {
      toast.error(t('Enter an adjustment amount and reason'))
      return
    }
    mutation.mutate({
      rewardId: selected.id,
      amount_quota: amountQuota,
      reason: reason.trim(),
      request_key: crypto.randomUUID(),
    })
  }

  const untransferredQuota = selected
    ? Math.max(
        0,
        selected.actual_quota -
          selected.adjusted_quota -
          selected.transferred_quota
      )
    : 0
  const requestedQuota = parseQuotaFromCNY(Number(amount))

  return (
    <div className='grid gap-4'>
      <form
        className='grid gap-3 sm:grid-cols-[minmax(240px,1fr)_180px_auto] sm:items-end'
        onSubmit={search}
      >
        <Field>
          <FieldLabel htmlFor='affiliate-reward-search'>
            {t('Search cashback records')}
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id='affiliate-reward-search'
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('User, email, invitation code, or order number')}
            />
            <InputGroupAddon align='inline-end'>
              <InputGroupButton
                type='submit'
                aria-label={t('Search')}
                title={t('Search')}
              >
                <Search />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor='affiliate-reward-status'>
            {t('Status')}
          </FieldLabel>
          <NativeSelect
            id='affiliate-reward-status'
            className='w-full'
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value)
            }}
          >
            <NativeSelectOption value=''>{t('All')}</NativeSelectOption>
            <NativeSelectOption value='pending'>
              {t('Frozen')}
            </NativeSelectOption>
            <NativeSelectOption value='available'>
              {t('Available to transfer')}
            </NativeSelectOption>
            <NativeSelectOption value='transferred'>
              {t('Transferred')}
            </NativeSelectOption>
            <NativeSelectOption value='adjusted'>
              {t('Adjusted')}
            </NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button type='submit' variant='outline'>
          <Search data-icon='inline-start' />
          {t('Search')}
        </Button>
      </form>

      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Inviter')}</TableHead>
              <TableHead>{t('Invitee')}</TableHead>
              <TableHead>{t('Order number')}</TableHead>
              <TableHead>{t('Top-up time')}</TableHead>
              <TableHead>{t('Paid amount')}</TableHead>
              <TableHead>{t('Cashback')}</TableHead>
              <TableHead>{t('Transferred')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead className='text-right'>{t('Action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((reward) => (
              <TableRow key={reward.id}>
                <TableCell className='whitespace-nowrap'>
                  {reward.inviter_username} #{reward.inviter_user_id}
                </TableCell>
                <TableCell className='whitespace-nowrap'>
                  {reward.invitee_email}
                </TableCell>
                <TableCell className='font-mono text-xs whitespace-nowrap'>
                  {reward.trade_no || `#${reward.topup_id}`}
                </TableCell>
                <TableCell className='whitespace-nowrap'>
                  {formatTimestampToDate(reward.created_at)}
                </TableCell>
                <TableCell>{formatCNY(reward.paid_cents)}</TableCell>
                <TableCell>{formatQuotaAsCNY(reward.actual_quota)}</TableCell>
                <TableCell>
                  {formatQuotaAsCNY(reward.transferred_quota)}
                </TableCell>
                <TableCell>
                  <Badge variant='outline'>{statusLabels[reward.status]}</Badge>
                </TableCell>
                <TableCell className='text-right'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={reward.adjusted_quota >= reward.actual_quota}
                    onClick={() => openAdjustment(reward)}
                  >
                    <MinusCircle data-icon='inline-start' />
                    {t('Adjust cashback')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!query.isLoading && items.length === 0 ? (
        <Empty className='min-h-40'>
          <EmptyHeader>
            <EmptyTitle>{t('No cashback records found')}</EmptyTitle>
            <EmptyDescription>
              {t('Try changing the search or status filter.')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {query.isLoading ? <Spinner className='mx-auto my-8' /> : null}

      {!query.isLoading && total > 0 ? (
        <div className='border-border flex items-center justify-between gap-3 border-t pt-3'>
          <div className='text-muted-foreground text-xs'>
            {t('Showing')} {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, total)} {t('of')} {total}
          </div>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='size-8 p-0'
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              aria-label={t('Previous page')}
              title={t('Previous page')}
            >
              <ChevronLeft />
            </Button>
            <span className='text-muted-foreground min-w-12 text-center text-sm tabular-nums'>
              {page} / {totalPages}
            </span>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='size-8 p-0'
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              aria-label={t('Next page')}
              title={t('Next page')}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined)
        }}
      >
        <DialogContent className='sm:max-w-lg'>
          <form onSubmit={submitAdjustment}>
            <DialogHeader>
              <DialogTitle>{t('Adjust cashback')}</DialogTitle>
              <DialogDescription>
                {t(
                  'Reduce the original cashback after a refund or chargeback. This action is recorded in the affiliate ledger.'
                )}
              </DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-5'>
              <div className='grid grid-cols-3 gap-3 text-xs'>
                <div>
                  <div className='text-muted-foreground'>{t('Original')}</div>
                  <div className='mt-1 font-semibold'>
                    {formatQuotaAsCNY(selected?.actual_quota ?? 0)}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground'>
                    {t('Already adjusted')}
                  </div>
                  <div className='mt-1 font-semibold'>
                    {formatQuotaAsCNY(selected?.adjusted_quota ?? 0)}
                  </div>
                </div>
                <div>
                  <div className='text-muted-foreground'>
                    {t('Already transferred')}
                  </div>
                  <div className='mt-1 font-semibold'>
                    {formatQuotaAsCNY(selected?.transferred_quota ?? 0)}
                  </div>
                </div>
              </div>
              <Field>
                <FieldLabel htmlFor='affiliate-adjustment-amount'>
                  {t('Adjustment amount')}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id='affiliate-adjustment-amount'
                    type='number'
                    min='0.01'
                    step='0.01'
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <InputGroupAddon align='inline-end'>
                    <InputGroupText>{t('CNY')}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                {requestedQuota > untransferredQuota ? (
                  <FieldDescription className='text-amber-700 dark:text-amber-400'>
                    {t(
                      'The transferred portion cannot be deducted automatically and will require separate manual handling.'
                    )}
                  </FieldDescription>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor='affiliate-adjustment-reason'>
                  {t('Reason')}
                </FieldLabel>
                <Textarea
                  id='affiliate-adjustment-reason'
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t('Required for audit history')}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setSelected(undefined)}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Spinner data-icon='inline-start' />
                ) : (
                  <MinusCircle data-icon='inline-start' />
                )}
                {t('Confirm adjustment')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
