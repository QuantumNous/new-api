<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MiniSparkline from '@/components/console/dashboard/MiniSparkline.vue'
import RpmRing from '@/components/console/dashboard/RpmRing.vue'
import { kpiDividerClasses } from '@/components/console/dashboard/kpiDividers'
import { useBalanceVisibility } from '@/composables/useDashboard'
import type {
  DashboardStats,
  FlowPoint,
  TokenTrendPoint,
  UserLimits,
} from '@/composables/useDashboard'
import { formatCompact, formatNumber, formatQuota } from '@/utils/format'

const props = defineProps<{
  stats: DashboardStats | null
  flow?: FlowPoint[]
  tokenTrend?: TokenTrendPoint[]
  limits?: UserLimits | null
  loading?: boolean
}>()

const emit = defineEmits<{ switchTab: [tab: string] }>()

const { t } = useI18n()
const { hidden } = useBalanceVisibility()

/** Sparklines show a fortnight — long enough to read a trend, short enough to stay legible at 100px wide. */
const WINDOW = 14

const flowWindow = computed(() => (props.flow ?? []).slice(-WINDOW))
const tokenWindow = computed(() => (props.tokenTrend ?? []).slice(-WINDOW))

function pointTotal(point: TokenTrendPoint): number {
  return point.input + point.output + point.cache_create + point.cache_read
}

/** All token classes billed today, from the last point of the trend series. */
const todayTokens = computed(() => {
  const point = props.tokenTrend?.at(-1)
  return point ? pointTotal(point) : 0
})

/**
 * Minutes elapsed in the current day, floored at one hour: just after midnight
 * the true divisor is tiny and would send any per-minute rate through the roof.
 */
function minutesElapsedToday(): number {
  const now = new Date()
  return Math.max(60, now.getHours() * 60 + now.getMinutes())
}

/**
 * Tokens per minute for each day in the window. Past days divide by a full day;
 * today divides by the elapsed minutes, so the last point of the sparkline is
 * exactly the headline figure rather than a differently-derived number.
 */
const tpmSeries = computed(() =>
  tokenWindow.value.map((point, i, all) => {
    const isToday = i === all.length - 1
    const minutes = isToday ? minutesElapsedToday() : 24 * 60
    return Math.round(pointTotal(point) / minutes)
  })
)

const avgTpm = computed(() => tpmSeries.value.at(-1) ?? 0)

interface Cell {
  key: string
  label: string
  /** lucide 24×24 path data */
  icon: string
  value: string
  color: string
  /** widens the loading skeleton to roughly match the real value */
  skeleton: string
  /** trend series; the RPM cell uses a ring instead */
  series?: number[]
  /** cells with a drill-down target render as buttons */
  drillDown?: boolean
}

const cells = computed<Cell[]>(() => [
  {
    key: 'spend',
    label: t('dashboard.statTodaySpend'),
    icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    value: hidden.value ? '••••' : formatQuota(props.stats?.today_quota ?? 0),
    color: 'var(--accent-text)',
    skeleton: 'w-24',
    series: flowWindow.value.map((f) => f.consume),
    drillDown: true,
  },
  {
    key: 'requests',
    label: t('dashboard.statTodayRequests'),
    icon: 'M4 17h4l3-9 3 14 3-11 2 6h3',
    value: formatNumber(props.stats?.today_requests ?? 0),
    color: 'var(--signal)',
    skeleton: 'w-20',
    series: flowWindow.value.map((f) => f.requests),
    drillDown: true,
  },
  {
    key: 'tokens',
    label: t('dashboard.statTodayTokens'),
    icon: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
    value: formatCompact(todayTokens.value),
    color: 'var(--text-primary)',
    skeleton: 'w-20',
    series: tokenWindow.value.map(pointTotal),
  },
  {
    key: 'rpm',
    label: t('dashboard.rpm.label'),
    icon: 'M12 22a10 10 0 1 0-10-10M12 12l4.5-4.5',
    value: props.limits ? formatNumber(props.limits.current_rpm) : '--',
    color: 'var(--text-primary)',
    skeleton: 'w-16',
  },
  {
    key: 'tpm',
    label: t('dashboard.statAvgTpm'),
    icon: 'M13 2 3 14h7l-1 8 10-12h-7l1-8Z',
    value: formatCompact(avgTpm.value),
    color: 'var(--support)',
    skeleton: 'w-16',
    series: tpmSeries.value,
  },
])

/** Caption sits under the figure; the RPM cell states its ceiling instead. */
const rpmCaption = computed(() => {
  if (!props.limits) return t('dashboard.kpiCaption.rpm')
  if (props.limits.rate_limit === 0) return t('dashboard.rpm.unmetered')
  return t('dashboard.rpm.ofCeiling', { n: props.limits.rate_limit })
})
</script>

<template>
  <section
    class="pencil-surface overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)]"
    data-handdrawn="surface-clipped"
    data-overview-kpi
  >
    <!--
      Divided strip: hairline separators between cells rather than gaps, so the
      five figures read as one summary row. Every cell is label / figure / mini
      visual — a sparkline where the data is a series, a ring for RPM where it is
      a share of a ceiling.
    -->
    <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
      <component
        :is="cell.drillDown ? 'button' : 'div'"
        v-for="(cell, i) in cells"
        :key="cell.key"
        :type="cell.drillDown ? 'button' : undefined"
        class="group relative flex flex-col px-5 py-4 text-left transition-colors"
        :class="[
          ...kpiDividerClasses(i),
          i === cells.length - 1 ? 'col-span-2 sm:col-span-1' : '',
          cell.drillDown ? 'hover:bg-[var(--surface-muted)] focus-ring' : '',
        ]"
        @click="cell.drillDown && emit('switchTab', 'stats')"
      >
        <div
          :class="
            i === cells.length - 1
              ? 'grid grid-cols-[minmax(0,1fr)_minmax(7rem,1fr)] items-end gap-4 sm:block'
              : ''
          "
        >
          <div class="min-w-0">
            <p
              class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path :d="cell.icon" />
              </svg>
              <span class="truncate">{{ cell.label }}</span>
            </p>

            <p
              v-if="loading"
              class="mt-1.5 h-7 animate-pulse rounded bg-[var(--surface-muted)]"
              :class="cell.skeleton"
            />
            <p
              v-else
              class="mt-1 truncate text-2xl font-bold leading-tight tabular-nums tracking-tight"
              :style="{ color: cell.color }"
            >
              {{ cell.value }}
            </p>
          </div>

          <div v-if="cell.key === 'rpm'" class="mt-2 flex items-center gap-2.5">
            <RpmRing
              v-if="limits"
              :current="limits.current_rpm"
              :limit="limits.rate_limit"
              :size="34"
              :show-inner-label="false"
              :show-side-label="false"
            />
            <span class="truncate text-xs text-[var(--text-tertiary)]">
              {{ rpmCaption }}
            </span>
          </div>
          <div v-else class="mt-2">
            <MiniSparkline
              v-if="!loading && cell.series && cell.series.length > 1"
              :points="cell.series"
              :color="cell.color"
              :height="30"
            />
            <div v-else class="h-[30px]" />
          </div>
        </div>
      </component>
    </div>
  </section>
</template>
