<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UsageHeatmapGrid from '@/components/console/dashboard/UsageHeatmapGrid.vue'
import UsageSegmentBar from '@/components/console/dashboard/UsageSegmentBar.vue'
import type { UsageDistributionPoint } from '@/composables/useUsageDistribution'
import { formatCompact, formatNumber, formatQuota } from '@/utils/format'
import {
  buildUsageDistributionView,
  type UsageDistributionMetric,
  type UsageDistributionPeriod,
} from '@/utils/usageDistribution'

const props = withDefaults(
  defineProps<{
    points: UsageDistributionPoint[]
    loading?: boolean
  }>(),
  { loading: false }
)

const { t, locale } = useI18n()
const period = ref<UsageDistributionPeriod>('month')
const metric = ref<UsageDistributionMetric>('requests')

const view = computed(() =>
  buildUsageDistributionView(props.points, period.value, metric.value)
)

const periodOptions = computed(() => [
  { key: 'month' as const, label: t('dashboard.distribution.periodMonth') },
  { key: 'quarter' as const, label: t('dashboard.distribution.periodQuarter') },
  { key: 'year' as const, label: t('dashboard.distribution.periodYear') },
])

const metricOptions = computed(() => [
  {
    key: 'requests' as const,
    label: t('dashboard.distribution.metricRequests'),
  },
  { key: 'consume' as const, label: t('dashboard.distribution.metricConsume') },
  { key: 'tokens' as const, label: t('dashboard.distribution.metricTokens') },
])

const metricColor = computed(() => {
  if (metric.value === 'consume') return 'var(--accent)'
  if (metric.value === 'tokens') return 'var(--support)'
  return 'var(--signal)'
})

const periodLabel = computed(() =>
  t(`dashboard.distribution.periodSummary.${period.value}`)
)
const metricLabel = computed(
  () => metricOptions.value.find((option) => option.key === metric.value)!.label
)

function formatMetric(value: number): string {
  if (metric.value === 'consume') return formatQuota(value)
  if (metric.value === 'tokens') return formatCompact(Math.round(value))
  return formatNumber(Math.round(value))
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(year!, month! - 1, day))
}

function intensityStyle(level: 0 | 1 | 2 | 3 | 4 | 5) {
  if (level === 0) {
    return {
      background: 'var(--surface-muted)',
      borderColor: 'var(--border-subtle)',
    }
  }
  const amount = [0, 20, 34, 50, 68, 88][level]
  return {
    background: `color-mix(in srgb, ${metricColor.value} ${amount}%, var(--surface-solid))`,
    borderColor: `color-mix(in srgb, ${metricColor.value} ${Math.min(96, amount + 8)}%, var(--border-subtle))`,
  }
}

const weekdays = computed(() => {
  const monday = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(date.getDate() + index)
    return new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' }).format(
      date
    )
  })
})

const topSegments = computed(() =>
  view.value.topDays.map((day, index) => ({
    key: day.date,
    label: formatDate(day.date),
    value: day.value,
    displayValue: formatMetric(day.value),
    intensity: [90, 68, 46][index]!,
  }))
)

const weekdaySegments = computed(() => {
  const max = Math.max(...view.value.weekdays.map((entry) => entry.value), 0)
  return view.value.weekdays.map((entry) => ({
    key: String(entry.weekday),
    label: weekdays.value[entry.weekday]!,
    value: entry.value,
    displayValue: formatMetric(entry.value),
    intensity: max ? Math.round(28 + (entry.value / max) * 62) : 28,
  }))
})

const peakWeekday = computed(
  () =>
    [...view.value.weekdays].sort(
      (left, right) => right.value - left.value || left.weekday - right.weekday
    )[0]
)

const weekdaySummary = computed(() => {
  const peak = peakWeekday.value
  if (!peak || peak.value <= 0) return ''
  return t('dashboard.distribution.weekdayPeak', {
    weekday: weekdays.value[peak.weekday],
    value: formatMetric(peak.value),
  })
})
</script>

