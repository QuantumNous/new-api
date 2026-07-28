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
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { PageFooterPortal, SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  approveTopUpReview,
  getTopUpReviews,
  rejectTopUpReview,
} from '@/features/wallet/api'
import type {
  TopUpReview,
  TopUpSubmissionStatus,
} from '@/features/wallet/types'
import { getCurrentIntlLocale } from '@/i18n/languages'
import { formatDateTimeObject } from '@/lib/time'

const PAGE_SIZE = 12
const SKELETON_KEYS = ['first', 'second', 'third', 'fourth']

function getStatusVariant(value: TopUpSubmissionStatus) {
  if (value === 'approved') return 'success' as const
  if (value === 'rejected') return 'danger' as const
  return 'warning' as const
}

function getStatusLabel(value: TopUpSubmissionStatus) {
  if (value === 'approved') return 'Approved'
  if (value === 'rejected') return 'Rejected'
  return 'Submitted'
}

export function TopUpReviews() {
  const { t } = useTranslation()
  const [items, setItems] = useState<TopUpReview[]>([])
  const [status, setStatus] = useState('submitted')
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [rejectItem, setRejectItem] = useState<TopUpReview | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getTopUpReviews({
        status,
        keyword: search,
        page,
        page_size: PAGE_SIZE,
      })
      setItems(response.data?.items || [])
      setTotal(response.data?.total || 0)
    } catch {
      toast.error(t('Failed to load top-up reviews'))
    } finally {
      setLoading(false)
    }
  }, [page, search, status, t])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (item: TopUpReview) => {
    if (!window.confirm(t('Approve this payment proof?'))) return
    setActing(true)
    try {
      const response = await approveTopUpReview(item.id)
      if (response.success || response.message === 'success') {
        toast.success(t('Payment proof approved'))
        await load()
      } else toast.error(response.message || t('Review failed'))
    } catch {
      toast.error(t('Review failed'))
    } finally {
      setActing(false)
    }
  }

  const reject = async () => {
    if (!rejectItem || !reason.trim()) return
    if (!window.confirm(t('Reject this payment proof?'))) return
    setActing(true)
    try {
      const response = await rejectTopUpReview(rejectItem.id, reason.trim())
      if (response.success || response.message === 'success') {
        toast.success(t('Payment proof rejected'))
        setRejectItem(null)
        setReason('')
        await load()
      } else toast.error(response.message || t('Review failed'))
    } catch {
      toast.error(t('Review failed'))
    } finally {
      setActing(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Top-up Reviews')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            <form
              className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center'
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
                setSearch(keyword.trim())
              }}
            >
              <div className='relative min-w-0 flex-1'>
                <Search
                  className='text-muted-foreground absolute top-2 left-2.5 size-4'
                  aria-hidden='true'
                />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={t('Search user or order number')}
                  className='pl-9'
                  aria-label={t('Search user or order number')}
                />
              </div>
              <Select
                items={[
                  { value: 'submitted', label: t('Submitted') },
                  { value: 'approved', label: t('Approved') },
                  { value: 'rejected', label: t('Rejected') },
                  { value: '', label: t('All statuses') },
                ]}
                value={status}
                onValueChange={(value) => {
                  setStatus(value || '')
                  setPage(1)
                }}
              >
                <SelectTrigger className='w-full sm:w-44'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value='submitted'>{t('Submitted')}</SelectItem>
                  <SelectItem value='approved'>{t('Approved')}</SelectItem>
                  <SelectItem value='rejected'>{t('Rejected')}</SelectItem>
                  <SelectItem value=''>{t('All statuses')}</SelectItem>
                </SelectContent>
              </Select>
              <Button type='submit' className='w-full sm:w-auto'>
                {t('Search')}
              </Button>
            </form>
            {loading && (
              <div className='grid gap-3 md:grid-cols-2'>
                {SKELETON_KEYS.map((key) => (
                  <Skeleton key={key} className='h-64' />
                ))}
              </div>
            )}
            {!loading && items.length === 0 && (
              <p className='text-muted-foreground py-16 text-center'>
                {t('No review submissions found')}
              </p>
            )}
            {!loading && items.length > 0 && (
              <div className='grid gap-3 md:grid-cols-2'>
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardContent className='space-y-3 p-4'>
                      <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                        <div className='min-w-0'>
                          <p className='font-medium'>{item.username}</p>
                          <code className='text-muted-foreground text-xs break-all'>
                            {item.trade_no}
                          </code>
                        </div>
                        <StatusBadge
                          label={t(getStatusLabel(item.status))}
                          variant={getStatusVariant(item.status)}
                          copyable={false}
                        />
                      </div>
                      <dl className='grid grid-cols-1 gap-2 text-sm sm:grid-cols-2'>
                        <div>
                          <dt className='text-muted-foreground'>
                            {t('Target')}
                          </dt>
                          <dd>
                            {item.order_type === 'subscription'
                              ? item.plan_title || `#${item.plan_id}`
                              : t('Wallet balance')}
                          </dd>
                        </div>
                        <div>
                          <dt className='text-muted-foreground'>
                            {t('Amount')}
                          </dt>
                          <dd>
                            {new Intl.NumberFormat(getCurrentIntlLocale(), {
                              style: 'currency',
                              currency: item.currency || 'VND',
                            }).format(item.money)}
                          </dd>
                        </div>
                        <div>
                          <dt className='text-muted-foreground'>
                            {t('Bank transaction number')}
                          </dt>
                          <dd className='break-all'>
                            {item.bank_transaction_no || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className='text-muted-foreground'>
                            {t('Submitted at')}
                          </dt>
                          <dd>
                            {formatDateTimeObject(
                              new Date(item.submitted_at * 1000)
                            )}
                          </dd>
                        </div>
                      </dl>
                      {item.note ? (
                        <p className='bg-muted rounded-md p-2 text-sm'>
                          <span className='font-medium'>{t('Note')}: </span>
                          {item.note}
                        </p>
                      ) : null}
                      {item.proof_url ? (
                        <a
                          href={item.proof_url}
                          target='_blank'
                          rel='noreferrer'
                          className='block'
                        >
                          <img
                            src={item.proof_url}
                            alt={t('Payment proof')}
                            className='max-h-52 w-full rounded-md border object-contain'
                            loading='lazy'
                          />
                        </a>
                      ) : null}
                      {item.status === 'submitted' && (
                        <div className='flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end'>
                          <Button
                            variant='destructive'
                            size='sm'
                            className='w-full sm:w-auto'
                            onClick={() => setRejectItem(item)}
                            disabled={acting}
                          >
                            {t('Reject')}
                          </Button>
                          <Button
                            size='sm'
                            className='w-full sm:w-auto'
                            onClick={() => void approve(item)}
                            disabled={acting}
                          >
                            {t('Approve')}
                          </Button>
                        </div>
                      )}
                      {item.status !== 'submitted' && item.review_note ? (
                        <p className='text-muted-foreground text-sm'>
                          {t('Review note')}: {item.review_note}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <PageFooterPortal>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <p className='text-muted-foreground text-sm'>
                {t('Total')}: {total}
              </p>
              <div className='flex items-center justify-end gap-2'>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => setPage((value) => value - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft aria-hidden='true' />
                </Button>
                <span className='text-sm tabular-nums'>
                  {page} / {totalPages}
                </span>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => setPage((value) => value + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight aria-hidden='true' />
                </Button>
              </div>
            </div>
          </PageFooterPortal>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      <Dialog
        open={rejectItem !== null}
        onOpenChange={(open) => !open && setRejectItem(null)}
        title={t('Reject payment proof')}
        description={t('Enter a reason, then confirm the rejection.')}
        contentClassName='sm:max-w-md'
      >
        <div className='space-y-3'>
          <Label htmlFor='reject-reason'>{t('Rejection reason')}</Label>
          <Textarea
            id='reject-reason'
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
          <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
            <Button
              variant='outline'
              className='w-full sm:w-auto'
              onClick={() => setRejectItem(null)}
            >
              {t('Cancel')}
            </Button>
            <Button
              variant='destructive'
              className='w-full sm:w-auto'
              disabled={!reason.trim() || acting}
              onClick={() => void reject()}
            >
              {t('Reject')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
