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
import { Database, DatabaseZap, Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useCacheRateStatsVisible } from '@/hooks/use-cache-rate-stats'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getModelCacheStats } from '../api'
import type { PricingModel } from '../types'
import { SectionHeader, StatCard } from './model-details-performance'

// Keep the same 24h window as the performance metrics above.
const MODEL_CACHE_WINDOW_HOURS = 24

function formatRatePercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0.0%'
  return `${(Math.min(numerator / denominator, 1) * 100).toFixed(1)}%`
}

/**
 * Site-wide cache rates for one model in the model square details, next to
 * the performance tab. Rendered only when the viewer passes the cache-rate
 * visibility switches (the endpoint enforces the same rules server-side)
 * and the model had usage in the window; otherwise nothing shows.
 */
export function ModelDetailsCacheStats(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const cacheStatsVisible = useCacheRateStatsVisible()
  const statsQuery = useQuery({
    queryKey: ['model-cache-stats', props.model.model_name],
    queryFn: async () =>
      requireServerSuccess(
        await getModelCacheStats(props.model.model_name, MODEL_CACHE_WINDOW_HOURS)
      ),
    enabled: cacheStatsVisible,
    staleTime: 60 * 1000,
    retry: false,
  })

  if (!cacheStatsVisible) return null

  const stats = statsQuery.data?.data
  if (statsQuery.isLoading || statsQuery.isError || !stats) return null
  if ((stats.count ?? 0) <= 0) return null

  const requestCount = Number(stats.count) || 0
  const promptTokens = Number(stats.prompt_tokens) || 0
  const cacheTokens = Number(stats.cache_tokens) || 0
  const cacheCreationTokens = Number(stats.cache_creation_tokens) || 0
  const cacheHitCount = Number(stats.cache_hit_count) || 0

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeader
        icon={Database}
        title={t('Cache rate (last 24h)')}
        description={t('Cache rates of {{count}} requests in the last 24 hours', {
          count: requestCount,
        })}
      />
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
        <StatCard
          icon={Database}
          label={t('Cache Read Rate')}
          value={formatRatePercent(cacheTokens, promptTokens)}
        />
        <StatCard
          icon={DatabaseZap}
          label={t('Cache Creation Rate')}
          value={formatRatePercent(cacheCreationTokens, promptTokens)}
        />
        <StatCard
          icon={Gauge}
          label={t('Cache Hit Rate')}
          value={formatRatePercent(cacheHitCount, requestCount)}
        />
      </div>
    </section>
  )
}
