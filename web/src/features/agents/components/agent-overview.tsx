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
  Calendar01Icon,
  Package01Icon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'

import { getAgentOverview } from '../api'
import { formatAgentPoints } from '../lib/money'
import { agentQueryKeys, agentUserQueryKey } from '../lib/workspace'
import type { AgentOverview as AgentOverviewData } from '../types'

type AgentOverviewProps = {
  initialOverview: AgentOverviewData
}

function OverviewSkeleton() {
  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-3 w-36' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-8 w-28' />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function AgentOverview(props: AgentOverviewProps) {
  const { t } = useTranslation()
  const userID = useAuthStore((state) => state.auth.user?.id ?? 0)
  const query = useQuery({
    queryKey: agentUserQueryKey(agentQueryKeys.overview, userID),
    queryFn: async () => {
      const response = await getAgentOverview()
      if (!response.success) throw new Error('Agent overview unavailable')
      return response.data
    },
    initialData: props.initialOverview,
    staleTime: 30_000,
  })

  if (query.isPending || !query.data) return <OverviewSkeleton />

  const overview = query.data
  const resetTime = new Date(overview.next_daily_reset_at * 1000)

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      <Card>
        <CardHeader>
          <CardTitle>{t('Point balance')}</CardTitle>
          <CardDescription>{t('1 point equals 1 CNY')}</CardDescription>
          <CardAction>
            <HugeiconsIcon
              icon={Wallet01Icon}
              strokeWidth={2}
              className='text-muted-foreground size-5'
              aria-hidden='true'
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold tabular-nums'>
            {formatAgentPoints(overview.balance)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Codes purchased today')}</CardTitle>
          <CardDescription>
            {t('Application-local calendar day')}
          </CardDescription>
          <CardAction>
            <HugeiconsIcon
              icon={Package01Icon}
              strokeWidth={2}
              className='text-muted-foreground size-5'
              aria-hidden='true'
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold tabular-nums'>
            {overview.daily_code_count}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Codes remaining today')}</CardTitle>
          <CardDescription>
            {t('Daily limit: {{limit}}', { limit: overview.daily_code_limit })}
          </CardDescription>
          <CardAction>
            <Badge
              variant={
                overview.daily_remaining > 0 ? 'secondary' : 'destructive'
              }
            >
              {overview.daily_remaining > 0
                ? t('Available')
                : t('Limit reached')}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold tabular-nums'>
            {overview.daily_remaining}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Daily reset')}</CardTitle>
          <CardDescription>
            {t('Your purchase limit refreshes then')}
          </CardDescription>
          <CardAction>
            <HugeiconsIcon
              icon={Calendar01Icon}
              strokeWidth={2}
              className='text-muted-foreground size-5'
              aria-hidden='true'
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className='text-base font-semibold'>
            {resetTime.toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