<template>
  <ConsoleCard stretch data-usage-distribution>
    <div v-if="loading" class="flex flex-col gap-3" data-usage-loading>
      <div class="flex flex-wrap justify-between gap-4">
        <div
          class="h-12 w-52 animate-pulse rounded-xl bg-[var(--surface-muted)]"
        />
        <div
          class="h-10 w-72 animate-pulse rounded-xl bg-[var(--surface-muted)]"
        />
      </div>
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div class="h-48 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        <div class="h-48 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      </div>
    </div>

    <EmptyState
      v-else-if="!points.length"
      :title="t('dashboard.distribution.emptyTitle')"
      :hint="t('dashboard.distribution.emptyHint')"
    />

    <div v-else class="flex grow flex-col" data-usage-content>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ periodLabel }} · {{ metricLabel }}
          </p>
          <p
            class="mt-0.5 truncate text-xl font-bold tabular-nums text-[var(--text-primary)] sm:text-2xl"
            aria-live="polite"
            data-usage-total
          >
            {{ formatMetric(view.total) }}
          </p>
        </div>

        <div
          class="grid w-full gap-2 min-[360px]:grid-cols-2 sm:w-auto sm:justify-items-end"
        >
          <div
            class="grid grid-cols-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5 text-[10px] sm:text-xs"
            :aria-label="t('dashboard.distribution.periodControl')"
          >
            <button
              v-for="option in periodOptions"
              :key="option.key"
              type="button"
              class="min-w-0 rounded-lg px-1 py-1.5 font-medium transition-all focus-ring sm:px-2"
              :class="
                period === option.key
                  ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              "
              :aria-pressed="period === option.key"
              :data-usage-period="option.key"
              @click="period = option.key"
            >
              {{ option.label }}
            </button>
          </div>
          <div
            class="grid grid-cols-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5 text-[10px] sm:text-xs"
            :aria-label="t('dashboard.distribution.metricControl')"
          >
            <button
              v-for="option in metricOptions"
              :key="option.key"
              type="button"
              class="min-w-0 rounded-lg px-1 py-1.5 font-medium transition-all focus-ring sm:px-2"
              :class="
                metric === option.key
                  ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              "
              :aria-pressed="metric === option.key"
              :data-usage-metric="option.key"
              @click="metric = option.key"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <div
        class="gap-3"
        :class="[
          period === 'quarter' ? 'mt-0' : 'mt-3',
          period === 'year'
            ? 'grid grow content-center'
            : 'grid grow content-center lg:grid-cols-[minmax(0,1fr)_17rem]',
        ]"
      >
        <UsageHeatmapGrid
          class="min-w-0 self-center"
          :view="view"
          :period="period"
          :metric="metric"
          :metric-color="metricColor"
          :period-label="periodLabel"
          :metric-label="metricLabel"
        />

        <aside
          v-if="period !== 'year'"
          class="grid gap-3 border-t border-[var(--border-subtle)] pt-3 min-[360px]:grid-cols-2 lg:flex lg:flex-col lg:justify-center lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
          data-usage-analytics="side"
        >
          <UsageSegmentBar
            :title="t('dashboard.distribution.topDays')"
            :segments="topSegments"
            :color="metricColor"
            :empty-label="t('dashboard.stats.noData')"
            layout="ranked"
          />
          <UsageSegmentBar
            :title="t('dashboard.distribution.weekdayRhythm')"
            :segments="weekdaySegments"
            :color="metricColor"
            :empty-label="t('dashboard.stats.noData')"
            :summary="weekdaySummary"
            layout="rhythm"
          />
        </aside>
      </div>

      <div
        v-if="period === 'year'"
        class="mt-2 grid gap-3 border-t border-[var(--border-subtle)] pt-2 min-[360px]:grid-cols-2"
        data-usage-analytics="bottom"
      >
        <UsageSegmentBar
          :title="t('dashboard.distribution.topDays')"
          :segments="topSegments"
          :color="metricColor"
          :empty-label="t('dashboard.stats.noData')"
          minimal
          layout="ranked"
        />
        <UsageSegmentBar
          :title="t('dashboard.distribution.weekdayRhythm')"
          :segments="weekdaySegments"
          :color="metricColor"
          :empty-label="t('dashboard.stats.noData')"
          :summary="weekdaySummary"
          minimal
          layout="rhythm"
        />
      </div>

      <div
        class="-mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-tertiary)]"
        :class="period === 'quarter' ? 'mt-0' : 'mt-3'"
        data-usage-footer
      >
        <div class="flex items-center gap-1.5">
          <span>{{ t('dashboard.distribution.less') }}</span>
          <span
            v-for="level in [0, 1, 2, 3, 4, 5] as const"
            :key="level"
            class="size-2.5 rounded-sm border"
            :style="intensityStyle(level)"
          />
          <span>{{ t('dashboard.distribution.more') }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{{
            t('dashboard.distribution.activeDays', { count: view.activeDays })
          }}</span>
          <span>
            {{ t('dashboard.distribution.peak') }}
            <strong class="font-semibold text-[var(--text-secondary)]">
              {{ view.peak ? formatMetric(view.peak.value) : '--' }}
            </strong>
          </span>
        </div>
      </div>
    </div>
  </ConsoleCard>
</template>
