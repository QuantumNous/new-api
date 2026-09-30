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
import { Database } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useCacheRateStatsVisible } from '@/hooks/use-cache-rate-stats'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getModelCacheStats } from '../api'
import { sumCacheBuckets } from '../lib/model-cache-chart'
import type { PricingModel } from '../types'
import { CacheRateTrendChart } from './model-details-charts'
import { SectionHeader } from './model-details-performance'

// Keep the same 24h window as the performance metrics above.
const MODEL_CACHE_WINDOW_HOURS = 24

/**
 * Site-wide cache rate trend for one model in the model square details,
 * next to the performance tab. Each metric (read/creation/hit) with activity
 * in the window gets one line; metrics the model never used get no line, and
 * the whole section hides when the model had no usage or no cache activity.
 * Rendered only when the viewer passes the cache-rate visibility switches
 * (the endpoint enforces the same rules server-side).
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

  const buckets = useMemo(() => statsQuery.data?.data ?? [], [statsQuery.data])
  const totals = useMemo(() => sumCacheBuckets(buckets), [buckets])

  if (!cacheStatsVisible) return null
  if (statsQuery.isLoading || statsQuery.isError) return null

  // Only metrics with activity in the window get a line.
  const metrics = [
    {
      key: 'read' as const,
      label: t('Cache Read Rate'),
      present: totals.cache_tokens > 0,
    },
    {
      key: 'creation' as const,
      label: t('Cache Creation Rate'),
      present: totals.cache_creation_tokens > 0,
    },
    {
      key: 'hit' as const,
      label: t('Cache Hit Rate'),
      present: totals.cache_hit_count > 0,
    },
  ]
  const activeMetrics = metrics
    .filter((metric) => metric.present)
    .map((metric) => ({ key: metric.key, label: metric.label }))

  if (totals.count <= 0 || activeMetrics.length === 0) return null

  return (
    <section className='flex flex-col gap-4'>
      <SectionHeader
        icon={Database}
        title={t('Cache rate (last 24h)')}
        description={t('Cache rates of {{count}} requests in the last 24 hours', {
          count: totals.count,
        })}
      />
      <CacheRateTrendChart buckets={buckets} metrics={activeMetrics} />
    </section>
  )
}
