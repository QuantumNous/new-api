<script setup lang="ts">
import { ArrowUpDown } from 'lucide-vue-next'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import MiniRing from '@/components/console/dashboard/MiniRing.vue'
import MiniSparkline from '@/components/console/dashboard/MiniSparkline.vue'
import type { SystemMetrics } from '@/composables/useDashboard'
import { useAppStore } from '@/stores'

const props = defineProps<{
  metrics?: SystemMetrics | null
}>()

const { t } = useI18n()
const { phase, statusReachable, versionLabel } = storeToRefs(useAppStore())
const metricsAvailable = computed(
  () => props.metrics !== null && props.metrics !== undefined
)

const apiState = computed(() => {
  if (phase.value === 'loading') {
    return {
      color: 'var(--status-info)',
      label: t('dashboard.loading'),
      pulse: false,
    }
  }
  if (phase.value === 'error') {
    return {
      color: 'var(--status-danger)',
      label: t('dashboard.offline'),
      pulse: false,
    }
  }
  if (
    phase.value === 'ready' &&
    statusReachable.value &&
    metricsAvailable.value
  ) {
    return {
      color: 'var(--status-success)',
      label: t('dashboard.online'),
      pulse: true,
    }
  }
  if (
    phase.value === 'degraded' &&
    statusReachable.value &&
    metricsAvailable.value
  ) {
    return {
      color: 'var(--status-warning)',
      label: t('dashboard.degraded'),
      pulse: false,
    }
  }
  return {
    color: 'var(--text-tertiary)',
    label: t('dashboard.unknown'),
    pulse: false,
  }
})

function finiteNonNegative(value: number | null | undefined): number | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null
  }
  return value
}

function clampPercent(value: number | null | undefined): number | null {
  const finite = finiteNonNegative(value)
  return finite === null ? null : Math.min(100, finite)
}

function ratioPercent(
  used: number | null | undefined,
  total: number | null | undefined
): number | null {
  const safeUsed = finiteNonNegative(used)
  const safeTotal = finiteNonNegative(total)
  if (safeUsed === null || safeTotal === null || safeTotal <= 0) return null
  return Math.min(100, (safeUsed / safeTotal) * 100)
}

/** Load thresholds: comfortable below 70%, tight from 70%, saturated from 90%. */
function loadColor(percent: number | null): string {
  if (percent === null) return 'var(--text-tertiary)'
  if (percent >= 90) return 'var(--status-danger)'
  if (percent >= 70) return 'var(--status-warning)'
  return 'var(--glow)'
}

/** Disk uses amber/accent by default, shifting to warning/danger under high usage. */
function diskColor(percent: number | null): string {
  if (percent === null) return 'var(--text-tertiary)'
  if (percent >= 90) return 'var(--status-danger)'
  if (percent >= 70) return 'var(--status-warning)'
  return 'var(--accent)'
}

/** Success rate reads the other way round — high is good. */
function rateColor(percent: number | null): string {
  if (percent === null) return 'var(--text-tertiary)'
  if (percent >= 99) return 'var(--glow)'
  if (percent >= 95) return 'var(--status-warning)'
  return 'var(--status-danger)'
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) return '--'
  const rounded = Math.round(value * 10) / 10
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

function formatBandwidth(valueMbps: number): string {
  const safeValue = finiteNonNegative(valueMbps)
  if (safeValue === null) return '--'
  if (safeValue >= 1) return `${formatMetric(safeValue)} Mbps`
  if (safeValue >= 0.001) return `${formatMetric(safeValue * 1_000)} Kbps`
  return `${formatMetric(safeValue * 1_000_000)} bps`
}

function formatStorage(value: number | null | undefined): string {
  const safeValue = finiteNonNegative(value)
  return safeValue === null ? '--' : formatMetric(safeValue)
}

