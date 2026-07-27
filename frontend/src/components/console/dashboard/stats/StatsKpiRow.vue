<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MiniRing from '@/components/console/dashboard/MiniRing.vue'
import MiniSparkline from '@/components/console/dashboard/MiniSparkline.vue'
import { kpiDividerClasses } from '@/components/console/dashboard/kpiDividers'
import type { FlowPoint } from '@/composables/useDashboard'
import type { StatsKpi } from '@/composables/useDashboardStats'
import { formatQuota, formatNumber } from '@/utils/format'

const props = defineProps<{
  kpi: StatsKpi | null
  /** Daily flow of the selected window, feeding the spend/request sparklines. */
  flow?: FlowPoint[]
  loading?: boolean
}>()

const { t } = useI18n()

const successColor = computed(() => {
  const rate = props.kpi?.successRate
  if (rate === undefined) return 'var(--text-tertiary)'
  if (rate >= 99) return 'var(--status-success)'
  if (rate >= 95) return 'var(--status-warning)'
  return 'var(--status-danger)'
})

interface Cell {
  key: string
  label: string
  /** lucide 24×24 path data */
  icon: string
  value: string
  /** small unit rendered after the figure */
  suffix?: string
  color: string
  /** widens the loading skeleton to roughly match the real value */
  skeleton: string
  /** window trend; the success cell uses a ring instead */
  series?: number[]
}

const cells = computed<Cell[]>(() => [
  {
    key: 'tokens',
    label: t('dashboard.stats.totalTokens'),
    icon: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
    value: props.kpi ? formatNumber(props.kpi.totalTokens) : '—',
    color: 'var(--accent-text)',
    skeleton: 'w-28',
  },
  {
    key: 'spend',
    label: t('dashboard.stats.totalSpend'),
    icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    value: props.kpi ? formatQuota(props.kpi.totalQuota) : '—',
    color: 'var(--accent-text)',
    skeleton: 'w-24',
    series: (props.flow ?? []).map((f) => f.consume),
  },
  {
    key: 'requests',
    label: t('dashboard.stats.totalRequests'),
    icon: 'M4 17h4l3-9 3 14 3-11 2 6h3',
    value: props.kpi ? formatNumber(props.kpi.totalRequests) : '—',
    color: 'var(--signal)',
    skeleton: 'w-20',
    series: (props.flow ?? []).map((f) => f.requests),
  },
  {
    key: 'latency',
    label: t('dashboard.stats.avgLatency'),
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 6v6l4 2',
    value: props.kpi ? props.kpi.avgLatency.toFixed(2) : '—',
    suffix: 's',
    color: 'var(--support)',
    skeleton: 'w-20',
  },
  {
    key: 'success',
    label: t('dashboard.stats.successRate'),
    icon: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4',
    value: props.kpi ? props.kpi.successRate.toFixed(1) : '—',
    suffix: '%',
    color: successColor.value,
    skeleton: 'w-16',
  },
])
</script>

<template>
  <!--
    Same divided strip as the Overview tab, so the two tabs read as one
    system: hairline separators rather than card gaps, every cell label /
    figure / mini visual. Spend and requests chart the selected window; the
    success rate reads out as a ring; cells with no series keep the visual
    slot's height so the strip stays level.
  -->
  <section
    class="pencil-surface overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)]"
    data-handdrawn="surface-clipped"
  >
    <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
      <div
        v-for="(cell, i) in cells"
        :key="cell.key"
        class="flex min-w-0 flex-col px-5 py-4"
        :class="kpiDividerClasses(i)"
      >
        <!-- Label + icon -->
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

        <!-- Figure -->
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
          {{ cell.value
          }}<span
            v-if="cell.suffix"
            class="text-xs font-normal text-[var(--text-tertiary)]"
          >
            {{ cell.suffix }}</span
          >
        </p>

        <!-- Mini visual: ring for the success rate, sparkline where a series exists -->
        <div v-if="cell.key === 'success'" class="mt-2 flex items-center">
          <MiniRing
            :percent="kpi?.successRate ?? 0"
            :color="successColor"
            :size="30"
            :indeterminate="!kpi || loading"
            :aria-label="cell.label"
          />
        </div>
        <div v-else class="mt-2">
          <MiniSparkline
            v-if="!loading && cell.series && cell.series.length > 1"
            :points="cell.series"
            :color="cell.color"
            :height="30"
          />
          <!-- Keeps every cell the same height when a series is missing -->
          <div v-else class="h-[30px]" />
        </div>
      </div>
    </div>
  </section>
</template>
