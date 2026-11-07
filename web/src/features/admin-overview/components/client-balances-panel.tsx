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
import { Link } from '@tanstack/react-router'
import { ArrowDownUp, ChevronRight, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import type { UserSortBy, UserSortOrder } from '@/features/users/types'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatInteger, formatPercent } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getUsers } from '@/features/users/api'

import { LIVE_REFRESH_MS } from '../constants'

const CLIENT_LIMIT = 8

type BalanceSortOption = {
  value: string
  sortBy: UserSortBy
  sortOrder: UserSortOrder
  labelKey: string
}

const BALANCE_SORT_OPTIONS: BalanceSortOption[] = [
  {
    value: 'quota-desc',
    sortBy: 'quota',
    sortOrder: 'desc',
    labelKey: 'Highest balance',
  },
  {
    value: 'quota-asc',
    sortBy: 'quota',
    sortOrder: 'asc',
    labelKey: 'Lowest balance',
  },
  {
    value: 'last-login-desc',
    sortBy: 'last_login_at',
    sortOrder: 'desc',
    labelKey: 'Recently active',
  },
]

const RANK_COLORS = [
  'bg-amber-500 text-white',
  'bg-slate-400 text-slate-900',
  'bg-amber-700 text-white',
] as const

export function ClientBalancesPanel() {
  const { t } = useTranslation()
  const [sortValue, setSortValue] = useState<string>('quota-desc')
  const sortOption =
    BALANCE_SORT_OPTIONS.find((option) => option.value === sortValue) ??
    BALANCE_SORT_OPTIONS[0]

  const balancesQuery = useQuery({
    queryKey: ['admin-overview', 'client-balances', sortValue],
    queryFn: async () =>
      requireServerSuccess(
        await getUsers({
          p: 1,
          page_size: CLIENT_LIMIT,
          sort_by: sortOption.sortBy,
          sort_order: sortOption.sortOrder,
        })
      ),
    refetchInterval: LIVE_REFRESH_MS,
    staleTime: LIVE_REFRESH_MS - 100,
  })

  const users = balancesQuery.data?.data?.items ?? []
  const totalClients = balancesQuery.data?.data?.total ?? 0

  const sortItems = BALANCE_SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }))

  let content: ReactNode
  if (balancesQuery.isError) {
    content = (
      <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
        {t('Failed to load')}
      </div>
    )
  } else if (balancesQuery.isLoading) {
    content = (
      <div className='space-y-4'>
        {['client-1', 'client-2', 'client-3', 'client-4'].map((key) => (
          <div key={key} className='space-y-1.5'>
            <Skeleton className='h-6 w-full' />
            <Skeleton className='h-1.5 w-full' />
          </div>
        ))}
      </div>
    )
  } else if (users.length === 0) {
    content = (
      <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  } else {
    content = (
      <ol className='space-y-4'>
        {users.map((user, index) => {
          const total = user.quota + user.used_quota
          const usedShare = total > 0 ? (user.used_quota / total) * 100 : 0
          const exhausted = user.quota <= 0
          return (
            <li key={user.id}>
              <div className='flex items-center justify-between gap-3'>
                <span className='flex min-w-0 items-center gap-2'>
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold tabular-nums',
                      RANK_COLORS[index] ?? 'bg-muted text-muted-foreground'
                    )}
                  >
                    {index + 1}
                  </span>
                  <span
                    className='truncate font-mono text-xs sm:text-sm'
                    dir='auto'
                    title={user.username}
                  >
                    {user.display_name?.trim() || user.username}
                  </span>
                  <GroupBadge group={user.group} className='font-normal' />
                </span>
                <span className='grid shrink-0 justify-items-end text-right tabular-nums'>
                  <span
                    className={cn(
                      'font-mono text-xs font-semibold sm:text-sm',
                      exhausted && 'text-destructive'
                    )}
                  >
                    {formatQuotaWithCurrency(user.quota, { showSymbol: false })}
                  </span>
                  <span className='text-muted-foreground text-[11px]'>
                    {t('Used amount')}{' '}
                    {formatQuotaWithCurrency(user.used_quota, {
                      showSymbol: false,
                    })}
                  </span>
                </span>
              </div>
              <Progress
                value={Math.min(usedShare, 100)}
                aria-label={`${user.username}: ${t('Used amount')} ${formatPercent(usedShare)}`}
                className='mt-1.5 gap-0'
              />
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <TitledCard
      title={t('Client Balances')}
      description={t('Remaining balance and usage of each client')}
      icon={<Wallet />}
      iconTone='success'
      action={
        <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
          <Select
            items={sortItems}
            value={sortValue}
            onValueChange={(value) => {
              if (value != null) {
                setSortValue(value)
              }
            }}
          >
            <SelectTrigger
              aria-label={t('Sort')}
              size='sm'
              className='w-40 sm:w-44'
            >
              <div className='flex items-center gap-1.5'>
                <ArrowDownUp className='text-muted-foreground size-3.5' />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {sortItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button size='sm' variant='outline' render={<Link to='/users' />}>
            {t('View all clients')}
            <ChevronRight className='size-3.5' />
          </Button>
        </div>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='bg-muted/40 text-muted-foreground flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs'>
          <span>{t('Total clients')}</span>
          <span className='text-foreground font-mono font-semibold tabular-nums'>
            {balancesQuery.isLoading ? '—' : formatInteger(totalClients)}
          </span>
        </div>
        {content}
      </div>
    </TitledCard>
  )
}
