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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'

import { getStatusPageCards } from './api'
import { GroupStatusCard } from './components/group-status-card'

const MIN_REFRESH_SECONDS = 10

export function StatusPage() {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState<number>(60)

  const query = useQuery({
    queryKey: ['status-cards'],
    queryFn: getStatusPageCards,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
  })

  const refreshSeconds = Math.max(
    MIN_REFRESH_SECONDS,
    query.data?.refresh_seconds ?? 60
  )

  // 每次成功拉取后，重置倒计时到 refreshSeconds
  useEffect(() => {
    if (query.data) {
      setCountdown(refreshSeconds)
    }
  }, [query.data, refreshSeconds])

  // 倒计时 tick + 到点触发 refetch，页面隐藏时暂停
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      setCountdown((prev) => {
        if (prev <= 1) {
          void query.refetch()
          return refreshSeconds
        }
        return prev - 1
      })
    }
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [query, refreshSeconds])

  const enabled = query.data?.enabled ?? true
  const cards = query.data?.cards ?? []

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='relative mx-auto w-full max-w-[1280px] space-y-6 px-3 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12 xl:px-8'>
        <header className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-semibold sm:text-3xl'>
              {t('服务状态')}
            </h1>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('按分组查看渠道可用性与近期表现')}
            </p>
          </div>
          <div className='text-muted-foreground text-xs sm:text-sm tabular-nums'>
            {query.isFetching
              ? t('刷新中...')
              : t('{{n}}S 后刷新', { n: countdown })}
          </div>
        </header>

        {query.isLoading ? (
          <LoadingGrid />
        ) : !enabled ? (
          <EmptyState
            title={t('状态页未开启')}
            description={t('请联系管理员在系统设置中启用状态页')}
          />
        ) : cards.length === 0 ? (
          <EmptyState
            title={t('暂无展示分组')}
            description={t('管理员可在系统设置的「状态页设置」中勾选要展示的分组')}
          />
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {cards.map((card) => (
              <GroupStatusCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </PageTransition>
    </PublicLayout>
  )
}

function LoadingGrid() {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <Skeleton key={n} className='h-56 w-full rounded-xl' />
      ))}
    </div>
  )
}

type EmptyStateProps = {
  title: string
  description: string
}

function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className='ring-foreground/10 rounded-xl border-dashed py-16 text-center ring-1'>
      <div className='text-base font-medium'>{title}</div>
      <div className='text-muted-foreground mx-auto mt-2 max-w-md text-sm'>
        {description}
      </div>
    </div>
  )
}
