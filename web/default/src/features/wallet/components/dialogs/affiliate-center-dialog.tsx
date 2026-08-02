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
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
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
import { formatQuotaAsCNY, formatTimestampToDate } from '@/lib/format'

import type {
  AffiliateBalanceTransferResponse,
  AffiliateInviteeTopUp,
  AffiliateInviteeTopUpsQuery,
  AffiliateSummary,
  AffiliateTopUpSort,
  AffiliateTopUpStatus,
} from '../../types'

function formatCNY(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'CNY',
  }).format(cents / 100)
}

interface AffiliateCenterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary?: AffiliateSummary
  topUps: AffiliateInviteeTopUp[]
  topUpsTotal: number
  topUpQuery: AffiliateInviteeTopUpsQuery
  onTopUpQueryChange: (query: AffiliateInviteeTopUpsQuery) => void
  loading: boolean
  transferring: boolean
  onTransfer: (request: {
    amount_quota?: number
    reward_id?: number
    request_key: string
  }) => Promise<AffiliateBalanceTransferResponse>
}

interface ListPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

function ListPagination(props: ListPaginationProps) {
  const { t } = useTranslation()
  if (props.total <= 0) return null

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize))
  return (
    <div className='border-border mt-4 flex items-center justify-between gap-3 border-t pt-3'>
      <div className='text-muted-foreground text-xs'>
        {t('Showing')} {(props.page - 1) * props.pageSize + 1}-
        {Math.min(props.page * props.pageSize, props.total)} {t('of')}{' '}
        {props.total}
      </div>
      <div className='flex items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='size-8 p-0'
          disabled={props.page <= 1}
          onClick={() => props.onPageChange(props.page - 1)}
          aria-label={t('Previous page')}
          title={t('Previous page')}
        >
          <ChevronLeft />
        </Button>
        <span className='text-muted-foreground min-w-12 text-center text-sm tabular-nums'>
          {props.page} / {totalPages}
        </span>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='size-8 p-0'
          disabled={props.page >= totalPages}
          onClick={() => props.onPageChange(props.page + 1)}
          aria-label={t('Next page')}
          title={t('Next page')}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

function getStatusLabel(
  t: (key: string) => string,
  status: AffiliateTopUpStatus
) {
  const labels: Record<AffiliateTopUpStatus, string> = {
    unqualified: t('Not qualified'),
    pending: t('Frozen'),
    available: t('Available to transfer'),
    transferred: t('Transferred'),
    adjusted: t('Adjusted'),
  }
  return labels[status]
}

function getStatusClass(status: AffiliateTopUpStatus) {
  if (status === 'available') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (status === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (status === 'transferred') {
    return 'border-border bg-muted text-muted-foreground'
  }
  return 'border-border bg-background text-muted-foreground'
}

function getAvailableReward(topUp: AffiliateInviteeTopUp) {
  return topUp.available_reward_quota ?? topUp.reward_quota
}

function formatCashbackRule(
  t: (key: string, options?: Record<string, unknown>) => string,
  topUp: AffiliateInviteeTopUp
) {
  if (topUp.reward_mode === 'fixed') {
    return t('Fixed {{amount}}', {
      amount: formatQuotaAsCNY(topUp.fixed_reward_quota),
    })
  }
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(topUp.reward_rate_bps / 100)}%`
}

function formatUnlockTime(
  t: (key: string, options?: Record<string, unknown>) => string,
  topUp: AffiliateInviteeTopUp
) {
  if (topUp.status !== 'pending') {
    return topUp.available_at <= topUp.topup_at
      ? t('Immediately available')
      : formatTimestampToDate(topUp.available_at)
  }
  const remainingSeconds = topUp.available_at - Math.floor(Date.now() / 1000)
  if (remainingSeconds <= 0) {
    return t('Available now')
  }
  return t('Unlocks in {{count}} days', {
    count: Math.max(1, Math.ceil(remainingSeconds / 86400)),
  })
}

function TransferAction(props: {
  topUp: AffiliateInviteeTopUp
  disabled: boolean
  transferring: boolean
  onTransfer: (topUp: AffiliateInviteeTopUp) => void
}) {
  const { t } = useTranslation()
  const availableReward = getAvailableReward(props.topUp)
  const isTransferring = props.transferring
  const canTransfer = props.topUp.status === 'available' && availableReward > 0

  if (props.topUp.status === 'transferred') {
    return (
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled
        className='min-w-36'
      >
        {t('Transferred to balance')}
      </Button>
    )
  }

  if (props.topUp.status === 'pending') {
    return (
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled
        className='min-w-36'
      >
        <span className='flex flex-col items-center leading-tight'>
          <span>{t('Transfer to account balance')}</span>
          <span className='text-muted-foreground text-[11px]'>
            {formatUnlockTime(t, props.topUp)}
          </span>
        </span>
      </Button>
    )
  }

  return (
    <Button
      type='button'
      size='sm'
      className='min-w-36'
      disabled={!canTransfer || props.disabled || isTransferring}
      onClick={() => props.onTransfer(props.topUp)}
    >
      {isTransferring ? (
        <Spinner data-icon='inline-start' />
      ) : (
        <ArrowRightLeft data-icon='inline-start' />
      )}
      {t('Transfer to account balance')}
    </Button>
  )
}

function HiddenTopUpFallback(props: {
  availableQuota: number
  transferring: boolean
  onTransfer: () => void
}) {
  const { t } = useTranslation()
  return (
    <Empty className='min-h-48'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <ReceiptText />
        </EmptyMedia>
        <EmptyTitle>{t('Invitee top-up records are hidden')}</EmptyTitle>
        <EmptyDescription>
          {t('The administrator has disabled invitee top-up visibility.')}
        </EmptyDescription>
      </EmptyHeader>
      <Button
        type='button'
        disabled={props.availableQuota <= 0 || props.transferring}
        onClick={props.onTransfer}
      >
        {props.transferring ? (
          <Spinner data-icon='inline-start' />
        ) : (
          <ArrowRightLeft data-icon='inline-start' />
        )}
        {t('Transfer available cashback')}
      </Button>
    </Empty>
  )
}

export function AffiliateCenterDialog(props: AffiliateCenterDialogProps) {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState(props.topUpQuery.keyword ?? '')
  const [transferringRewardID, setTransferringRewardID] = useState<
    number | null
  >(null)
  const [selectedReward, setSelectedReward] =
    useState<AffiliateInviteeTopUp | null>(null)
  const account = props.summary?.account
  const rule = props.summary?.rule
  const activeStatus = props.topUpQuery.status
  const activeSort = props.topUpQuery.sort ?? 'recharge_time_desc'
  const queryKeyword = props.topUpQuery.keyword ?? ''
  const queryPageSize = props.topUpQuery.pageSize
  const queryStatus = props.topUpQuery.status
  const querySort = props.topUpQuery.sort
  const queryStartAt = props.topUpQuery.startAt
  const queryEndAt = props.topUpQuery.endAt
  const onTopUpQueryChange = props.onTopUpQueryChange

  useEffect(() => {
    const keyword = searchInput.trim()
    if (keyword === queryKeyword) return
    const timeout = window.setTimeout(() => {
      onTopUpQueryChange({
        page: 1,
        pageSize: queryPageSize,
        keyword: keyword || undefined,
        status: queryStatus,
        sort: querySort,
        startAt: queryStartAt,
        endAt: queryEndAt,
      })
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [
    onTopUpQueryChange,
    queryEndAt,
    queryKeyword,
    queryPageSize,
    querySort,
    queryStartAt,
    queryStatus,
    searchInput,
  ])

  async function confirmRewardTransfer() {
    if (!selectedReward) return
    setTransferringRewardID(selectedReward.id)
    try {
      const response = await props.onTransfer({
        reward_id: selectedReward.reward_id,
        request_key: crypto.randomUUID(),
      })
      if (response.success) setSelectedReward(null)
    } finally {
      setTransferringRewardID(null)
    }
  }

  async function transferAllAvailable() {
    const availableQuota = account?.available_quota ?? 0
    if (availableQuota <= 0) return
    setTransferringRewardID(-1)
    try {
      await props.onTransfer({
        amount_quota: availableQuota,
        request_key: crypto.randomUUID(),
      })
    } finally {
      setTransferringRewardID(null)
    }
  }

  function selectStatus(status?: AffiliateTopUpStatus) {
    props.onTopUpQueryChange({
      ...props.topUpQuery,
      page: 1,
      status,
    })
  }

  function selectSort(sort: AffiliateTopUpSort) {
    props.onTopUpQueryChange({
      ...props.topUpQuery,
      page: 1,
      sort,
    })
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[90vh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-6xl'>
        <DialogHeader>
          <DialogTitle>{t('Referral Cashback')}</DialogTitle>
          <DialogDescription>
            {t('Transfer available cashback and review invitee top-ups.')}
          </DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          {[
            [t('Frozen cashback'), account?.pending_quota ?? 0],
            [t('Available to transfer'), account?.available_quota ?? 0],
            [t('Transferred'), account?.transferred_quota ?? 0],
            [t('Lifetime earned'), account?.lifetime_earned_quota ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className='border-border border-l-2 pl-3'>
              <div className='text-muted-foreground text-xs'>{label}</div>
              <div className='mt-1 font-semibold tabular-nums'>
                {formatQuotaAsCNY(Number(value))}
              </div>
            </div>
          ))}
        </div>

        {rule?.show_invitee_topups ? (
          <div className='min-w-0 space-y-4 pt-2'>
            <div className='bg-muted/40 flex flex-wrap items-center gap-1 rounded-lg p-1'>
              <span className='text-muted-foreground px-3 text-xs font-medium'>
                {t('Record status')}
              </span>
              {(
                [
                  [undefined, t('All')],
                  ['pending', t('Frozen')],
                  ['available', t('Available to transfer')],
                  ['transferred', t('Transferred')],
                ] as const
              ).map(([status, label]) => (
                <Button
                  key={status ?? 'all'}
                  type='button'
                  variant={activeStatus === status ? 'secondary' : 'ghost'}
                  size='sm'
                  className='h-8 px-3 text-xs'
                  onClick={() => selectStatus(status)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h3 className='text-base font-semibold'>
                  {t('Invitee top-up records')}
                </h3>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {t('Sorted by recharge time. Emails are masked for privacy.')}
                </p>
              </div>
              <div className='flex w-full gap-2 sm:w-auto'>
                <InputGroup className='min-w-0 flex-1 sm:w-80'>
                  <InputGroupAddon align='inline-start'>
                    <Search aria-hidden='true' />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label={t('Search email or recharge time')}
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t('Search email or recharge time')}
                  />
                  {searchInput ? (
                    <InputGroupAddon align='inline-end'>
                      <InputGroupButton
                        type='button'
                        aria-label={t('Clear search')}
                        title={t('Clear search')}
                        onClick={() => setSearchInput('')}
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>
                <NativeSelect
                  aria-label={t('Sort by recharge time')}
                  value={activeSort}
                  onChange={(event) =>
                    selectSort(event.target.value as AffiliateTopUpSort)
                  }
                  className='w-36 shrink-0'
                >
                  <NativeSelectOption value='recharge_time_desc'>
                    {t('Newest recharge')}
                  </NativeSelectOption>
                  <NativeSelectOption value='recharge_time_asc'>
                    {t('Oldest recharge')}
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className='min-w-0 overflow-x-auto'>
              <Table className='min-w-[980px]'>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Invitee (privacy protected)')}</TableHead>
                    <TableHead>{t('Top-up time')}</TableHead>
                    <TableHead>{t('Paid amount')}</TableHead>
                    <TableHead>{t('Cashback rule')}</TableHead>
                    <TableHead>{t('Available cashback')}</TableHead>
                    <TableHead>{t('Unlock time')}</TableHead>
                    <TableHead>{t('Action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className='h-32 text-center'>
                        <Spinner className='mx-auto' />
                      </TableCell>
                    </TableRow>
                  ) : (
                    props.topUps.map((topUp) => {
                      const availableReward = getAvailableReward(topUp)
                      return (
                        <TableRow key={topUp.id}>
                          <TableCell>
                            <div className='font-medium whitespace-nowrap'>
                              {topUp.masked_email}
                            </div>
                            <div className='text-muted-foreground text-xs whitespace-nowrap'>
                              {t('Invited {{time}}', {
                                time: formatTimestampToDate(topUp.invited_at),
                              })}
                            </div>
                          </TableCell>
                          <TableCell className='whitespace-nowrap'>
                            {formatTimestampToDate(topUp.topup_at)}
                          </TableCell>
                          <TableCell className='whitespace-nowrap'>
                            {formatCNY(topUp.paid_cents)}
                          </TableCell>
                          <TableCell className='whitespace-nowrap'>
                            {formatCashbackRule(t, topUp)}
                          </TableCell>
                          <TableCell>
                            <div className='font-medium whitespace-nowrap'>
                              {formatQuotaAsCNY(availableReward)}
                            </div>
                            <Badge
                              variant='outline'
                              className={getStatusClass(topUp.status)}
                            >
                              {getStatusLabel(t, topUp.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className='whitespace-nowrap'>
                            {formatUnlockTime(t, topUp)}
                          </TableCell>
                          <TableCell>
                            <TransferAction
                              topUp={topUp}
                              disabled={props.transferring}
                              transferring={transferringRewardID === topUp.id}
                              onTransfer={setSelectedReward}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {!props.loading && props.topUps.length === 0 ? (
              <Empty className='min-h-48'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <ReceiptText />
                  </EmptyMedia>
                  <EmptyTitle>{t('No invitee top-ups yet')}</EmptyTitle>
                  <EmptyDescription>
                    {t('Successful online wallet top-ups will appear here.')}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            <ListPagination
              page={props.topUpQuery.page}
              pageSize={props.topUpQuery.pageSize}
              total={props.topUpsTotal}
              onPageChange={(page) =>
                props.onTopUpQueryChange({ ...props.topUpQuery, page })
              }
            />
          </div>
        ) : (
          <HiddenTopUpFallback
            availableQuota={account?.available_quota ?? 0}
            transferring={props.transferring || transferringRewardID === -1}
            onTransfer={transferAllAvailable}
          />
        )}
        <ConfirmDialog
          open={selectedReward !== null}
          onOpenChange={(open) => {
            if (!open && !props.transferring) setSelectedReward(null)
          }}
          title={t('Confirm cashback transfer')}
          desc={t('Transfer {{amount}} to your account balance?', {
            amount: formatQuotaAsCNY(
              selectedReward ? getAvailableReward(selectedReward) : 0
            ),
          })}
          confirmText={t('Transfer to account balance')}
          handleConfirm={confirmRewardTransfer}
          isLoading={props.transferring}
        />
      </DialogContent>
    </Dialog>
  )
}
