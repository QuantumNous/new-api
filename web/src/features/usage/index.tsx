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
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import { Podium, UsageHero, UsageList } from './components'
import { useCheckinLeaderboard, useUsageLeaderboard } from './hooks/use-usage-leaderboard'
import type { UsagePeriod, UsageTab } from './types'

const VALID_TABS: UsageTab[] = ['today', 'week', 'month', 'checkin']

export function Usage() {
  const { t } = useTranslation()
  const search = useSearch({ from: '/usage/' })
  const navigate = useNavigate()

  const tab: UsageTab = VALID_TABS.includes(search.tab as UsageTab)
    ? (search.tab as UsageTab)
    : 'week'

  const isCheckin = tab === 'checkin'
  const period = isCheckin ? 'week' : (tab as UsagePeriod)

  const usageQuery = useUsageLeaderboard(period)
  const checkinQuery = useCheckinLeaderboard()

  const handleTabChange = (next: UsageTab) => {
    navigate({
      to: '/usage',
      search: (prev) => ({ ...prev, tab: next }),
    })
  }

  const isLoading = isCheckin ? checkinQuery.isLoading : usageQuery.isLoading
  const error = isCheckin ? checkinQuery.error : usageQuery.error

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[600px] opacity-20 dark:opacity-[0.10]'
          style={{
            background: [
              'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.78 0.16 75 / 80%) 0%, transparent 70%)',
              'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.72 0.10 250 / 60%) 0%, transparent 70%)',
              'radial-gradient(ellipse 40% 35% at 50% 70%, oklch(0.70 0.12 50 / 40%) 0%, transparent 70%)',
            ].join(', '),
            maskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        />
        <PageTransition className='relative mx-auto w-full max-w-[1100px] space-y-8 px-3 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12 xl:px-8'>
          <UsageHero tab={tab} onTabChange={handleTabChange} />

          {isLoading ? (
            <UsageLoading />
          ) : error ? (
            <UsageError
              message={
                error instanceof Error
                  ? error.message
                  : t('Unable to load leaderboard data')
              }
            />
          ) : isCheckin ? (
            <CheckinBoard
              entries={checkinQuery.data?.entries ?? []}
              date={checkinQuery.data?.date}
              fromCache={checkinQuery.data?.from_cache}
            />
          ) : (
            <UsageBoard
              entries={usageQuery.data?.entries ?? []}
              fromCache={usageQuery.data?.from_cache}
            />
          )}
        </PageTransition>
      </div>
    </PublicLayout>
  )
}

function UsageBoard(props: {
  entries: import('./types').UsageRankEntry[]
  fromCache?: boolean
}) {
  const { t } = useTranslation()
  const { entries } = props
  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  const podiumEntries = podium.map((e) => ({
    rank: e.rank,
    username: e.username,
    value: formatQuota(e.quota),
    subtitle: t('{{count}} requests', { count: e.requests }),
    is_self: e.is_self,
  }))

  const listEntries = rest.map((e) => ({
    rank: e.rank,
    username: e.username,
    value: formatQuota(e.quota),
    subtitle: t('{{count}} requests', { count: e.requests }),
    is_self: e.is_self,
  }))

  return (
    <div className='space-y-6'>
      <section className='bg-card/60 border-border/60 rounded-2xl border p-5 backdrop-blur-sm sm:p-8'>
        <Podium entries={podiumEntries} />
      </section>

      {listEntries.length > 0 && (
        <section className='bg-card/60 border-border/60 rounded-2xl border px-2 py-2 sm:px-3'>
          <UsageList entries={listEntries} />
        </section>
      )}

      {props.fromCache && (
        <p className='text-muted-foreground/60 text-center text-xs'>
          {t('Cached — refreshes every couple of minutes.')}
        </p>
      )}
    </div>
  )
}

function CheckinBoard(props: {
  entries: import('./types').CheckinRankEntry[]
  date?: string
  fromCache?: boolean
}) {
  const { t } = useTranslation()
  const { entries } = props
  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  const podiumEntries = podium.map((e) => ({
    rank: e.rank,
    username: e.username,
    value: formatQuota(e.quota_awarded),
    subtitle: t('Check-in reward'),
    is_self: e.is_self,
  }))

  const listEntries = rest.map((e) => ({
    rank: e.rank,
    username: e.username,
    value: formatQuota(e.quota_awarded),
    is_self: e.is_self,
  }))

  return (
    <div className='space-y-6'>
      {props.date && (
        <p className='text-muted-foreground text-center text-sm'>
          {t('Check-in leaderboard for {{date}}', { date: props.date })}
        </p>
      )}
      <section className='bg-card/60 border-border/60 rounded-2xl border p-5 backdrop-blur-sm sm:p-8'>
        <Podium entries={podiumEntries} />
      </section>

      {listEntries.length > 0 && (
        <section className='bg-card/60 border-border/60 rounded-2xl border px-2 py-2 sm:px-3'>
          <UsageList entries={listEntries} />
        </section>
      )}

      {props.fromCache && (
        <p className='text-muted-foreground/60 text-center text-xs'>
          {t('Cached — refreshes every couple of minutes.')}
        </p>
      )}
    </div>
  )
}

function UsageLoading() {
  return (
    <div className='space-y-6'>
      <div className='flex items-end justify-center gap-3 sm:gap-5'>
        <Skeleton className='h-32 w-1/3 max-w-[220px] rounded-t-xl' />
        <Skeleton className='h-48 w-1/3 max-w-[220px] rounded-t-xl' />
        <Skeleton className='h-24 w-1/3 max-w-[220px] rounded-t-xl' />
      </div>
      <Skeleton className='h-64 w-full rounded-2xl' />
    </div>
  )
}

function UsageError(props: { message: string }) {
  const { t } = useTranslation()
  return (
    <div className='bg-card rounded-xl border border-dashed px-6 py-12 text-center'>
      <h2 className='text-foreground text-base font-semibold'>
        {t('Unable to load leaderboard')}
      </h2>
      <p className='text-muted-foreground mx-auto mt-2 max-w-md text-sm'>
        {props.message}
      </p>
    </div>
  )
}
