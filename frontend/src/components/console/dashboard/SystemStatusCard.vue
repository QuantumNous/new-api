<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Tag,
  Wifi,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import type { SystemStatusSnapshot } from '@/api/systemStatus'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import MiniRing from '@/components/console/dashboard/MiniRing.vue'
import MiniSparkline from '@/components/console/dashboard/MiniSparkline.vue'
import type { SystemServiceState } from '@/composables/useSystemStatus'

const props = withDefaults(
  defineProps<{
    metrics?: SystemStatusSnapshot | null
    serviceState?: SystemServiceState
  }>(),
  { metrics: null, serviceState: 'offline' }
)

const { t, locale } = useI18n()

const apiState = computed(() => {
  if (props.serviceState === 'online') {
    return {
      color: 'var(--status-success)',
      label: t('dashboard.online'),
      pulse: true,
    }
  }
  if (props.serviceState === 'degraded') {
    return {
      color: 'var(--status-warning)',
      label: t('dashboard.degraded'),
      pulse: false,
    }
  }
  return {
    color: 'var(--status-danger)',
    label: t('dashboard.offline'),
    pulse: false,
  }
})

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, percent))
}

function loadColor(percent: number | null): string {
  if (percent === null) return 'var(--text-tertiary)'
  if (percent >= 90) return 'var(--status-danger)'
  if (percent >= 70) return 'var(--status-warning)'
  return 'var(--status-success)'
}

function rateColor(percent: number | null): string {
  if (percent === null) return 'var(--text-tertiary)'
  if (percent >= 99) return 'var(--status-success)'
  if (percent >= 95) return 'var(--status-warning)'
  return 'var(--status-danger)'
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits }).format(
    value
  )
}

function formatGiB(value: number): string {
  return formatNumber(value / 1024 ** 3, 1)
}

function formatMBPerSecond(value: number): string {
  return (value / 1_000_000).toFixed(2)
}

function usagePercent(
  used: number | null | undefined,
  total: number | null | undefined
): number | null {
  if (used === null || used === undefined || !total || total <= 0) return null
  return clampPercent((used / total) * 100)
}

interface MetricTile {
  key: string
  label: string
  icon: Component
  value: string
  unit: string
  percent: number | null
  series?: { down: number[]; up: number[] }
  color: string
}

const tiles = computed<MetricTile[]>(() => {
  const metrics = props.metrics
  const cpu = metrics?.cpu_percent ?? null
  const memoryPercent = usagePercent(
    metrics?.memory_used_bytes,
    metrics?.memory_total_bytes
  )
  const diskPercent = usagePercent(
    metrics?.disk_used_bytes,
    metrics?.disk_total_bytes
  )
  const hasMemory =
    metrics?.memory_used_bytes != null && metrics?.memory_total_bytes != null
  const hasDisk =
    metrics?.disk_used_bytes != null && metrics?.disk_total_bytes != null
  const hasNetwork =
    metrics?.network_tx_bytes_per_second != null &&
    metrics?.network_rx_bytes_per_second != null

  return [
    {
      key: 'cpu',
      label: t('dashboard.systemStatus.cpu'),
      icon: Cpu,
      value: cpu === null ? '--' : formatNumber(cpu, 1),
      unit: cpu === null ? '' : '%',
      percent: cpu === null ? null : clampPercent(cpu),
      color: loadColor(cpu === null ? null : clampPercent(cpu)),
    },
    {
      key: 'memory',
      label: t('dashboard.systemStatus.memory'),
      icon: MemoryStick,
      value: hasMemory
        ? `${formatGiB(metrics.memory_used_bytes!)} / ${formatGiB(metrics.memory_total_bytes!)}`
        : '--',
      unit: hasMemory ? 'GiB' : '',
      percent: memoryPercent,
      color: loadColor(memoryPercent),
    },
    {
      key: 'bandwidth',
      label: t('dashboard.systemStatus.bandwidth'),
      icon: Network,
      value: hasNetwork
        ? `↑${formatMBPerSecond(metrics.network_tx_bytes_per_second!)} ↓${formatMBPerSecond(metrics.network_rx_bytes_per_second!)}`
        : '--',
      unit: hasNetwork ? 'MB/s' : '',
      percent: null,
      series: metrics
        ? {
            down: metrics.network_series.map(
              (sample) => sample.rx_bytes_per_second / 1_000_000
            ),
            up: metrics.network_series.map(
              (sample) => sample.tx_bytes_per_second / 1_000_000
            ),
          }
        : undefined,
      color: 'var(--signal)',
    },
    {
      key: 'disk',
      label: t('dashboard.systemStatus.disk'),
      icon: HardDrive,
      value: hasDisk
        ? `${formatGiB(metrics.disk_used_bytes!)} / ${formatGiB(metrics.disk_total_bytes!)}`
        : '--',
      unit: hasDisk ? 'GiB' : '',
      percent: diskPercent,
      color: loadColor(diskPercent),
    },
  ]
})