function normalizeSeries(
  series: SystemMetrics['bandwidth_series'] | undefined
): { down: number[]; up: number[] } | undefined {
  if (!series || !Array.isArray(series.up) || !Array.isArray(series.down)) {
    return undefined
  }

  if (series.up.length !== series.down.length || series.up.length < 2) {
    return undefined
  }

  const up: number[] = []
  const down: number[] = []
  for (let index = 0; index < series.up.length; index += 1) {
    const safeUp = finiteNonNegative(series.up[index])
    const safeDown = finiteNonNegative(series.down[index])
    if (safeUp === null || safeDown === null) return undefined
    up.push(safeUp)
    down.push(safeDown)
  }

  return up.length >= 2 ? { up, down } : undefined
}

interface MetricTile {
  key: 'cpu' | 'memory' | 'bandwidth' | 'disk'
  label: string
  /** lucide 24x24 path data */
  icon?: string
  value: string
  unit: string
  bandwidth?: { up: string; down: string }
  /** 0-100 usage against a ceiling; null when the metric is unavailable. */
  percent: number | null
  /** Shared-scale throughput history, for metrics with no ceiling. */
  series?: { down: number[]; up: number[] }
  color: string
}

const tiles = computed<MetricTile[]>(() => {
  const metrics = props.metrics
  const memoryUsed = finiteNonNegative(metrics?.memory_used_gb)
  const memoryTotal = finiteNonNegative(metrics?.memory_total_gb)
  const diskUsed = finiteNonNegative(metrics?.disk_used_gb)
  const diskTotal = finiteNonNegative(metrics?.disk_total_gb)
  const cpuPercent = clampPercent(metrics?.cpu_percent)
  const memoryPercent = ratioPercent(memoryUsed, memoryTotal)
  const diskPercent = ratioPercent(diskUsed, diskTotal)
  const bandwidthUp = finiteNonNegative(metrics?.bandwidth_up_mbps)
  const bandwidthDown = finiteNonNegative(metrics?.bandwidth_down_mbps)
  const bandwidth =
    bandwidthUp !== null && bandwidthDown !== null
      ? {
          up: formatBandwidth(bandwidthUp),
          down: formatBandwidth(bandwidthDown),
        }
      : undefined

  return [
    {
      key: 'cpu',
      label: t('dashboard.systemStatus.cpu'),
      icon: 'M4 4h16v16H4zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3M9 9h6v6H9z',
      value: cpuPercent === null ? '--' : formatMetric(cpuPercent),
      unit: cpuPercent === null ? '' : '%',
      percent: cpuPercent,
      color: loadColor(cpuPercent),
    },
    {
      key: 'memory',
      label: t('dashboard.systemStatus.memory'),
      icon: 'M3 7h18v10H3zM7 7v10M11 7v10M15 7v10M5 17v3M19 17v3',
      value:
        memoryUsed === null || memoryTotal === null
          ? '--'
          : `${formatStorage(memoryUsed)} / ${formatStorage(memoryTotal)}`,
      unit: memoryUsed === null || memoryTotal === null ? '' : 'GB',
      percent: memoryPercent,
      color: loadColor(memoryPercent),
    },
    {
      key: 'bandwidth',
      label: t('dashboard.systemStatus.bandwidth'),
      value: bandwidth ? '' : '--',
      unit: '',
      bandwidth,
      percent: null,
      series: normalizeSeries(metrics?.bandwidth_series),
      color: 'var(--signal)',
    },
    {
      key: 'disk',
      label: t('dashboard.systemStatus.disk'),
      icon: 'M22 12H2M5.5 16h.01M9.5 16h.01M5.45 5h13.1a2 2 0 0 1 1.79 1.11L22 12v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5l1.66-5.89A2 2 0 0 1 5.45 5z',
      value:
        diskUsed === null || diskTotal === null
          ? '--'
          : `${formatStorage(diskUsed)} / ${formatStorage(diskTotal)}`,
      unit: diskUsed === null || diskTotal === null ? '' : 'GB',
      percent: diskPercent,
      color: diskColor(diskPercent),
    },
  ]
})

