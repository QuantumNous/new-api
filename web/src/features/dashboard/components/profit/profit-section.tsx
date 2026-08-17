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

import { FadeIn } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'

import { getChannelProfit } from '@/features/dashboard/api'

import { ChannelProfitTable } from './channel-profit-table'
import { ModelProfitChart } from './model-profit-chart'
import { ProfitSummaryCards } from './profit-summary-cards'

export function ProfitSection(props: {
  filters?: { start_timestamp?: number; end_timestamp?: number }
}) {
  const { data, isLoading } = useQuery({
    queryKey: [
      'channel-profit',
      props.filters?.start_timestamp,
      props.filters?.end_timestamp,
    ],
    queryFn: () =>
      getChannelProfit({
        start_timestamp: props.filters?.start_timestamp,
        end_timestamp: props.filters?.end_timestamp,
      }),
  })

  return (
    <div className='space-y-3 sm:space-y-4'>
      <FadeIn>
        <ProfitSummaryCards
          summary={data?.data.summary}
          loading={isLoading}
        />
      </FadeIn>
      <FadeIn delay={0.05}>
        <ChannelProfitTable rows={data?.data.by_channel} loading={isLoading} />
      </FadeIn>
      <FadeIn delay={0.1}>
        {isLoading ? (
          <Skeleton className='h-72 w-full' />
        ) : (
          <ModelProfitChart rows={data?.data.by_model ?? []} />
        )}
      </FadeIn>
    </div>
  )
}
