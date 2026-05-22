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
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, HandCoins, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import { formatRewardPoints } from '@/features/wallet/lib'
import {
  getAdminAffiliateRewardPointSettlements,
  getAdminAffiliateSummary,
  offlineCashbackAffiliateRewardPoints,
} from './api'
import type {
  AffiliateRewardPointSettlement,
  AffiliateRewardPointSettlementFilters,
  AffiliateRewardPointSettlementQuery,
} from './types'

const PAGE_SIZE = 20

function formatPoints(points: number | undefined) {
  return formatRewardPoints(points || 0)
}

function settlementLabelKey(row: AffiliateRewardPointSettlement) {
  return row.settlement_type === 'wallet'
    ? 'Wallet redemption'
    : 'Offline cashback'
}

function toQuery(
  filters: AffiliateRewardPointSettlementFilters,
  page: number
): AffiliateRewardPointSettlementQuery {
  return {
    ...filters,
    p: page,
    page_size: PAGE_SIZE,
  }
}

export function AffiliateCommissions() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<AffiliateRewardPointSettlementFilters>(
    {
      settlement_type: '',
      promoter_id: '',
    }
  )
  const [cashbackOpen, setCashbackOpen] = useState(false)
  const [cashbackPromoterId, setCashbackPromoterId] = useState('')
  const [cashbackPoints, setCashbackPoints] = useState('')
  const [cashbackRemark, setCashbackRemark] = useState('')

  const settlementQuery = useMemo(() => toQuery(filters, page), [filters, page])
  const summaryQuery = useMemo(
    () => ({
      promoter_id: filters.promoter_id || undefined,
    }),
    [filters.promoter_id]
  )

  const settlementsQuery = useQuery({
    queryKey: ['affiliate-reward-settlements', settlementQuery],
    queryFn: () => getAdminAffiliateRewardPointSettlements(settlementQuery),
  })

  const summaryQueryResult = useQuery({
    queryKey: ['affiliate-commissions-summary', summaryQuery],
    queryFn: () => getAdminAffiliateSummary(summaryQuery),
  })

  const cashbackMutation = useMutation({
    mutationFn: () =>
      offlineCashbackAffiliateRewardPoints({
        promoter_id: Number(cashbackPromoterId),
        points: Number(cashbackPoints),
        remark: cashbackRemark,
      }),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to record offline cashback'))
        return
      }
      toast.success(t('Offline cashback recorded'))
      setCashbackOpen(false)
      setCashbackPromoterId('')
      setCashbackPoints('')
      setCashbackRemark('')
      queryClient.invalidateQueries({
        queryKey: ['affiliate-reward-settlements'],
      })
      queryClient.invalidateQueries({
        queryKey: ['affiliate-commissions-summary'],
      })
      queryClient.invalidateQueries({ queryKey: ['affiliate-commissions'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to record offline cashback'))
    },
  })

  const data = settlementsQuery.data?.data
  const rows = data?.items || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const summary = summaryQueryResult.data?.data
  const cashbackPromoterIdValue = Number(cashbackPromoterId)
  const cashbackPointsValue = Number(cashbackPoints)
  const cashbackValid =
    Number.isInteger(cashbackPromoterIdValue) &&
    cashbackPromoterIdValue > 0 &&
    Number.isInteger(cashbackPointsValue) &&
    cashbackPointsValue > 0

  const updateFilter = (
    key: keyof AffiliateRewardPointSettlementFilters,
    value: string
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const submitCashback = () => {
    if (!cashbackValid) {
      toast.error(t('Enter a valid user ID and point amount'))
      return
    }
    cashbackMutation.mutate()
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Reward Points Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Manage wallet redemptions and offline cashback point deductions')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            onClick={() => {
              settlementsQuery.refetch()
              summaryQueryResult.refetch()
            }}
          >
            <RefreshCw className='size-4' />
            {t('Refresh')}
          </Button>
          <Button onClick={() => setCashbackOpen(true)}>
            <Gift className='size-4' />
            {t('Record offline cashback')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4'>
            <div className='grid gap-3 sm:grid-cols-4'>
              {[
                [
                  t('Pending Points'),
                  formatPoints(summary?.pending_points),
                  summary?.pending_count || 0,
                ],
                [
                  t('Redeemed Points'),
                  formatPoints(summary?.redeemed_points ?? summary?.settled_points),
                  summary?.redeemed_count ?? summary?.settled_count ?? 0,
                ],
                [
                  t('Offline Cashback Points'),
                  formatPoints(
                    summary?.offline_cashback_points ??
                      summary?.offline_settled_points
                  ),
                  summary?.offline_cashback_count ??
                    summary?.offline_settled_count ??
                    0,
                ],
                [
                  t('Total Points'),
                  formatPoints(summary?.total_points),
                  summary?.total_count || 0,
                ],
              ].map(([label, amount, count]) => (
                <Card key={String(label)}>
                  <CardHeader className='pb-2'>
                    <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                      <HandCoins className='text-muted-foreground size-4' />
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-semibold tabular-nums'>
                      {amount} {t('points')}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t('{{count}} records', { count })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className='space-y-4 p-4'>
                <div className='grid gap-3 md:grid-cols-4'>
                  <div className='space-y-1.5'>
                    <Label>{t('Processing Type')}</Label>
                    <NativeSelect
                      className='w-full'
                      value={filters.settlement_type || ''}
                      onChange={(event) =>
                        updateFilter('settlement_type', event.target.value)
                      }
                    >
                      <NativeSelectOption value=''>
                        {t('All types')}
                      </NativeSelectOption>
                      <NativeSelectOption value='wallet'>
                        {t('Wallet redemption')}
                      </NativeSelectOption>
                      <NativeSelectOption value='offline_cashback'>
                        {t('Offline cashback')}
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>{t('User ID')}</Label>
                    <Input
                      value={filters.promoter_id || ''}
                      onChange={(event) =>
                        updateFilter('promoter_id', event.target.value)
                      }
                    />
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('User')}</TableHead>
                      <TableHead>{t('Processing Type')}</TableHead>
                      <TableHead>{t('Points')}</TableHead>
                      <TableHead>{t('Wallet Credit')}</TableHead>
                      <TableHead>{t('Operator')}</TableHead>
                      <TableHead>{t('Remark')}</TableHead>
                      <TableHead>{t('Processed At')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='text-muted-foreground h-24 text-center'
                        >
                          {settlementsQuery.isLoading
                            ? t('Loading...')
                            : t('No reward point activity')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            #{row.promoter_id}{' '}
                            <span className='text-muted-foreground'>
                              {row.promoter_username || ''}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.settlement_type === 'wallet'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {t(settlementLabelKey(row))}
                            </Badge>
                          </TableCell>
                          <TableCell className='tabular-nums'>
                            {formatPoints(row.points)} {t('points')}
                          </TableCell>
                          <TableCell className='tabular-nums'>
                            {row.wallet_quota > 0
                              ? formatQuota(row.wallet_quota)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {row.settled_by ? (
                              <>
                                #{row.settled_by}{' '}
                                <span className='text-muted-foreground'>
                                  {row.settled_by_username || ''}
                                </span>
                              </>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className='max-w-64 truncate'>
                            {row.remark || '-'}
                          </TableCell>
                          <TableCell className='text-muted-foreground'>
                            {formatTimestamp(row.settled_at || row.created_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className='flex items-center justify-between gap-2'>
                  <p className='text-muted-foreground text-sm'>
                    {t('Page {{page}} of {{total}}', {
                      page,
                      total: totalPages,
                    })}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      disabled={page <= 1}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      {t('Previous')}
                    </Button>
                    <Button
                      variant='outline'
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      {t('Next')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog open={cashbackOpen} onOpenChange={setCashbackOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('Record offline cashback')}</DialogTitle>
            <DialogDescription>
              {t('Deduct reward points after completing an offline cashback for a user.')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='offline-cashback-user'>
                  {t('User ID')}
                </Label>
                <Input
                  id='offline-cashback-user'
                  type='number'
                  min={1}
                  step={1}
                  value={cashbackPromoterId}
                  onChange={(event) =>
                    setCashbackPromoterId(event.target.value)
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='offline-cashback-points'>
                  {t('Points')}
                </Label>
                <Input
                  id='offline-cashback-points'
                  type='number'
                  min={1}
                  step={1}
                  value={cashbackPoints}
                  onChange={(event) => setCashbackPoints(event.target.value)}
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='offline-cashback-remark'>
                {t('Remark')}
              </Label>
              <Textarea
                id='offline-cashback-remark'
                value={cashbackRemark}
                onChange={(event) => setCashbackRemark(event.target.value)}
                placeholder={t('Optional')}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant='outline' />}>
              {t('Cancel')}
            </DialogClose>
            <Button
              onClick={submitCashback}
              disabled={cashbackMutation.isPending}
            >
              {cashbackMutation.isPending ? t('Saving...') : t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