const successRate = computed(() => props.metrics?.api_success_rate_24h ?? null)
const successProgress = computed(() =>
  successRate.value === null ? 0 : clampPercent(successRate.value)
)
const successColor = computed(() =>
  rateColor(successRate.value === null ? null : successProgress.value)
)
const versionLabel = computed(() => props.metrics?.version || '--')
</script>

<template>
  <ConsoleCard
    :title="t('dashboard.systemStatus.title')"
    data-system-status-card
    stretch
  >
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
            {{
              successRate === null ? '--' : `${formatNumber(successRate, 1)}%`
            }}
          </p>
        </div>
        <MiniRing
          :percent="successProgress"
          :color="successColor"
          :size="34"
          :indeterminate="successRate === null"
        />
      </div>
    </template>

    <div
      class="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5"
      :data-service-state="serviceState"
    >
      <span class="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Wifi :size="15" :stroke-width="2" aria-hidden="true" />
        {{ t('dashboard.systemStatus.apiService') }}
      </span>
      <span
        class="flex items-center gap-1.5 text-sm font-semibold"
        :style="{ color: apiState.color }"
      >
        <span class="relative flex h-2 w-2">
          <span
            v-if="apiState.pulse"
            class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            :style="{ background: apiState.color }"
          />
          <span
            class="relative inline-flex h-2 w-2 rounded-full"
            :style="{ background: apiState.color }"
          />
        </span>
        {{ apiState.label }}
      </span>
    </div>

    <div class="mb-4 mt-4 grid grow grid-cols-2 gap-3">
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="flex min-w-0 flex-col rounded-xl bg-[var(--surface-muted)] px-3 py-2.5"
      >
        <p
          class="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]"
        >
          <component
            :is="tile.icon"
            :size="13"
            :stroke-width="1.8"
            aria-hidden="true"
          />
          <span class="truncate">{{ tile.label }}</span>
        </p>
        <p class="mt-1 flex items-baseline gap-1 pb-2">
          <span
            class="truncate font-bold leading-tight tabular-nums"
            :class="tile.key === 'bandwidth' ? 'text-[13px]' : 'text-base'"
            :style="{ color: tile.color }"
            >{{ tile.value }}</span
          >
          <span
            v-if="tile.unit"
            class="text-[10px] text-[var(--text-tertiary)]"
            >{{ tile.unit }}</span
          >
        </p>
        <div v-if="tile.series" class="mt-auto" aria-hidden="true">
          <MiniSparkline
            :points="tile.series.down"
            :secondary="tile.series.up"
            color="var(--support)"
            secondary-color="var(--signal)"
            :height="26"
          />
        </div>
        <div
          v-else
          class="pencil-progress mt-auto flex h-1 overflow-hidden rounded-full bg-[var(--surface-solid)]"
          aria-hidden="true"
        >
          <div
            v-if="tile.percent !== null"
            class="h-full rounded-full transition-[width] duration-700"
            :style="{ width: `${tile.percent}%`, background: tile.color }"
          />
        </div>
      </div>
    </div>

    <div
      class="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3.5 text-xs"
    >
      <span class="flex items-center gap-1.5 text-[var(--text-tertiary)]">
        <Tag :size="13" :stroke-width="1.8" aria-hidden="true" />
        {{ t('dashboard.systemStatus.version') }}
      </span>
      <span
        class="min-w-0 break-all text-right font-mono text-[var(--text-secondary)]"
        >{{ versionLabel }}</span
      >
    </div>
  </ConsoleCard>
</template>