/** Semicircle geometry for the CPU tile. */
const cpuGauge = computed(() => {
  const percent = tiles.value[0]?.percent ?? null
  const arcLength = Math.PI * 24
  if (percent === null) {
    return { percent: null, dashOffset: arcLength, needleX: 12, needleY: 32 }
  }
  const angle = Math.PI - (percent / 100) * Math.PI
  return {
    percent,
    dashOffset: arcLength * (1 - percent / 100),
    needleX: 32 + 20 * Math.cos(angle),
    needleY: 32 - 20 * Math.sin(angle),
  }
})

function memorySegmentStyle(percent: number | null, index: number) {
  const fill =
    percent === null ? 0 : Math.min(1, Math.max(0, percent / 10 - index))
  const isFilled = fill > 0
  return {
    background: isFilled
      ? 'var(--glow)'
      : 'color-mix(in srgb, var(--text-primary) 12%, transparent)',
    opacity: isFilled ? (fill >= 1 ? 1 : 0.6) : 1,
    boxShadow:
      fill >= 1
        ? '0 0 8px color-mix(in srgb, var(--glow) 45%, transparent)'
        : 'none',
  }
}

/** Success rate reads out in the header, so it is not one of the tiles. */
const successRate = computed(() =>
  clampPercent(props.metrics?.api_success_rate)
)
const successColor = computed(() => rateColor(successRate.value))
</script>

