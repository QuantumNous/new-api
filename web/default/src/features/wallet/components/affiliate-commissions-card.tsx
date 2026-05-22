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
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks'
import { HandCoins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getSelf } from '@/lib/api'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  getSelfAffiliateRewardPointSettlements,
  getSelfAffiliateSummary,
  quoteSelfAffiliateRewardPoints,
  redeemSelfAffiliateRewardPoints,
} from '@/features/affiliate-commissions/api'
import type { AffiliateRewardPointSettlement } from '@/features/affiliate-commissions/types'
import { formatRewardPoints } from '../lib'

function formatPoints(points: number | undefined) {
  return formatRewardPoints(points || 0)
}

function getProcessedPoints(summary: { redeemed_points?: number; settled_points?: number } | undefined) {
  return summary?.redeemed_points ?? summary?.settled_points ?? 0
}

function getSettlementLabelKey(row: AffiliateRewardPointSettlement) {
  return row.settlement_type === 'wallet'
    ? 'Wallet redemption'
    : 'Processed by admin'
}

export function AffiliateCommissionsCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemPointsInput, setRedeemPointsInput] = useState('')
  const summaryQuery = useQuery({
    queryKey: ['self-affiliate-summary'],
    queryFn: getSelfAffiliateSummary,
  })
  const settlementsQuery = useQuery({
    queryKey: ['self-affiliate-reward-settlements'],
    queryFn: () => getSelfAffiliateRewardPointSettlements({ p: 1, page_size: 8 }),
  })

  const summary = summaryQuery.data?.data
  const rows = settlementsQuery.data?.data?.items || []
  const loading = summaryQuery.isLoading || settlementsQuery.isLoading
  const pendingPoints = summary?.pending_points || 0
  const processedPoints = getProcessedPoints(summary)
  const redeemPoints = Number(redeemPointsInput)
  const redeemPointsEntered = redeemPointsInput.trim().length > 0
  const redeemPointsValid =
    redeemPointsEntered &&
    Number.isInteger(redeemPoints) &&
    redeemPoints >= 1 &&
    redeemPoints <= pendingPoints
  const redeemPointsError =
    redeemPointsEntered && !redeemPointsValid
      ? t('Points must be between 1 and {{max}}', {
          max: formatPoints(pendingPoints),
        })
      : undefined
  const debouncedRedeemPoints = useDebounce(
    redeemPointsValid ? redeemPoints : 0
  )
  const quoteQuery = useQuery({
    queryKey: ['self-affiliate-reward-quote', debouncedRedeemPoints],
    queryFn: () =>
      quoteSelfAffiliateRewardPoints({ points: debouncedRedeemPoints }),
    enabled:
      redeemOpen && redeemPointsValid && debouncedRedeemPoints === redeemPoints,
  })
  const quote =
    quoteQuery.data?.success &&
    debouncedRedeemPoints === redeemPoints &&
    redeemPointsValid
      ? quoteQuery.data.data
      : undefined
  const quoteError =
    quoteQuery.data && !quoteQuery.data.success ? quoteQuery.data.message : ''
  const redeemMutation = useMutation({
    mutationFn: (points: number) => redeemSelfAffiliateRewardPoints({ points }),
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to redeem reward points'))
        return
      }
      const redeemedPoints = formatPoints(res.data?.redeemed_points)
      const walletAmount = formatQuota(res.data?.redeemed_quota || 0)
      toast.success(
        t('Redeemed {{points}} points, added {{walletAmount}}', {
          points: redeemedPoints,
          walletAmount,
        })
      )
      setRedeemOpen(false)
      setRedeemPointsInput('')
      await getSelf()
      queryClient.invalidateQueries({ queryKey: ['self-affiliate-summary'] })
      queryClient.invalidateQueries({
        queryKey: ['self-affiliate-reward-settlements'],
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to redeem reward points'))
    },
  })

  const openRedeemDialog = () => {
    setRedeemPointsInput('')
    setRedeemOpen(true)
  }

  const handleRedeemOpenChange = (open: boolean) => {
    setRedeemOpen(open)
    if (!open) {
      setRedeemPointsInput('')
    }
  }

  const handleConfirmRedeem = () => {
    if (!redeemPointsValid) {
      toast.error(
        redeemPointsEntered
          ? t('Points must be between 1 and {{max}}', {
              max: formatPoints(pendingPoints),
            })
          : t('Enter points to redeem')
      )
      return
    }
    redeemMutation.mutate(redeemPoints)
  }

  return (
    <>
      <Card className='bg-muted/20 py-0'>
        <CardContent className='space-y-4 p-3 sm:p-4'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
              <HandCoins className='text-muted-foreground size-4' />
            </div>
            <div className='min-w-0'>
              <h3 className='truncate text-sm font-semibold'>
                {t('Top-up Reward Points')}
              </h3>
              <p className='text-muted-foreground line-clamp-1 text-xs'>
                {t('Reward points can be redeemed to your wallet at 1 point = 500000 tokens.')}
              </p>
            </div>
            <Button
              size='sm'
              className='ml-auto h-8 shrink-0'
              disabled={
                loading || pendingPoints <= 0 || redeemMutation.isPending
              }
              onClick={openRedeemDialog}
            >
              {redeemMutation.isPending ? t('Redeeming...') : t('Redeem')}
            </Button>
          </div>

          <div className='grid gap-2 sm:grid-cols-3'>
            {[
              {
                label: t('Pending Points'),
                value: formatPoints(summary?.pending_points),
              },
              {
                label: t('Redeemed Points'),
                value: formatPoints(processedPoints),
              },
              {
                label: t('Total Points'),
                value: formatPoints(summary?.total_points),
              },
            ].map((item) => (
              <div
                key={item.label}
                className='bg-background rounded-lg border p-3'
              >
                <div className='text-muted-foreground text-xs font-medium'>
                  {item.label}
                </div>
                {loading ? (
                  <Skeleton className='mt-2 h-5 w-24' />
                ) : (
                  <div className='mt-1 text-sm font-semibold tabular-nums'>
                    {item.value} {t('points')}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className='bg-background divide-y rounded-lg border'>
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className='flex items-center gap-3 p-3'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-4 flex-1' />
                  <Skeleton className='h-4 w-20' />
                </div>
              ))
            ) : rows.length === 0 ? (
              <div className='text-muted-foreground p-3 text-sm'>
                {t('No reward point activity')}
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className='grid gap-2 p-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)_160px] sm:items-center'
                >
                  <Badge
                    variant={
                      row.settlement_type === 'wallet' ? 'secondary' : 'outline'
                    }
                  >
                    {t(getSettlementLabelKey(row))}
                  </Badge>
                  <div className='min-w-0'>
                    <div className='font-medium tabular-nums'>
                      {formatPoints(row.points)} {t('points')}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {row.wallet_quota > 0
                        ? t('Wallet credit: {{amount}}', {
                            amount: formatQuota(row.wallet_quota),
                          })
                        : t('Processed points')}
                    </div>
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {formatTimestamp(row.settled_at || row.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={redeemOpen} onOpenChange={handleRedeemOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <form
            className='contents'
            onSubmit={(event) => {
              event.preventDefault()
              handleConfirmRedeem()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('Redeem points')}</DialogTitle>
              <DialogDescription>
                {t('Choose how many reward points to redeem into your wallet.')}
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4'>
              <div className='bg-muted/30 flex items-center justify-between rounded-lg border p-3'>
                <span className='text-muted-foreground text-sm'>
                  {t('Available points')}
                </span>
                <span className='text-sm font-semibold tabular-nums'>
                  {formatPoints(pendingPoints)} {t('points')}
                </span>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='affiliate-redeem-points'>
                  {t('Points to redeem')}
                </Label>
                <div className='flex gap-2'>
                  <Input
                    id='affiliate-redeem-points'
                    type='number'
                    inputMode='numeric'
                    min={1}
                    max={pendingPoints}
                    step={1}
                    value={redeemPointsInput}
                    placeholder={t('Enter points to redeem')}
                    onChange={(event) =>
                      setRedeemPointsInput(event.target.value)
                    }
                  />
                  <Button
                    type='button'
                    variant='outline'
                    className='shrink-0'
                    onClick={() => setRedeemPointsInput(String(pendingPoints))}
                  >
                    {t('All')}
                  </Button>
                </div>
                {redeemPointsError ? (
                  <p className='text-destructive text-xs'>
                    {redeemPointsError}
                  </p>
                ) : null}
              </div>

              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground text-xs font-medium'>
                  {t('Estimated wallet credit')}
                </div>
                {quoteQuery.isFetching ? (
                  <Skeleton className='mt-2 h-6 w-28' />
                ) : quote ? (
                  <div className='mt-1 text-lg font-semibold tabular-nums'>
                    {formatQuota(quote.redeemed_quota)}
                  </div>
                ) : (
                  <div className='text-muted-foreground mt-1 text-sm'>
                    {quoteError || t('Enter points to redeem')}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant='outline' type='button' />}>
                {t('Cancel')}
              </DialogClose>
              <Button
                type='submit'
                disabled={
                  !redeemPointsValid ||
                  redeemMutation.isPending ||
                  quoteQuery.isFetching
                }
              >
                {redeemMutation.isPending
                  ? t('Redeeming...')
                  : t('Confirm redemption')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
