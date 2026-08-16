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
import { ArrowRightLeft, Coins, History, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatQuota } from '@/lib/format'

import {
  createChannelContributionRewardTransfer,
  getChannelContributionRewards,
  getChannelContributionRewardTransfers,
} from '../api'
import { formatContributionTimestamp } from '../lib'

function RewardStat(props: {
  title: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <Card size='sm'>
      <CardContent className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <p className='text-muted-foreground text-xs'>{props.title}</p>
          <p className='mt-1 truncate text-lg font-semibold tabular-nums'>
            {props.value}
          </p>
        </div>
        <span className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg'>
          {props.icon}
        </span>
      </CardContent>
    </Card>
  )
}

export function ContributionRewards(props: { rewardBps: number }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const rewardsQuery = useQuery({
    queryKey: ['channel-contribution-rewards'],
    queryFn: async () => {
      const response = await getChannelContributionRewards({
        page: 1,
        page_size: 50,
      })
      if (!response.success || !response.data) {
        throw new Error(
          response.message || t('Failed to load contribution rewards')
        )
      }
      return response.data
    },
  })
  const transfersQuery = useQuery({
    queryKey: ['channel-contribution-reward-transfers'],
    queryFn: async () => {
      const response = await getChannelContributionRewardTransfers({
        page: 1,
        page_size: 20,
      })
      if (!response.success || !response.data) {
        throw new Error(
          response.message || t('Failed to load contribution rewards')
        )
      }
      return response.data
    },
  })
  const transferMutation = useMutation({
    mutationFn: createChannelContributionRewardTransfer,
  })

  const account = rewardsQuery.data?.account
  const balance = account?.balance ?? 0
  const transferAmount = Number(amount)
  const amountValid =
    Number.isInteger(transferAmount) &&
    transferAmount > 0 &&
    transferAmount <= balance

  const handleTransfer = async () => {
    if (!amountValid) return
    try {
      const response = await transferMutation.mutateAsync(transferAmount)
      if (!response.success) {
        toast.error(response.message || t('Failed to transfer rewards'))
        return
      }
      setAmount('')
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['channel-contribution-rewards'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['channel-contribution-reward-transfers'],
        }),
      ])
      toast.success(t('Rewards transferred to your wallet'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to transfer rewards')
      )
    }
  }

  const rewardRate = `${(props.rewardBps / 100).toFixed(2).replace(/\.00$/, '')}%`
  const ledger = rewardsQuery.data?.items ?? []
  const transfers = transfersQuery.data?.items ?? []

  return (
    <div className='space-y-4'>
      {rewardsQuery.error || transfersQuery.error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('Failed to load contribution rewards')}</AlertTitle>
          <AlertDescription className='flex flex-wrap items-center justify-between gap-3'>
            <span>
              {(rewardsQuery.error instanceof Error &&
                rewardsQuery.error.message) ||
                (transfersQuery.error instanceof Error &&
                  transfersQuery.error.message) ||
                t('Failed to load contribution rewards')}
            </span>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() =>
                void Promise.all([
                  rewardsQuery.refetch(),
                  transfersQuery.refetch(),
                ])
              }
            >
              {t('Retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className='grid gap-3 sm:grid-cols-3'>
        <RewardStat
          title={t('Available reward')}
          value={formatQuota(balance)}
          icon={<Coins className='size-4' aria-hidden='true' />}
        />
        <RewardStat
          title={t('Lifetime earned')}
          value={formatQuota(account?.lifetime_earned ?? 0)}
          icon={<TrendingUp className='size-4' aria-hidden='true' />}
        />
        <RewardStat
          title={t('Current reward rate')}
          value={rewardRate}
          icon={<History className='size-4' aria-hidden='true' />}
        />
      </div>

      <div className='grid gap-4 lg:grid-cols-[minmax(280px,0.42fr)_minmax(0,1fr)] lg:items-start'>
        <Card className='gap-0 py-0'>
          <CardHeader className='border-b py-4'>
            <CardTitle>{t('Transfer rewards')}</CardTitle>
            <CardDescription>
              {t(
                'Move available contribution rewards into your wallet balance.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='channel-contribution-transfer-amount'>
                {t('Transfer amount')}
              </Label>
              <Input
                id='channel-contribution-transfer-amount'
                type='number'
                min={1}
                max={balance}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={t('Enter reward quota')}
              />
              <div className='flex items-center justify-between gap-3 text-xs'>
                <span className='text-muted-foreground'>
                  {t('Available: {{amount}}', { amount: formatQuota(balance) })}
                </span>
                <Button
                  type='button'
                  variant='link'
                  size='sm'
                  className='h-auto p-0'
                  disabled={balance <= 0}
                  onClick={() => setAmount(String(balance))}
                >
                  {t('Transfer all')}
                </Button>
              </div>
            </div>
            <Button
              type='button'
              className='w-full'
              disabled={!amountValid || transferMutation.isPending}
              onClick={handleTransfer}
            >
              <ArrowRightLeft data-icon='inline-start' />
              {t('Transfer to wallet')}
            </Button>

            {transfers.length > 0 ? (
              <div className='border-t pt-3'>
                <p className='mb-2 text-sm font-medium'>
                  {t('Recent transfers')}
                </p>
                <div className='space-y-2'>
                  {transfers.slice(0, 5).map((transfer) => (
                    <div
                      key={transfer.id}
                      className='flex items-center justify-between gap-3 text-xs'
                    >
                      <span className='text-muted-foreground'>
                        {formatContributionTimestamp(transfer.created_at)}
                      </span>
                      <span className='font-medium tabular-nums'>
                        {formatQuota(Math.abs(transfer.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className='gap-0 py-0'>
          <CardHeader className='border-b py-4'>
            <CardTitle>{t('Reward ledger')}</CardTitle>
            <CardDescription>
              {t(
                'Rewards are credited after billable requests use an approved channel.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className='p-0'>
            {rewardsQuery.isLoading ? (
              <div className='text-muted-foreground flex min-h-48 items-center justify-center text-sm'>
                {t('Loading...')}
              </div>
            ) : null}
            {!rewardsQuery.isLoading &&
            !rewardsQuery.error &&
            ledger.length === 0 ? (
              <div className='text-muted-foreground flex min-h-48 items-center justify-center px-4 text-center text-sm'>
                {t('No contribution rewards yet')}
              </div>
            ) : null}
            {!rewardsQuery.isLoading &&
            !rewardsQuery.error &&
            ledger.length > 0 ? (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Type')}</TableHead>
                      <TableHead>{t('Amount')}</TableHead>
                      <TableHead>{t('Balance')}</TableHead>
                      <TableHead>{t('Time')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {entry.entry_type === 'transfer'
                            ? t('Wallet transfer')
                            : t('Usage reward')}
                        </TableCell>
                        <TableCell
                          className={
                            entry.amount >= 0
                              ? 'text-success font-medium tabular-nums'
                              : 'font-medium tabular-nums'
                          }
                        >
                          {entry.amount >= 0 ? '+' : ''}
                          {formatQuota(entry.amount)}
                        </TableCell>
                        <TableCell className='tabular-nums'>
                          {formatQuota(entry.balance_after ?? 0)}
                        </TableCell>
                        <TableCell className='text-muted-foreground whitespace-nowrap'>
                          {formatContributionTimestamp(entry.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