<template>
  <ConsoleCard data-system-status-card stretch>
    <template #title>
      <div class="flex min-w-0 items-center gap-2">
        <h2 class="truncate text-sm font-semibold text-[var(--text-primary)]">
          {{ t('dashboard.systemStatus.title') }}
        </h2>
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
          :style="{
            background: `color-mix(in srgb, ${apiState.color} 14%, transparent)`,
            color: apiState.color,
          }"
          :data-status-reachable="statusReachable"
        >
          <span class="relative flex h-1.5 w-1.5">
            <span
              v-if="apiState.pulse"
              class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              :style="{ background: apiState.color }"
            />
            <span
              class="relative inline-flex h-1.5 w-1.5 rounded-full"
              :style="{ background: apiState.color }"
            />
          </span>
          <span>{{ apiState.label }}</span>
        </span>
      </div>
    </template>

    <template #action>
      <div class="flex items-center gap-2">
        <div class="text-right">
          <p class="text-[11px] leading-none text-[var(--text-tertiary)]">
            {{ t('dashboard.systemStatus.successRate') }}
          </p>
          <p
            class="mt-1 text-sm font-bold leading-none tabular-nums"
            :style="{ color: successColor }"
          >
            {{ successRate === null ? '--' : `${formatMetric(successRate)}%` }}
          </p>
        </div>
        <MiniRing
          :percent="successRate ?? 0"
          :color="successColor"
          :size="34"
          :indeterminate="successRate === null"
        />
      </div>
    </template>

    <div
      class="my-auto grid grid-cols-2 content-start gap-3 py-1"
      data-system-status-grid
    >
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="group relative flex h-[108px] min-w-0 flex-col overflow-hidden rounded-xl bg-[var(--surface-muted)] px-3 py-2.5 transition-colors duration-300 hover:bg-[var(--surface-hover)]"
        data-system-status-tile
        :data-metric="tile.key"
      >
        <div class="flex items-center justify-between gap-1.5">
          <p
            class="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]"
          >
            <ArrowUpDown
              v-if="tile.key === 'bandwidth'"
              :size="13"
              :stroke-width="1.8"
              aria-hidden="true"
              data-bandwidth-icon
            />
            <svg
              v-else-if="tile.icon"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="tile.icon" />
            </svg>
            <span class="truncate">{{ tile.label }}</span>
          </p>
          <span
            v-if="tile.percent !== null"
            class="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums"
            :style="{
              color: tile.color,
              background: `color-mix(in srgb, ${tile.color} 14%, transparent)`,
            }"
          >
            {{ Math.round(tile.percent) }}%
          </span>
        </div>

        <div
          v-if="tile.key === 'cpu'"
          class="mt-auto flex items-end justify-between gap-2 pt-2"
          data-cpu-gauge
        >
          <p class="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
            <span
              class="whitespace-nowrap text-xl font-bold leading-none tabular-nums"
              :style="{ color: tile.color }"
            >
              {{ tile.value }}
            </span>
            <span
              v-if="tile.unit"
              class="text-[10px] text-[var(--text-tertiary)]"
            >
              {{ tile.unit }}
            </span>
          </p>
          <svg
            class="h-9 w-16 shrink-0"
            viewBox="0 0 64 38"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 32a24 24 0 0 1 48 0"
              stroke="color-mix(in srgb, var(--text-primary) 12%, transparent)"
              stroke-width="4"
              stroke-linecap="round"
            />
            <path
              v-if="cpuGauge.percent !== null"
              d="M8 32a24 24 0 0 1 48 0"
              :stroke="tile.color"
              stroke-width="4"
              stroke-linecap="round"
              :stroke-dasharray="Math.PI * 24"
              :stroke-dashoffset="cpuGauge.dashOffset"
              data-cpu-gauge-active
            />
            <line
              v-if="cpuGauge.percent !== null"
              x1="32"
              y1="32"
              :x2="cpuGauge.needleX"
              :y2="cpuGauge.needleY"
              stroke="var(--text-primary)"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <circle cx="32" cy="32" r="3" fill="var(--text-primary)" />
          </svg>
        </div>

        <template v-else-if="tile.key === 'memory'">
          <p class="mt-auto flex items-baseline gap-1 pt-2">
            <span class="text-base font-bold leading-tight tabular-nums">
              {{ tile.value }}
            </span>
            <span
              v-if="tile.unit"
              class="text-[10px] text-[var(--text-tertiary)]"
            >
              {{ tile.unit }}
            </span>
          </p>
          <div
            class="mt-2 grid h-2 grid-cols-10 gap-1"
            data-memory-segments
            aria-hidden="true"
          >
            <span
              v-for="index in 10"
              :key="index"
              class="min-w-0 rounded-sm transition-[background,opacity,box-shadow] duration-500"
              :style="memorySegmentStyle(tile.percent, index - 1)"
            />
          </div>
        </template>

        <template v-else-if="tile.key === 'bandwidth'">
          <p
            class="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-2 text-xs font-bold leading-tight tabular-nums"
          >
            <template v-if="tile.bandwidth">
              <span
                data-bandwidth-direction="up"
                class="shrink-0 whitespace-nowrap"
                style="color: var(--accent)"
              >
                ↑{{ tile.bandwidth.up }}
              </span>
              <span
                data-bandwidth-direction="down"
                class="shrink-0 whitespace-nowrap"
                style="color: var(--glow)"
              >
                ↓{{ tile.bandwidth.down }}
              </span>
            </template>
            <span v-else class="text-[var(--text-tertiary)]">--</span>
          </p>
          <div v-if="tile.series" class="mt-1" data-bandwidth-sparkline>
            <MiniSparkline
              :points="tile.series.down"
              :secondary="tile.series.up"
              color="var(--glow)"
              secondary-color="var(--accent)"
              :height="28"
            />
          </div>
        </template>

        <div
          v-else
          class="mt-auto flex items-end justify-between gap-1.5 pt-2"
          data-disk-gauge
        >
          <p class="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
            <span
              class="text-sm font-bold leading-tight tabular-nums"
              :style="{ color: tile.color }"
            >
              {{ tile.value }}
            </span>
            <span
              v-if="tile.unit"
              class="text-[9px] text-[var(--text-tertiary)]"
            >
              {{ tile.unit }}
            </span>
          </p>
          <MiniRing
            :percent="tile.percent ?? 0"
            :color="tile.color"
            :size="36"
            :indeterminate="tile.percent === null"
          />
        </div>
      </div>
    </div>

    <div
      class="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3 text-xs"
    >
      <span class="flex items-center gap-1.5 text-[var(--text-tertiary)]">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01"
          />
        </svg>
        {{ t('dashboard.systemStatus.version') }}
      </span>
      <span class="font-mono text-[var(--text-secondary)]">{{
        versionLabel
      }}</span>
    </div>
  </ConsoleCard>
</template>
